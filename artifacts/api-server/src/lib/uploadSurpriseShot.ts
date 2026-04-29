import { randomBytes, randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR non configuré");
  return dir;
}

function parsePath(path: string): { bucketName: string; objectName: string } {
  const p = path.startsWith("/") ? path : `/${path}`;
  const parts = p.split("/");
  if (parts.length < 3) throw new Error("Chemin invalide");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

export interface SurpriseShotResult {
  objectPath: string;
  token: string;
  signedUrl: string;
}

/**
 * Upload une capture d'écran de statut WhatsApp vers Object Storage.
 * Génère un token aléatoire pour la servir via notre API
 * et une URL signée temporaire (1h) pour l'envoyer à l'admin via Twilio.
 */
export async function uploadSurpriseShot(params: {
  buffer: Buffer;
  contentType: string;
  userId: number;
}): Promise<SurpriseShotResult> {
  const ext = params.contentType.includes("png")
    ? "png"
    : params.contentType.includes("webp")
      ? "webp"
      : "jpg";

  const filename = `surprises/s-u${params.userId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const fullPath = `${getPrivateObjectDir().replace(/\/$/, "")}/${filename}`;
  const { bucketName, objectName } = parsePath(fullPath);

  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(params.buffer, {
    contentType: params.contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=0, no-store" },
  });

  const token = randomBytes(32).toString("hex");

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + 3 * 3600 * 1000, // 3 heures
  });

  return {
    objectPath: `/objects/${filename}`,
    token,
    signedUrl,
  };
}
