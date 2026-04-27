import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      // L'utilisateur complet est mis à disposition pour éviter une seconde requête
      // dans les routes (et permettre au middleware requireActivation de l'utiliser).
      user?: User;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: "Token invalide ou expiré" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Compte suspendu" });
    return;
  }

  req.userId = user.id;
  req.user = user;
  next();
}
