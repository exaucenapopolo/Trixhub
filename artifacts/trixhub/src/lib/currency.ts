// Conversion automatique FCFA → devise locale selon le pays de l'utilisateur.
// Les taux INCLUENT les frais de paiement (le client final doit voir le montant exact qu'il paie).
// Référence donnée par le métier : 3 600 FCFA = 14 900 CDF (taux 4.139, inclut frais).
// Pour les autres devises, marge ~6-8% appliquée sur le taux interbancaire indicatif.

export type CountryName =
  | "Bénin" | "Burkina Faso" | "Cameroun" | "Côte d'Ivoire"
  | "Congo-Brazzaville" | "RD Congo" | "Gabon" | "Ghana"
  | "Guinée" | "Kenya" | "Mali" | "Niger" | "Nigeria"
  | "Rwanda" | "Sénégal" | "Togo" | "Tanzanie" | "Ouganda";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** Multiplicateur depuis FCFA (XOF). Inclut déjà les frais. */
  rate: number;
  /** Pas d'arrondi : on arrondit au multiple le plus proche pour avoir un montant "rond". */
  roundTo: number;
}

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  // Zone XOF (UEMOA)
  "Bénin": "XOF",
  "Burkina Faso": "XOF",
  "Côte d'Ivoire": "XOF",
  "Mali": "XOF",
  "Niger": "XOF",
  "Sénégal": "XOF",
  "Togo": "XOF",
  // Zone XAF (CEMAC)
  "Cameroun": "XAF",
  "Congo-Brazzaville": "XAF",
  "Gabon": "XAF",
  // Devises locales
  "RD Congo": "CDF",
  "Ghana": "GHS",
  "Guinée": "GNF",
  "Kenya": "KES",
  "Nigeria": "NGN",
  "Rwanda": "RWF",
  "Tanzanie": "TZS",
  "Ouganda": "UGX",
};

const CURRENCIES: Record<string, CurrencyInfo> = {
  XOF: { code: "XOF", symbol: "FCFA", rate: 1,                 roundTo: 1 },
  XAF: { code: "XAF", symbol: "FCFA", rate: 1,                 roundTo: 1 },
  CDF: { code: "CDF", symbol: "CDF",  rate: 14900 / 3600,      roundTo: 100 },   // ≈ 4.1389
  GHS: { code: "GHS", symbol: "GHS",  rate: 80 / 3600,         roundTo: 1 },     // ≈ 0.0222
  GNF: { code: "GNF", symbol: "GNF",  rate: 55000 / 3600,      roundTo: 500 },   // ≈ 15.28
  KES: { code: "KES", symbol: "KES",  rate: 870 / 3600,        roundTo: 10 },    // ≈ 0.2417
  NGN: { code: "NGN", symbol: "NGN",  rate: 9900 / 3600,       roundTo: 50 },    // ≈ 2.75
  RWF: { code: "RWF", symbol: "RWF",  rate: 8400 / 3600,       roundTo: 100 },   // ≈ 2.333
  TZS: { code: "TZS", symbol: "TZS",  rate: 15400 / 3600,      roundTo: 100 },   // ≈ 4.278
  UGX: { code: "UGX", symbol: "UGX",  rate: 23000 / 3600,      roundTo: 100 },   // ≈ 6.389
};

const FALLBACK: CurrencyInfo = CURRENCIES.XOF;

/**
 * Libellés lisibles des devises supportées (utilisés par exemple sur la page profil
 * pour laisser l'utilisateur consulter les correspondances).
 */
export const CURRENCY_LABELS: Record<string, string> = {
  XOF: "FCFA — Franc CFA (BCEAO / UEMOA)",
  XAF: "FCFA — Franc CFA (BEAC / CEMAC)",
  CDF: "CDF — Franc congolais",
  GHS: "GHS — Cedi ghanéen",
  GNF: "GNF — Franc guinéen",
  KES: "KES — Shilling kényan",
  NGN: "NGN — Naira nigérian",
  RWF: "RWF — Franc rwandais",
  TZS: "TZS — Shilling tanzanien",
  UGX: "UGX — Shilling ougandais",
};

export function getCurrencyForCountry(country?: string | null): CurrencyInfo {
  if (!country) return FALLBACK;
  const code = COUNTRY_TO_CURRENCY[country];
  if (!code) return FALLBACK;
  return CURRENCIES[code] ?? FALLBACK;
}

/** Convertit un montant FCFA en devise locale, arrondi à un multiple "propre". */
export function convertFromFcfa(amountFcfa: number, country?: string | null): { amount: number; currency: CurrencyInfo } {
  const currency = getCurrencyForCountry(country);
  const raw = amountFcfa * currency.rate;
  const rounded = Math.round(raw / currency.roundTo) * currency.roundTo;
  return { amount: rounded, currency };
}

/** Formate un nombre avec espace insécable comme séparateur de milliers (style FR). */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Affichage standard : "14 900 CDF" (devise locale).
 * Si la devise est XOF/XAF, affiche directement "3 600 FCFA".
 */
export function formatLocal(amountFcfa: number, country?: string | null): string {
  const { amount, currency } = convertFromFcfa(amountFcfa, country);
  return `${formatNumber(amount)} ${currency.symbol}`;
}

/**
 * Affichage avec équivalence FCFA en petit pour les utilisateurs hors zone CFA.
 * Exemple : "14 900 CDF (≈ 3 600 FCFA)" pour un Congolais.
 * Pour XOF/XAF on n'affiche que le montant principal.
 */
export function formatLocalWithFcfa(amountFcfa: number, country?: string | null): { primary: string; secondary: string | null } {
  const { amount, currency } = convertFromFcfa(amountFcfa, country);
  const primary = `${formatNumber(amount)} ${currency.symbol}`;
  if (currency.code === "XOF" || currency.code === "XAF") {
    return { primary, secondary: null };
  }
  return { primary, secondary: `≈ ${formatNumber(amountFcfa)} FCFA` };
}
