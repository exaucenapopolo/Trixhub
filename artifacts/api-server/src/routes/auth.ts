import { Router, type IRouter, type Request, type Response } from "express";
import { sendWelcomeEmail } from "../lib/email";
import { eq, or, sql } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import { hashPassword, comparePassword, generateToken, generateReferralCode } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";
import { authLimiter } from "../middlewares/rateLimiters";
import {
  RegisterBody,
  LoginBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    isActivated: user.isActivated,
    isAdmin: user.isAdmin,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode ?? null,
    preferredCurrency: user.preferredCurrency,
    themePreference: user.themePreference,
    canvaRequestedAt: user.canvaRequestedAt ? user.canvaRequestedAt.toISOString() : null,
    formationRequestedAt: user.formationRequestedAt ? user.formationRequestedAt.toISOString() : null,
    formationRequestedTitle: user.formationRequestedTitle ?? null,
    avatarUrl: user.avatarUrl ?? null,
    phoneVisible: user.phoneVisible,
    blockedActivities: user.blockedActivities,
    blockedFormations: user.blockedFormations,
    blockedCanva: user.blockedCanva,
    blockedContacts: user.blockedContacts,
    blockedReferral: user.blockedReferral,
    isFreeAccount: user.isFreeAccount,
    activationCredit: user.activationCredit,
    freeAccountDebt: user.freeAccountDebt,
    createdAt: user.createdAt.toISOString(),
  };
}

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

router.get("/auth/referrer/:code", async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params;
  const codeStr = Array.isArray(code) ? code[0] : code;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.referralCode, codeStr));
  if (!user) {
    res.status(404).json({ error: "Code de parrainage invalide" });
    return;
  }
  const displayName = user.displayName || deriveDisplayName(user.email);
  res.json({ displayName, referralCode: user.referralCode, country: user.country });
});

router.post("/auth/register", authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const { email, phone, country, password, referralCode, phoneVisible } = parsed.data;
  const emailLower = email.toLowerCase().trim();
  const phoneClean = phone.trim();

  const existingByEmail = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailLower));
  if (existingByEmail.length > 0) {
    res.status(409).json({ error: "Cette adresse email est déjà utilisée" });
    return;
  }

  const existingByPhone = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phoneClean));
  if (existingByPhone.length > 0) {
    res.status(409).json({ error: "Ce numéro de téléphone est déjà utilisé" });
    return;
  }

  let referrer: typeof usersTable.$inferSelect | undefined;
  if (referralCode) {
    const codeStr = typeof referralCode === "string" ? referralCode : Array.isArray(referralCode) ? referralCode[0] : String(referralCode);
    const [ref] = await db.select().from(usersTable).where(eq(usersTable.referralCode, codeStr));
    if (ref) referrer = ref;
  }

  const passwordHash = await hashPassword(password);
  const displayName = deriveDisplayName(emailLower);

  let finalUser: typeof usersTable.$inferSelect;
  try {
    finalUser = await db.transaction(async (tx) => {
      const tempCode = `TEMP${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx.insert(usersTable).values({
        displayName,
        email: emailLower,
        phone: phoneClean,
        country,
        passwordHash,
        referralCode: tempCode,
        referredByCode: referrer?.referralCode ?? null,
        isActivated: false,
        preferredCurrency: "FCFA",
        themePreference: "light",
        phoneVisible: phoneVisible ?? false,
      }).returning();

      const realCode = generateReferralCode(displayName, user.id);
      const [withCode] = await tx.update(usersTable)
        .set({ referralCode: realCode })
        .where(eq(usersTable.id, user.id))
        .returning();

      await tx.insert(balancesTable).values({
        userId: user.id,
        referralBalance: "0",
        taskBalance: "0",
        inactiveBalance: "0",
        withdrawnAmount: "0",
        spentAmount: "0",
      });

      if (referrer) {
        await creditInactiveBalanceTx(tx, referrer, withCode, displayName, 1700, 1, req);

        if (referrer.referredByCode) {
          const [gr] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referrer.referredByCode));
          if (!gr) {
            req.log.warn({ code: referrer.referredByCode, level: 2, newUserId: user.id }, "[auth/register] N2 referrer introuvable, commission ignorée (dérive de données)");
          } else {
            await creditInactiveBalanceTx(tx, gr, withCode, displayName, 700, 2, req);
            if (gr.referredByCode) {
              const [gg] = await db.select().from(usersTable).where(eq(usersTable.referralCode, gr.referredByCode));
              if (!gg) {
                req.log.warn({ code: gr.referredByCode, level: 3, newUserId: user.id }, "[auth/register] N3 referrer introuvable, commission ignorée (dérive de données)");
              } else {
                await creditInactiveBalanceTx(tx, gg, withCode, displayName, 200, 3, req);
              }
            }
          }
        }
      }

      return withCode;
    });
  } catch (err) {
    req.log.error({ err, email: emailLower }, "[auth/register] transaction rollbackée");
    res.status(500).json({ error: "Erreur lors de la création du compte" });
    return;
  }

  const token = generateToken(finalUser.id);
  req.log.info({ userId: finalUser.id }, "User registered");
  sendWelcomeEmail(finalUser).catch((err) => req.log.warn({ err }, "Email bienvenue échoué"));
  res.status(201).json({ user: formatUser(finalUser), token });
});

type AuthTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function creditInactiveBalanceTx(
  tx: AuthTx,
  beneficiary: typeof usersTable.$inferSelect,
  newUser: typeof usersTable.$inferSelect,
  newUserName: string,
  commission: number,
  level: number,
  req: Request,
) {
  await tx.insert(balancesTable).values({ userId: beneficiary.id }).onConflictDoNothing();

  const updated = await tx.update(balancesTable)
    .set({ inactiveBalance: sql`${balancesTable.inactiveBalance} + ${commission}` })
    .where(eq(balancesTable.userId, beneficiary.id))
    .returning();
  if (updated.length === 0) {
    throw new Error(`MISSING_BALANCE_ROW_AFTER_UPSERT user=${beneficiary.id}`);
  }

  await tx.insert(transactionsTable).values({
    userId: beneficiary.id,
    type: `referral_l${level}_inactive`,
    amount: commission.toFixed(2),
    description: `Parrainage inactif N${level}: ${newUserName} (en attente d'activation)`,
    relatedUserId: newUser.id,
    level,
    status: "pending",
  });
}

router.post("/auth/login", authLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const { email, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  if (!user) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Votre compte a été suspendu" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    req.log.warn({ email: emailLower }, "Failed login attempt");
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const token = generateToken(user.id);
  req.log.info({ userId: user.id }, "User logged in");
  res.json({ user: formatUser(user), token });
});

router.post("/auth/choose-free-account", authenticate, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) { res.status(401).json({ error: "Utilisateur introuvable" }); return; }
  if (user.isActivated) { res.status(400).json({ error: "Ton compte est déjà activé" }); return; }
  if (user.isFreeAccount) { res.status(400).json({ error: "Tu as déjà choisi l'option compte gratuit" }); return; }

  const [updated] = await db
    .update(usersTable)
    .set({
      isFreeAccount: true,
      blockedActivities: true,
      blockedFormations: true,
      blockedCanva: true,
    })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  req.log.info({ userId: req.userId }, "[auth] compte gratuit activé");
  res.json({ user: formatUser(updated) });
});

router.post("/auth/logout", authenticate, async (req: Request, res: Response): Promise<void> => {
  res.json({ success: true, message: "Déconnecté avec succès" });
});

router.get("/auth/me", authenticate, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  if (!user.lastLoginAt || user.lastLoginAt < thirtyMinAgo) {
    db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id)).execute().catch(() => {});
  }
  res.json(formatUser(user));
});

export default router;
