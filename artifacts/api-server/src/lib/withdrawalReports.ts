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
export async function reportWithdrawalCreated(w: Withdrawal, user: User, balanceBefore: number, balanceAfter: number) {
  const fee = typeof w.feeAmount === "number" ? w.feeAmount : parseFloat(String(w.feeAmount ?? "0"));
  const message =
    `💸 NOUVEAU RETRAIT — #${w.id}\n` +
    `${STATUS_LABELS[w.status] ?? w.status}\n\n` +
    `💰 Montant demandé : ${fmtAmount(w.amount)}\n` +
    `🏷️ Frais prélevés : ${fmtAmount(fee)}\n` +
    `📤 Montant reçu : ${fmtAmount(parseFloat(String(w.amount)) - (w.feeMode === "from_amount" ? fee : 0))}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n\n` +
    `── Soldes ──\n` +
    `📊 Avant retrait : ${fmtAmount(balanceBefore)}\n` +
    `📉 Après retrait : ${fmtAmount(balanceAfter)}\n\n` +
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
  balanceBefore: number,
  balanceAfter: number,
) {
  const statusLine = payoutStatus === "success"
    ? "✅ PAIEMENT CONFIRMÉ PAR NOTRE PARTENAIRE"
    : "🔵 PAIEMENT INITIÉ — EN COURS DE TRAITEMENT";

  const message =
    `💸 RETRAIT AUTOMATIQUE — #${w.id}\n` +
    `${statusLine}\n\n` +
    `💰 Montant demandé : ${fmtAmount(w.amount)}\n` +
    `📤 Montant reçu par l'utilisateur : ${fmtAmount(amountSent)}\n` +
    `🏷️ Frais prélevés : ${fmtAmount(fee)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n` +
    `🔑 Réf. paiement : ${payoutRef}\n\n` +
    `── Soldes ──\n` +
    `📊 Avant retrait : ${fmtAmount(balanceBefore)}\n` +
    `📉 Après retrait : ${fmtAmount(balanceAfter)}\n\n` +
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
  amountSentToPartner: number,
  fee: number,
  balanceBefore: number,
  balanceAfterRefund: number,
) {
  const reason = isInsufficientFunds
    ? "⚠️ SOLDE INSUFFISANT DANS LE PORTEFEUILLE PARTENAIRE"
    : "❌ ERREUR TECHNIQUE — PAIEMENT ÉCHOUÉ";

  const message =
    `🚨 RETRAIT ÉCHOUÉ — #${w.id}\n` +
    `${reason}\n\n` +
    `💰 Montant demandé : ${fmtAmount(amountRequested)}\n` +
    `📤 Montant envoyé au partenaire : ${fmtAmount(amountSentToPartner)}\n` +
    `🏷️ Frais déduits : ${fmtAmount(fee)}\n` +
    `💵 Total débité du solde : ${fmtAmount(totalDebited)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n\n` +
    `── Soldes ──\n` +
    `📊 Avant tentative : ${fmtAmount(balanceBefore)}\n` +
    `♻️ Après remboursement : ${fmtAmount(balanceAfterRefund)}\n\n` +
    (isInsufficientFunds
      ? `⚡ ACTION REQUISE : recharger le portefeuille partenaire avant de traiter d'autres retraits.\n\n`
      : `🔍 Erreur : ${rawError.slice(0, 300)}\n\n`) +
    memberBlock(user) + "\n\n" +
    `🕐 ${now()}`;
  return sendWhatsAppToAssistance(message);
}

/**
 * Timeout réseau lors du paiement — statut inconnu chez AccountPE.
 * Le solde N'A PAS été restitué. L'admin doit vérifier manuellement sur AccountPE.
 */
export async function reportPayoutTimeout(
  w: Withdrawal,
  user: User,
  transactionId: string,
  amountSent: number,
  fee: number,
  balanceBefore: number,
) {
  const message =
    `⏱️ TIMEOUT PAIEMENT — #${w.id}\n` +
    `⚠️ VÉRIFICATION MANUELLE REQUISE SUR ACCOUNTPE\n\n` +
    `Le serveur n'a pas reçu de réponse d'AccountPE dans les délais.\n` +
    `Le paiement a PEUT-ÊTRE été exécuté. Le solde N'A PAS été restitué.\n\n` +
    `💰 Montant demandé : ${fmtAmount(w.amount)}\n` +
    `📤 Montant envoyé au partenaire : ${fmtAmount(amountSent)}\n` +
    `🏷️ Frais déduits : ${fmtAmount(fee)}\n` +
    `📦 Source : ${SOURCE_LABELS[w.source ?? "referral"] ?? w.source}\n` +
    `🏦 Méthode : ${METHOD_LABELS[w.method] ?? w.method}\n` +
    `📞 N° destinataire : ${w.accountNumber}\n` +
    `👤 Titulaire : ${w.accountName}\n` +
    `🔑 Réf. transaction : ${transactionId}\n\n` +
    `── Soldes ──\n` +
    `📊 Avant tentative : ${fmtAmount(balanceBefore)}\n` +
    `⚠️ Solde NON restitué — en attente de vérification\n\n` +
    `🔧 ACTIONS ADMIN :\n` +
    `  1. Vérifier si la transaction ${transactionId} est présente sur AccountPE\n` +
    `  2. Si OUI → utiliser "Forcer complétion" dans l'admin (retrait #${w.id})\n` +
    `  3. Si NON → utiliser "Forcer remboursement" dans l'admin (retrait #${w.id})\n\n` +
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
