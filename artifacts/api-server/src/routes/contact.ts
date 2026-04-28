import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { authenticate } from "../middlewares/authenticate";
import { sendWhatsAppToAssistance } from "../lib/twilio";

const router: IRouter = Router();

// Anti-spam : 1 envoi toutes les 30 secondes par utilisateur, par type
const lastSentByUser = new Map<string, number>(); // key = `${userId}:${type}` → timestamp
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
  if (rateLimited(userId, "canva")) {
    res.status(429).json({ error: "Vous venez d'envoyer une demande. Patientez 30 secondes." });
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

  const user = await getUser(userId);
  const message =
    `🎨 Nouvelle demande Canva Pro\n\n` +
    `👤 Nom : ${fullName}\n` +
    `📧 Email Canva : ${canvaEmail}\n` +
    `🌍 Pays : ${user?.country ?? "—"}\n` +
    `🔗 Code parrainage : ${user?.referralCode ?? "—"}\n` +
    `📱 Compte TRIXHUB : ${user?.email ?? "—"}`;

  const result = await sendWhatsAppToAssistance(message);
  if (!result.ok) {
    res.status(503).json({ error: "Impossible d'envoyer la demande pour le moment. Réessayez plus tard." });
    return;
  }

  req.log.info({ userId, type: "canva" }, "Demande contact envoyée");
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// POST /api/contact/formation
// Demande d'inscription à une formation
// ─────────────────────────────────────────────
router.post("/contact/formation", authenticate, async (req, res): Promise<void> => {
  const userId = req.userId!;
  if (rateLimited(userId, "formation")) {
    res.status(429).json({ error: "Vous venez d'envoyer une demande. Patientez 30 secondes." });
    return;
  }

  const body = req.body as { title?: string };
  const title = sanitize(body.title ?? "", 200);
  if (!title) {
    res.status(400).json({ error: "Titre de la formation requis" });
    return;
  }

  const user = await getUser(userId);
  const message =
    `📚 Nouvelle demande de formation\n\n` +
    `🎯 Formation : ${title}\n` +
    `👤 Membre : ${user?.displayName ?? "—"}\n` +
    `🌍 Pays : ${user?.country ?? "—"}\n` +
    `📱 Email : ${user?.email ?? "—"}\n` +
    `🔗 Code parrainage : ${user?.referralCode ?? "—"}`;

  const result = await sendWhatsAppToAssistance(message);
  if (!result.ok) {
    res.status(503).json({ error: "Impossible d'envoyer la demande pour le moment. Réessayez plus tard." });
    return;
  }

  req.log.info({ userId, type: "formation", title }, "Demande contact envoyée");
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
