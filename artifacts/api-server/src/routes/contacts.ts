import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, balancesTable, contactPurchasesTable } from "@workspace/db/schema";
import { eq, desc, asc, and, count, sql, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CURRENCY_RATES } from "../lib/currency";

const PRICE_PER_CONTACT_FCFA = 2;

const router = Router();

// ─── GET /contacts — infos (count uniquement, pas les données) ───
router.get("/contacts", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé. Active ton compte pour accéder aux contacts." });
    return;
  }

  const [{ total }] = await db.select({ total: count() }).from(usersTable);

  const purchases = await db
    .select({ contactIds: contactPurchasesTable.contactIds })
    .from(contactPurchasesTable)
    .where(eq(contactPurchasesTable.buyerId, req.user.id));

  const alreadyOwnedIds = new Set(purchases.flatMap(p => p.contactIds as number[]));
  const available = Math.max(0, (total ?? 0) - alreadyOwnedIds.size);

  res.json({
    total: total ?? 0,
    alreadyOwned: alreadyOwnedIds.size,
    available,
    pricePerContact: PRICE_PER_CONTACT_FCFA,
  });
});

// ─── POST /contacts/purchase — achat atomique ────────────────────
router.post("/contacts/purchase", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const quantity = parseInt(req.body.quantity);
  const orderType: "newest" | "oldest" = req.body.orderType === "oldest" ? "oldest" : "newest";

  if (!quantity || quantity < 1 || quantity > 10000) {
    res.status(400).json({ error: "Quantité invalide (1 à 10 000 contacts)." });
    return;
  }

  // Devise de l'utilisateur
  const [userRow] = await db
    .select({ country: usersTable.country, preferredCurrency: usersTable.preferredCurrency })
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  const prefCurrency = userRow?.preferredCurrency;
  const currency =
    prefCurrency && prefCurrency !== "FCFA" && CURRENCY_RATES[prefCurrency]
      ? prefCurrency
      : "XOF";
  const fxRate = CURRENCY_RATES[currency] ?? 1;

  // IDs déjà achetés par cet utilisateur
  const prevPurchases = await db
    .select({ contactIds: contactPurchasesTable.contactIds })
    .from(contactPurchasesTable)
    .where(eq(contactPurchasesTable.buyerId, req.user.id));

  const alreadyOwnedIds = new Set(prevPurchases.flatMap(p => p.contactIds as number[]));

  // Contacts disponibles (non encore achetés), dans l'ordre demandé
  const allContacts = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .orderBy(orderType === "newest" ? desc(usersTable.createdAt) : asc(usersTable.createdAt));

  const availableContacts = allContacts.filter(c => !alreadyOwnedIds.has(c.id));

  if (availableContacts.length === 0) {
    res.status(400).json({ error: "Aucun nouveau contact disponible. Tu as déjà acheté tous les contacts disponibles." });
    return;
  }

  const actualQty = Math.min(quantity, availableContacts.length);
  const actualPriceFcfa = actualQty * PRICE_PER_CONTACT_FCFA;
  const actualPriceInCurrency = Math.round(actualPriceFcfa * fxRate * 100) / 100;
  const selectedIds = availableContacts.slice(0, actualQty).map(c => c.id);

  // Transaction atomique : débit deposit_balance + insertion achat
  const result = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(balancesTable)
      .set({ depositBalance: sql`${balancesTable.depositBalance}::numeric - ${actualPriceFcfa}` })
      .where(and(
        eq(balancesTable.userId, req.user!.id),
        sql`${balancesTable.depositBalance}::numeric >= ${actualPriceFcfa}`
      ))
      .returning({ newBalance: balancesTable.depositBalance });

    if (!updated) return null;

    const [purchase] = await tx
      .insert(contactPurchasesTable)
      .values({
        buyerId: req.user!.id,
        quantity: actualQty,
        priceFcfa: actualPriceFcfa.toString(),
        currency,
        priceInCurrency: actualPriceInCurrency.toString(),
        contactIds: selectedIds,
        orderType,
      })
      .returning({ id: contactPurchasesTable.id });

    return { purchase, newBalance: updated.newBalance };
  });

  if (!result) {
    res.status(402).json({
      error: "Solde de dépôt insuffisant.",
      required: actualPriceFcfa,
    });
    return;
  }

  // Récupérer les données des contacts pour le téléchargement immédiat
  const contacts = await db
    .select({ displayName: usersTable.displayName, phone: usersTable.phone, country: usersTable.country })
    .from(usersTable)
    .where(inArray(usersTable.id, selectedIds));

  res.json({
    purchaseId: result.purchase.id,
    quantity: actualQty,
    priceFcfa: actualPriceFcfa,
    currency,
    priceInCurrency: actualPriceInCurrency,
    newBalance: result.newBalance,
    contacts,
  });
});

// ─── GET /contacts/my-purchases — historique ────────────────────
router.get("/contacts/my-purchases", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const purchases = await db
    .select({
      id: contactPurchasesTable.id,
      quantity: contactPurchasesTable.quantity,
      priceFcfa: contactPurchasesTable.priceFcfa,
      currency: contactPurchasesTable.currency,
      priceInCurrency: contactPurchasesTable.priceInCurrency,
      orderType: contactPurchasesTable.orderType,
      createdAt: contactPurchasesTable.createdAt,
    })
    .from(contactPurchasesTable)
    .where(eq(contactPurchasesTable.buyerId, req.user.id))
    .orderBy(desc(contactPurchasesTable.createdAt));

  res.json({ purchases });
});

// ─── GET /contacts/download/:purchaseId — téléchargement VCF ────
router.get("/contacts/download/:purchaseId", authenticate, async (req, res): Promise<void> => {
  if (!req.user?.isActivated) {
    res.status(403).json({ error: "Compte non activé." });
    return;
  }

  const purchaseId = parseInt(String(req.params.purchaseId));
  if (isNaN(purchaseId)) {
    res.status(400).json({ error: "ID d'achat invalide." });
    return;
  }

  const [purchase] = await db
    .select()
    .from(contactPurchasesTable)
    .where(and(
      eq(contactPurchasesTable.id, purchaseId),
      eq(contactPurchasesTable.buyerId, req.user.id)
    ));

  if (!purchase) {
    res.status(404).json({ error: "Achat introuvable." });
    return;
  }

  const contactIds = purchase.contactIds as number[];
  const contacts = await db
    .select({ displayName: usersTable.displayName, phone: usersTable.phone, country: usersTable.country })
    .from(usersTable)
    .where(inArray(usersTable.id, contactIds));

  const lines: string[] = [];
  for (const c of contacts) {
    lines.push("BEGIN:VCARD");
    lines.push("VERSION:3.0");
    lines.push(`FN:${c.displayName} (TRIXHUB)`);
    lines.push(`N:${c.displayName};;;;`);
    lines.push(`TEL;TYPE=CELL,VOICE:${c.phone}`);
    if (c.country) lines.push(`ADR;TYPE=HOME:;;;;;;${c.country}`);
    lines.push("NOTE:Membre TRIXHUB");
    lines.push("END:VCARD");
    lines.push("");
  }

  res.setHeader("Content-Type", "text/vcard; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="contacts-trixhub-${purchaseId}.vcf"`);
  res.send(lines.join("\r\n"));
});

export default router;
