import { sendWhatsAppToAssistance } from "./twilio";
import type { Withdrawal, User } from "@workspace/db";

const METHOD_LABELS: Record<string, string> = {
  orange_money: "Orange Money",
  mtn_money: "MTN Mobile Money",
  wave: "Wave",
  moov: "Moov Money",
  free_money: "Free Money",
  airtel_money: "Airtel Money",
  mpesa: "M-Pesa",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "🟡 EN ATTENTE",
  processing: "🔵 EN TRAITEMENT",
  completed: "✅ CONFIRMÉ",
  rejected: "❌ ÉCHOUÉ / REJETÉ",
};

const SOURCE_LABELS: Record<string, string> = {
  referral: "Solde parrainage",
  task: "Solde missions",
};

function fmtAmount(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

function memberBlock(user: User): string {
  return (
    `── Membre ──\n` +
    `🪪 ${user.displayName || "—"}\n` +
    `📧 ${user.email}\n` +
    `📱 ${user.phone}\n` +
    `🌍 ${user.country}\n` +
    `🔗 Code : ${user.referralCode}`
  );
}

function now(): string {
  return new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
}

/**
 * Retraits missions (flux manuel) — notifie l'admin à la création.
 * Pour les retraits parrainage automatiques, utiliser reportPayoutSuccess ou reportPayoutFailed.
 */
export async function reportWithdrawalCreated(w: Withdrawal, user: User) {
  const message =
    `💸 NOUVEAU RETRAIT — #${w.id}\n` +
    `${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `💰 Montant : ${fmtAmount(w.amount)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n\n` +
    memberBlock(user) + "\n\n" +
    `🕐 ${now()}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Retrait parrainage automatique : AccountPE a accepté ou traitement lancé (pending).
 * Envoyé uniquement après confirmation de AccountPE.
 */
export async function reportPayoutSuccess(
  w: Withdrawal,
  user: User,
  payoutRef: string,
  payoutStatus: "pending" | "success",
  amountSent: number,
  fee: number,
) {
  const statusLine = payoutStatus === "success"
    ? "✅ PAIEMENT CONFIRMÉ PAR ACCOUNTPE"
    : "🔵 PAIEMENT INITIÉ — EN COURS DE TRAITEMENT";

  const message =
    `💸 RETRAIT AUTOMATIQUE — #${w.id}\n` +
    `${statusLine}\n\n` +
    `💰 Montant demandé : ${fmtAmount(w.amount)}\n` +
    `💸 Montant envoyé à l'utilisateur : ${fmtAmount(amountSent)}\n` +
    `🏷️ Frais prélevés : ${fmtAmount(fee)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n` +
    `🔑 Réf. AccountPE : ${payoutRef}\n\n` +
    memberBlock(user) + "\n\n" +
    `🕐 ${now()}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Retrait parrainage automatique : AccountPE a refusé ou erreur.
 * Le solde de l'utilisateur a été restitué automatiquement.
 */
export async function reportPayoutFailed(
  w: Withdrawal,
  user: User,
  rawError: string,
  isInsufficientFunds: boolean,
  amountRequested: number,
  totalDebited: number,
) {
  const reason = isInsufficientFunds
    ? "⚠️ SOLDE INSUFFISANT DANS LE PORTEFEUILLE ACCOUNTPE"
    : "❌ ERREUR TECHNIQUE ACCOUNTPE";

  const message =
    `🚨 RETRAIT ÉCHOUÉ — #${w.id}\n` +
    `${reason}\n\n` +
    `💰 Montant réclamé : ${fmtAmount(amountRequested)}\n` +
    `💵 Total qui aurait été débité : ${fmtAmount(totalDebited)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n\n` +
    (isInsufficientFunds
      ? `⚡ ACTION REQUISE : recharger le portefeuille AccountPE avant de traiter d'autres retraits.\n\n`
      : `🔍 Erreur brute : ${rawError.slice(0, 300)}\n\n`) +
    `♻️ Solde de l'utilisateur restitué automatiquement.\n\n` +
    memberBlock(user) + "\n\n" +
    `🕐 ${now()}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Envoie un rapport de changement de statut (flux admin manuel).
 */
export async function reportWithdrawalStatusChange(w: Withdrawal, user: User, previousStatus: string, reason?: string | null) {
  const message =
    `🔄 STATUT RETRAIT — #${w.id}\n` +
    `${STATUS_LABELS[previousStatus] ?? previousStatus}  →  ${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `💰 Montant : ${fmtAmount(w.amount)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n` +
    (reason ? `\n📝 Motif : ${reason}\n` : "") +
    `\n` + memberBlock(user);
  return sendWhatsAppToAssistance(message);
}

/**
 * Envoie la preuve de paiement (lien vers la capture d'écran) à l'assistance.
 */
export async function reportWithdrawalProof(w: Withdrawal, user: User, publicUrl: string) {
  const message =
    `📸 PREUVE DE PAIEMENT — Retrait #${w.id}\n\n` +
    `💰 Montant : ${fmtAmount(w.amount)}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 ${user.displayName} (${user.email})\n` +
    `📱 ${user.phone}\n\n` +
    `🔗 Capture d'écran :\n${publicUrl}\n\n` +
    `🕐 ${now()}`;
  return sendWhatsAppToAssistance(message);
}
