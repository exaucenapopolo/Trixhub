import { Request, Response, NextFunction } from "express";

/**
 * Middleware à placer APRÈS `authenticate`.
 * Bloque (HTTP 403) toute route qui exige un compte activé (qui a payé l'activation).
 */
export function requireActivation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Non autorisé", code: "UNAUTHENTICATED" });
    return;
  }

  if (!req.user.isActivated) {
    res.status(403).json({
      error: "Votre compte doit être activé pour accéder à cette fonctionnalité.",
      code: "ACCOUNT_NOT_ACTIVATED",
    });
    return;
  }

  next();
}

/**
 * Variante qui autorise aussi les comptes gratuits (isFreeAccount = true).
 * Utilisée pour les routes auxquelles les comptes gratuits ont aussi accès
 * (ex : activer un filleul, faire un dépôt).
 */
export function requireActivationOrFreeAccount(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Non autorisé", code: "UNAUTHENTICATED" });
    return;
  }

  if (!req.user.isActivated && !req.user.isFreeAccount) {
    res.status(403).json({
      error: "Votre compte doit être activé pour accéder à cette fonctionnalité.",
      code: "ACCOUNT_NOT_ACTIVATED",
    });
    return;
  }

  next();
}
