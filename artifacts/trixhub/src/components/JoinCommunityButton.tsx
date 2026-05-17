const WHATSAPP_COMMUNITY_URL = "https://whatsapp.com/channel/0029Vb7W0X4IyPtXGFuPoK3W";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

interface JoinCommunityButtonProps {
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
        <WhatsAppIcon className="w-3.5 h-3.5" />
        Rejoindre la communauté WhatsApp
      </a>
    );
  }

  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`block group ${className}`}
      aria-label="Rejoindre le canal WhatsApp de la communauté TRIXHUB (nouvel onglet)"
    >
      <div className="relative overflow-hidden rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent p-4 flex items-center gap-4 hover:border-green-500/60 transition-all hover:shadow-lg hover:shadow-green-500/10 active:scale-[0.99]">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-green-400/10 blur-2xl pointer-events-none" />
        <div className="relative w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-md shadow-green-500/30">
          <WhatsAppIcon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground">Rejoindre la communauté</p>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/25">GRATUIT</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">Canal WhatsApp officiel TRIXHUB · Questions, conseils, entraide</p>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center group-hover:bg-green-500/25 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-green-600 dark:text-green-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </div>
      </div>
    </a>
  );
}
