import { sendWhatsAppToAssistance } from "./twilio";
import type { ActivityWithdrawal, User } from "@workspace/db";

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
  pending: "🟡 EN ATTENTE — À VÉRIFIER",
  approved: "🟢 APPROUVÉ",
  paid: "✅ PAYÉ",
  rejected: "❌ REJETÉ",
};

function fmtAmount(amount: string | number): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

/**
 * Notification admin : nouvelle demande de retrait du solde activité.
 * Souligne explicitement la nécessité de VÉRIFIER l'utilisateur (anti-fraude).
 */
export async function reportActivityWithdrawalCreated(w: ActivityWithdrawal, user: User) {
  const message =
    `🎯 RETRAIT ACTIVITÉ — #${w.id}\n` +
    `${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `⚠️  VÉRIFIER FRAUDE AVANT VALIDATION\n\n` +
    `💰 Montant : ${fmtAmount(w.amount)}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n` +
    `🌍 Pays : ${w.country ?? "—"}\n\n` +
    `── Membre ──\n` +
    `🪪 ${user.displayName || "—"}\n` +
    `📧 ${user.email}\n` +
    `📱 ${user.phone}\n` +
    `🌍 ${user.country}\n` +
    `🔗 Code : ${user.referralCode}\n` +
    `🆔 User ID : ${user.id}\n\n` +
    `🕐 ${new Date(w.createdAt).toLocaleString("fr-FR", { timeZone: "Africa/Douala" })}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Notification admin : changement de statut d'un retrait activité.
 */
export async function reportActivityWithdrawalStatusChange(
  w: ActivityWithdrawal,
  user: User,
  previousStatus: string,
) {
  const message =
    `🔄 RETRAIT ACTIVITÉ — #${w.id}\n` +
    `${STATUS_LABELS[previousStatus] ?? previousStatus}  →  ${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `💰 Montant : ${fmtAmount(w.amount)}\n` +
    `📞 N° : ${w.accountNumber}\n` +
    `👤 ${w.accountName}\n` +
    (w.adminNote ? `\n📝 Note admin : ${w.adminNote}\n` : "") +
    (w.rejectionReason ? `\n❌ Motif rejet : ${w.rejectionReason}\n` : "") +
    `\n── Membre ──\n` +
    `🪪 ${user.displayName || "—"}\n` +
    `📧 ${user.email}\n` +
    `📱 ${user.phone}`;
  return sendWhatsAppToAssistance(message);
}
