import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "TRIXHUB <support@socialboosthorizon.com>";
const SITE = "https://trixhub.site";

// ─── Helpers HTML ──────────────────────────────────────────────────────────
function base(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TRIXHUB</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td align="center" style="padding-bottom:24px;">
    <div style="background:linear-gradient(135deg,#f97316,#fb923c);border-radius:16px;display:inline-block;padding:10px 24px;">
      <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:1px;">TRIXHUB</span>
    </div>
  </td></tr>
  <tr><td style="background:#fff;border-radius:20px;padding:40px 32px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    ${content}
  </td></tr>
  <tr><td align="center" style="padding-top:20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff7ed;border-radius:16px;padding:16px 24px;border:1px solid #fed7aa;">
      <tr><td align="center">
        <p style="margin:0 0 4px;color:#9a3412;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Partenaire officiel n°1</p>
        <a href="https://socialboosthorizon.com" style="color:#ea580c;font-size:15px;font-weight:800;text-decoration:none;">🤝 Social Boost Horizon</a>
        <p style="margin:4px 0 0;color:#c2410c;font-size:12px;">socialboosthorizon.com — Le soutien principal de la plateforme TRIXHUB</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding-top:16px;">
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.8;">
      © 2025 TRIXHUB · La plateforme d'affiliation africaine<br>
      <a href="${SITE}" style="color:#f97316;text-decoration:none;">trixhub.site</a>
    </p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

function btn(href: string, label: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding-top:24px;">
    <a href="${href}" style="background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;display:inline-block;">${label} →</a>
  </td></tr></table>`;
}

function h1(t: string) { return `<h1 style="margin:0 0 8px;color:#0f172a;font-size:26px;font-weight:800;line-height:1.2;">${t}</h1>`; }
function sub(t: string) { return `<p style="margin:0 0 24px;color:#64748b;font-size:14px;">${t}</p>`; }
function p(t: string)   { return `<p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">${t}</p>`; }

function box(color: string, emoji: string, title: string, body: string): string {
  return `<div style="background:${color}0d;border-radius:14px;padding:20px 24px;margin:20px 0;border-left:4px solid ${color};">
    <p style="margin:0 0 8px;color:#0f172a;font-weight:700;">${emoji} ${title}</p>
    <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">${body}</p>
  </div>`;
}

function table(rows: [string, string][]): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">${rows.map(([k, v]) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:14px;width:140px;">${k}</td>
         <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:14px;font-weight:600;">${v}</td></tr>`
  ).join("")}</table>`;
}

function amountBadge(amount: string, color: string = "#f97316"): string {
  return `<div style="text-align:center;margin:24px 0;">
    <div style="background:linear-gradient(135deg,${color},${color}cc);border-radius:20px;padding:24px;display:inline-block;min-width:200px;">
      <p style="margin:0 0 4px;color:#fff;font-size:13px;opacity:0.9;">Montant</p>
      <p style="margin:0;color:#fff;font-size:36px;font-weight:800;">${amount}</p>
    </div>
  </div>`;
}

function fmt(n: number | string): string {
  return parseFloat(String(n)).toLocaleString("fr-FR") + " FCFA";
}

// ─── 1. Bienvenue (inscription) ────────────────────────────────────────────
export async function sendWelcomeEmail(user: { email: string; displayName: string }): Promise<void> {
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">🎉</div>
      ${h1("Bienvenue sur TRIXHUB !")}
      ${sub("Ton compte est créé — voici comment commencer à gagner.")}
    </div>
    ${p(`Bonjour <strong>${user.displayName}</strong>,`)}
    ${p("Tu viens de rejoindre <strong>TRIXHUB</strong>, la plateforme d'affiliation africaine qui te permet de générer des revenus réels depuis ton téléphone, en travaillant à ton rythme.")}

    <div style="background:#fff7ed;border-radius:16px;padding:24px;margin:20px 0;border:2px solid #fed7aa;">
      <p style="margin:0 0 12px;color:#9a3412;font-size:16px;font-weight:800;text-align:center;">❓ Pourquoi payer 3 600 FCFA ?</p>
      ${p(`Ce montant unique est ton <strong>ticket d'entrée</strong> dans la communauté TRIXHUB. Il te donne accès à un <strong>système complet de revenus</strong> conçu pour te faire rentabiliser cet investissement dès tes premières actions. Voici ce que tu reçois en échange :`)}
      <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:2.2;">
        <li>🎁 <strong>800 FCFA offerts</strong> immédiatement sur ton solde bonus</li>
        <li>💰 <strong>1 700 FCFA</strong> chaque fois qu'un filleul direct active son compte</li>
        <li>🔗 <strong>700 FCFA</strong> sur chaque activation de tes filleuls de niveau 2</li>
        <li>🌐 <strong>300 FCFA</strong> sur chaque activation au niveau 3 de ton réseau</li>
        <li>📋 Accès au <strong>répertoire de contacts</strong> à revendre (2 FCFA/contact)</li>
        <li>🎓 Accès aux <strong>formations exclusives</strong> que tu peux revendre à ta communauté</li>
        <li>🏆 Accès aux <strong>activités hebdomadaires</strong> (vidéos, quiz, découverte) convertibles en FCFA</li>
      </ul>
    </div>

    ${box("#22c55e", "📊", "Exemple concret de revenus",
      "Tu actives ton compte à <strong>3 600 FCFA</strong>. Tu parraines 3 personnes qui activent à leur tour → tu récupères déjà <strong>5 100 FCFA</strong> (3 × 1 700). Chacun de tes 3 filleuls parraine 3 autres → tu touches encore <strong>6 300 FCFA</strong> (9 × 700). Ton réseau grandit, tes revenus aussi — <strong>sans limite</strong>."
    )}

    ${box("#3b82f6", "🤝", "Soutenu par Social Boost Horizon",
      "TRIXHUB est porté par son partenaire officiel n°1, <strong>Social Boost Horizon</strong>, qui assure la crédibilité et la solidité de la plateforme. Découvrez-les sur <a href='https://socialboosthorizon.com' style='color:#1d4ed8;'>socialboosthorizon.com</a>"
    )}

    <div style="text-align:center;margin:28px 0 8px;">
      <p style="margin:0 0 8px;color:#0f172a;font-size:15px;font-weight:700;">Prêt à commencer ? Active ton compte maintenant :</p>
    </div>
    ${btn(SITE + "/activate", "Activer mon compte — 3 600 FCFA")}
    <div style="text-align:center;margin-top:16px;">
      <p style="margin:0;color:#64748b;font-size:13px;">Des questions ? Contacte notre équipe depuis ton tableau de bord ou via <a href="${SITE}/dashboard" style="color:#f97316;text-decoration:none;">trixhub.site</a></p>
    </div>
  `);
  await resend.emails.send({ from: FROM, to: user.email, subject: "🎉 Bienvenue sur TRIXHUB — Découvre comment gagner dès aujourd'hui", html });
}

// ─── 2. Compte activé (confirmation à l'utilisateur) ──────────────────────
export async function sendActivationConfirmEmail(user: { email: string; displayName: string }): Promise<void> {
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">✅</div>
      ${h1("Ton compte est activé !")}
      ${sub("Bienvenue dans la communauté TRIXHUB")}
    </div>
    ${p(`Félicitations <strong>${user.displayName}</strong> !`)}
    ${p("Ton compte est désormais pleinement actif. Tu peux parrainer, gagner des commissions et accéder à toutes les fonctionnalités.")}
    ${box("#22c55e", "🎁", "Bonus de bienvenue crédité", "800 FCFA ont été ajoutés sur ton solde bonus — profite !")}
    <div style="background:#f8fafc;border-radius:14px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 12px;color:#0f172a;font-weight:700;font-size:15px;">🚀 Que faire maintenant ?</p>
      <ul style="margin:0;padding-left:20px;color:#334155;font-size:14px;line-height:2;">
        <li>Partage ton <strong>lien de parrainage</strong> et gagne <strong>1 700 FCFA</strong> par filleul activé</li>
        <li>Fais les <strong>activités hebdomadaires</strong> (vidéos, quiz, découverte) pour accumuler des points</li>
        <li>Consulte les <strong>formations</strong> pour développer tes compétences</li>
      </ul>
    </div>
    ${btn(SITE + "/dashboard", "Accéder à mon tableau de bord")}
  `);
  await resend.emails.send({ from: FROM, to: user.email, subject: "✅ Compte activé — Bienvenue dans la communauté TRIXHUB !", html });
}

// ─── 3. Commission parrainage reçue ───────────────────────────────────────
export async function sendCommissionEmail(
  referrer: { email: string; displayName: string },
  newMember: { displayName: string },
  commission: number,
  level: number,
): Promise<void> {
  const emoji = ["💰", "🤑", "💸"][level - 1] ?? "💸";
  const levelLabel = `Niveau ${level} (N${level})`;
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">${emoji}</div>
      ${h1(`+${fmt(commission)} reçus !`)}
      ${sub(`Commission de parrainage ${levelLabel}`)}
    </div>
    ${p(`Bonne nouvelle <strong>${referrer.displayName}</strong> !`)}
    ${p(`<strong>${newMember.displayName}</strong> vient d'activer son compte TRIXHUB. En tant que parrain de niveau ${level}, tu reçois immédiatement ta commission :`)}
    ${amountBadge(`+${fmt(commission)}`)}
    ${p("Ce montant a été crédité sur ton <strong>solde parrainage</strong>. Continue à parrainer pour maximiser tes revenus !")}
    ${btn(SITE + "/dashboard", "Voir mon tableau de bord")}
  `);
  await resend.emails.send({ from: FROM, to: referrer.email, subject: `${emoji} Tu as reçu ${fmt(commission)} de commission parrainage !`, html });
}

// ─── 4. Confirmation dépôt ────────────────────────────────────────────────
export async function sendDepositConfirmEmail(user: { email: string; displayName: string }, amount: number): Promise<void> {
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">💳</div>
      ${h1("Dépôt reçu !")}
      ${sub("Ton solde dépôt a été mis à jour")}
    </div>
    ${p(`Bonjour <strong>${user.displayName}</strong>,`)}
    ${p("Ton paiement a bien été confirmé et ton solde dépôt a été crédité :")}
    ${amountBadge(`+${fmt(amount)}`, "#22c55e")}
    ${p("Tu peux utiliser ce solde pour acheter des contacts ou activer les comptes de tes filleuls.")}
    ${btn(SITE + "/dashboard", "Voir mon solde")}
  `);
  await resend.emails.send({ from: FROM, to: user.email, subject: `💳 Dépôt de ${fmt(amount)} confirmé`, html });
}

// ─── 5. Retrait créé ──────────────────────────────────────────────────────
export async function sendWithdrawalCreatedEmail(
  user: { email: string; displayName: string },
  amount: string,
  source: string,
  method: string,
): Promise<void> {
  const srcLabel = source === "referral" ? "Solde parrainage" : "Solde missions";
  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">📤</div>
      ${h1("Demande de retrait reçue")}
      ${sub("Nous traitons ta demande")}
    </div>
    ${p(`Bonjour <strong>${user.displayName}</strong>,`)}
    ${p("Ta demande de retrait a bien été enregistrée. Voici le récapitulatif :")}
    ${table([["Montant", fmt(amount)], ["Source", srcLabel], ["Méthode", method], ["Statut", "En cours de traitement"]])}
    ${p("Tu recevras une notification par email dès que ta demande est traitée. Pour toute question, contacte notre support.")}
    ${btn(SITE + "/withdrawals", "Suivre mes retraits")}
  `);
  await resend.emails.send({ from: FROM, to: user.email, subject: "📤 Ta demande de retrait est en cours de traitement", html });
}

// ─── 6. Statut retrait changé (parrainage/missions) ───────────────────────
export async function sendWithdrawalStatusEmail(
  user: { email: string; displayName: string },
  amount: string,
  status: string,
  reason?: string | null,
): Promise<void> {
  const done = status === "completed";
  const refused = status === "rejected";
  const emoji = done ? "✅" : refused ? "❌" : "🔄";
  const title = done ? "Retrait effectué !" : refused ? "Retrait refusé" : "Retrait en traitement";
  const bodyText = done
    ? "Bonne nouvelle ! Ton retrait a été traité avec succès. Le montant est en route sur ton compte de paiement."
    : refused
    ? `Ta demande de retrait a malheureusement été refusée.${reason ? ` <strong>Raison : ${reason}</strong>` : ""} Ton solde a été restitué automatiquement.`
    : "Ton retrait est en cours de traitement par notre équipe. Tu seras notifié dès que c'est finalisé.";

  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">${emoji}</div>
      ${h1(title)}
      ${sub(`Mise à jour de ton retrait de ${fmt(amount)}`)}
    </div>
    ${p(`Bonjour <strong>${user.displayName}</strong>,`)}
    ${p(bodyText)}
    ${btn(SITE + "/withdrawals", "Voir mes retraits")}
  `);
  const subject = done
    ? `✅ Retrait de ${fmt(amount)} effectué !`
    : refused
    ? `❌ Retrait de ${fmt(amount)} refusé`
    : `🔄 Retrait de ${fmt(amount)} en traitement`;
  await resend.emails.send({ from: FROM, to: user.email, subject, html });
}

// ─── 7. Statut retrait activité changé ────────────────────────────────────
export async function sendActivityWithdrawalStatusEmail(
  user: { email: string; displayName: string },
  amount: string,
  status: string,
): Promise<void> {
  const paid     = status === "paid";
  const approved = status === "approved";
  const rejected = status === "rejected";
  const emoji = paid ? "✅" : approved ? "🔄" : rejected ? "❌" : "📋";
  const title = paid ? "Retrait activité payé !" : approved ? "Retrait activité approuvé" : rejected ? "Retrait activité refusé" : "Retrait activité mis à jour";
  const bodyText = paid
    ? "Ton retrait activité a été payé ! Le montant a été envoyé via ta méthode de paiement. Merci de ta participation active sur TRIXHUB !"
    : approved
    ? "Bonne nouvelle ! Ta demande a été approuvée par notre équipe. Le paiement sera effectué très prochainement."
    : rejected
    ? "Ta demande de retrait activité a été refusée. Ton solde activité a été restitué automatiquement. Contacte notre support si tu as des questions."
    : "Le statut de ton retrait activité a été mis à jour.";

  const html = base(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:52px;margin-bottom:12px;">${emoji}</div>
      ${h1(title)}
      ${sub(`Retrait activité de ${fmt(amount)}`)}
    </div>
    ${p(`Bonjour <strong>${user.displayName}</strong>,`)}
    ${p(bodyText)}
    ${btn(SITE + "/retraits/activite", "Voir mes retraits activité")}
  `);
  const subject = paid
    ? `✅ Retrait activité de ${fmt(amount)} payé !`
    : approved
    ? `🔄 Retrait activité approuvé — paiement imminent`
    : `❌ Retrait activité de ${fmt(amount)} refusé`;
  await resend.emails.send({ from: FROM, to: user.email, subject, html });
}
