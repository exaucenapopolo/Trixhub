import { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  if (!req.user.isAdmin) {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }
  next();
}
