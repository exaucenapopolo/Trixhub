import { Router } from "express";
import { db } from "@workspace/db";
import { freeFormationDownloadsTable } from "@workspace/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { generateFormationPDF } from "../lib/formationPdf";

const FREE_FORMATIONS_CATALOG: Record<string, { title: string; description: string; emoji: string; category: string }> = {
  "vie-financiere":           { title: "Comment organiser sa vie financière même avec un petit revenu",       description: "Organise ton budget mois par mois, élimine les dépenses inutiles et commence à épargner dès aujourd'hui.",           emoji: "💰", category: "argent"  },
  "fin-mois-sans-argent":     { title: "Comment ne plus finir le mois sans argent",                          description: "Anticipe tes dépenses, évite les emprunts d'urgence et construis un matelas financier qui te protège.",             emoji: "📊", category: "argent"  },
  "deuxieme-source-revenu":   { title: "Comment créer une deuxième source de revenu sans stress",            description: "Identifie 3 sources de revenus adaptées à ton profil et lance la première en moins de 2 semaines.",               emoji: "💎", category: "argent"  },
  "business-stable":          { title: "Comment bâtir un business stable même en partant de rien",           description: "Construis ton activité pas à pas : idée → validation → premiers clients → revenus réguliers.",                     emoji: "🏗️", category: "business" },
  "revenus-etudes":           { title: "Comment gagner ses premiers revenus sans abandonner ses études",      description: "Freelance, affiliation, revente — des méthodes concrètes pour gagner de l'argent en ligne.",                      emoji: "🎓", category: "business" },
  "canal-plus":               { title: "Comment avoir tout Canal+ gratuitement",                             description: "Accède à Canal+ et ses bouquets premium à prix zéro grâce à des techniques légales méconnues.",                   emoji: "📺", category: "business" },
  "vendre-whatsapp":          { title: "Comment vendre sur WhatsApp sans forcer les gens",                   description: "Maîtrise les messages, statuts et groupes WhatsApp pour vendre naturellement, sans harceler tes contacts.",        emoji: "💬", category: "ventes"   },
  "convertir-contacts":       { title: "Comment convertir ses amis et contacts en premiers clients",          description: "Transforme ta liste de contacts en clients fidèles avec des scripts de conversation simples.",                     emoji: "🤝", category: "ventes"   },
  "viral-reseaux":            { title: "Comment devenir viral sur les réseaux sociaux",                      description: "Crée du contenu qui se partage seul : visuels, vidéos courtes, textes accrocheurs — sans budget.",                emoji: "🚀", category: "ventes"   },
  "confiance-en-soi":         { title: "Comment avoir confiance en soi quand personne ne croit en toi",      description: "Développe une confiance inébranlable en toi, même dans les moments de doute, de critique ou d'échec.",            emoji: "💪", category: "mindset"  },
  "serieux-30-jours":         { title: "Comment devenir sérieux et discipliné en 30 jours",                  description: "Plan d'action de 30 jours pour devenir quelqu'un de fiable, constant et productif dans tous les domaines.",      emoji: "🎯", category: "mindset"  },
  "controle-90-jours":        { title: "Comment reprendre le contrôle de sa vie en 90 jours",                description: "Programme de transformation sur 90 jours : santé, finances, relations, mental — reprends les rênes.",             emoji: "🔄", category: "mindset"  },
  "meilleure-version":        { title: "Comment devenir une meilleure version de soi (plan concret)",        description: "Évalue qui tu es aujourd'hui, décide qui tu veux être demain et applique les changements semaine après semaine.", emoji: "⭐", category: "mindset"  },
  "telephone":                { title: "Comment utiliser son téléphone sans gâcher sa vie",                  description: "Utilise ton smartphone comme un outil de croissance, pas de distraction : productivité et apprentissage continu.", emoji: "📱", category: "mindset"  },
  "intelligence-artificielle":{ title: "Comment utiliser l'intelligence artificielle pour améliorer sa vie", description: "Découvre comment ChatGPT, Gemini et les autres IA peuvent te faire gagner des heures chaque jour.",               emoji: "🤖", category: "tech"     },
};

const TZ = "Africa/Douala";

function getTodayStr(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: TZ });
}

const router = Router();

// GET /api/formations/list — liste toutes les formations gratuites avec statut utilisateur
router.get("/formations/list", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const todayStr = getTodayStr();

  // Compter les téléchargements d'aujourd'hui
  const [todayRow] = await db
    .select({ cnt: count() })
    .from(freeFormationDownloadsTable)
    .where(
      and(
        eq(freeFormationDownloadsTable.userId, req.user.id),
        sql`date(${freeFormationDownloadsTable.downloadedAt} AT TIME ZONE 'Africa/Douala') = ${todayStr}::date`
      )
    );

  const downloadedToday = (todayRow?.cnt ?? 0) > 0;

  // Toutes les formations déjà téléchargées
  const rows = await db
    .select({ formationId: freeFormationDownloadsTable.formationId })
    .from(freeFormationDownloadsTable)
    .where(eq(freeFormationDownloadsTable.userId, req.user.id));

  const downloadedIds = new Set(rows.map(r => r.formationId));

  const formations = Object.entries(FREE_FORMATIONS_CATALOG).map(([id, f]) => ({
    id,
    title: f.title,
    description: f.description,
    emoji: f.emoji,
    category: f.category,
    downloaded: downloadedIds.has(id),
  }));

  res.json({
    formations,
    downloadedToday,
    totalDownloaded: downloadedIds.size,
    total: formations.length,
  });
});

// GET /api/formations/:id/download — télécharger une formation gratuite (1 par jour)
router.get("/formations/:id/download", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const formationId = String(req.params.id);
  const formation = FREE_FORMATIONS_CATALOG[formationId];
  if (!formation) {
    res.status(404).json({ error: "Formation introuvable." });
    return;
  }

  // Vérifier si déjà téléchargée
  const [existing] = await db
    .select({ id: freeFormationDownloadsTable.id })
    .from(freeFormationDownloadsTable)
    .where(
      and(
        eq(freeFormationDownloadsTable.userId, req.user.id),
        eq(freeFormationDownloadsTable.formationId, formationId)
      )
    );

  // Vérifier limite quotidienne (seulement si pas encore téléchargée)
  if (!existing) {
    const todayStr = getTodayStr();
    const [todayRow] = await db
      .select({ cnt: count() })
      .from(freeFormationDownloadsTable)
      .where(
        and(
          eq(freeFormationDownloadsTable.userId, req.user.id),
          sql`date(${freeFormationDownloadsTable.downloadedAt} AT TIME ZONE 'Africa/Douala') = ${todayStr}::date`
        )
      );

    if ((todayRow?.cnt ?? 0) > 0) {
      res.status(429).json({ error: "Tu as déjà téléchargé une formation aujourd'hui. Reviens demain.", code: "DAILY_LIMIT" });
      return;
    }

    // Enregistrer le téléchargement
    await db.insert(freeFormationDownloadsTable).values({
      userId: req.user.id,
      formationId,
    });
  }

  const doc = generateFormationPDF(formationId);
  if (!doc) {
    res.status(500).json({ error: "Impossible de générer la formation." });
    return;
  }

  const safeName = formationId.replace(/[^a-z0-9-]/g, "-");
  const filename = `trixhub-formation-${safeName}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  doc.pipe(res);
  doc.on("error", (err: Error) => {
    req.log.error({ err, formationId }, "Free formation PDF generation error");
    if (!res.headersSent) res.status(500).json({ error: "Erreur de génération." });
  });

  req.log.info({ formationId, userId: req.user.id, alreadyDownloaded: !!existing }, "Free formation downloaded");
});

export { FREE_FORMATIONS_CATALOG };
export default router;
