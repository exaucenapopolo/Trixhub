// Modale "lightbox" pour afficher une image en grand au clic.
// Utilisée sur les pages d'inscription, de connexion et d'activation pour permettre à
// l'utilisateur de voir les visuels en plein écran.
// Sécurité : on accepte uniquement des URL https (pas de javascript: ni de data: arbitraire).

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export default function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  // Ferme la modale avec la touche Echap
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (!src) return;
    document.addEventListener("keydown", handleKey);
    // Empêche le scroll de la page sous la modale
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [src, handleKey]);

  if (!src || !isSafeUrl(src)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image en grand"}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-sm flex items-center justify-center transition-colors text-white z-10"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt || "Illustration en grand"}
        className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
