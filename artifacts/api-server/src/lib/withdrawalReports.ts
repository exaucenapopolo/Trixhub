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

/**
 * Envoie un rapport WhatsApp à l'assistance pour la création d'un retrait.
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
    `── Membre ──\n` +
    `🪪 ${user.displayName || "—"}\n` +
    `📧 ${user.email}\n` +
    `📱 ${user.phone}\n` +
    `🌍 ${user.country}\n` +
    `🔗 Code : ${user.referralCode}\n\n` +
    `🕐 ${new Date(w.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Envoie un rapport de changement de statut.
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
    `\n── Membre ──\n` +
    `🪪 ${user.displayName || "—"}\n` +
    `📧 ${user.email}\n` +
    `📱 ${user.phone}\n` +
    `🌍 ${user.country}`;
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
    `🕐 ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}`;
  return sendWhatsAppToAssistance(message);
}
