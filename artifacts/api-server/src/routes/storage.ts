import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db, withdrawalsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * GET /storage/public-objects/*
 * Sert les assets publics depuis PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

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
router.get("/storage/proofs/:withdrawalId/:token", async (req: Request, res: Response) => {
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
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
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

export default router;
