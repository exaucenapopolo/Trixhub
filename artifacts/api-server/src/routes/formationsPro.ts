import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, balancesTable, premiumFormationPurchasesTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CURRENCY_RATES } from "../lib/currency";
import { generateFormationPDF } from "../lib/formationPdf";

export const FORMATIONS_CATALOG: Record<string, { priceFcfa: number; title: string }> = {
  "tiktok-monetisable": { priceFcfa: 250, title: "Comment créer un compte TikTok monétisable depuis l'Afrique ?" },
  "tiktok-clients":     { priceFcfa: 150, title: "Comment transformer TikTok en source de clients ?" },
  "whatsapp-systeme":   { priceFcfa: 150, title: "Comment créer un système WhatsApp qui vend tout seul ?" },
  "ia-vendre":          { priceFcfa: 150, title: "Comment utiliser l'IA pour produire et vendre plus vite ?" },
  "whatsapp-business":  { priceFcfa: 100, title: "Comment prospecter et vendre sur WhatsApp Business en Afrique ?" },
  "marketing-affiliation": { priceFcfa: 100, title: "La base du marketing d'affiliation" },
  "business-telephone": { priceFcfa: 100, title: "Créer un business en ligne avec son téléphone" },
  "recruter-trixhub":   { priceFcfa: 0,   title: "Comment recruter pour TRIXHUB sans mentir ?" },
};

const router = Router();

router.get("/formations-pro", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }
  const purchases = await db
    .select({ formationId: premiumFormationPurchasesTable.formationId })
    .from(premiumFormationPurchasesTable)
    .where(eq(premiumFormationPurchasesTable.buyerId, req.user.id));
  res.json({ purchasedIds: purchases.map(p => p.formationId) });
});

router.post("/formations-pro/purchase", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const { formationId } = req.body as { formationId?: string };
  if (!formationId || !FORMATIONS_CATALOG[formationId]) {
    res.status(400).json({ error: "Formation invalide." });
    return;
  }
  const formation = FORMATIONS_CATALOG[formationId];

  const [existing] = await db
    .select({ id: premiumFormationPurchasesTable.id })
    .from(premiumFormationPurchasesTable)
    .where(
      and(
        eq(premiumFormationPurchasesTable.buyerId, req.user.id),
        eq(premiumFormationPurchasesTable.formationId, formationId)
      )
    );
  if (existing) {
    res.status(409).json({ error: "Formation déjà achetée." });
    return;
  }

  if (formation.priceFcfa === 0) {
    await db.insert(premiumFormationPurchasesTable).values({
      buyerId: req.user.id,
      formationId,
      priceFcfa: 0,
      currency: "XOF",
      priceInCurrency: "0",
    });
    res.json({ ok: true });
    return;
  }

  const [userRow] = await db
    .select({ preferredCurrency: usersTable.preferredCurrency })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  const prefCurrency = userRow?.preferredCurrency;
  const currency =
    prefCurrency && prefCurrency !== "FCFA" && CURRENCY_RATES[prefCurrency]
      ? prefCurrency
      : "XOF";
  const fxRate = CURRENCY_RATES[currency] ?? 1;
  const priceInCurrency = Math.ceil(formation.priceFcfa * fxRate);

  const updated = await db
    .update(balancesTable)
    .set({ depositBalance: sql`${balancesTable.depositBalance}::numeric - ${formation.priceFcfa}` })
    .where(
      and(
        eq(balancesTable.userId, req.user.id),
        sql`${balancesTable.depositBalance}::numeric >= ${formation.priceFcfa}`
      )
    )
    .returning({ newBalance: balancesTable.depositBalance });

  if (!updated.length) {
    res.status(402).json({ error: "Solde dépôt insuffisant.", code: "INSUFFICIENT_BALANCE" });
    return;
  }

  await db.insert(premiumFormationPurchasesTable).values({
    buyerId: req.user.id,
    formationId,
    priceFcfa: formation.priceFcfa,
    currency,
    priceInCurrency: String(priceInCurrency),
  });

  res.json({ ok: true });
});

router.get("/formations-pro/:id/download", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const formationId = String(req.params.id);
  if (!FORMATIONS_CATALOG[formationId]) {
    res.status(404).json({ error: "Formation introuvable." });
    return;
  }

  const [purchase] = await db
    .select({ id: premiumFormationPurchasesTable.id })
    .from(premiumFormationPurchasesTable)
    .where(
      and(
        eq(premiumFormationPurchasesTable.buyerId, req.user.id),
        eq(premiumFormationPurchasesTable.formationId, formationId)
      )
    );

  if (!purchase) {
    res.status(403).json({ error: "Formation non achetée." });
    return;
  }

  const formation = FORMATIONS_CATALOG[formationId];
  const safeName = formationId.replace(/[^a-z0-9-]/g, "-");
  const filename = `trixhub-formation-${safeName}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = generateFormationPDF(formationId);
  if (!doc) {
    res.status(500).json({ error: "Impossible de générer la formation." });
    return;
  }

  doc.pipe(res);
  doc.on("error", (err: Error) => {
    req.log.error({ err, formationId }, "PDF generation error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur de génération." });
    }
  });

  req.log.info({ formationId, userId: req.user.id, title: formation.title }, "Formation PDF downloaded");
});

export default router;
