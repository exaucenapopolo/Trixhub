/**
 * URL publique du frontend Trixhub.
 *
 * En production / preview Vercel, PUBLIC_BASE_URL permet
 * de définir explicitement l'origine publique.
 *
 * La valeur par défaut correspond au frontend Vercel actuel.
 */
export function getPublicBaseUrl(_req?: unknown): string {
  const baseUrl = (
    process.env.PUBLIC_BASE_URL ||
    "https://trixhub.vercel.app"
  ).trim().replace(/\/$/, "");

  return baseUrl;
}