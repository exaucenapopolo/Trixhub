import { Request, Response, NextFunction } from "express";

/**
 * Middleware à placer APRÈS `authenticate`.
 * Bloque (HTTP 403) toute route qui exige un compte activé (qui a payé l'activation).
 * Le client (front) redirige déjà vers /activate, mais sans cette protection serveur,
 * un appel direct (curl, DevTools, autre client) pourrait contourner la garde et
 * accéder au tableau de bord, à l'équipe, aux missions, aux soldes, etc.
 *
 * Le code d'erreur "ACCOUNT_NOT_ACTIVATED" permet au front de détecter cette situation
 * et de rediriger l'utilisateur vers /activate proprement.
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
