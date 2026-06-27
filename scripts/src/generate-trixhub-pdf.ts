import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const PDFDocument = require("pdfkit");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(process.cwd(), "trixhub-presentation.pdf");

// ─── Couleurs TRIXHUB ────────────────────────────────────────────────────────
const ORANGE  = "#F97316";
const DARK    = "#0F172A";
const GREY    = "#64748B";
const WHITE   = "#FFFFFF";
const GREEN   = "#16A34A";
const AMBER   = "#D97706";
const LIGHT   = "#FFF7ED";
const BLUE    = "#1D4ED8";

const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "TRIXHUB — Dossier de Présentation 2026", Author: "Social Succès Group" } });
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const W = doc.page.width;   // 595
const M = 50;               // margin
const CW = W - M * 2;      // content width = 495

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureSpace(needed: number) {
  if (doc.y + needed > doc.page.height - 80) doc.addPage();
}

function hline(color = "#E2E8F0", lw = 0.5) {
  doc.save().strokeColor(color).lineWidth(lw)
    .moveTo(M, doc.y).lineTo(W - M, doc.y).stroke().restore();
  doc.moveDown(0.6);
}

function sectionTitle(text: string) {
  ensureSpace(50);
  doc.moveDown(0.8);
  doc.save()
    .fillColor(ORANGE).rect(M, doc.y, 4, 22).fill()
    .fillColor(DARK).fontSize(14).font("Helvetica-Bold")
    .text(text, M + 12, doc.y + 3, { width: CW - 12 })
    .restore();
  doc.moveDown(0.6);
}

function bodyText(text: string, indent = 0) {
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155")
    .text(text, M + indent, doc.y, { width: CW - indent, lineGap: 3 });
  doc.moveDown(0.4);
}

function bullet(text: string, color = ORANGE, indent = 12) {
  const y = doc.y;
  doc.save().fillColor(color).circle(M + indent + 3, y + 5, 2.5).fill().restore();
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155")
    .text(text, M + indent + 12, y, { width: CW - indent - 12, lineGap: 3 });
  doc.moveDown(0.2);
}

function badge(label: string, value: string, x: number, y: number, w: number, color = ORANGE) {
  doc.save()
    .roundedRect(x, y, w, 52, 8).fill(color)
    .fillColor(WHITE).fontSize(18).font("Helvetica-Bold")
    .text(value, x, y + 8, { width: w, align: "center" })
    .fontSize(8).font("Helvetica")
    .text(label, x, y + 32, { width: w, align: "center" })
    .restore();
}

function colorBox(text: string, bg: string, x: number, y: number, w: number, h: number, textColor = DARK) {
  doc.save().roundedRect(x, y, w, h, 6).fill(bg)
    .font("Helvetica").fontSize(9).fillColor(textColor)
    .text(text, x + 10, y + 10, { width: w - 20, lineGap: 3 })
    .restore();
}

function infoRow(label: string, value: string, y: number, shade: boolean) {
  if (shade) doc.save().rect(M, y, CW, 22).fill("#F8FAFC").restore();
  doc.font("Helvetica").fontSize(9).fillColor(GREY).text(label, M + 8, y + 6, { width: 160 });
  doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(value, M + 172, y + 6, { width: CW - 172 });
}

function qaBlock(q: string, a: string) {
  ensureSpace(80);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text(`❓  ${q}`, M, doc.y, { width: CW });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9.5).fillColor("#334155")
    .text(a, M + 16, doc.y, { width: CW - 16, lineGap: 3 });
  doc.moveDown(0.8);
}

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE DE COUVERTURE
// ─────────────────────────────────────────────────────────────────────────────
doc.save().roundedRect(M, 80, CW, 170, 12).fill(ORANGE).restore();

doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(52)
  .text("TRIXHUB", M, 118, { width: CW, align: "center", characterSpacing: 3 });
doc.font("Helvetica").fontSize(14)
  .text("La Plateforme d'Affiliation Africaine", M, 182, { width: CW, align: "center" });
doc.fontSize(10).font("Helvetica-Oblique")
  .text("Dossier Officiel de Présentation — 2026", M, 204, { width: CW, align: "center" });

// Badges statistiques
badge("Pays africains", "18", M, 290, 148, DARK);
badge("Activation unique", "3 600 FCFA", M + 174, 290, 148, "#EA580C");
badge("Niveaux de commissions", "3", M + 348, 290, 148, DARK);

doc.moveDown(0);
doc.y = 380;

hline();
doc.font("Helvetica-Oblique").fontSize(9).fillColor(GREY)
  .text("Un projet de Social Succès Group · Soutenu par Social Boost Horizon", M, doc.y, { width: CW, align: "center" });
doc.moveDown(2);

// Résumé couverture
doc.save().roundedRect(M, doc.y, CW, 120, 8).fill("#FFF7ED").restore();
const summY = doc.y + 12;
doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK)
  .text("TRIXHUB en quelques chiffres clés :", M + 14, summY);
doc.font("Helvetica").fontSize(9.5).fillColor("#334155");
const items = [
  "💰  Commissions : 1 700 FCFA (N1) · 700 FCFA (N2) · 200 FCFA (N3)",
  "🎁  Bonus de bienvenue : 800 FCFA offerts dès l'activation",
  "📤  Retrait minimum : 3 100 FCFA (parrainage) · 3 500 FCFA (activités)",
  "🌍  Disponible dans 18 pays africains · Mobile Money uniquement",
  "🆓  Mode gratuit : activation automatique à 3 400 FCFA de crédit accumulé",
];
let iy = summY + 18;
for (const item of items) {
  doc.text(item, M + 14, iy, { width: CW - 28 });
  iy += 16;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — QU'EST-CE QUE TRIXHUB ?
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();

// En-tête de chaque page (sauf couverture — géré via events)
doc.on("pageAdded", () => {
  doc.save()
    .rect(0, 0, W, 30).fill("#0F172A")
    .fillColor(WHITE).font("Helvetica-Bold").fontSize(8)
    .text("TRIXHUB — Dossier de Présentation 2026", M, 10, { width: CW / 2 })
    .font("Helvetica").fontSize(8).fillColor("#94A3B8")
    .text("trixhub.site · support@trixhub.site", M + CW / 2, 10, { width: CW / 2, align: "right" })
    .restore();
  doc.y = 50;
});

sectionTitle("1. Qu'est-ce que TRIXHUB ?");
bodyText("TRIXHUB est une plateforme africaine de marketing d'affiliation multi-niveaux, créée en 2026 dans le cadre du projet Social Succès Group. Elle permet à n'importe qui — disposant d'un téléphone et d'une connexion internet — de générer des revenus réels et mesurables depuis chez lui, en Afrique.");
bodyText("TRIXHUB n'est ni une plateforme d'investissement, ni un système pyramidal : c'est une infrastructure complète de revenus bâtie sur le parrainage actif, les formations et les activités quotidiennes rémunérées.");

doc.moveDown(0.4);
const box1Y = doc.y;
colorBox("🏢  Structure légale\n\nProjet porté par Social Succès Group, soutenu opérationnellement par le partenaire officiel Social Boost Horizon (socialboosthorizon.com).", LIGHT, M, box1Y, CW / 2 - 6, 75);
colorBox("🌍  Zone géographique\n\nDisponible dans 18 pays africains. Mobile Money comme principal moyen de paiement et de retrait. Paiements automatisés via AccountPE.", "#F0FDF4", M + CW / 2 + 6, box1Y, CW / 2 - 6, 75);
doc.y = box1Y + 85;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — À QUI S'ADRESSE TRIXHUB ?
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("2. À qui s'adresse TRIXHUB ?");
bodyText("TRIXHUB s'adresse à toute personne africaine motivée souhaitant générer un revenu complémentaire ou principal depuis son téléphone :");
doc.moveDown(0.2);
bullet("Les jeunes actifs et étudiants cherchant un revenu flexible sans contrainte d'horaire.");
bullet("Les demandeurs d'emploi souhaitant une activité génératrice de revenus en attente d'un emploi.");
bullet("Les entrepreneurs et commerçants voulant diversifier leurs sources de revenus.");
bullet("Les personnes ayant un réseau social fort (famille, amis, communauté) et souhaitant le monétiser.");
bullet("Les formateurs et créateurs de contenu voulant revendre des formations et toucher des commissions.");
bullet("Toute personne n'ayant pas les 3 600 FCFA d'entrée : le mode gratuit exclut personne.");

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — CE QUE TRIXHUB APPORTE
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("3. Ce que TRIXHUB apporte à ses membres");

const features = [
  { title: "💰  Revenus de parrainage", bg: LIGHT, text: "Commission automatique à chaque activation dans votre réseau :\n• N1 (filleul direct) : 1 700 FCFA\n• N2 (filleul de filleul) : 700 FCFA\n• N3 (3ᵉ niveau) : 200 FCFA" },
  { title: "🎓  Formations exclusives", bg: "#EFF6FF", text: "Catalogue de formations en marketing digital, vente, développement personnel et entrepreneuriat — revendables à votre communauté pour générer un revenu supplémentaire." },
  { title: "🏆  Activités quotidiennes rémunérées", bg: "#FDF4FF", text: "Vidéos, quiz, découverte de produits : 1 point = 1 FCFA. Minimum 700 points/semaine pour convertir chaque dimanche." },
  { title: "📋  Annuaire de contacts", bg: "#F0FDF4", text: "Répertoire de contacts qualifiés disponibles à la revente à 2 FCFA le contact. Idéal pour trouver des prospects et développer son réseau." },
  { title: "🎁  Pack de bienvenue", bg: "#FFFBEB", text: "À l'activation : 800 FCFA offerts, Canal+ offert, Canva Pro offert, VPN premium offert par l'équipe." },
  { title: "💸  Retraits Mobile Money", bg: "#FFF1F2", text: "Paiements directs sur Mobile Money via AccountPE. Minimum : 3 100 FCFA (parrainage) · 3 500 FCFA (activités)." },
];

const FH = 72;
const FCW = CW / 2 - 6;
for (let i = 0; i < features.length; i += 2) {
  ensureSpace(FH + 10);
  const fy = doc.y;
  const f1 = features[i], f2 = features[i + 1];
  doc.save().roundedRect(M, fy, FCW, FH, 6).fill(f1.bg).restore();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(f1.title, M + 8, fy + 8, { width: FCW - 16 });
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(f1.text, M + 8, fy + 22, { width: FCW - 16, lineGap: 2 });

  if (f2) {
    doc.save().roundedRect(M + FCW + 12, fy, FCW, FH, 6).fill(f2.bg).restore();
    doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text(f2.title, M + FCW + 20, fy + 8, { width: FCW - 16 });
    doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(f2.text, M + FCW + 20, fy + 22, { width: FCW - 16, lineGap: 2 });
  }
  doc.y = fy + FH + 8;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — PROBLÈMES RÉSOLUS
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("4. Quels problèmes TRIXHUB résout-il ?");
const problems = [
  ["❌ Pas d'emploi ou revenu instable", "✅ Revenus via parrainage, activités et formations — sans horaire imposé."],
  ["❌ Pas de formations accessibles", "✅ Catalogue de formations inclus dès l'activation."],
  ["❌ Pas les 3 600 FCFA pour commencer", "✅ Mode gratuit : accumule le montant via le parrainage, sans rien débourser."],
  ["❌ Difficulté à trouver des clients", "✅ Annuaire de contacts qualifiés disponibles à 2 FCFA/contact."],
  ["❌ Revenus dépendants d'un seul employeur", "✅ Trois sources de revenus indépendantes : parrainage, activités, formations."],
  ["❌ Pas de moyen de retrait simple", "✅ Paiements directs sur Mobile Money, automatiquement."],
];
for (const [prob, sol] of problems) {
  ensureSpace(28);
  const py = doc.y;
  doc.save().roundedRect(M, py, CW, 26, 4).fill("#F8FAFC").restore();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#DC2626").text(prob, M + 8, py + 5, { width: CW / 2 - 10 });
  doc.font("Helvetica").fontSize(8.5).fillColor(GREEN).text(sol, M + CW / 2 + 4, py + 5, { width: CW / 2 - 10 });
  doc.y = py + 32;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — COMMENT S'INSCRIRE
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("5. Comment s'inscrire ? Ce qu'il faut pour commencer");
bodyText("L'inscription est simple, rapide et accessible à tous. Voici ce dont vous avez besoin :");
doc.moveDown(0.3);

const s5Y = doc.y;
const s5H = 130;
doc.save().roundedRect(M, s5Y, FCW, s5H, 6).fill("#F0FDF4").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text("✅  Ce qu'il vous faut", M + 10, s5Y + 10, { width: FCW - 20 });
const reqItems = ["Un téléphone (smartphone ou basique)", "Une connexion internet (même lente)", "Une adresse e-mail valide", "Un numéro WhatsApp actif", "Avoir au moins 18 ans", "Fournir des informations exactes"];
let riy = s5Y + 26;
for (const r of reqItems) {
  doc.save().fillColor(GREEN).circle(M + 18, riy + 5, 2.5).fill().restore();
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(r, M + 26, riy, { width: FCW - 36 });
  riy += 16;
}

doc.save().roundedRect(M + FCW + 12, s5Y, FCW, s5H, 6).fill("#FFFBEB").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(AMBER).text("⚙️  Les deux modes d'entrée", M + FCW + 22, s5Y + 10, { width: FCW - 20 });
doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Mode Payant :", M + FCW + 22, s5Y + 28);
doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text("Payer 3 600 FCFA via Mobile Money.\nActivation immédiate. Tout débloqué.", M + FCW + 22, s5Y + 40, { width: FCW - 30, lineGap: 2 });
doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Mode Gratuit :", M + FCW + 22, s5Y + 72);
doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text("S'inscrire sans payer. Les commissions de parrainage s'accumulent. À 3 400 FCFA : activation automatique.", M + FCW + 22, s5Y + 84, { width: FCW - 30, lineGap: 2 });
doc.y = s5Y + s5H + 10;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — POURQUOI PAYER 3 600 FCFA ?
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("6. Pourquoi payer 3 600 FCFA ?");
bodyText("Les 3 600 FCFA ne sont pas un simple droit d'entrée. Ce montant unique vous donne accès à un pack complet conçu pour se rentabiliser dès vos premières actions :");
doc.moveDown(0.3);
bullet("800 FCFA offerts immédiatement sur votre solde bonus");
bullet("Accès au système de parrainage à 3 niveaux (1 700 / 700 / 200 FCFA)");
bullet("Canal+, Canva Pro et VPN premium offerts");
bullet("Accès aux formations exclusives revendables");
bullet("Accès aux activités quotidiennes rémunérées (1 point = 1 FCFA)");
bullet("Accès à l'annuaire de contacts qualifiés");

doc.moveDown(0.4);
ensureSpace(90);
const exY = doc.y;
doc.save().roundedRect(M, exY, CW, 84, 8).fill("#F0FDF4").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text("📊  Exemple concret de retour sur investissement", M + 12, exY + 10);
doc.font("Helvetica").fontSize(9).fillColor("#334155");
const exItems = [
  "Vous activez votre compte :  −3 600 FCFA  +  800 FCFA bonus immédiat",
  "3 filleuls directs activent  →  +5 100 FCFA  (3 × 1 700 FCFA)",
  "9 filleuls de niveau 2 activent  →  +6 300 FCFA  (9 × 700 FCFA)",
];
let exiy = exY + 26;
for (const ex of exItems) {
  doc.text(ex, M + 12, exiy, { width: CW - 24 });
  exiy += 16;
}
doc.font("Helvetica-Bold").fontSize(11).fillColor(ORANGE)
  .text("Total généré : 12 200 FCFA  pour un investissement de 3 600 FCFA", M + 12, exiy, { width: CW - 24 });
doc.y = exY + 90;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7 — POURQUOI LE MODE GRATUIT ?
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("7. Pourquoi le mode gratuit existe-t-il ?");
bodyText("TRIXHUB a été conçu pour être inclusif. Trouver 3 600 FCFA d'un coup est un obstacle réel dans de nombreuses régions africaines. Le mode gratuit a donc été créé pour que personne ne soit laissé de côté.");
doc.moveDown(0.3);
bullet("Inscrivez-vous sans payer — votre tableau de bord est actif immédiatement.");
bullet("Vous recevez votre lien de parrainage unique et pouvez commencer à inviter.");
bullet("Les commissions générées s'accumulent dans un crédit d'activation (non retirable avant activation).");
bullet("Dès que ce crédit atteint 3 400 FCFA, votre compte s'active automatiquement.");
bullet("L'éventuel surplus au-delà de 3 400 FCFA est versé dans votre solde parrainage retirable.");
doc.moveDown(0.3);
bodyText("Option intermédiaire : si vous avez accumulé par exemple 2 000 FCFA de crédit, vous pouvez payer uniquement les 1 600 FCFA restants (3 600 − 2 000) pour activer votre compte immédiatement. Votre crédit est utilisé, votre parrain reçoit sa commission normalement.", 12);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 8 — QUESTIONS FRÉQUENTES
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("8. Questions fréquentes et situations courantes");

qaBlock(
  "Que faire si je n'arrive pas à parrainer ?",
  "Le parrainage n'est pas la seule source de revenus. Vous pouvez :\n\n• Participer aux activités quotidiennes (vidéos, quiz, découvertes). 700 points minimum par semaine permet de convertir chaque dimanche.\n• Acheter des contacts depuis le répertoire (2 FCFA/contact) et les approcher vous-même.\n• Revendre les formations incluses à votre entourage.\n\nEn combinant ces trois sources, des revenus sont possibles même sans réseau de parrainage actif."
);

qaBlock(
  "Que se passe-t-il si je ne revends pas les formations ?",
  "Aucune obligation. Les formations vous appartiennent et peuvent être utilisées pour développer vos propres compétences. La revente est une option supplémentaire, pas une contrainte. Votre compte reste actif et vous continuez à percevoir vos commissions normalement."
);

qaBlock(
  "Que se passe-t-il si je ne fais pas les activités ?",
  "Les activités quotidiennes sont entièrement facultatives. Ne pas les faire signifie simplement ne pas bénéficier de ce canal de revenus supplémentaire. Votre compte reste actif, vos commissions de parrainage continuent normalement."
);

qaBlock(
  "Est-ce que TRIXHUB est légal ?",
  "Oui. TRIXHUB est une plateforme transparente de marketing d'affiliation. Elle ne promet aucun retour garanti et n'est pas une plateforme d'investissement. Les membres paient un accès à un pack de services à valeur réelle. Les gains dépendent entièrement des efforts de chaque membre."
);

qaBlock(
  "Quand peut-on retirer ses gains ?",
  "Dès que votre solde atteint le minimum requis :\n\n• Solde parrainage : minimum 3 100 FCFA\n• Solde activités : minimum 3 500 FCFA\n\nLes paiements sont effectués via Mobile Money (AccountPE). Les retraits du solde activités nécessitent une validation manuelle avant paiement."
);

qaBlock(
  "Comment fonctionne la dette envers le parrain en mode gratuit ?",
  "Si votre compte s'active automatiquement (sans paiement de votre part), votre parrain n'a pas encore reçu sa commission de 1 700 FCFA. Votre toute première commission après activation est automatiquement redirigée vers votre parrain jusqu'à solder ces 1 700 FCFA. Ensuite, toutes les commissions suivantes vous reviennent intégralement.\n\nNote : si vous payez directement (solde restant ou 3 600 FCFA en totalité), votre parrain est payé au moment du paiement et aucune dette n'est créée."
);

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 9 — POLITIQUE DE RETRAIT
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("9. Politique de retrait & protection des membres");

const s9Y = doc.y;
doc.save().roundedRect(M, s9Y, FCW, 100, 6).fill("#F0FDF4").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text("✅  Garanties pour les membres", M + 10, s9Y + 10, { width: FCW - 20 });
const guarItems = ["Aucun retrait refusé sans raison fondée", "Seule une fraude avérée peut bloquer un retrait", "Solde restitué automatiquement si retrait refusé", "Paiement automatisé via AccountPE en temps réel", "Historique complet des transactions visible"];
let giy = s9Y + 26;
for (const g of guarItems) {
  doc.save().fillColor(GREEN).circle(M + 18, giy + 5, 2.5).fill().restore();
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(g, M + 26, giy, { width: FCW - 36 });
  giy += 18;
}

doc.save().roundedRect(M + FCW + 12, s9Y, FCW, 100, 6).fill("#FEF2F2").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor("#DC2626").text("❌  Ce qui est interdit", M + FCW + 22, s9Y + 10, { width: FCW - 20 });
const forbItems = ["Multi-comptes (plusieurs comptes par personne)", "Fausses informations à l'inscription", "Manipulation du système de parrainage", "Promettre des gains garantis", "Présenter TRIXHUB comme un investissement"];
let fiy = s9Y + 26;
for (const f of forbItems) {
  doc.save().fillColor("#DC2626").circle(M + FCW + 30, fiy + 5, 2.5).fill().restore();
  doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(f, M + FCW + 38, fiy, { width: FCW - 36 });
  fiy += 18;
}
doc.y = s9Y + 108;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 10 — PARTENAIRES
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("10. Partenaires officiels de TRIXHUB");

const s10Y = doc.y;
doc.save().roundedRect(M, s10Y, FCW, 80, 6).fill(LIGHT).restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(ORANGE).text("🚀  Partenaire officiel n°1", M + 10, s10Y + 10, { width: FCW - 20 });
doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Social Boost Horizon", M + 10, s10Y + 26);
doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text("Vous cherchez à devenir viral sur tous les réseaux sociaux ? Avec Social Boost Horizon ce n'est plus qu'un jeu. Le partenaire officiel n°1 de TRIXHUB.", M + 10, s10Y + 40, { width: FCW - 20, lineGap: 2 });
doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ORANGE).text("🌐 socialboosthorizon.com", M + 10, s10Y + 64);

doc.save().roundedRect(M + FCW + 12, s10Y, FCW, 80, 6).fill("#F0FDF4").restore();
doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN).text("🌐  Partenaire officiel n°2", M + FCW + 22, s10Y + 10, { width: FCW - 20 });
doc.font("Helvetica-Bold").fontSize(9).fillColor(DARK).text("Texerra", M + FCW + 22, s10Y + 26);
doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text("Vous cherchez un numéro étranger ? Texerra a ce qu'il vous faut — rapide, fiable et accessible. Le partenaire officiel n°2 de TRIXHUB pour les solutions télécom.", M + FCW + 22, s10Y + 40, { width: FCW - 20, lineGap: 2 });
doc.font("Helvetica-Bold").fontSize(8.5).fillColor(GREEN).text("🌐 texerra.site", M + FCW + 22, s10Y + 64);
doc.y = s10Y + 88;

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 11 — TABLEAU DE BORD INFORMATIONS GÉNÉRALES
// ─────────────────────────────────────────────────────────────────────────────
sectionTitle("11. Informations générales");

const rows: [string, string, string][] = [
  ["Nom de la plateforme", "TRIXHUB", DARK],
  ["Fondateur / Groupe", "Social Succès Group", DARK],
  ["Année de création", "2026", DARK],
  ["Nature", "Marketing d'affiliation multi-niveaux (3 niveaux)", DARK],
  ["Frais d'activation", "3 600 FCFA — paiement unique, non remboursable", DARK],
  ["Mode gratuit", "Oui — activation automatique à 3 400 FCFA de crédit", GREEN],
  ["Commissions N1 / N2 / N3", "1 700 FCFA / 700 FCFA / 200 FCFA", ORANGE],
  ["Bonus de bienvenue", "800 FCFA offerts à l'activation", DARK],
  ["Retrait min. parrainage", "3 100 FCFA", DARK],
  ["Retrait min. activités", "3 500 FCFA", DARK],
  ["Moyen de paiement", "Mobile Money via AccountPE", DARK],
  ["Pays couverts", "18 pays africains", DARK],
  ["Site web", "trixhub.site", ORANGE],
  ["Support", "support@trixhub.site", ORANGE],
  ["Partenaire n°1", "Social Boost Horizon — socialboosthorizon.com", DARK],
  ["Partenaire n°2", "Texerra — texerra.site", DARK],
];

for (let i = 0; i < rows.length; i++) {
  ensureSpace(24);
  const ry = doc.y;
  const [label, value, vc] = rows[i];
  if (i % 2 === 0) doc.save().rect(M, ry, CW, 22).fill("#F8FAFC").restore();
  doc.save().strokeColor("#E2E8F0").lineWidth(0.5).moveTo(M, ry).lineTo(W - M, ry).stroke().restore();
  doc.font("Helvetica").fontSize(8.5).fillColor(GREY).text(label, M + 8, ry + 6, { width: 160 });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(vc).text(value, M + 172, ry + 6, { width: CW - 172 });
  doc.y = ry + 22;
}
doc.save().strokeColor("#E2E8F0").lineWidth(0.5).moveTo(M, doc.y).lineTo(W - M, doc.y).stroke().restore();
doc.moveDown(1.5);

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE DE CLÔTURE
// ─────────────────────────────────────────────────────────────────────────────
ensureSpace(140);
const closeY = doc.y + 10;
doc.save().roundedRect(M, closeY, CW, 110, 12).fill(ORANGE).restore();
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(20)
  .text("Rejoignez la communauté TRIXHUB", M, closeY + 20, { width: CW, align: "center" });
doc.font("Helvetica").fontSize(12)
  .text("La plateforme qui transforme votre réseau en revenus réels.", M, closeY + 50, { width: CW, align: "center" });
doc.font("Helvetica-Oblique").fontSize(10)
  .text("trixhub.site  ·  support@trixhub.site", M, closeY + 74, { width: CW, align: "center" });
doc.font("Helvetica").fontSize(8.5).fillColor(WHITE).opacity(0.8)
  .text("© 2026 TRIXHUB · Social Succès Group", M, closeY + 94, { width: CW, align: "center" });

// ─────────────────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => console.log(`✅ PDF généré : ${OUT}`));
stream.on("error", (e: Error) => { console.error("❌", e); process.exit(1); });
