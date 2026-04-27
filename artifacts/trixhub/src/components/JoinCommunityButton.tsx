// Bouton "Rejoindre la communauté" qui redirige vers le canal WhatsApp officiel.
// rel="noopener noreferrer" pour la sécurité (anti tabnabbing).

import { MessageCircle } from "lucide-react";

const WHATSAPP_COMMUNITY_URL = "https://whatsapp.com/channel/0029Vb7W0X4IyPtXGFuPoK3W";

interface JoinCommunityButtonProps {
  /** "full" pour bouton large, "compact" pour bouton lien discret. */
  size?: "full" | "compact";
  className?: string;
}

export default function JoinCommunityButton({ size = "full", className = "" }: JoinCommunityButtonProps) {
  if (size === "compact") {
    return (
      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400 hover:underline ${className}`}
        aria-label="Rejoindre le canal WhatsApp de la communauté TRIXHUB (nouvel onglet)"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Rejoindre la communauté WhatsApp
      </a>
    );
  }

  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl transition-colors shadow-sm shadow-green-500/20 ${className}`}
      aria-label="Rejoindre le canal WhatsApp de la communauté TRIXHUB (nouvel onglet)"
    >
      <MessageCircle className="w-5 h-5" />
      Rejoindre la communauté WhatsApp
    </a>
  );
}
