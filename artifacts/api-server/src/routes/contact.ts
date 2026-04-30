import { Router, type IRouter } from "express";
import { eq, and, isNull, gte } from "drizzle-orm";
import { db, usersTable, formationRequestsTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { sendWhatsAppToAssistance } from "../lib/twilio";

const router: IRouter = Router();

// Anti-spam : 1 envoi toutes les 30 secondes par utilisateur, par type (sécurité d'appoint)
const lastSentByUser = new Map<string, number>();
const COOLDOWN_MS = 30 * 1000;

function rateLimited(userId: number, type: string): boolean {
  const key = `${userId}:${type}`;
  const last = lastSentByUser.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  lastSentByUser.set(key, Date.now());
  return false;
}

async function getUser(userId: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return u;
}

function sanitize(text: string, maxLen: number): string {
  return text.replace(/[\r\n]+/g, " ").trim().slice(0, maxLen);
}

// ─────────────────────────────────────────────
// POST /api/contact/canva
// Demande de compte Canva Pro
// ─────────────────────────────────────────────
router.post("/contact/canva", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const user = await getUser(userId);
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  // Pré-check rapide pour message d'erreur clair (race-safe via UPDATE conditionnel ci-dessous).
  if (user.canvaRequestedAt) {
    res.status(409).json({
      error: "Vous avez déjà demandé votre compte Canva Pro. Une seule demande est autorisée par membre.",
      requestedAt: user.canvaRequestedAt.toISOString(),
    });
    return;
  }

  if (rateLimited(userId, "canva")) {
    res.status(429).json({ error: "Patientez 30 secondes avant de réessayer." });
    return;
  }

  const body = req.body as { fullName?: string; canvaEmail?: string };
  const fullName = sanitize(body.fullName ?? "", 80);
  const canvaEmail = sanitize(body.canvaEmail ?? "", 120);

  if (!fullName || fullName.length < 2) {
    res.status(400).json({ error: "Nom complet requis" });
    return;
  }
  if (!canvaEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canvaEmail)) {
    res.status(400).json({ error: "Email Canva invalide" });
    return;
  }

  // ATOMIC : on stampe d'abord (UPDATE conditionnel). Si 0 ligne → quelqu'un l'a fait avant nous.
  // Cela ferme la fenêtre de course entre check et envoi Twilio.
  const stamped = await db.update(usersTable)
    .set({ canvaRequestedAt: new Date() })
    .where(and(eq(usersTable.id, userId), isNull(usersTable.canvaRequestedAt)))
    .returning({ id: usersTable.id });

  if (stamped.length === 0) {
    res.status(409).json({
      error: "Vous avez déjà demandé votre compte Canva Pro. Une seule demande est autorisée par membre.",
    });
    return;
  }

  const message =
    `🎨 Nouvelle demande Canva Pro\n\n` +
    `👤 Nom : ${fullName}\n` +
    `📧 Email Canva : ${canvaEmail}\n` +
    `🌍 Pays : ${user.country}\n` +
    `📱 Téléphone : ${user.phone}\n` +
    `🔗 Code parrainage : ${user.referralCode}\n` +
    `📧 Compte TRIXHUB : ${user.email}`;

  const result = await sendWhatsAppToAssistance(message);
  if (!result.ok) {
    // Rollback du stamp si Twilio échoue, pour ne pas pénaliser le membre.
    await db.update(usersTable)
      .set({ canvaRequestedAt: null })
      .where(eq(usersTable.id, userId));
    res.status(503).json({ error: "Impossible d'envoyer la demande pour le moment. Réessayez plus tard." });
    return;
  }

  req.log.info({ userId, type: "canva" }, "Demande contact envoyée");
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// GET /api/formations/requests
// Liste des formations déjà demandées par l'utilisateur
// ─────────────────────────────────────────────
router.get("/formations/requests", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const requests = await db
    .select({
      id: formationRequestsTable.id,
      formationTitle: formationRequestsTable.formationTitle,
      requestedAt: formationRequestsTable.requestedAt,
    })
    .from(formationRequestsTable)
    .where(eq(formationRequestsTable.userId, userId));

  // Vérifie si l'utilisateur a déjà fait une demande aujourd'hui (heure locale Afrique = UTC+1)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const requestedToday = requests.some(r => r.requestedAt >= todayStart);

  res.json({
    requests: requests.map(r => ({
      id: r.id,
      formationTitle: r.formationTitle,
      requestedAt: r.requestedAt.toISOString(),
    })),
    requestedToday,
    totalRequested: requests.length,
  });
});

// ─────────────────────────────────────────────
// POST /api/contact/formation
// Demande d'accès à une formation (1 par jour, toutes les formations accessibles)
// ─────────────────────────────────────────────
router.post("/contact/formation", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  const user = await getUser(userId);
  if (!user) {
    res.status(401).json({ error: "Utilisateur introuvable" });
    return;
  }

  if (rateLimited(userId, "formation")) {
    res.status(429).json({ error: "Patientez 30 secondes avant de réessayer." });
    return;
  }

  const body = req.body as { title?: string; whatsappNumber?: string };
  const title = sanitize(body.title ?? "", 200);
  const whatsappNumber = sanitize(body.whatsappNumber ?? "", 30);

  if (!title) {
    res.status(400).json({ error: "Titre de la formation requis" });
    return;
  }
  if (!whatsappNumber || whatsappNumber.length < 8) {
    res.status(400).json({ error: "Numéro WhatsApp requis (minimum 8 chiffres)" });
    return;
  }

  // Vérifier si l'utilisateur a déjà demandé une formation aujourd'hui
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayRequest] = await db
    .select({ id: formationRequestsTable.id })
    .from(formationRequestsTable)
    .where(
      and(
        eq(formationRequestsTable.userId, userId),
        gte(formationRequestsTable.requestedAt, todayStart),
      ),
    )
    .limit(1);

  if (todayRequest) {
    res.status(409).json({
      error: "Vous avez déjà demandé une formation aujourd'hui. Revenez demain pour en demander une autre.",
      requestedToday: true,
    });
    return;
  }

  // Vérifier si cette formation a déjà été demandée par cet utilisateur
  const [alreadyRequested] = await db
    .select({ id: formationRequestsTable.id })
    .from(formationRequestsTable)
    .where(
      and(
        eq(formationRequestsTable.userId, userId),
        eq(formationRequestsTable.formationTitle, title),
      ),
    )
    .limit(1);

  if (alreadyRequested) {
    res.status(409).json({
      error: "Vous avez déjà demandé cette formation.",
      alreadyRequested: true,
    });
    return;
  }

  // Insérer la demande
  await db.insert(formationRequestsTable).values({
    userId,
    formationTitle: title,
    whatsappNumber,
  });

  const memberName = user.displayName ?? user.email.split("@")[0];
  const message =
    `📚 *Nouvelle demande de formation*\n\n` +
    `🎯 *Formation :* ${title}\n` +
    `👤 *Membre :* ${memberName}\n` +
    `📱 *WhatsApp :* ${whatsappNumber}\n` +
    `📧 *Email :* ${user.email}\n` +
    `🌍 *Pays :* ${user.country}\n` +
    `🔗 *Code parrainage :* ${user.referralCode}\n\n` +
    `⚡ Contacter ce membre sur WhatsApp dans les plus brefs délais.`;

  const result = await sendWhatsAppToAssistance(message);
  if (!result.ok) {
    // Rollback de l'insertion si WhatsApp échoue
    await db
      .delete(formationRequestsTable)
      .where(
        and(
          eq(formationRequestsTable.userId, userId),
          eq(formationRequestsTable.formationTitle, title),
        ),
      );
    res.status(503).json({ error: "Impossible d'envoyer la demande pour le moment. Réessayez plus tard." });
    return;
  }

  req.log.info({ userId, type: "formation", title, whatsappNumber }, "Demande formation envoyée");
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// POST /api/contact/assistance
// Message libre à l'assistance
// ─────────────────────────────────────────────
router.post("/contact/assistance", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  if (rateLimited(userId, "assistance")) {
    res.status(429).json({ error: "Vous venez d'envoyer un message. Patientez 30 secondes." });
    return;
  }

  const body = req.body as { message?: string; subject?: string };
  const messageText = sanitize(body.message ?? "", 1000);
  const subject = sanitize(body.subject ?? "Demande d'assistance", 100);

  if (!messageText || messageText.length < 5) {
    res.status(400).json({ error: "Votre message doit faire au moins 5 caractères" });
    return;
  }

  const user = await getUser(userId);
  const fullMessage =
    `💬 ${subject}\n\n` +
    `👤 Membre : ${user?.displayName ?? "—"}\n` +
    `📱 Email : ${user?.email ?? "—"}\n` +
    `🌍 Pays : ${user?.country ?? "—"}\n` +
    `🔗 Code : ${user?.referralCode ?? "—"}\n\n` +
    `📝 Message :\n${messageText}`;

  const result = await sendWhatsAppToAssistance(fullMessage);
  if (!result.ok) {
    res.status(503).json({ error: "Impossible d'envoyer le message pour le moment. Réessayez plus tard." });
    return;
  }

  req.log.info({ userId, type: "assistance" }, "Message assistance envoyé");
  res.json({ ok: true });
});

export default router;
