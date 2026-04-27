import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, balancesTable, transactionsTable } from "@workspace/db";
import { hashPassword, comparePassword, generateToken, generateReferralCode } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";
import {
  RegisterBody,
  LoginBody,
  ActivateAccountBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    country: user.country,
    isActivated: user.isActivated,
    referralCode: user.referralCode,
    referredByCode: user.referredByCode ?? null,
    preferredCurrency: user.preferredCurrency,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { firstName, lastName, email, phone, country, password, referralCode } = parsed.data;

  const emailLower = email.toLowerCase().trim();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  if (existing) {
    res.status(409).json({ error: "Cette adresse email est déjà utilisée" });
    return;
  }

  let referrer: typeof usersTable.$inferSelect | undefined;
  if (referralCode) {
    const [ref] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    if (ref) {
      referrer = ref;
    }
  }

  const passwordHash = await hashPassword(password);

  const tempCode = `TEMP${Date.now()}`;
  const [user] = await db.insert(usersTable).values({
    firstName,
    lastName,
    email: emailLower,
    phone,
    country,
    passwordHash,
    referralCode: tempCode,
    referredByCode: referrer?.referralCode ?? null,
    isActivated: false,
    preferredCurrency: "FCFA",
  }).returning();

  const realCode = generateReferralCode(firstName, user.id);
  await db.update(usersTable).set({ referralCode: realCode }).where(eq(usersTable.id, user.id));

  await db.insert(balancesTable).values({
    userId: user.id,
    referralBalance: "0",
    taskBalance: "0",
    inactiveBalance: "0",
    withdrawnAmount: "0",
    spentAmount: "0",
  });

  if (referrer) {
    const referrerBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, referrer.id));
    if (referrerBalance.length > 0) {
      const currentInactive = parseFloat(referrerBalance[0].inactiveBalance ?? "0");
      const commission = 1700;
      await db.update(balancesTable)
        .set({ inactiveBalance: (currentInactive + commission).toFixed(2) })
        .where(eq(balancesTable.userId, referrer.id));

      await db.insert(transactionsTable).values({
        userId: referrer.id,
        type: "referral_l1_inactive",
        amount: commission.toFixed(2),
        description: `Parrainage inactif: ${firstName} ${lastName} (en attente d'activation)`,
        relatedUserId: user.id,
        level: 1,
        status: "pending",
      });
    }

    const grandReferrer = referrer.referredByCode
      ? await db.select().from(usersTable).where(eq(usersTable.referralCode, referrer.referredByCode))
      : [];

    if (grandReferrer.length > 0) {
      const gr = grandReferrer[0];
      const grBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, gr.id));
      if (grBalance.length > 0) {
        const currentInactive = parseFloat(grBalance[0].inactiveBalance ?? "0");
        const commission = 700;
        await db.update(balancesTable)
          .set({ inactiveBalance: (currentInactive + commission).toFixed(2) })
          .where(eq(balancesTable.userId, gr.id));

        await db.insert(transactionsTable).values({
          userId: gr.id,
          type: "referral_l2_inactive",
          amount: commission.toFixed(2),
          description: `Parrainage niveau 2 inactif: ${firstName} ${lastName}`,
          relatedUserId: user.id,
          level: 2,
          status: "pending",
        });

        if (gr.referredByCode) {
          const ggRef = await db.select().from(usersTable).where(eq(usersTable.referralCode, gr.referredByCode));
          if (ggRef.length > 0) {
            const gg = ggRef[0];
            const ggBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, gg.id));
            if (ggBalance.length > 0) {
              const currentInactive = parseFloat(ggBalance[0].inactiveBalance ?? "0");
              const commission = 300;
              await db.update(balancesTable)
                .set({ inactiveBalance: (currentInactive + commission).toFixed(2) })
                .where(eq(balancesTable.userId, gg.id));

              await db.insert(transactionsTable).values({
                userId: gg.id,
                type: "referral_l3_inactive",
                amount: commission.toFixed(2),
                description: `Parrainage niveau 3 inactif: ${firstName} ${lastName}`,
                relatedUserId: user.id,
                level: 3,
                status: "pending",
              });
            }
          }
        }
      }
    }
  }

  const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id);

  req.log.info({ userId: user.id }, "User registered");
  res.status(201).json({ user: formatUser(updatedUser[0]), token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
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

router.post("/auth/activate", authenticate, async (req, res): Promise<void> => {
  const parsed = ActivateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (user.isActivated) {
    res.status(400).json({ error: "Compte déjà activé" });
    return;
  }

  await db.update(usersTable).set({ isActivated: true }).where(eq(usersTable.id, user.id));

  const balance = await db.select().from(balancesTable).where(eq(balancesTable.userId, user.id));
  if (balance.length > 0) {
    const spent = parseFloat(balance[0].spentAmount ?? "0") + 3600;
    await db.update(balancesTable)
      .set({ spentAmount: spent.toFixed(2) })
      .where(eq(balancesTable.userId, user.id));
  }

  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "activation",
    amount: "-3600",
    description: "Activation du compte TRIXHUB",
    status: "completed",
  });

  if (user.referredByCode) {
    const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, user.referredByCode));
    if (referrer) {
      const refBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, referrer.id));
      if (refBalance.length > 0) {
        const currentInactive = parseFloat(refBalance[0].inactiveBalance ?? "0");
        const currentReferral = parseFloat(refBalance[0].referralBalance ?? "0");
        const commission = 1700;
        const newInactive = Math.max(0, currentInactive - commission);
        await db.update(balancesTable)
          .set({
            inactiveBalance: newInactive.toFixed(2),
            referralBalance: (currentReferral + commission).toFixed(2),
          })
          .where(eq(balancesTable.userId, referrer.id));

        await db.update(transactionsTable)
          .set({ status: "completed", description: `Commission niveau 1: ${user.firstName} ${user.lastName} activé` })
          .where(eq(transactionsTable.userId, referrer.id))
          .where(eq(transactionsTable.relatedUserId, user.id));

        await db.insert(transactionsTable).values({
          userId: referrer.id,
          type: "referral_l1",
          amount: commission.toFixed(2),
          description: `Commission niveau 1: ${user.firstName} ${user.lastName} a activé son compte`,
          relatedUserId: user.id,
          level: 1,
          status: "completed",
        });
      }

      if (referrer.referredByCode) {
        const [gr] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referrer.referredByCode));
        if (gr) {
          const grBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, gr.id));
          if (grBalance.length > 0) {
            const currentInactive = parseFloat(grBalance[0].inactiveBalance ?? "0");
            const currentReferral = parseFloat(grBalance[0].referralBalance ?? "0");
            const commission = 700;
            const newInactive = Math.max(0, currentInactive - commission);
            await db.update(balancesTable)
              .set({
                inactiveBalance: newInactive.toFixed(2),
                referralBalance: (currentReferral + commission).toFixed(2),
              })
              .where(eq(balancesTable.userId, gr.id));

            await db.insert(transactionsTable).values({
              userId: gr.id,
              type: "referral_l2",
              amount: commission.toFixed(2),
              description: `Commission niveau 2: ${user.firstName} ${user.lastName} activé`,
              relatedUserId: user.id,
              level: 2,
              status: "completed",
            });
          }

          if (gr.referredByCode) {
            const [gg] = await db.select().from(usersTable).where(eq(usersTable.referralCode, gr.referredByCode));
            if (gg) {
              const ggBalance = await db.select().from(balancesTable).where(eq(balancesTable.userId, gg.id));
              if (ggBalance.length > 0) {
                const currentInactive = parseFloat(ggBalance[0].inactiveBalance ?? "0");
                const currentReferral = parseFloat(ggBalance[0].referralBalance ?? "0");
                const commission = 300;
                const newInactive = Math.max(0, currentInactive - commission);
                await db.update(balancesTable)
                  .set({
                    inactiveBalance: newInactive.toFixed(2),
                    referralBalance: (currentReferral + commission).toFixed(2),
                  })
                  .where(eq(balancesTable.userId, gg.id));

                await db.insert(transactionsTable).values({
                  userId: gg.id,
                  type: "referral_l3",
                  amount: commission.toFixed(2),
                  description: `Commission niveau 3: ${user.firstName} ${user.lastName} activé`,
                  relatedUserId: user.id,
                  level: 3,
                  status: "completed",
                });
              }
            }
          }
        }
      }
    }
  }

  const updatedUser = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const token = generateToken(user.id);

  req.log.info({ userId: user.id }, "Account activated");
  res.json({ user: formatUser(updatedUser[0]), token });
});

export default router;
