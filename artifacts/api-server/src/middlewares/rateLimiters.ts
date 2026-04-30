import rateLimit from "express-rate-limit";

const rateLimitMessage = (message: string) => ({
  success: false,
  error: message,
});

// Limiter sur les routes d'authentification (login, register, otp...)
// 15 tentatives par 15 minutes par IP — protège contre le brute-force de mots de passe.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage(
    "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
  ),
});

// Limiter sur l'initiation de paiement
// 10 demandes par 10 minutes par IP — évite le spam de liens de paiement.
export const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage(
    "Trop de tentatives de paiement. Réessayez dans 10 minutes.",
  ),
});

// Limiter sur les demandes de retrait
// 5 demandes par heure par IP — protège contre les demandes automatisées de retrait.
export const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: rateLimitMessage(
    "Trop de demandes de retrait. Réessayez dans une heure.",
  ),
});
