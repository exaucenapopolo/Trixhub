import { Request, Response, NextFunction } from "express";

const ADMIN_EMAILS = [
  "exaucenapopolo2@gmail.com",
  "mcexauofficiel@gmail.com",
];

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Non autorisé" });
    return;
  }
  if (!req.user.isAdmin && !ADMIN_EMAILS.includes(req.user.email)) {
    res.status(403).json({ error: "Réservé aux administrateurs" });
    return;
  }
  next();
}

export function isAdminUser(email: string, isAdmin: boolean): boolean {
  return isAdmin || ADMIN_EMAILS.includes(email);
}
