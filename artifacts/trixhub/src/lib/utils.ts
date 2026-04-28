import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/**
 * Convertit le chemin avatar stocké en DB ("/objects/avatars/foo.png") en URL
 * publique servable par l'API ("/api/storage/avatars/foo.png" préfixé du BASE).
 * Retourne null si pas d'avatar.
 */
export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  // Format attendu : /objects/avatars/<filename>
  const match = avatarUrl.match(/^\/objects\/avatars\/(.+)$/);
  if (!match) return null;
  // bust-cache léger lié au filename (filename inclut un timestamp)
  return `${BASE}/api/storage/avatars/${match[1]}`;
}
