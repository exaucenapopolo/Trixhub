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

function fmtDate(d: Date | string | null | undefined, fallback = "—"): string {
  if (!d) return fallback;
  return new Date(d).toLocaleString("fr-FR", { timeZone: "Africa/Douala" });
}

/**
 * Notification admin : nouvelle demande de retrait du solde activité.
 * Inclut les infos KYC (WhatsApp, prénom, nom) + données anti-fraude
 * (date de création du compte, date de première activité).
 */
export async function reportActivityWithdrawalCreated(
  w: ActivityWithdrawal,
  user: User,
  firstActivityAt?: Date | null,
) {
  const w2 = w as ActivityWithdrawal & {
    whatsappNumber?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  };

  const fullName =
    w2.firstName && w2.lastName
      ? `${w2.firstName} ${w2.lastName}`
      : w2.firstName ?? w2.lastName ?? w.accountName;

  const message =
    `🎯 *RETRAIT ACTIVITÉ — #${w.id}*\n` +
    `${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `⚠️  *VÉRIFIER FRAUDE AVANT VALIDATION*\n\n` +
    `━━━ 💰 PAIEMENT ━━━\n` +
    `Montant : *${fmtAmount(w.amount)}*\n` +
    `Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `N° Mobile Money : ${w.accountNumber}\n` +
    `Titulaire : ${w.accountName}\n` +
    `Pays : ${w.country ?? "—"}\n\n` +
    `━━━ 👤 IDENTITÉ ━━━\n` +
    `Prénom Nom : *${fullName}*\n` +
    `📱 WhatsApp : ${w2.whatsappNumber ?? "—"}\n\n` +
    `━━━ 🕵️ ANTI-FRAUDE ━━━\n` +
    `📅 Inscription : ${fmtDate(user.createdAt)}\n` +
    `🏁 1ère activité : ${fmtDate(firstActivityAt, "aucune activité enregistrée")}\n\n` +
    `━━━ 🪪 COMPTE ━━━\n` +
    `Pseudo : ${user.displayName || "—"}\n` +
    `Email : ${user.email}\n` +
    `Tél. compte : ${user.phone}\n` +
    `Pays compte : ${user.country}\n` +
    `Code parrainage : ${user.referralCode}\n` +
    `User ID : ${user.id}\n\n` +
    `🕐 Demande le : ${fmtDate(w.createdAt)}`;

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
