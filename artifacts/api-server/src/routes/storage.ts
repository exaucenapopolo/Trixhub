import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { timingSafeEqual } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db, withdrawalsTable, activityCompletionsTable, adminProofsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR non configuré");
  return dir;
}

function parsePrivatePath(path: string): { bucketName: string; objectName: string } {
  const p = path.startsWith("/") ? path : `/${path}`;
  const parts = p.split("/");
  if (parts.length < 3) throw new Error("Chemin invalide");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

/**
 * GET /storage/avatars/:filename
 * Sert une photo de profil utilisateur depuis le bucket privé. La photo est
 * publique par nature (lecture sans auth) mais le filename contient un suffixe
 * aléatoire 256 bits qui rend l'URL non devinable.
 */
router.get("/storage/avatars/:filename", async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = String(req.params.filename ?? "");
    // Garde-fou: filename autorisé uniquement = lettres/chiffres/-/._
    if (!/^[A-Za-z0-9._-]{8,256}$/.test(filename)) {
      res.status(404).json({ error: "Avatar introuvable" });
      return;
    }
    const fullPath = `${getPrivateObjectDir().replace(/\/$/, "")}/avatars/${filename}`;
    const { bucketName, objectName } = parsePrivatePath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Avatar introuvable" });
      return;
    }
    const response: any = await objectStorageService.downloadObject(file, 86400);
    res.status(response.status || 200);
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    }
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving avatar");
    res.status(500).json({ error: "Échec du chargement de l'avatar" });
  }
});

/**
 * GET /storage/public-objects/*
 * Sert les assets publics depuis PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response: any = await objectStorageService.downloadObject(file);
    res.status(response.status || 200);
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    }

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * Comparaison de chaînes en temps constant (évite les attaques timing).
 */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * GET /storage/proofs/:withdrawalId/:token
 * Sert la preuve de paiement uniquement si le jeton correspond à celui stocké
 * en BD pour ce retrait. URL signée à durée illimitée (révocable en supprimant le token).
 */
router.get("/storage/proofs/:withdrawalId/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.withdrawalId), 10);
    const token = String(req.params.token ?? "");
    if (!Number.isFinite(id) || token.length < 32 || token.length > 128) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }

    const [w] = await db.select({
      proofUrl: withdrawalsTable.proofUrl,
      proofToken: withdrawalsTable.proofToken,
    }).from(withdrawalsTable).where(eq(withdrawalsTable.id, id));

    if (!w || !w.proofUrl || !w.proofToken || !safeEqual(w.proofToken, token)) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(w.proofUrl);
    const response: any = await objectStorageService.downloadObject(objectFile);
    res.status(response.status || 200);
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    }
    res.setHeader("Cache-Control", "private, max-age=0, no-store");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }
    req.log.error({ err: error }, "Error serving proof");
    res.status(500).json({ error: "Échec du chargement de la preuve" });
  }
});

/**
 * GET /storage/surprises/:token
 * Sert une capture d'écran de statut WhatsApp via un token opaque (non devinable).
 * Le token est stocké en BD dans activity_completions.payload_proof->>'token'.
 * Pas d'auth requise — le token 256 bits rend l'URL non devinable.
 */
router.get("/storage/surprises/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.params.token ?? "");
    if (!token || token.length < 32 || token.length > 128) {
      res.status(404).json({ error: "Capture d'écran introuvable" });
      return;
    }

    const [match] = await db
      .select({ payloadProof: activityCompletionsTable.payloadProof })
      .from(activityCompletionsTable)
      .where(
        and(
          eq(activityCompletionsTable.activityType, "surprise"),
          sql`${activityCompletionsTable.payloadProof}->>'token' = ${token}`,
        ),
      )
      .limit(1);

    if (!match) {
      res.status(404).json({ error: "Capture d'écran introuvable" });
      return;
    }

    const objectPath = (match.payloadProof as Record<string, unknown>)?.objectPath as
      | string
      | undefined;
    if (!objectPath) {
      res.status(404).json({ error: "Chemin introuvable" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response: any = await objectStorageService.downloadObject(objectFile);
    res.status(response.status || 200);
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    }
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Capture d'écran introuvable" });
      return;
    }
    res.status(500).json({ error: "Échec du chargement" });
  }
});

/**
 * GET /storage/admin-proofs/:id/:token
 * Sert une preuve de retrait publiée par l'admin via un jeton opaque.
 */
router.get("/storage/admin-proofs/:id/:token", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const token = String(req.params.token ?? "");
    if (!Number.isFinite(id) || token.length < 32 || token.length > 128) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }

    const [proof] = await db.select({
      imageUrl: adminProofsTable.imageUrl,
      imageToken: adminProofsTable.imageToken,
    }).from(adminProofsTable).where(eq(adminProofsTable.id, id));

    if (!proof || !proof.imageUrl || !proof.imageToken || !safeEqual(proof.imageToken, token)) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(proof.imageUrl);
    const response: any = await objectStorageService.downloadObject(objectFile);
    res.status(response.status || 200);
    if (response.headers && typeof response.headers.forEach === "function") {
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    }
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Preuve introuvable" });
      return;
    }
    res.status(500).json({ error: "Échec du chargement de la preuve" });
  }
});

export default router;
