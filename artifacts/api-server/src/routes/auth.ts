import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import { hashPassword, comparePassword, generateToken, generateReferralCode } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";
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
    createdAt: user.createdAt.toISOString(),
  };
}

function deriveDisplayName(email: string): string {
  const username = email.split("@")[0];
  return username.charAt(0).toUpperCase() + username.slice(1);
}

router.get("/auth/referrer/:code", async (req, res): Promise<void> => {
  const { code } = req.params;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.referralCode, code));
  if (!user) {
    res.status(404).json({ error: "Code de parrainage invalide" });
    return;
  }
  const displayName = user.displayName || deriveDisplayName(user.email);
  res.json({ displayName, referralCode: user.referralCode, country: user.country });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Données invalides" });
    return;
  }

  const { email, phone, country, password, referralCode } = parsed.data;
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
    const [ref] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (ref) referrer = ref;
  }

  const passwordHash = await hashPassword(password);
  const displayName = deriveDisplayName(emailLower);

  const tempCode = `TEMP${Date.now()}`;
  const [user] = await db.insert(usersTable).values({
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
  }).returning();

  const realCode = generateReferralCode(displayName, user.id);
  await db.update(usersTable).set({ referralCode: realCode }).where(eq(usersTable.id, user.id));

  await db.insert(balancesTable).values({
    userId: user.id,
    referralBalance: "0",
    taskBalance: "0",
    inactiveBalance: "0",
    withdrawnAmount: "0",
    spentAmount: "0",
  });

  // Credit inactive balance to referrers
  if (referrer) {
    await creditInactiveBalance(referrer, user, displayName, 1700, 1);

    if (referrer.referredByCode) {
      const [gr] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referrer.referredByCode));
      if (gr) {
        await creditInactiveBalance(gr, user, displayName, 700, 2);
        if (gr.referredByCode) {
          const [gg] = await db.select().from(usersTable).where(eq(usersTable.referralCode, gr.referredByCode));
          if (gg) await creditInactiveBalance(gg, user, displayName, 300, 3);
        }
      }
    }
  }

  const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id);
  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({ user: formatUser(updatedUser[0]), token });
});

async function creditInactiveBalance(
  beneficiary: typeof usersTable.$inferSelect,
  newUser: typeof usersTable.$inferSelect,
  newUserName: string,
  commission: number,
  level: number
) {
  const [bal] = await db.select().from(balancesTable).where(eq(balancesTable.userId, beneficiary.id));
  if (!bal) return;
  const current = parseFloat(bal.inactiveBalance ?? "0");
  await db.update(balancesTable)
    .set({ inactiveBalance: (current + commission).toFixed(2) })
    .where(eq(balancesTable.userId, beneficiary.id));
  await db.insert(transactionsTable).values({
    userId: beneficiary.id,
    type: `referral_l${level}_inactive`,
    amount: commission.toFixed(2),
    description: `Parrainage inactif N${level}: ${newUserName} (en attente d'activation)`,
    relatedUserId: newUser.id,
    level,
    status: "pending",
  });
}

router.post("/auth/login", async (req, res): Promise<void> => {
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

router.post("/auth/logout", authenticate, async (req, res): Promise<void> => {
  res.json({ success: true, message: "Déconnecté avec succès" });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }
  res.json(formatUser(user));
});

export default router;
