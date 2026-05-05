import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { asc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.get("/contacts", authenticate, async (req, res) => {
  if (!req.user?.isActivated) {
    return res.status(403).json({ error: "Compte non activé. Active ton compte pour accéder aux contacts." });
  }

  const users = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      phone: usersTable.phone,
      country: usersTable.country,
      isActivated: usersTable.isActivated,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(asc(usersTable.createdAt));

  return res.json({ contacts: users, total: users.length });
});

export default router;
