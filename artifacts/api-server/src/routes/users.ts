import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, usersTable, balancesTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { requireActivation } from "../middlewares/requireActivation";
import { getRates } from "../lib/currency";
import { claimDailyBonusIfDue, DAILY_BONUS } from "../lib/dailyBonus";
import {
  uploadAvatarImage,
  deleteAvatarObject,
  getPublicAvatarUrl,
  ALLOWED_AVATAR_TYPES,
  AVATAR_MAX_SIZE,
} from "../lib/uploadAvatar";

const router: IRouter = Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_SIZE, files: 1 },
});

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
    createdAt: user.createdAt.toISOString(),
  };
}

async function getLevel1Members(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return [];
  return db.select().from(usersTable).where(eq(usersTable.referredByCode, user.referralCode));
}

async function getLevel2Members(userId: number) {
  const l1 = await getLevel1Members(userId);
  const l2: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l1) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l2.push(...members);
  }
  return l2;
}

async function getLevel3Members(userId: number) {
  const l2 = await getLevel2Members(userId);
  const l3: (typeof usersTable.$inferSelect)[] = [];
  for (const m of l2) {
    const members = await db.select().from(usersTable).where(eq(usersTable.referredByCode, m.referralCode));
    l3.push(...members);
  }
  return l3;
}

router.get("/users/me/dashboard", authenticate, requireActivation, async (req, res): Promise<void> => {
  const userId = req.userId!;

  // Bonus de connexion quotidien : crédite +5 FCFA si pas déjà attribué aujourd'hui (atomique)
  const dailyBonusClaimed = await claimDailyBonusIfDue(userId, req.log);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  const [balance] = await db.select().from(balancesTable).where(eq(balancesTable.userId, userId));
  const referralBalance = parseFloat(balance?.referralBalance ?? "0");
  const taskBalance = parseFloat(balance?.taskBalance ?? "0");
  const activityBalance = parseFloat(balance?.activityBalance ?? "0");
  const bonusBalance = parseFloat(balance?.bonusBalance ?? "0");
  const depositBalance = parseFloat(balance?.depositBalance ?? "0");
  const inactiveBalance = parseFloat(balance?.inactiveBalance ?? "0");
  const withdrawnAmount = parseFloat(balance?.withdrawnAmount ?? "0");
  const spentAmount = parseFloat(balance?.spentAmount ?? "0");
  const totalBalance = referralBalance + taskBalance + activityBalance + bonusBalance + depositBalance;

  const l1 = await getLevel1Members(userId);
  const l2 = await getLevel2Members(userId);
  const l3 = await getLevel3Members(userId);
  const all = [...l1, ...l2, ...l3];

  const rates = getRates();
  const currency = user.preferredCurrency;
  const exchangeRate = rates[currency] ?? 1;

  // Parrain (sponsor) — celui qui a invité cet utilisateur
  let sponsor: { displayName: string | null; email: string; referralCode: string; avatarUrl: string | null } | null = null;
  if (user.referredByCode) {
    const [sp] = await db
      .select({ displayName: usersTable.displayName, email: usersTable.email, referralCode: usersTable.referralCode, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.referralCode, user.referredByCode));
    if (sp) sponsor = sp;
  }

  res.json({
    totalBalance, referralBalance, taskBalance, activityBalance, bonusBalance, depositBalance,
    withdrawnAmount, spentAmount, inactiveBalance,
    totalReferrals: all.length,
    activeReferrals: all.filter(m => m.isActivated).length,
    inactiveReferrals: all.filter(m => !m.isActivated).length,
    level1Count: l1.length,
    level2Count: l2.length,
    level3Count: l3.length,
    pendingWithdrawals: 0,
    dailyBonusClaimed,
    dailyBonusAmount: DAILY_BONUS,
    currency,
    exchangeRate,
    sponsor: sponsor
      ? {
          name: sponsor.displayName ?? sponsor.email.split("@")[0],
          referralCode: sponsor.referralCode,
          avatarUrl: sponsor.avatarUrl ? getPublicAvatarUrl(req, sponsor.avatarUrl) : null,
        }
      : null,
  });
});

router.patch("/users/me", authenticate, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof body.displayName === "string") updates.displayName = body.displayName;
  if (typeof body.phone === "string") updates.phone = body.phone;
  if (typeof body.country === "string") updates.country = body.country;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Aucune donnée à mettre à jour" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

router.patch("/users/me/preferred-currency", authenticate, async (req, res): Promise<void> => {
  const { currency } = req.body as { currency?: string };
  if (!currency || typeof currency !== "string") {
    res.status(400).json({ error: "Devise invalide" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ preferredCurrency: currency })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

router.patch("/users/me/theme", authenticate, async (req, res): Promise<void> => {
  const { theme } = req.body as { theme?: string };
  if (!theme || !["light", "dark"].includes(theme)) {
    res.status(400).json({ error: "Thème invalide (light ou dark)" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ themePreference: theme })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(formatUser(updated));
});

/**
 * POST /users/me/avatar (multipart, field "file")
 * Upload une nouvelle photo de profil. Limite 3 Mo, formats png/jpg/webp.
 * L'ancien avatar est supprimé en best-effort après mise à jour réussie.
 */
router.post("/users/me/avatar", authenticate, (req: Request, res: Response): void => {
  avatarUpload.single("file")(req, res, (uploadErr: unknown) => {
    void (async () => {
      if (uploadErr) {
        const msg =
          (uploadErr as { code?: string }).code === "LIMIT_FILE_SIZE"
            ? "Fichier trop volumineux (max 3 Mo)"
            : "Échec du téléversement";
        res.status(400).json({ error: msg });
        return;
      }
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file || !file.buffer || file.buffer.length === 0) {
        res.status(400).json({ error: "Aucun fichier fourni" });
        return;
      }
      if (!ALLOWED_AVATAR_TYPES.includes(file.mimetype)) {
        res.status(400).json({ error: "Format non supporté (png, jpg ou webp uniquement)" });
        return;
      }

      const userId = req.userId!;
      let uploadedPath: string | null = null;
      try {
        // Upload du nouvel avatar
        const { objectPath } = await uploadAvatarImage({
          buffer: file.buffer,
          contentType: file.mimetype,
          userId,
        });
        uploadedPath = objectPath;

        // Récupère l'ancien avatar pour suppression best-effort APRÈS update OK
        const [previous] = await db
          .select({ avatarUrl: usersTable.avatarUrl })
          .from(usersTable)
          .where(eq(usersTable.id, userId));

        const [updated] = await db
          .update(usersTable)
          .set({ avatarUrl: objectPath })
          .where(eq(usersTable.id, userId))
          .returning();

        if (!updated) {
          // Rollback: l'utilisateur n'existe plus, on supprime l'objet uploadé
          void deleteAvatarObject(objectPath, req.log);
          uploadedPath = null;
          res.status(404).json({ error: "Utilisateur introuvable" });
          return;
        }

        // Best-effort: supprime l'ancien avatar (si différent)
        if (previous?.avatarUrl && previous.avatarUrl !== objectPath) {
          void deleteAvatarObject(previous.avatarUrl, req.log);
        }

        res.json(formatUser(updated));
      } catch (err) {
        // Rollback global: si on a uploadé l'objet mais que la DB a planté,
        // supprimer l'objet orphelin pour éviter une fuite de stockage.
        if (uploadedPath) {
          void deleteAvatarObject(uploadedPath, req.log);
        }
        req.log.error({ err, uploadedPath }, "Avatar upload failed");
        res.status(500).json({ error: "Échec du téléversement de l'avatar" });
      }
    })();
  });
});

/**
 * DELETE /users/me/avatar
 * Supprime la photo de profil de l'utilisateur (DB + Object Storage best-effort).
 */
router.delete("/users/me/avatar", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const [previous] = await db
    .select({ avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl: null })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (previous?.avatarUrl) {
    void deleteAvatarObject(previous.avatarUrl);
  }

  res.json(formatUser(updated));
});

export default router;
