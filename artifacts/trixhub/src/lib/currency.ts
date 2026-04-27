export const CURRENCY_LABELS: Record<string, string> = {
  FCFA: "FCFA",
  XOF: "XOF",
  XAF: "XAF",
  EUR: "EUR (€)",
  USD: "USD ($)",
  GBP: "GBP (£)",
  CAD: "CAD ($)",
  CHF: "CHF",
  NGN: "NGN (₦)",
  GHS: "GHS (₵)",
  KES: "KES (KSh)",
  MAD: "MAD (DH)",
  TND: "TND (DT)",
  DZD: "DZD (DA)",
  ZAR: "ZAR (R)",
  EGP: "EGP (E£)",
  BRL: "BRL (R$)",
  INR: "INR (₹)",
  CNY: "CNY (¥)",
  AED: "AED (د.إ)",
};

export function convertAmount(fcfaAmount: number, exchangeRate: number): number {
  return fcfaAmount * exchangeRate;
}

export function formatCurrency(amount: number, currency: string, decimals = 0): string {
  const symbols: Record<string, string> = {
    EUR: "€", USD: "$", GBP: "£", CAD: "$", NGN: "₦", GHS: "₵", KES: "KSh",
    ZAR: "R", EGP: "E£", BRL: "R$", INR: "₹", CNY: "¥", AED: "د.إ",
  };

  const formatted = amount.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const symbol = symbols[currency];
  if (symbol) {
    return `${formatted} ${symbol}`;
  }
  return `${formatted} ${currency}`;
}

export function formatDualAmount(fcfaAmount: number, exchangeRate: number, currency: string): string {
  const fcfaStr = formatCurrency(fcfaAmount, "FCFA", 0);
  if (currency === "FCFA" || currency === "XOF" || currency === "XAF") {
    return fcfaStr;
  }
  const converted = convertAmount(fcfaAmount, exchangeRate);
  const convertedStr = formatCurrency(converted, currency, 2);
  return `${fcfaStr} (≈ ${convertedStr})`;
}
