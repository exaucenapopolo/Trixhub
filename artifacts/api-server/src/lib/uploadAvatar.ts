import { randomBytes, randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage";
import { getPublicBaseUrl } from "./getPublicBaseUrl";

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

export const AVATAR_MAX_SIZE = 3 * 1024 * 1024; // 3 Mo

export const ALLOWED_AVATAR_TYPES: ReadonlyArray<string> = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export function avatarExtension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Upload une photo de profil dans Object Storage.
 * Le filename inclut un suffixe aléatoire 256 bits qui sert de "secret" rendant
 * l'URL publique non devinable. Format: avatars/u{userId}-{ts}-{rand}.{ext}.
 * Retourne le chemin stocké en DB ("/objects/avatars/...") et le filename brut.
 */
export async function uploadAvatarImage(params: {
  buffer: Buffer;
  contentType: string;
  userId: number;
}): Promise<{ objectPath: string; filename: string }> {
  const ext = avatarExtension(params.contentType);
  const secret = randomBytes(16).toString("hex"); // 32 chars
  const filename = `avatars/u${params.userId}-${Date.now()}-${secret}-${randomUUID().slice(0, 8)}.${ext}`;
  const fullPath = `${getPrivateObjectDir().replace(/\/$/, "")}/${filename}`;
  const { bucketName, objectName } = parsePath(fullPath);

  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(params.buffer, {
    contentType: params.contentType,
    resumable: false,
    metadata: { cacheControl: "public, max-age=86400" },
  });

  return { objectPath: `/objects/${filename}`, filename };
}

type AvatarLogger = {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
};

/**
 * Supprime un avatar dans Object Storage (best-effort).
 * Les erreurs sont loggées en warn pour observabilité (orphan tracking) mais
 * n'interrompent jamais le caller.
 */
export async function deleteAvatarObject(
  objectPath: string,
  log?: AvatarLogger,
): Promise<void> {
  if (!objectPath || !objectPath.startsWith("/objects/")) return;
  try {
    const filename = objectPath.replace(/^\/objects\//, "");
    const fullPath = `${getPrivateObjectDir().replace(/\/$/, "")}/${filename}`;
    const { bucketName, objectName } = parsePath(fullPath);
    await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
  } catch (err) {
    log?.warn(
      { err, objectPath },
      "AVATAR_DELETE_FAILED — orphan object may remain in storage",
    );
  }
}

/**
 * URL publique pour servir l'avatar. Ne contient pas de token car la photo de
 * profil est par nature publique ; le suffixe aléatoire dans le filename rend
 * l'URL non devinable depuis l'extérieur.
 */
export function getPublicAvatarUrl(
  req: { protocol: string; get: (h: string) => string | undefined },
  filename: string,
): string {
  const base = getPublicBaseUrl(req);
  return `${base}/api/storage/avatars/${filename}`;
}
