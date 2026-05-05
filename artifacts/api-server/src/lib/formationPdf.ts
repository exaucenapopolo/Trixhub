import PDFDocument from "pdfkit";

const BRAND = "#f59e0b";
const BRAND_DARK = "#b45309";
const BLUE = "#3b82f6";
const BLUE_LIGHT = "#dbeafe";
const GREEN = "#10b981";
const GREEN_LIGHT = "#d1fae5";
const ORANGE = "#f97316";
const ORANGE_LIGHT = "#ffedd5";
const PURPLE = "#8b5cf6";
const PURPLE_LIGHT = "#ede9fe";
const DARK = "#1f2937";
const GRAY = "#6b7280";
const LIGHT_BG = "#f9fafb";
const WHITE = "#ffffff";
const YELLOW_LIGHT = "#fef3c7";

type Chapter = {
  title: string;
  intro?: string;
  sections: {
    heading?: string;
    body: string;
    type?: "normal" | "tip" | "example" | "exercise" | "warning" | "info";
    listItems?: string[];
  }[];
};

type FormationContent = {
  id: string;
  title: string;
  subtitle: string;
  tagline: string;
  accentColor: string;
  accentLight: string;
  chapters: Chapter[];
  conclusion: string;
};

const MARGIN = 50;

function pageWidth(doc: InstanceType<typeof PDFDocument>) {
  return doc.page.width - MARGIN * 2;
}

function drawRect(
  doc: InstanceType<typeof PDFDocument>,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  radius = 6
) {
  doc.roundedRect(x, y, w, h, radius).fill(color);
}

function sectionCallout(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  text: string,
  listItems: string[] | undefined,
  bg: string,
  accent: string
) {
  const x = MARGIN;
  const w = pageWidth(doc);
  const startY = doc.y + 4;
  const padding = 12;

  const labelHeight = 16;
  const contentX = x + padding;
  const contentW = w - padding * 2;

  doc.save();
  // Background
  drawRect(doc, x, startY, w, 30, bg, 6);
  // Left border stripe
  drawRect(doc, x, startY, 4, 30, accent, 3);

  doc.font("Helvetica-Bold").fontSize(9).fillColor(accent);
  doc.text(label, contentX + 4, startY + 8, { width: contentW - 4, lineBreak: false });
  doc.restore();

  const textStartY = startY + labelHeight + 10;
  doc.save();
  drawRect(doc, x, textStartY - 6, w, 4, bg, 0);
  doc.restore();

  doc.font("Helvetica").fontSize(10).fillColor(DARK);
  if (listItems && listItems.length > 0) {
    doc.text("", contentX, textStartY);
    listItems.forEach((item) => {
      const bulletY = doc.y;
      drawRect(doc, contentX, bulletY + 4, 5, 5, accent, 1);
      doc.text(item, contentX + 12, bulletY, { width: contentW - 12 });
      doc.moveDown(0.3);
    });
  } else if (text) {
    doc.text(text, contentX, textStartY, { width: contentW });
  }
  doc.moveDown(0.8);
}

function chapterHeader(doc: InstanceType<typeof PDFDocument>, num: number, title: string, accent: string) {
  doc.addPage();
  const w = pageWidth(doc);

  drawRect(doc, MARGIN, 40, w, 70, accent, 8);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(WHITE)
    .text(`CHAPITRE ${num}`, MARGIN + 16, 56, { width: w - 32 });
  doc.font("Helvetica-Bold").fontSize(16).fillColor(WHITE).text(title, MARGIN + 16, 74, { width: w - 32 });

  doc.y = 130;
  doc.x = MARGIN;
}

function bodyText(doc: InstanceType<typeof PDFDocument>, text: string) {
  doc.font("Helvetica").fontSize(10.5).fillColor(DARK).text(text, MARGIN, doc.y, {
    width: pageWidth(doc),
    lineGap: 3,
    align: "justify",
  });
  doc.moveDown(0.7);
}

function sectionTitle(doc: InstanceType<typeof PDFDocument>, title: string) {
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(DARK).text(title, MARGIN, doc.y, {
    width: pageWidth(doc),
  });
  doc.moveDown(0.4);
}

function tipBox(doc: InstanceType<typeof PDFDocument>, text: string, listItems?: string[]) {
  sectionCallout(doc, "💡 CONSEIL PRO", text, listItems, YELLOW_LIGHT, BRAND_DARK);
}
function exampleBox(doc: InstanceType<typeof PDFDocument>, text: string, listItems?: string[]) {
  sectionCallout(doc, "📌 EXEMPLE CONCRET", text, listItems, BLUE_LIGHT, BLUE);
}
function exerciseBox(doc: InstanceType<typeof PDFDocument>, text: string, listItems?: string[]) {
  sectionCallout(doc, "✏️ EXERCICE PRATIQUE", text, listItems, GREEN_LIGHT, GREEN);
}
function warningBox(doc: InstanceType<typeof PDFDocument>, text: string, listItems?: string[]) {
  sectionCallout(doc, "⚠️ À ÉVITER", text, listItems, ORANGE_LIGHT, ORANGE);
}
function infoBox(doc: InstanceType<typeof PDFDocument>, text: string, listItems?: string[]) {
  sectionCallout(doc, "📚 BON À SAVOIR", text, listItems, PURPLE_LIGHT, PURPLE);
}

function renderChapter(
  doc: InstanceType<typeof PDFDocument>,
  num: number,
  chapter: Chapter,
  accent: string
) {
  chapterHeader(doc, num, chapter.title, accent);
  if (chapter.intro) bodyText(doc, chapter.intro);

  for (const section of chapter.sections) {
    if (section.heading) sectionTitle(doc, section.heading);
    switch (section.type) {
      case "tip":
        tipBox(doc, section.body, section.listItems);
        break;
      case "example":
        exampleBox(doc, section.body, section.listItems);
        break;
      case "exercise":
        exerciseBox(doc, section.body, section.listItems);
        break;
      case "warning":
        warningBox(doc, section.body, section.listItems);
        break;
      case "info":
        infoBox(doc, section.body, section.listItems);
        break;
      default:
        if (section.listItems && section.listItems.length > 0) {
          if (section.body) bodyText(doc, section.body);
          section.listItems.forEach((item) => {
            const bY = doc.y;
            drawRect(doc, MARGIN, bY + 5, 5, 5, accent, 1);
            doc
              .font("Helvetica")
              .fontSize(10.5)
              .fillColor(DARK)
              .text(item, MARGIN + 14, bY, { width: pageWidth(doc) - 14, lineGap: 3 });
            doc.moveDown(0.3);
          });
          doc.moveDown(0.5);
        } else {
          bodyText(doc, section.body);
        }
    }
  }
}

function coverPage(
  doc: InstanceType<typeof PDFDocument>,
  formation: FormationContent
) {
  const w = doc.page.width;
  const h = doc.page.height;

  drawRect(doc, 0, 0, w, h, DARK, 0);
  drawRect(doc, 0, 0, w, 8, formation.accentColor, 0);
  drawRect(doc, 0, h - 8, w, 8, formation.accentColor, 0);

  drawRect(doc, MARGIN, 60, w - MARGIN * 2, 3, formation.accentColor, 2);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(formation.accentColor)
    .text("TRIXHUB — FORMATIONS PRO", MARGIN, 46, { width: w - MARGIN * 2, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(26)
    .fillColor(WHITE)
    .text(formation.title, MARGIN, 90, {
      width: w - MARGIN * 2,
      align: "center",
      lineGap: 6,
    });

  const titleEndY = doc.y + 20;
  drawRect(doc, MARGIN, titleEndY, w - MARGIN * 2, 3, formation.accentColor, 2);

  doc
    .font("Helvetica")
    .fontSize(13)
    .fillColor("#d1d5db")
    .text(formation.subtitle, MARGIN, titleEndY + 20, {
      width: w - MARGIN * 2,
      align: "center",
      lineGap: 4,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(formation.accentColor)
    .text(formation.tagline, MARGIN, doc.y + 30, {
      width: w - MARGIN * 2,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#9ca3af")
    .text(`${formation.chapters.length} chapitres · Contenu pratique · Exemples & Exercices`, MARGIN, doc.y + 20, {
      width: w - MARGIN * 2,
      align: "center",
    });

  const footerY = h - 50;
  drawRect(doc, MARGIN, footerY, w - MARGIN * 2, 1, "#374151", 0);
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#6b7280")
    .text("© TRIXHUB — Contenu exclusif. Tous droits réservés.", MARGIN, footerY + 10, {
      width: w - MARGIN * 2,
      align: "center",
    });
}

function tocPage(
  doc: InstanceType<typeof PDFDocument>,
  chapters: Chapter[],
  accent: string
) {
  doc.addPage();
  const w = pageWidth(doc);

  drawRect(doc, MARGIN, 40, w, 50, accent, 8);
  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(WHITE)
    .text("TABLE DES MATIÈRES", MARGIN + 16, 60, { width: w - 32 });

  doc.y = 115;

  chapters.forEach((ch, i) => {
    const y = doc.y;
    drawRect(doc, MARGIN, y, w, 34, i % 2 === 0 ? LIGHT_BG : WHITE, 6);
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(accent)
      .text(`${i + 1}`, MARGIN + 12, y + 11, { width: 16, lineBreak: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(DARK)
      .text(ch.title, MARGIN + 32, y + 11, { width: w - 60, lineBreak: false });
    doc.y = y + 40;
  });
}

function conclusionPage(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  accent: string
) {
  doc.addPage();
  const w = pageWidth(doc);

  drawRect(doc, MARGIN, 40, w, 50, accent, 8);
  doc.font("Helvetica-Bold").fontSize(18).fillColor(WHITE).text("CONCLUSION", MARGIN + 16, 60, { width: w - 32 });

  doc.y = 120;
  bodyText(doc, text);

  doc.moveDown(1);
  drawRect(doc, MARGIN, doc.y, w, 70, YELLOW_LIGHT, 8);
  doc.font("Helvetica-Bold").fontSize(11).fillColor(BRAND_DARK).text("🚀 TA PROCHAINE ÉTAPE", MARGIN + 14, doc.y + 12, { width: w - 28 });
  doc.font("Helvetica").fontSize(10).fillColor(DARK).text(
    "Connecte-toi sur TRIXHUB, explore les formations disponibles et mets en pratique ce que tu viens d'apprendre. Chaque jour d'action te rapproche de tes objectifs.",
    MARGIN + 14,
    doc.y + 8,
    { width: w - 28 }
  );
  doc.y = doc.y + 80;

  doc.moveDown(1);
  drawRect(doc, MARGIN, doc.y, w, 55, "#f3f4f6", 8);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(DARK).text("TRIXHUB — Plateforme d'Affiliation", MARGIN + 14, doc.y + 12, { width: w - 28 });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(GRAY)
    .text("Rejoins notre communauté et développe ton business depuis l'Afrique.", MARGIN + 14, doc.y + 6, { width: w - 28 });
}

const FORMATION_CONTENTS: Record<string, FormationContent> = {
  "tiktok-monetisable": {
    id: "tiktok-monetisable",
    title: "Comment créer un compte TikTok monétisable depuis l'Afrique ?",
    subtitle: "La méthode complète pour activer la monétisation et vendre ce service à 3 000 FCFA",
    tagline: "✦ Formation Premium · 250 FCFA ✦",
    accentColor: BRAND,
    accentLight: YELLOW_LIGHT,
    conclusion:
      "Tu as maintenant entre les mains tout ce qu'il faut pour créer un compte TikTok monétisable depuis l'Afrique. Cette compétence est rare, recherchée, et tu peux la vendre à répétition. Un seul client peut te rembourser cette formation 10 fois. Ne perds plus de temps — crée ton premier compte dès aujourd'hui et commence à prospecter dès demain.",
    chapters: [
      {
        title: "TikTok : l'opportunité cachée pour les Africains",
        intro:
          "TikTok compte plus de 1,5 milliard d'utilisateurs actifs dans le monde. En Afrique subsaharienne, la croissance est de plus de 150 % par an. Ce que la plupart ne savent pas, c'est que tu peux monétiser TikTok depuis l'Afrique, même sans être sur le sol européen ou américain. Ce chapitre te donne le cadre mental pour comprendre pourquoi cette opportunité est réelle.",
        sections: [
          {
            heading: "Pourquoi TikTok est différent des autres réseaux",
            body: "",
            listItems: [
              "L'algorithme favorise le contenu qualitatif, pas le nombre d'abonnés",
              "Un compte à 0 abonné peut faire 1 million de vues sur son premier post",
              "Les niches africaines sont moins saturées = plus de visibilité facilement",
              "Le coût d'acquisition d'abonnés sur TikTok est 10x moins cher qu'Instagram",
            ],
          },
          {
            type: "tip",
            body: "Les créateurs africains ont un avantage naturel : l'authenticité. Le contenu africain (humour, vie quotidienne, business local) performe très bien dans les pays francophones du monde entier.",
          },
          {
            heading: "Les 3 modèles de monétisation TikTok accessibles depuis l'Afrique",
            body: "",
            listItems: [
              "1. TikTok Creator Fund (fonds créateurs) — rémunération directe sur les vues",
              "2. Lives et cadeaux virtuels — convertis en argent réel via TikTok",
              "3. Vendre des produits ou services via tes vidéos (le plus rentable)",
            ],
          },
          {
            type: "example",
            body: "Exemple réel : Moussa, basé à Abidjan, crée des contenus de 30 secondes sur les astuces téléphoniques. En 3 mois avec 45 000 abonnés, il génère 15 000 FCFA/mois via le Creator Fund + 60 000 FCFA/mois via la vente de prestation. Revenu total : 75 000 FCFA/mois.",
          },
        ],
      },
      {
        title: "Créer et configurer ton compte professionnel",
        intro:
          "La création du compte est l'étape cruciale. Une mauvaise configuration dès le départ peut bloquer ta monétisation pendant des mois. Suis exactement ces étapes.",
        sections: [
          {
            heading: "Étape 1 — Préparer ton environnement",
            body: "",
            listItems: [
              "Installe un VPN fiable sur ton téléphone (ProtonVPN gratuit ou ExpressVPN)",
              "Connecte-toi à un serveur situé en France ou en Belgique",
              "Crée une adresse Gmail dédiée uniquement à ce compte TikTok",
              "Prépare un numéro de téléphone valide (le tien suffit)",
            ],
          },
          {
            type: "warning",
            body: "N'utilise JAMAIS le même appareil ou le même réseau WiFi que d'autres comptes TikTok. TikTok détecte les doublons par IP et appareil. Utilise toujours le VPN avant de créer le compte.",
          },
          {
            heading: "Étape 2 — Créer le compte",
            body: "",
            listItems: [
              "Ouvre TikTok avec le VPN activé (serveur France)",
              "Choisis 'Créer un compte' → 'Continuer avec e-mail'",
              "Renseigne la date de naissance (18 ans minimum requis)",
              "Choisis un nom d'utilisateur professionnel et mémorable",
              "Ne mentionne PAS l'Afrique dans ta bio au départ",
            ],
          },
          {
            heading: "Étape 3 — Passer en compte Business/Créateur",
            body: "Va dans Paramètres → Gérer mon compte → Passer en compte Créateur. Cette action est gratuite et débloque des fonctionnalités essentielles comme les statistiques, les outils d'analyse et surtout l'accès au Programme Créateur.",
          },
          {
            heading: "Étape 4 — Optimiser la bio parfaite",
            body: "",
            listItems: [
              "Photo de profil : portrait clair, fond neutre, sourire professionnel",
              "Bio en 3 lignes : ce que tu fais | pour qui | ce qu'ils gagnent",
              "Exemple de bio : '🎯 J'aide les entrepreneurs africains à vendre sur TikTok | +12 000 ventes générées | Clique sur le lien ↓'",
              "Lien en bio : utilise Linktree gratuit pour pointer vers WhatsApp + ton offre",
            ],
          },
          {
            type: "exercise",
            body: "Exercice 1 — Crée ton compte aujourd'hui",
            listItems: [
              "Installe ProtonVPN et connecte-toi à un serveur France",
              "Crée ton compte TikTok avec une nouvelle adresse Gmail",
              "Passe en mode Créateur",
              "Rédige ta bio en utilisant la formule ci-dessus",
              "Publie une première vidéo test (peu importe le contenu)",
            ],
          },
        ],
      },
      {
        title: "Les critères de monétisation décryptés",
        intro:
          "TikTok a des critères précis pour accéder à la monétisation. Beaucoup de créateurs africains échouent parce qu'ils ne connaissent pas les règles exactes. Ce chapitre te donne tout ce qu'il faut savoir.",
        sections: [
          {
            heading: "Les critères officiels du TikTok Creator Fund",
            body: "",
            listItems: [
              "✅ Avoir au minimum 10 000 abonnés",
              "✅ Avoir cumulé 100 000 vues dans les 30 derniers jours",
              "✅ Être âgé d'au moins 18 ans",
              "✅ Respecter les règles de la communauté TikTok",
              "✅ Avoir un compte actif depuis plus de 30 jours",
            ],
          },
          {
            type: "info",
            body: "Le critère de 'résider dans un pays éligible' est le plus bloquant pour les Africains. La solution : utiliser un VPN France en permanence + avoir un compte Payoneer ou Wise pour recevoir les paiements. Ces deux services acceptent les Africains.",
          },
          {
            heading: "La méthode alternative : TikTok LIVE (plus rapide)",
            body: "Pour activer les TikTok Lives et recevoir des cadeaux, le seuil est seulement 1 000 abonnés. Un Live de 2 heures bien animé peut générer entre 5 000 et 30 000 FCFA en cadeaux. C'est souvent plus rentable que le Creator Fund au début.",
          },
          {
            type: "example",
            body: "Stratégie rapide : publie 3 vidéos par jour pendant 2 semaines. Concentre-toi sur un seul sujet (cuisine, business, humour). À ce rythme, atteindre 1 000 abonnés en 14 jours est réaliste si le contenu est bon.",
          },
          {
            type: "exercise",
            body: "Exercice 2 — Vérifie ton éligibilité actuelle",
            listItems: [
              "Ouvre TikTok → Outils créateur → Voir mes statistiques",
              "Note ton nombre d'abonnés actuel",
              "Note tes vues des 30 derniers jours",
              "Calcule combien de vues manquantes il te faut",
              "Définis une date cible réaliste pour atteindre les critères",
            ],
          },
        ],
      },
      {
        title: "Techniques pour atteindre les critères rapidement",
        intro:
          "Croître rapidement sur TikTok n'est pas une question de chance. C'est une science. Ce chapitre te donne les stratégies testées et éprouvées pour atteindre 10 000 abonnés en moins de 60 jours.",
        sections: [
          {
            heading: "La formule du contenu qui performe",
            body: "Le contenu TikTok qui performe suit toujours la même formule : Accroche forte (0-3 secondes) + Valeur ou divertissement + Appel à l'action. Les 3 premières secondes déterminent 80 % des performances de ta vidéo.",
          },
          {
            heading: "Les 5 types de contenus qui marchent le mieux en Afrique",
            body: "",
            listItems: [
              "1. 'Ce que personne ne te dit sur [sujet]' — curiosité maximale",
              "2. Avant / Après — transformation visible en 15 secondes",
              "3. Tutoriel étape par étape en moins de 60 secondes",
              "4. Réaction ou commentaire sur une tendance locale",
              "5. Histoire vraie de réussite ou d'échec (storytelling)",
            ],
          },
          {
            type: "tip",
            body: "Publie à ces heures pour l'audience africaine francophone : 7h-9h (matin), 12h-14h (pause déjeuner) et 19h-22h (soirée). Le vendredi soir et le samedi matin sont les meilleurs moments de la semaine.",
          },
          {
            heading: "Le hack des Duos et Coutures",
            body: 'Utilise la fonction "Duo" ou "Couture" pour répondre à des vidéos virales dans ta niche. Tu bénéficies de leur audience. Cherche des vidéos ayant entre 10 000 et 100 000 vues dans ton domaine et fais un Duo avec une vraie valeur ajoutée.',
          },
          {
            type: "exercise",
            body: "Exercice 3 — Ton plan de contenu 30 jours",
            listItems: [
              "Semaine 1 : Crée 21 vidéos (3/jour) sur UN seul sujet",
              "Semaine 2 : Identifie les 3 vidéos qui ont le mieux marché — réplique-les",
              "Semaine 3 : Fais 5 Duos avec des créateurs populaires dans ta niche",
              "Semaine 4 : Lance ton premier Live de 45 minutes minimum",
              "Objectif : 1 000 abonnés à la fin du mois",
            ],
          },
          {
            type: "tip",
            body: "Utilisez des hashtags en français ET en langue locale. Exemple : #businessafrique #entrepreneurcameroun #tiktokci. 5 à 8 hashtags maximum par vidéo, sinon TikTok pénalise.",
          },
        ],
      },
      {
        title: "Vendre ce service entre 2 500 et 7 000 FCFA",
        intro:
          "Une fois que tu sais créer des comptes monétisables, tu as une compétence que des milliers de commerçants et d'entrepreneurs africains cherchent désespérément. Ce chapitre te montre comment transformer cette compétence en source de revenus réguliers.",
        sections: [
          {
            heading: "Tes clients idéaux — qui prospecter en priorité",
            body: "",
            listItems: [
              "Commerçants et boutiquiers qui veulent vendre en ligne",
              "Coiffeurs, couturiers, restaurateurs qui veulent plus de visibilité",
              "Agences de voyage et hôtels locaux",
              "Formateurs et coachs qui veulent se faire connaître",
              "Autres créateurs qui veulent monétiser mais ne savent pas comment",
            ],
          },
          {
            heading: "Tes offres et tes prix",
            body: "",
            listItems: [
              "Pack Starter (2 500 FCFA) : création du compte + configuration + bio optimisée",
              "Pack Pro (4 500 FCFA) : Starter + 7 premières vidéos créées + stratégie 30 jours",
              "Pack Complet (7 000 FCFA) : Pro + suivi 1 mois + 3 Lives animés",
              "Abonnement mensuel (3 000 FCFA/mois) : gestion du compte en continu",
            ],
          },
          {
            type: "example",
            body: "Script WhatsApp testé : 'Bonjour [Nom], j'aide les [commerçants/coiffeurs/etc.] à créer un compte TikTok professionnel monétisable pour attirer plus de clients. Je prends en charge toute la configuration — tu n'as rien à faire. C'est à partir de 2 500 FCFA. Est-ce que ça t'intéresse ?'",
          },
          {
            heading: "Comment gérer et livrer la prestation",
            body: "",
            listItems: [
              "Demande accès au téléphone du client via TeamViewer ou AnyDesk",
              "Ou demande-lui de créer le compte en te partageant son écran via WhatsApp",
              "Documente chaque étape en photo/vidéo pour lui envoyer après",
              "Fais signer un petit accord simple par WhatsApp ('Je confirme avoir reçu mon compte TikTok configuré')",
              "Propose une garantie : si les critères ne sont pas atteints en 60 jours, tu fais une session de coaching gratuite",
            ],
          },
          {
            type: "exercise",
            body: "Exercice 4 — Ta première vente cette semaine",
            listItems: [
              "Identifie 10 contacts WhatsApp qui ont un business local",
              "Envoie le script ci-dessus à 5 d'entre eux aujourd'hui",
              "Propose une démo gratuite à ceux qui hésitent (crée un compte test en direct)",
              "Objectif : 1 vente dans les 7 prochains jours",
              "Budget cible premier mois : 3 à 5 ventes = 7 500 à 22 500 FCFA",
            ],
          },
          {
            type: "tip",
            body: "Rejoins des groupes WhatsApp de commerçants, d'associations d'entrepreneurs ou de femmes d'affaires dans ta ville. C'est là que tu trouveras tes 10 premiers clients gratuitement.",
          },
        ],
      },
    ],
  },

  "tiktok-clients": {
    id: "tiktok-clients",
    title: "Comment transformer TikTok en source de clients ?",
    subtitle: "Stratégies concrètes pour attirer, engager et convertir une audience africaine",
    tagline: "✦ Formation Pro · 150 FCFA ✦",
    accentColor: "#ec4899",
    accentLight: "#fce7f3",
    conclusion:
      "TikTok peut devenir ta principale source de clients si tu appliques ces stratégies avec constance. La clé, c'est de publier régulièrement, d'analyser ce qui marche et d'adapter. Commence avec UN type de contenu, maîtrise-le, puis diversifie. Tes premiers clients TikTok sont à 30 jours de travail sérieux.",
    chapters: [
      {
        title: "Comprendre l'algorithme TikTok pour les créateurs africains",
        intro: "L'algorithme de TikTok est l'un des plus puissants au monde. Contrairement à Instagram ou Facebook, TikTok montre ton contenu à des inconnus dès ta première vidéo. Comprendre comment il fonctionne, c'est avoir un avantage compétitif énorme.",
        sections: [
          {
            heading: "Les 4 signaux que l'algorithme TikTok analyse",
            body: "",
            listItems: [
              "Taux de complétion : combien de personnes regardent ta vidéo jusqu'à la fin ?",
              "Taux d'engagement : likes, commentaires, partages, enregistrements",
              "Taux de repartage : les partages comptent 3x plus que les likes",
              "Temps regardé : plus le temps total passé sur ta vidéo est élevé, plus tu es promu",
            ],
          },
          {
            type: "tip",
            body: "Le secret du taux de complétion : crée du suspense dès la première seconde. Commence par une question, une affirmation choc ou un résultat visible. Exemple : 'Voilà comment j'ai gagné 50 000 FCFA avec mon téléphone en une semaine...' puis montre le processus.",
          },
          {
            heading: "La niche : la décision la plus importante",
            body: "Choisir une niche claire est la décision n°1 qui détermine ton succès. L'algorithme TikTok classe les comptes par sujet. Plus tu es cohérent, plus il te montre à des gens intéressés par ton domaine.",
          },
          {
            type: "exercise",
            body: "Choisis ta niche cette semaine",
            listItems: [
              "Liste tes 5 sujets de prédilection (cuisine, business, beauté, tech, humour...)",
              "Pour chaque sujet, estime combien de personnes dans ton entourage sont intéressées",
              "Recherche sur TikTok les créateurs africains dans cette niche",
              "Choisis la niche où tu vois le moins de créateurs locaux = moins de concurrence",
              "Engagement : publier UNIQUEMENT sur cette niche pendant 30 jours",
            ],
          },
        ],
      },
      {
        title: "Créer du contenu qui attire et convertit",
        intro: "Le contenu est roi, mais le contenu stratégique est roi et riche. Ce chapitre te donne les formules de contenu qui attirent des prospects qualifiés pour ton business.",
        sections: [
          {
            heading: "Les formats de vidéo qui génèrent des clients (pas juste des vues)",
            body: "",
            listItems: [
              "Tutoriel court : 'Comment faire X en 60 secondes' — positionne ton expertise",
              "Démonstration de résultat : montre le BEFORE/AFTER de tes services",
              "FAQ client : réponds aux 5 questions que tes clients posent le plus",
              "Coulisses / Behind the scenes : montre ton processus de travail",
              "Témoignage client : filme tes clients satisfaits (avec leur accord)",
            ],
          },
          {
            type: "example",
            body: "Exemple pour une couturière : Vidéo 1 = transformation d'un tissu en robe en 30 sec. Vidéo 2 = '3 erreurs que font les clients en choisissant leur tissu'. Vidéo 3 = cliente qui porte sa tenue + réaction. Ce triptyque génère en moyenne 10 à 20 messages WhatsApp par semaine.",
          },
          {
            heading: "Le script parfait pour chaque vidéo",
            body: "",
            listItems: [
              "Secondes 0-3 : L'accroche (question, chiffre choc, situation identifiable)",
              "Secondes 3-15 : Le problème que tu résous ou la valeur que tu apportes",
              "Secondes 15-45 : Le contenu principal (démonstration, conseil, histoire)",
              "Secondes 45-60 : L'appel à l'action ('Abonne-toi', 'Contacte-moi sur WhatsApp', 'Lien en bio')",
            ],
          },
          {
            type: "tip",
            body: "Mets TOUJOURS un texte écrit sur l'écran (sous-titres ou captions). 40 % des utilisateurs TikTok regardent sans son. Le texte à l'écran double ton taux de complétion.",
          },
          {
            type: "exercise",
            body: "Crée ta série de 5 vidéos 'client magnet'",
            listItems: [
              "Vidéo 1 : Présente ton service en 30 secondes avec le résultat visible",
              "Vidéo 2 : Réponds à l'objection n°1 de tes prospects",
              "Vidéo 3 : Montre un client satisfait (témoignage filmé ou lu à voix haute)",
              "Vidéo 4 : Tutoriel rapide lié à ton domaine d'expertise",
              "Vidéo 5 : Coulisses de ton travail — rend-toi humain et sympathique",
            ],
          },
        ],
      },
      {
        title: "Convertir les vues en contacts et en ventes",
        intro: "Des vues sans ventes, c'est de la fumée. Ce chapitre te montre comment transformer chaque vue en contact WhatsApp et chaque contact en client payant.",
        sections: [
          {
            heading: "La chaîne de conversion TikTok → WhatsApp → Vente",
            body: "",
            listItems: [
              "Étape 1 : La vidéo génère de la curiosité et du désir",
              "Étape 2 : Le CTA dans la vidéo et la bio dirige vers WhatsApp ou DM",
              "Étape 3 : Message automatique de bienvenue sur WhatsApp",
              "Étape 4 : Qualification du prospect (ce qu'il cherche, son budget)",
              "Étape 5 : Proposition personnalisée + suivi jusqu'à la vente",
            ],
          },
          {
            type: "example",
            body: "Message automatique WhatsApp Business à configurer : 'Bonjour ! Merci d'avoir contacté [ton nom]. Je suis [ton métier] et j'aide [ta cible] à [résultat]. Pour mieux te servir, dis-moi : quel est ton besoin principal ? Je te réponds dans les 2h.'",
          },
          {
            heading: "Les appels à l'action qui convertissent le mieux",
            body: "",
            listItems: [
              "'Lien en bio pour commander' (le plus classique mais efficace)",
              "'Commente TON PRÉNOM et je te contacte' (génère des commentaires = algorithme boost)",
              "'Envoie-moi DM avec le mot [FORMATION/COMMANDE]' (filtre les vrais intéressés)",
              "'Enregistre cette vidéo pour t'en souvenir' (enregistrements = signaux forts)",
            ],
          },
          {
            type: "tip",
            body: "L'erreur numéro 1 : mettre ton numéro WhatsApp dans les commentaires. TikTok supprime ou pénalise ces commentaires. Utilise TOUJOURS le lien en bio ou dirige vers les DMs TikTok.",
          },
          {
            type: "exercise",
            body: "Mise en place de ton tunnel de conversion",
            listItems: [
              "Crée un compte Linktree gratuit et mets ton lien WhatsApp Business",
              "Configure le message automatique de bienvenue WhatsApp Business",
              "Écris 3 scripts de réponse pour les demandes les plus fréquentes",
              "Teste ton tunnel : fais cliquer un ami sur le lien en bio et mesure le parcours",
            ],
          },
        ],
      },
      {
        title: "Fidéliser ta communauté et scaler tes ventes",
        intro: "Attirer des clients une fois c'est bien. En avoir en continu, c'est un business. Ce chapitre te montre comment bâtir une communauté fidèle qui achète régulièrement.",
        sections: [
          {
            heading: "Les habitudes des créateurs TikTok qui vendent chaque jour",
            body: "",
            listItems: [
              "Publient à heure fixe chaque jour (la régularité rassure l'algorithme ET l'audience)",
              "Répondent à CHAQUE commentaire dans les 30 premières minutes",
              "Font des Lives au moins 2 fois par semaine",
              "Analysent leurs statistiques chaque semaine et adaptent leur stratégie",
              "Collaborent avec d'autres créateurs dans des niches complémentaires",
            ],
          },
          {
            type: "tip",
            body: "Stratégie avancée : crée un groupe WhatsApp VIP pour tes abonnés les plus engagés. Envoie-leur des offres exclusives, des contenus bonus, des avant-premières. Ce groupe devient ta machine à ventes récurrentes.",
          },
          {
            type: "exercise",
            body: "Ton planning hebdomadaire optimal",
            listItems: [
              "Lundi-Mercredi-Vendredi : 2 vidéos par jour (total 6 vidéos)",
              "Mardi-Jeudi : 1 Live de 45 min minimum",
              "Samedi : vidéo récapitulative de la semaine + offre spéciale",
              "Dimanche : planification + tournage des vidéos de la semaine suivante",
              "Chaque soir : 15 min pour répondre aux commentaires et DMs",
            ],
          },
        ],
      },
    ],
  },

  "whatsapp-systeme": {
    id: "whatsapp-systeme",
    title: "Comment créer un système WhatsApp qui vend tout seul ?",
    subtitle: "Configure ton business WhatsApp comme un tunnel de vente automatisé 24h/24",
    tagline: "✦ Formation Pro · 150 FCFA ✦",
    accentColor: "#10b981",
    accentLight: "#d1fae5",
    conclusion:
      "Un système WhatsApp bien configuré travaille pour toi 24h sur 24, 7 jours sur 7 — même quand tu dors. Ce n'est pas de la magie, c'est de l'organisation. Commence par mettre en place les messages automatiques et une offre claire. Ajoute les autres éléments un par un. Dans 30 jours, tu auras un vrai tunnel de vente WhatsApp fonctionnel.",
    chapters: [
      {
        title: "WhatsApp Business : la différence qui change tout",
        intro: "WhatsApp Business n'est pas juste WhatsApp avec un logo différent. C'est un outil professionnel complet qui te permet d'automatiser, de qualifier et de convertir tes prospects. Ce chapitre te montre comment passer de l'amateur au professionnel.",
        sections: [
          {
            heading: "WhatsApp standard vs WhatsApp Business : le comparatif",
            body: "",
            listItems: [
              "✅ Profil business avec description, horaires, adresse, site web",
              "✅ Catalogue de produits intégré directement dans l'appli",
              "✅ Messages automatiques : accueil, absence, réponses rapides",
              "✅ Étiquettes pour classer tes contacts (Nouveau prospect, Client, VIP...)",
              "✅ Statistiques de messages (envoyés, reçus, lus)",
              "✅ Bouton de lien direct WhatsApp pour tes réseaux sociaux",
            ],
          },
          {
            heading: "Configuration du profil professionnel parfait",
            body: "",
            listItems: [
              "Photo de profil : ton logo ou photo professionnelle (fond clair, haute qualité)",
              "Nom de l'entreprise : utilise ton vrai nom de business, pas un surnom",
              "Catégorie : choisis la catégorie la plus proche de ton activité",
              "Description (en 256 caractères) : ce que tu fais + pour qui + résultat principal",
              "Horaires : configure tes vraies heures d'activité",
              "Adresse et site web : même si tu n'as pas de boutique physique, mets une zone géographique",
            ],
          },
          {
            type: "example",
            body: "Exemple de description parfaite (couturière) : '👗 Tenues sur mesure pour femmes africaines modernes | Livraison Douala & Yaoundé | Commandes à partir de 5 000 FCFA | Plus de 500 clientes satisfaites ✨'",
          },
          {
            type: "exercise",
            body: "Configure ton profil WhatsApp Business complet aujourd'hui",
            listItems: [
              "Télécharge WhatsApp Business (gratuit sur Google Play / App Store)",
              "Migre ton numéro actuel vers Business (garde tous tes contacts)",
              "Complète chaque champ du profil sans exception",
              "Ajoute au moins 3 produits/services dans le catalogue",
              "Prends une capture d'écran et montre à un ami — est-ce professionnel ?",
            ],
          },
        ],
      },
      {
        title: "Les messages automatiques qui vendent à ta place",
        intro: "L'automatisation WhatsApp, c'est ton premier employé — gratuit, disponible 24h/24, qui ne fait jamais d'erreur. Ce chapitre te donne les messages exacts à configurer.",
        sections: [
          {
            heading: "Message d'accueil automatique (le plus important)",
            body: "Ce message part automatiquement quand quelqu'un t'écrit pour la première fois ou après 14 jours d'inactivité. Il doit qualifier le prospect ET lui donner envie de continuer.",
          },
          {
            type: "example",
            body: "Template message d'accueil (à personnaliser) :\n'Bonjour [Prénom] ! 🙏 Merci de contacter [Nom Business]. Je suis [ton prénom], [ton rôle].\n\nPour mieux vous aider, dites-moi :\n1️⃣ Vous cherchez [produit/service A] ?\n2️⃣ Vous cherchez [produit/service B] ?\n3️⃣ Autre chose ?\n\nRépondez avec le numéro qui vous correspond. Je reviens vers vous dans les 2h ! ✅'",
          },
          {
            heading: "Message d'absence automatique",
            body: "Configure ce message pour les heures en dehors de tes horaires de travail. Il évite que le client parte chez un concurrent parce qu'il croit que tu l'ignores.",
          },
          {
            type: "example",
            body: "Template absence : 'Bonsoir ! Vous avez bien contacté [Business]. Je suis actuellement indisponible mais je vous répondrai dès demain matin à 8h. En attendant, consultez notre catalogue : [lien]. Bonne soirée ! 🌙'",
          },
          {
            heading: "Les 10 réponses rapides à configurer dès maintenant",
            body: "",
            listItems: [
              "/prix → Template avec tes tarifs complets",
              "/catalogue → Lien vers ton catalogue ou portfolio",
              "/delai → Tes délais de livraison habituels",
              "/paiement → Tes modes de paiement acceptés (Mobile Money, virement...)",
              "/localisation → Ton adresse ou zone de livraison",
              "/commande → Les étapes pour passer commande",
              "/merci → Message de remerciement après achat",
              "/relance → Pour relancer un prospect inactif",
              "/avis → Demander un avis/témoignage client",
              "/promo → Offre du moment",
            ],
          },
          {
            type: "exercise",
            body: "Configure tes 5 premiers messages automatiques",
            listItems: [
              "Va dans WhatsApp Business → Paramètres → Outils business",
              "Configure le message d'accueil avec le template ci-dessus (personnalisé)",
              "Configure le message d'absence avec tes horaires réels",
              "Crée 5 réponses rapides en commençant par /prix, /paiement, /commande",
              "Teste en t'envoyant un message depuis un autre numéro",
            ],
          },
        ],
      },
      {
        title: "Ton tunnel de vente WhatsApp étape par étape",
        intro: "Un tunnel de vente, c'est le chemin que prend ton prospect depuis le premier contact jusqu'à l'achat. Sur WhatsApp, ce chemin peut être entièrement automatisé si tu le prépares bien.",
        sections: [
          {
            heading: "Les 5 étapes du tunnel de vente WhatsApp",
            body: "",
            listItems: [
              "Étape 1 — Attirance : TikTok, Facebook, bouche à oreille → ils t'écrivent",
              "Étape 2 — Accueil : message automatique qualifie et classe le prospect",
              "Étape 3 — Présentation : tu envoies l'offre personnalisée selon sa réponse",
              "Étape 4 — Objection : tu réponds aux doutes avec preuves sociales + garantie",
              "Étape 5 — Conversion : tu guides vers le paiement et la commande",
            ],
          },
          {
            type: "tip",
            body: "La relance est souvent plus rentable que la prospection. 70 % des clients qui demandent un devis sans acheter finissent par acheter si tu les relances 3 jours après. Configure un rappel dans ton agenda pour chaque prospect.",
          },
          {
            heading: "Le catalogue WhatsApp : ton boutiquier virtuel",
            body: "Le catalogue WhatsApp permet à tes clients de voir tes produits directement dans l'application, sans quitter WhatsApp. Chaque produit a sa photo, sa description, son prix et un bouton 'Envoyer au vendeur'.",
          },
          {
            type: "exercise",
            body: "Construis ton tunnel en 3 jours",
            listItems: [
              "Jour 1 : Configure les messages automatiques + 10 réponses rapides",
              "Jour 2 : Ajoute 5 produits minimum dans ton catalogue WhatsApp",
              "Jour 3 : Teste ton tunnel complet avec un ami qui joue le rôle du client",
              "Ajuste ce qui ne fonctionne pas bien et recommence le test",
            ],
          },
        ],
      },
      {
        title: "Stratégies avancées pour vendre plus chaque jour",
        intro: "Tu as maintenant la base. Ce chapitre te donne les stratégies avancées pour multiplier tes ventes sans multiplier ton temps de travail.",
        sections: [
          {
            heading: "Les groupes WhatsApp : ta communauté d'acheteurs fidèles",
            body: "Crée un groupe WhatsApp avec tes 50 à 200 meilleurs contacts. Nomme-le '[Ton Business] — Offres & Actus'. Publie-y tes nouvelles offres, tes promos et des contenus exclusifs. Les membres d'un groupe achètent 4x plus que les contacts ordinaires.",
          },
          {
            type: "warning",
            body: "Erreurs fatales à éviter dans les groupes WhatsApp : Publier uniquement pour vendre (ratio recommandé : 3 contenus utiles pour 1 promo), ajouter des personnes sans leur accord, envoyer plus de 2 messages par jour.",
          },
          {
            heading: "Les statuts WhatsApp : publicité gratuite 24h/24",
            body: "",
            listItems: [
              "Poste 3 à 5 statuts par jour : produit phare, témoignage client, conseil utile",
              "Les statuts disparaissent en 24h → sentiment d'urgence naturel",
              "Mets TOUJOURS un appel à l'action : 'Contacte-moi pour commander'",
              "Les contacts actifs voient tes statuts — c'est ta pub la plus qualifiée",
              "Astuce : finis chaque statut par une question pour générer des réponses",
            ],
          },
          {
            type: "exercise",
            body: "Ton plan de contenu WhatsApp 7 jours",
            listItems: [
              "Lundi : Statut 'Produit/Service de la semaine' avec photo + prix",
              "Mardi : Témoignage client (photo ou texte)",
              "Mercredi : Conseil utile lié à ton domaine",
              "Jeudi : Coulisses de ton travail ou processus",
              "Vendredi : Offre spéciale weekend ou promotion limitée",
              "Samedi : Résultats de la semaine + remerciements clients",
              "Dimanche : Teaser de ce qui arrive la semaine prochaine",
            ],
          },
        ],
      },
    ],
  },

  "ia-vendre": {
    id: "ia-vendre",
    title: "Comment utiliser l'IA pour produire et vendre plus vite ?",
    subtitle: "Maîtrise ChatGPT et les outils IA pour booster ton business africain",
    tagline: "✦ Formation Pro · 150 FCFA ✦",
    accentColor: "#8b5cf6",
    accentLight: "#ede9fe",
    conclusion:
      "L'IA n'est pas là pour remplacer les entrepreneurs africains — elle est là pour les propulser. Ceux qui l'adoptent aujourd'hui auront 5 ans d'avance sur ceux qui attendent. Commence avec les outils gratuits (ChatGPT Free, Canva AI), maîtrise-les, puis investis dans les versions premium quand tes revenus le permettent.",
    chapters: [
      {
        title: "Les outils IA essentiels pour ton business (et lesquels sont gratuits)",
        intro: "Il existe des centaines d'outils IA, mais tu n'en as besoin que de 5 pour transformer ton business. Ce chapitre te donne la liste précise, avec les liens et les versions gratuites disponibles.",
        sections: [
          {
            heading: "Le top 5 des outils IA pour les entrepreneurs africains",
            body: "",
            listItems: [
              "1. ChatGPT (chat.openai.com) — rédaction, idées, scripts, réponses clients",
              "2. Canva AI (canva.com) — visuels professionnels avec IA intégrée",
              "3. Gamma (gamma.app) — créer des présentations et brochures en 30 secondes",
              "4. ElevenLabs (elevenlabs.io) — voix off professionnelle pour tes vidéos",
              "5. Remove.bg (remove.bg) — supprimer le fond d'une photo instantanément",
            ],
          },
          {
            type: "tip",
            body: "Tous ces outils ont une version gratuite suffisante pour démarrer. ChatGPT Free (GPT-3.5) est gratuit et accessible depuis l'Afrique sans VPN. Commence par lui — il fera 80 % du travail.",
          },
          {
            heading: "Installer et configurer ChatGPT en français",
            body: "",
            listItems: [
              "Va sur chat.openai.com et crée un compte avec ton Gmail",
              "Commence toujours tes prompts par 'Réponds en français' ou configure la langue",
              "Dis à ChatGPT qui tu es et ce que tu fais pour des réponses plus précises",
              "Exemple : 'Je suis couturière à Abidjan, ma cible ce sont les femmes de 25-40 ans...'",
            ],
          },
          {
            type: "exercise",
            body: "Crée ton profil ChatGPT en 10 minutes",
            listItems: [
              "Crée ton compte ChatGPT (gratuit)",
              "Envoie ce message : 'Tu es mon assistant business. Je suis [métier] à [ville]. Ma cible : [description]. Mon offre principale : [description]. Mémorise ces infos pour toutes nos conversations.'",
              "Teste avec une première demande : 'Rédige 5 posts Instagram pour promouvoir mon service de [ton service]'",
            ],
          },
        ],
      },
      {
        title: "Créer du contenu 10x plus vite avec l'IA",
        intro: "La création de contenu est souvent le principal obstacle des entrepreneurs africains. L'IA élimine ce problème. Ce chapitre te donne les prompts exacts pour générer du contenu prêt à publier en moins de 5 minutes.",
        sections: [
          {
            heading: "Les prompts magiques pour les réseaux sociaux",
            body: "",
            listItems: [
              "Post Instagram : 'Écris un post Instagram de 150 mots pour promouvoir [service] auprès de [cible]. Inclus 5 emojis, une question finale et 10 hashtags en français.'",
              "Story TikTok : 'Écris un script de 60 secondes pour TikTok sur [sujet]. Commence par une phrase choc. Inclus un appel à l'action à la fin.'",
              "Statut WhatsApp : 'Écris 5 statuts WhatsApp courts (max 2 lignes) pour vendre [produit] aujourd'hui. Chacun doit créer une urgence différente.'",
              "Email client : 'Écris un email de relance pour un prospect qui a demandé un devis il y a 3 jours mais n'a pas répondu. Ton de ton: chaleureux et non pressant.'",
            ],
          },
          {
            type: "example",
            body: "Test en direct : Lance ChatGPT et entre ce prompt exactement — 'Écris 5 accroches TikTok pour vendre des formations en ligne à des entrepreneurs africains. Chaque accroche doit tenir en 1 phrase et créer de la curiosité.' Tu obtiendras 5 idées prêtes à l'emploi en 10 secondes.",
          },
          {
            heading: "Créer des visuels professionnels avec Canva AI",
            body: "",
            listItems: [
              "Ouvre Canva (canva.com) → crée un compte gratuit",
              "Clique sur 'Magic Design' et décris ce que tu veux en français",
              "Exemple : 'Affiche pour une boutique de mode africaine, couleurs violettes et dorées'",
              "Canva génère automatiquement 4 designs professionnels",
              "Personnalise avec ton logo, tes prix et tes photos",
              "Télécharge en PNG pour Instagram ou PDF pour imprimer",
            ],
          },
          {
            type: "exercise",
            body: "Crée 7 jours de contenu en 1 heure",
            listItems: [
              "Ouvre ChatGPT et demande-lui : 'Crée un calendrier de contenu pour 7 jours pour [ton business]. 1 post par jour, thème différent chaque jour.'",
              "Pour chaque thème, demande le texte complet du post",
              "Ouvre Canva et crée le visuel correspondant (15 min max par visuel)",
              "Planifie les publications sur Meta Business Suite (gratuit)",
              "Résultat : 7 posts professionnels prêts à publier en 1h de travail",
            ],
          },
        ],
      },
      {
        title: "Automatiser ta prospection et tes ventes avec l'IA",
        intro: "L'IA peut aussi t'aider à trouver des clients, rédiger des propositions commerciales et gérer tes suivis. Ce chapitre te montre comment automatiser ta prospection sans la déshumaniser.",
        sections: [
          {
            heading: "Rédiger des propositions commerciales en 2 minutes",
            body: "Une bonne proposition commerciale peut faire la différence entre un client qui dit oui et un qui dit 'je vais réfléchir'. L'IA te permet d'en créer des dizaines, personnalisées pour chaque prospect.",
          },
          {
            type: "example",
            body: "Prompt pour une proposition commerciale : 'Rédige une proposition commerciale professionnelle pour [nom du prospect/entreprise] qui cherche [leur besoin]. Je propose [ton service] pour [ton prix]. Inclus : présentation, solution proposée, tarif, délai, garantie. Format: texte clair adapté à WhatsApp.'",
          },
          {
            heading: "Scripts de vente générés par IA",
            body: "",
            listItems: [
              "Prompt premier contact : 'Écris un message de prospection WhatsApp pour [type de prospect]. Objectif : obtenir un rendez-vous. Max 100 mots. Naturel et humain.'",
              "Prompt gestion d'objection : 'Mon prospect dit [objection exacte]. Comment répondre pour rassurer et maintenir l'intérêt ? Donne-moi 3 réponses différentes.'",
              "Prompt relance : 'Écris un message de relance pour un prospect qui n'a pas répondu depuis 5 jours. Chaleureux, bref, sans pression.'",
            ],
          },
          {
            type: "tip",
            body: "Astuce d'expert : demande toujours à ChatGPT de reformuler dans 'un style africain francophone naturel'. Les textes seront plus adaptés à ton audience locale et moins robotiques.",
          },
          {
            type: "exercise",
            body: "Tes 5 scripts de vente IA à créer maintenant",
            listItems: [
              "Script 1 : Premier contact WhatsApp (prospection à froid)",
              "Script 2 : Réponse à 'C'est trop cher'",
              "Script 3 : Réponse à 'Je dois y réfléchir'",
              "Script 4 : Relance après devis sans réponse",
              "Script 5 : Message de remerciement après achat + demande d'avis",
            ],
          },
        ],
      },
      {
        title: "Cas pratiques et prompts avancés pour ton business",
        intro: "Ce dernier chapitre te donne des cas pratiques concrets selon ton domaine d'activité, avec des prompts spécialisés à copier-coller directement.",
        sections: [
          {
            heading: "Pour les vendeurs et commerçants",
            body: "",
            listItems: [
              "'Crée 10 descriptions de produits percutantes pour [liste de produits] destinées à des clients africains.'",
              "'Écris un script pour présenter ma boutique en 60 secondes pour une vidéo TikTok.'",
              "'Génère 5 idées de promotions originales pour attirer des clients ce weekend.'",
            ],
          },
          {
            heading: "Pour les prestataires de services",
            body: "",
            listItems: [
              "'Rédige une FAQ complète pour [ton service] avec 10 questions et réponses.'",
              "'Crée un document de présentation de mon agence [domaine] en 1 page.'",
              "'Écris 3 témoignages clients fictifs mais réalistes pour illustrer mon portfolio.'",
            ],
          },
          {
            heading: "Pour les formateurs et coaches",
            body: "",
            listItems: [
              "'Crée le plan détaillé d'une formation de 2h sur [sujet] pour des débutants africains.'",
              "'Rédige 5 emailings pour une séquence de vente d'une formation à [prix].'",
              "'Génère 30 idées de contenus Instagram pour un coach business africain.'",
            ],
          },
          {
            type: "exercise",
            body: "Défi IA 7 jours : applique 1 prompt par jour",
            listItems: [
              "Jour 1 : Génère 10 idées de posts pour ce mois",
              "Jour 2 : Crée une proposition commerciale complète",
              "Jour 3 : Génère 5 scripts de réponse aux objections",
              "Jour 4 : Crée une bio complète pour tous tes réseaux",
              "Jour 5 : Génère ton catalogue de services formaté",
              "Jour 6 : Crée 5 statuts WhatsApp prêts à publier",
              "Jour 7 : Rédige un email newsletter pour tes clients",
            ],
          },
        ],
      },
    ],
  },

  "whatsapp-business": {
    id: "whatsapp-business",
    title: "Comment prospecter et vendre sur WhatsApp Business en Afrique ?",
    subtitle: "La méthode terrain pour trouver des clients et convertir sans budget pub",
    tagline: "✦ Formation Pratique · 100 FCFA ✦",
    accentColor: "#10b981",
    accentLight: "#d1fae5",
    conclusion:
      "La prospection WhatsApp est l'une des méthodes les plus efficaces et les moins coûteuses pour développer un business en Afrique. Avec un profil professionnel, des messages adaptés et une routine de prospection quotidienne, tu peux générer 5 à 15 nouveaux clients par mois sans dépenser un franc en publicité.",
    chapters: [
      {
        title: "Préparer son profil WhatsApp Business pour vendre",
        intro: "Avant de prospecter, ton profil doit donner confiance. Un profil mal configuré fait fuir les prospects avant même que tu aies parlé.",
        sections: [
          {
            heading: "Les 6 éléments d'un profil WhatsApp Business qui convertit",
            body: "",
            listItems: [
              "Photo de profil : professionnelle, claire, souriante (pas de selfie flou)",
              "Nom de business : clair et mémorable, pas de chiffres aléatoires",
              "Description : 3 lignes max — ce que tu fais, pour qui, ce qu'ils gagnent",
              "Horaires de disponibilité : indique tes vraies heures de réponse",
              "Catalogue : minimum 3 produits/services avec photos et prix",
              "Lien direct : crée ton lien wa.me/[ton numéro] et partage-le partout",
            ],
          },
          {
            type: "exercise",
            body: "Audit rapide de ton profil actuel",
            listItems: [
              "Ouvre ton profil WhatsApp Business",
              "Note ce qui manque parmi les 6 éléments ci-dessus",
              "Complète chaque élément manquant dans les 24h",
              "Demande à 3 personnes de ton entourage : 'Est-ce que tu ferais confiance à ce business ?'",
            ],
          },
        ],
      },
      {
        title: "Trouver des prospects et les approcher efficacement",
        intro: "La prospection WhatsApp ne veut pas dire envoyer des messages en masse à des inconnus. Voici la méthode qui marche vraiment.",
        sections: [
          {
            heading: "Les 5 sources de prospects WhatsApp gratuites",
            body: "",
            listItems: [
              "1. Tes contacts existants — commence par les personnes qui te connaissent déjà",
              "2. Groupes WhatsApp thématiques — rejoins des groupes de ta cible",
              "3. Commentaires Facebook/TikTok — contacte les gens qui commentent tes publications",
              "4. Recommandations clients — chaque client satisfait peut t'en amener 3",
              "5. Événements et marchés locaux — collecte des numéros en face à face",
            ],
          },
          {
            type: "example",
            body: "Script de premier contact (à adapter) : 'Bonjour [Prénom] ! Je m'appelle [Ton prénom] et je suis [ton métier]. J'aide [ta cible] à [résultat]. J'ai vu ton profil/business et je pense pouvoir t'aider. Est-ce que tu as 5 minutes cette semaine pour qu'on en parle ?'",
          },
          {
            type: "tip",
            body: "Règle d'or : prospecte 10 contacts par jour, 5 jours sur 7. À ce rythme, tu contactes 200 prospects par mois. Avec un taux de conversion de 5 %, c'est 10 nouveaux clients sans dépenser un franc.",
          },
          {
            type: "exercise",
            body: "Ta routine de prospection quotidienne",
            listItems: [
              "Chaque matin : identifie 10 nouveaux prospects (15 min)",
              "Envoie les messages personnalisés (20 min)",
              "Réponds aux réponses reçues la veille (15 min)",
              "Relance les prospects qui n'ont pas répondu depuis 3 jours (10 min)",
              "Total : 1h par jour pour une prospection sérieuse et constante",
            ],
          },
        ],
      },
      {
        title: "Transformer les conversations en ventes concrètes",
        intro: "Une fois qu'un prospect te répond, tout se joue dans les 10 prochains messages. Ce chapitre te donne la méthode pour convertir les conversations en ventes.",
        sections: [
          {
            heading: "La méthode AIDA adaptée à WhatsApp",
            body: "",
            listItems: [
              "A — Attention : ton premier message doit créer de la curiosité",
              "I — Intérêt : présente un problème que ton prospect reconnaît",
              "D — Désir : montre le résultat qu'il peut obtenir grâce à toi",
              "A — Action : propose une étape simple et sans risque (démo, devis, appel)",
            ],
          },
          {
            heading: "Les 3 objections les plus fréquentes et comment les gérer",
            body: "",
            listItems: [
              "'C'est trop cher' → 'Je comprends. Si ce produit te permet de [résultat], est-ce que tu considères que ça vaut [prix] ?'",
              "'Je vais réfléchir' → 'Bien sûr ! Pour t'aider à réfléchir, qu'est-ce qui te retient encore ?'",
              "'Je n'ai pas le temps' → 'Je comprends. C'est justement pour ça que [ton service] existe — pour te faire gagner du temps. On peut commencer en 15 min seulement.'",
            ],
          },
          {
            type: "exercise",
            body: "Joue le jeu avec un ami",
            listItems: [
              "Demande à un ami de jouer le rôle d'un prospect difficile",
              "Présente ton offre en 5 messages maximum",
              "Gère au moins 3 objections différentes",
              "Essaie de conclure la vente sans jamais mettre de pression",
              "Après l'exercice, demande à ton ami ce qui l'aurait convaincu",
            ],
          },
        ],
      },
    ],
  },

  "marketing-affiliation": {
    id: "marketing-affiliation",
    title: "La base du marketing d'affiliation",
    subtitle: "Comprendre et démarrer l'affiliation pour générer tes premières commissions",
    tagline: "✦ Formation Pratique · 100 FCFA ✦",
    accentColor: "#3b82f6",
    accentLight: "#dbeafe",
    conclusion:
      "Le marketing d'affiliation est l'un des business les plus accessibles pour démarrer sans capital. Tu n'as pas besoin d'un produit, pas d'un stock, pas d'un bureau. Tu as juste besoin de comprendre comment recommander les bonnes offres aux bonnes personnes. TRIXHUB est d'ailleurs un excellent programme d'affiliation pour commencer — tu connais déjà le produit, tu vis l'expérience. C'est ton meilleur argument de vente.",
    chapters: [
      {
        title: "Comprendre le marketing d'affiliation en 10 minutes",
        intro: "Le marketing d'affiliation est simple : tu recommandes un produit ou service d'une autre entreprise. Quand quelqu'un achète grâce à ta recommandation, tu reçois une commission. Pas de stock, pas de service client — juste des recommandations.",
        sections: [
          {
            heading: "Comment fonctionne l'affiliation concrètement",
            body: "",
            listItems: [
              "1. Tu rejoins un programme d'affiliation (TRIXHUB, Amazon, etc.)",
              "2. Tu reçois un lien ou code de parrainage unique",
              "3. Tu partages ce lien avec des prospects (réseaux sociaux, WhatsApp, bouche à oreille)",
              "4. Quand quelqu'un achète via ton lien, le système enregistre la vente",
              "5. Tu reçois ta commission automatiquement",
            ],
          },
          {
            heading: "Les avantages de l'affiliation pour les Africains",
            body: "",
            listItems: [
              "Démarrage sans capital — zéro investissement requis au départ",
              "Pas de gestion de stock ou de livraison",
              "Revenus passifs possibles : un lien posté peut générer des ventes pendant des mois",
              "Flexible : tu travailles depuis n'importe où, avec juste ton téléphone",
              "Scalable : plus tu recommandes, plus tu gagnes",
            ],
          },
          {
            type: "example",
            body: "Exemple TRIXHUB : Tu parraines 5 personnes qui s'activent. Tu reçois 1 700 FCFA × 5 = 8 500 FCFA en commissions niveau 1. Ces 5 personnes parrainent chacune 3 personnes → tu reçois 700 FCFA × 15 = 10 500 FCFA supplémentaires. Total : 19 000 FCFA sans vendre un seul produit physique.",
          },
          {
            type: "exercise",
            body: "Identifie les 3 programmes d'affiliation que tu vas rejoindre",
            listItems: [
              "TRIXHUB (tu l'utilises déjà — avantage unique !)",
              "Recherche '2 autres programmes d'affiliation [ton domaine]' sur Google",
              "Pour chaque programme, note : commission %, méthode de paiement, délai de paiement",
              "Crée un tableau comparatif et choisis les 3 meilleurs",
            ],
          },
        ],
      },
      {
        title: "Choisir les bons programmes et les bons produits",
        intro: "Tous les programmes d'affiliation ne se valent pas. Certains paient en retard, d'autres ont des produits de mauvaise qualité qui endommagent ta réputation. Voici comment choisir intelligemment.",
        sections: [
          {
            heading: "Les critères d'un bon programme d'affiliation",
            body: "",
            listItems: [
              "Taux de commission élevé : cherche minimum 20% pour les produits digitaux, 10% pour le physique",
              "Produit que tu utilises ou que tu crois : ta recommandation sera plus convaincante",
              "Paiement fiable et régulier : évite les programmes sans historique de paiement",
              "Support client sérieux : si tu as des questions, quelqu'un répond",
              "Matériaux de promotion disponibles : images, scripts, liens trackés",
            ],
          },
          {
            type: "warning",
            body: "Évite les programmes qui : demandent un paiement pour rejoindre, n'ont pas de CGV claires, paient uniquement en cryptomonnaies obscures, ou promettent des commissions irréalistes (50%+ sur des produits physiques).",
          },
          {
            type: "exercise",
            body: "Teste ton premier programme cette semaine",
            listItems: [
              "Rejoins TRIXHUB si ce n'est pas déjà fait",
              "Trouve ton lien de parrainage dans l'application",
              "Partage-le avec 5 contacts WhatsApp qui pourraient être intéressés",
              "Note les retours et les questions posées pour améliorer ton discours",
            ],
          },
        ],
      },
      {
        title: "Générer tes premières commissions et scaler",
        intro: "La théorie c'est bien, mais l'argent vient de l'action. Ce chapitre te donne la méthode concrète pour générer tes 5 premières commissions.",
        sections: [
          {
            heading: "La méthode des 100 contacts pour tes premières commissions",
            body: "",
            listItems: [
              "Fais la liste de tes 100 contacts les plus proches (WhatsApp, Facebook, réel)",
              "Classe-les par potentiel : qui a un besoin que ton produit affilié résout ?",
              "Contacte les 20 plus pertinents en premier avec un message personnalisé",
              "Partage ton lien uniquement après avoir expliqué la valeur du produit",
              "Suis chaque contact dans un tableau (contacté, intéressé, inscrit, commissionné)",
            ],
          },
          {
            type: "tip",
            body: "La règle d'or de l'affiliation : recommande comme un ami, pas comme un vendeur. 'J'utilise ce service depuis X semaines et voilà ce que ça m'a apporté...' convertit 3x mieux que 'Clique sur mon lien pour t'inscrire'.",
          },
          {
            type: "exercise",
            body: "Plan d'action 30 jours pour tes premières commissions",
            listItems: [
              "Semaine 1 : Rejoins 3 programmes d'affiliation, crée ton message de présentation",
              "Semaine 2 : Contacte 50 personnes de ton réseau (10/jour)",
              "Semaine 3 : Crée 5 posts de contenu sur tes réseaux avec ton lien",
              "Semaine 4 : Analyse les résultats, double ce qui marche, arrête ce qui ne marche pas",
              "Objectif réaliste : 3 à 10 commissions dans le premier mois",
            ],
          },
        ],
      },
    ],
  },

  "business-telephone": {
    id: "business-telephone",
    title: "Créer un business en ligne avec son téléphone",
    subtitle: "Zéro ordinateur, zéro bureau — ton smartphone est tout ce qu'il te faut",
    tagline: "✦ Formation Pratique · 100 FCFA ✦",
    accentColor: "#f59e0b",
    accentLight: "#fef3c7",
    conclusion:
      "Des milliers d'entrepreneurs africains font des millions de FCFA chaque mois avec uniquement leur téléphone. La différence entre eux et les autres, c'est l'action. Ils ont choisi une niche, créé une offre simple, et commencé à vendre — même de façon imparfaite. Ton téléphone est prêt. Es-tu prêt, toi ?",
    chapters: [
      {
        title: "Identifier ton business et ton marché depuis ton téléphone",
        intro: "Le téléphone n'est pas une limitation — c'est un avantage. Il te connecte à tes clients, te permet de créer, de vendre et de livrer. Ce chapitre te guide pour trouver LE business que tu peux lancer cette semaine.",
        sections: [
          {
            heading: "Les 10 business en ligne les plus rentables avec un téléphone en Afrique",
            body: "",
            listItems: [
              "1. Affiliation / Parrainage (TRIXHUB et autres)",
              "2. Revente de données téléphoniques (crédit, internet)",
              "3. Graphisme et création de visuels (Canva depuis le téléphone)",
              "4. Vente de formations et ebooks numériques",
              "5. Gestion de réseaux sociaux pour des businesses locaux",
              "6. Commerce en ligne (revente de produits sans stock)",
              "7. Coaching et consultation (vidéo WhatsApp, appels)",
              "8. Écriture et rédaction (articles, posts, scripts)",
              "9. Traduction et transcription audio",
              "10. Enseignement en ligne (cours de langues, matières scolaires)",
            ],
          },
          {
            type: "exercise",
            body: "Trouve ton business en 20 minutes",
            listItems: [
              "Liste tes 5 compétences ou passions principales",
              "Pour chacune, demande-toi : est-ce que des gens paient pour ça ?",
              "Recherche sur Google : '[ta compétence] + gagner de l'argent en Afrique'",
              "Identifie le business qui combine ce que tu SAIS faire et ce que les gens VEULENT acheter",
              "Objectif : choisir UN business et commencer dans les 48h",
            ],
          },
        ],
      },
      {
        title: "Créer tes offres et tes contenus depuis le téléphone",
        intro: "Avec les bonnes apps, ton téléphone devient un studio créatif complet. Ce chapitre te donne la liste des apps essentielles et comment les utiliser pour créer des offres professionnelles.",
        sections: [
          {
            heading: "Les apps indispensables pour créer avec ton téléphone",
            body: "",
            listItems: [
              "Canva (design graphique) — gratuit, puissant, entièrement en français",
              "CapCut (montage vidéo) — le meilleur éditeur vidéo gratuit pour créateurs",
              "WhatsApp Business (vente et communication) — gratuit",
              "Google Drive (stockage et partage) — 15 Go gratuits",
              "Notion (organisation et prise de notes) — gratuit",
              "Linktree (page de liens pour ta bio) — gratuit",
            ],
          },
          {
            type: "tip",
            body: "Conseil clé : maîtrise PARFAITEMENT 2 apps plutôt que de connaître superficiellement 10. Pour la plupart des business téléphone, Canva + WhatsApp Business suffisent pour démarrer et faire 100 000 FCFA/mois.",
          },
          {
            heading: "Créer ton offre irrésistible",
            body: "",
            listItems: [
              "Formule : [Résultat précis] en [délai] pour [ta cible] à [prix clair]",
              "Exemple : 'Je crée ton logo professionnel en 24h pour 2 000 FCFA'",
              "Exemple : 'Je gère ta page Facebook pendant 1 mois pour 15 000 FCFA'",
              "Évite les offres floues : 'Je fais du graphisme' ne vend pas",
              "Commence par un prix bas pour obtenir tes 3 premiers clients et des avis",
            ],
          },
          {
            type: "exercise",
            body: "Crée ton offre en 30 minutes",
            listItems: [
              "Rédige ton offre avec la formule ci-dessus",
              "Crée un visuel sur Canva avec ta photo, ton offre et ton prix",
              "Partage ce visuel sur ton statut WhatsApp et ta story Instagram",
              "Envoie-le à 10 contacts qui pourraient être intéressés",
              "Réponds à TOUS ceux qui répondent dans la heure",
            ],
          },
        ],
      },
      {
        title: "Gérer tes paiements et faire croître ton business",
        intro: "Un business sans système de paiement clair est un business qui perd des ventes. Ce chapitre te montre comment recevoir des paiements proprement et comment croître ensuite.",
        sections: [
          {
            heading: "Les moyens de paiement pour les business téléphone en Afrique",
            body: "",
            listItems: [
              "Mobile Money (MTN MoMo, Orange Money, Wave) — le plus utilisé, zéro friction",
              "Virement bancaire — pour les gros montants, plus de confiance",
              "Paiement à la livraison — pour les produits physiques locaux",
              "PayPal / Wise / Payoneer — pour les clients internationaux",
              "Jamais de paiement anticipé total pour un nouveau client — demande 50% d'abord",
            ],
          },
          {
            type: "tip",
            body: "Stratégie de croissance : chaque client que tu as satisfait peut t'en amener 3 autres. Après chaque prestation réussie, demande : 'Connais-tu quelqu'un qui aurait besoin du même service ?' C'est la méthode de croissance la plus simple et la plus efficace.",
          },
          {
            type: "exercise",
            body: "Plan de croissance 90 jours",
            listItems: [
              "Mois 1 : Obtenir 3 premiers clients payants — focus sur la livraison parfaite",
              "Mois 2 : Obtenir 5 avis/témoignages — commencer à les afficher partout",
              "Mois 3 : Augmenter les prix de 20% et viser 8-10 clients par mois",
              "Objectif 90 jours : 50 000 à 150 000 FCFA de chiffre d'affaires mensuel",
            ],
          },
        ],
      },
    ],
  },

  "recruter-trixhub": {
    id: "recruter-trixhub",
    title: "Comment recruter pour TRIXHUB sans mentir ?",
    subtitle: "La méthode honnête pour parrainer avec succès et bâtir une équipe durable",
    tagline: "✦ Bonus Offert · 0 FCFA ✦",
    accentColor: "#f59e0b",
    accentLight: "#fef3c7",
    conclusion:
      "Le vrai succès sur TRIXHUB ne vient pas de recruter vite — il vient de recruter bien. 10 filleuls actifs et motivés valent mieux que 50 filleuls inactifs. Sois honnête sur ce qu'est TRIXHUB, sois disponible pour accompagner, et tes revenus seront réels et durables.",
    chapters: [
      {
        title: "Présenter TRIXHUB de façon honnête et convaincante",
        intro: "La force de TRIXHUB, c'est que c'est un vrai programme avec une vraie valeur. Tu n'as pas besoin de mentir ou d'exagérer. La vérité bien présentée est plus convaincante que les fausses promesses.",
        sections: [
          {
            heading: "Ce que TRIXHUB EST (et ce qu'il n'est pas)",
            body: "",
            listItems: [
              "✅ TRIXHUB EST : une plateforme d'affiliation qui récompense le parrainage sur 3 niveaux",
              "✅ TRIXHUB EST : un business réel qui demande un effort de recrutement régulier",
              "✅ TRIXHUB EST : une façon de gagner 1 700 FCFA par filleul direct activé",
              "❌ TRIXHUB N'EST PAS : un moyen de s'enrichir sans travailler",
              "❌ TRIXHUB N'EST PAS : garanti sans effort de recrutement",
              "❌ TRIXHUB N'EST PAS : un investissement (c'est une activité de recrutement)",
            ],
          },
          {
            type: "example",
            body: "Présentation honnête en 3 phrases : 'TRIXHUB est une plateforme d'affiliation. Tu paies 3 600 FCFA une fois pour activer ton compte, puis tu gagnes 1 700 FCFA pour chaque personne que tu parraines. Plus tu recrutes, plus tu gagnes — mais ça demande un vrai travail de recommandation.'",
          },
          {
            heading: "Répondre aux 5 questions les plus fréquentes",
            body: "",
            listItems: [
              "'Est-ce que c'est une arnaque ?' → 'Non. Tu peux voir mon compte et mes paiements si tu veux.'",
              "'Combien je peux gagner ?' → 'Ça dépend de combien de personnes tu recrutes. Avec 5 filleuls actifs, c'est 8 500 FCFA.'",
              "'Et si je ne recrute personne ?' → 'Tu n'auras pas de revenus de parrainage. C'est pourquoi c'est important de le faire avec sérieux.'",
              "'Quand est-ce que je récupère mon argent ?' → 'Dès que tu as recruté quelqu'un d'actif, tu reçois ta commission.'",
              "'Est-ce que c'est difficile ?' → 'Comme tout business, ça demande de la régularité. Avec la bonne méthode, tes 5 premiers filleuls viennent en moins de 2 semaines.'",
            ],
          },
          {
            type: "exercise",
            body: "Prépare ta présentation TRIXHUB",
            listItems: [
              "Écris en 5 phrases ce qu'est TRIXHUB pour toi (utilise tes propres mots)",
              "Prépare les réponses aux 5 objections ci-dessus",
              "Entraîne-toi en te filmant en train de présenter TRIXHUB en 2 minutes",
              "Regarde la vidéo et identifie ce qui sonne faux — corrige",
            ],
          },
        ],
      },
      {
        title: "Recruter des filleuls qui restent actifs et bâtir une équipe solide",
        intro: "Recruter des gens qui ne s'activent jamais est une perte de temps et d'énergie. Ce chapitre te montre comment sélectionner les bons profils et les accompagner vers le succès.",
        sections: [
          {
            heading: "Les profils qui réussissent le mieux sur TRIXHUB",
            body: "",
            listItems: [
              "Des personnes qui ont déjà un réseau actif (commerçants, enseignants, animateurs)",
              "Des personnes motivées par un objectif financier précis (payer les études, loyer, etc.)",
              "Des personnes qui ont du temps à consacrer au recrutement",
              "Des personnes qui font confiance à ta recommandation personnelle",
              "À éviter : les personnes sceptiques sans intention réelle, les personnes sans réseau",
            ],
          },
          {
            type: "tip",
            body: "Ton meilleur argument de recrutement : montrer tes propres résultats. Une capture d'écran de ton solde TRIXHUB ou de tes paiements vaut mille discours.",
          },
          {
            heading: "Accompagner tes filleuls vers leur premier succès",
            body: "",
            listItems: [
              "Aide chaque filleul à activer son compte dans les 48h après l'inscription",
              "Donne-lui ce guide de recrutement dès le début",
              "Fixe un appel WhatsApp ou une rencontre dans la première semaine",
              "Célèbre son premier filleul avec lui — la motivation vient des petites victoires",
              "Crée un groupe WhatsApp avec tes 5 premiers filleuls pour les encourager mutuellement",
            ],
          },
          {
            type: "exercise",
            body: "Ton plan de recrutement pour les 30 prochains jours",
            listItems: [
              "Semaine 1 : Présente TRIXHUB à 15 personnes de ton entourage",
              "Semaine 2 : Fais un live ou un post de témoignage sur TikTok/Facebook",
              "Semaine 3 : Rejoins 3 groupes WhatsApp de ta ville et partage ton lien",
              "Semaine 4 : Demande à tes 3 premiers filleuls de recruter à leur tour",
              "Objectif : 5 filleuls actifs au bout de 30 jours",
            ],
          },
        ],
      },
    ],
  },
};

export function generateFormationPDF(
  formationId: string
): InstanceType<typeof PDFDocument> | null {
  const formation = FORMATION_CONTENTS[formationId];
  if (!formation) return null;

  const doc = new PDFDocument({
    margin: MARGIN,
    size: "A4",
    info: {
      Title: formation.title,
      Author: "TRIXHUB",
      Subject: "Formation Pro",
      Creator: "TRIXHUB Platform",
    },
  });

  coverPage(doc, formation);
  tocPage(doc, formation.chapters, formation.accentColor);

  formation.chapters.forEach((ch, i) => {
    renderChapter(doc, i + 1, ch, formation.accentColor);
  });

  conclusionPage(doc, formation.conclusion, formation.accentColor);

  doc.end();
  return doc;
}
