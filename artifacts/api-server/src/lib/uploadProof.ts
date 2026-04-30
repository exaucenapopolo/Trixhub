import { randomBytes, randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";
import { getPublicBaseUrl } from "./getPublicBaseUrl";

function getPrivateObjectDir(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR non configuré");
  return dir;
}

function parsePath(path: string): { bucketName: string; objectName: string } {
  let p = path.startsWith("/") ? path : `/${path}`;
  const parts = p.split("/");
  if (parts.length < 3) throw new Error("Chemin invalide");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

/**
 * Upload une preuve de retrait dans Object Storage.
 * Génère également un jeton aléatoire qui devra être présenté pour télécharger l'objet.
 * Retourne l'objectPath stocké en DB (`/objects/proofs/<file>`) et le jeton.
 */
export async function uploadProofImage(params: {
  buffer: Buffer;
  contentType: string;
  withdrawalId: number;
  userId: number;
}): Promise<{ objectPath: string; token: string }> {
  const ext = params.contentType.includes("png")
    ? "png"
    : params.contentType.includes("webp")
    ? "webp"
    : "jpg";
  const filename = `proofs/wd-${params.withdrawalId}-u${params.userId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const fullPath = `${getPrivateObjectDir().replace(/\/$/, "")}/${filename}`;
  const { bucketName, objectName } = parsePath(fullPath);

  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(params.buffer, {
    contentType: params.contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=0, no-store" },
  });

  // Jeton aléatoire 256 bits → URL non devinable.
  const token = randomBytes(32).toString("hex");

  return { objectPath: `/objects/${filename}`, token };
}

/**
 * URL publique signée pour la preuve : /api/storage/proofs/:withdrawalId/:token
 * Le serveur vérifie en BD que le token correspond avant de servir l'image.
 */
export function getPublicProofUrl(
  req: { protocol: string; get: (h: string) => string | undefined },
  withdrawalId: number,
  token: string,
): string {
  const base = getPublicBaseUrl(req);
  return `${base}/api/storage/proofs/${withdrawalId}/${token}`;
}
