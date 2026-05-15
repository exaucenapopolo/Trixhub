import { useState } from "react";
import { PlayCircle, ChevronDown, ChevronUp, Youtube } from "lucide-react";

interface TutorialVideoProps {
  videoId: string;
  title: string;
  description?: string;
  /**
   * Lorsque true, la vidéo est affichée en grand la 1ère fois,
   * puis réduite en ligne compacte les visites suivantes.
   * L'état "déjà vu" est persisté dans localStorage via `storageKey`.
   */
  smartCollapse?: boolean;
  storageKey?: string;
}

export default function TutorialVideo({
  videoId,
  title,
  description,
  smartCollapse = false,
  storageKey,
}: TutorialVideoProps) {
  const lsKey = storageKey ?? `trixhub_tuto_${videoId}`;

  const [expanded, setExpanded] = useState(() => {
    if (!smartCollapse) return true;
    return !localStorage.getItem(lsKey);
  });
  const [playing, setPlaying] = useState(false);

  const markSeen = () => {
    if (smartCollapse && !localStorage.getItem(lsKey)) {
      localStorage.setItem(lsKey, "1");
    }
  };

  const handlePlay = () => {
    setPlaying(true);
    markSeen();
  };

  const handleExpand = () => {
    setExpanded(true);
    setPlaying(false);
    markSeen();
  };

  const handleCollapse = () => {
    setExpanded(false);
    setPlaying(false);
  };

  /* ── Etat replié (smartCollapse + déjà vu) ── */
  if (smartCollapse && !expanded) {
    return (
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 p-3 bg-muted/40 hover:bg-muted/70 rounded-2xl border border-border/50 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
          <Youtube className="w-4 h-4 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-snug truncate">
            Tutoriel : {title}
          </p>
          <p className="text-[10px] text-muted-foreground">Cliquer pour revoir</p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  /* ── Etat déplié ── */
  return (
    <div className="rounded-2xl overflow-hidden border border-red-500/20 bg-card shadow-sm">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
            <Youtube className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
            {description && (
              <p className="text-[11px] text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {smartCollapse && (
          <button
            onClick={handleCollapse}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Réduire"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Lecteur — format portrait 9:16 pour les YouTube Shorts */}
      <div className="mx-auto px-4 pb-4" style={{ maxWidth: 300 }}>
        <div
          className="relative rounded-xl overflow-hidden bg-black"
          style={{ paddingBottom: "177.78%" }}
        >
          {playing ? (
            <iframe
              className="absolute inset-0 w-full h-full border-0"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <button
              onClick={handlePlay}
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 group"
              style={{
                backgroundImage: `url(https://img.youtube.com/vi/${videoId}/mqdefault.jpg)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-black/35" />
              <div className="relative w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                <PlayCircle className="w-9 h-9 text-white fill-current" />
              </div>
              <span className="relative text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm">
                Appuyer pour regarder
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
