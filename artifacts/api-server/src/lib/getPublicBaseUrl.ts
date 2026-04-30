/**
 * Retourne le domaine public stable à utiliser pour construire des URLs
 * envoyées à l'extérieur (WhatsApp, email, etc.).
 *
 * Ordre de priorité :
 *  1. PUBLIC_BASE_URL          — override explicite (recommandé en production)
 *  2. REPLIT_DOMAINS           — domaines de production Replit (ex: trixhub.site)
 *  3. REPLIT_DEV_DOMAIN        — domaine de développement (fallback)
 *  4. req.protocol + req.host  — dernier recours (requiert le contexte de requête)
 */
export function getPublicBaseUrl(
  req?: { protocol: string; get: (h: string) => string | undefined },
): string {
  // 1. Override explicite
  const explicit = process.env.PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  // 2. Domaines de production Replit (comma-séparés)
  const replitDomains = process.env.REPLIT_DOMAINS || "";
  if (replitDomains) {
    const domains = replitDomains.split(",").map((d) => d.trim()).filter(Boolean);
    // Préférer le domaine trixhub.site, sinon prendre le premier
    const preferred =
      domains.find((d) => d.includes("trixhub.site")) || domains[0];
    if (preferred) return `https://${preferred}`;
  }

  // 3. Domaine de développement Replit (fallback dev)
  const devDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (devDomain) return `https://${devDomain}`;

  // 4. Dernier recours : construire depuis la requête en cours
  if (req) {
    const host = req.get("host") || "localhost";
    return `${req.protocol}://${host}`;
  }

  return "http://localhost";
}
