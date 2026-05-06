import { useState, useEffect } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  GraduationCap, CheckCircle2, Lock, Loader2, CalendarClock,
  DollarSign, Rocket, MessageSquare, Brain, Zap, ChevronRight,
  Star, Download, ZoomIn, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type FreeFormation = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  category: string;
  downloaded: boolean;
};

type FormationsData = {
  formations: FreeFormation[];
  downloadedToday: boolean;
  totalDownloaded: number;
  total: number;
};

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string; iconBg: string }> = {
  argent:  { label: "Argent & Finance",             icon: DollarSign,   color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10",  border: "border-emerald-500/25",  iconBg: "bg-emerald-500/20"  },
  business:{ label: "Business & Revenus",            icon: Rocket,       color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-500/10",     border: "border-blue-500/25",     iconBg: "bg-blue-500/20"     },
  ventes:  { label: "Ventes & Marketing",            icon: MessageSquare,color: "text-purple-600 dark:text-purple-400",   bg: "bg-purple-500/10",   border: "border-purple-500/25",   iconBg: "bg-purple-500/20"   },
  mindset: { label: "Mindset & Discipline",          icon: Brain,        color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-500/10",    border: "border-amber-500/25",    iconBg: "bg-amber-500/20"    },
  tech:    { label: "Tech & Intelligence Artificielle",icon: Zap,         color: "text-cyan-600 dark:text-cyan-400",       bg: "bg-cyan-500/10",     border: "border-cyan-500/25",     iconBg: "bg-cyan-500/20"     },
};

const IMAGE_MAP: Record<string, string> = {
  "vie-financiere":            "/formation-vie-financiere.jpg",
  "fin-mois-sans-argent":      "/formation-fin-mois-sans-argent.jpg",
  "deuxieme-source-revenu":    "/formation-deuxieme-source-revenu.png",
  "business-stable":           "/formation-business-stable.png",
  "revenus-etudes":            "/formation-revenus-etudes.jpg",
  "canal-plus":                "/formation-canal-plus.jpg",
  "vendre-whatsapp":           "/formation-vendre-whatsapp.png",
  "convertir-contacts":        "/formation-convertir-contacts.png",
  "viral-reseaux":             "/formation-viral-reseaux.jpg",
  "confiance-en-soi":          "/formation-confiance-en-soi.jpg",
  "serieux-30-jours":          "/formation-serieux-30-jours.jpg",
  "controle-90-jours":         "/formation-controle-90-jours.png",
  "meilleure-version":         "/formation-meilleure-version.jpg",
  "telephone":                 "/formation-telephone.jpg",
  "intelligence-artificielle": "/formation-intelligence-artificielle.jpg",
};

function useFormations() {
  const [data, setData] = useState<FormationsData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${BASE}/api/formations/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: FormationsData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);
  return { data, loading, refresh };
}

function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt={alt} className="max-h-[90vh] max-w-full w-auto rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

function FormationCard({
  formation,
  downloadedToday,
  onDownload,
  downloading,
  onImageClick,
}: {
  formation: FreeFormation;
  downloadedToday: boolean;
  onDownload: () => void;
  downloading: boolean;
  onImageClick: (src: string, alt: string) => void;
}) {
  const meta = CATEGORY_META[formation.category] ?? CATEGORY_META.argent;
  const Icon = meta.icon;
  const imgSrc = IMAGE_MAP[formation.id];

  const canDownload = !formation.downloaded && !downloadedToday;
  const blocked = !canDownload || downloading;

  return (
    <div className={cn(
      "bg-card border rounded-2xl overflow-hidden transition-all",
      formation.downloaded
        ? "border-emerald-500/30 bg-emerald-500/5"
        : downloadedToday
          ? "border-card-border opacity-70"
          : "border-card-border hover:border-primary/30 hover:shadow-sm",
    )}>
      {/* Image ou emoji */}
      <div className="relative overflow-hidden">
        {imgSrc ? (
          <div className="relative group cursor-zoom-in" onClick={() => onImageClick(`${BASE}${imgSrc}`, formation.title)}>
            <img src={`${BASE}${imgSrc}`} alt={formation.title} className="w-full h-44 object-cover object-top transition-transform duration-300 group-hover:scale-105" loading="lazy" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/20 backdrop-blur-sm rounded-full p-3">
                <ZoomIn className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("flex items-center justify-center py-8 h-44", meta.bg)}>
            <span className="text-6xl select-none">{formation.emoji}</span>
          </div>
        )}

        {/* Badge catégorie */}
        <div className={cn("absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center shadow-sm", meta.iconBg)}>
          <Icon className={cn("w-3.5 h-3.5", meta.color)} />
        </div>

        {formation.downloaded && (
          <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <CheckCircle2 className="w-3 h-3" />
            Téléchargée
          </div>
        )}

        {imgSrc && (
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>

      {/* Contenu */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug mb-1">{formation.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{formation.description}</p>
        </div>

        {formation.downloaded ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDownload}
            disabled={downloading}
            className="w-full text-xs font-semibold h-9 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Retélécharger
          </Button>
        ) : downloadedToday ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            Reviens demain pour débloquer celle-ci
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onDownload}
            disabled={blocked}
            className="w-full text-xs font-bold h-9"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Download className="w-3.5 h-3.5 mr-1" />}
            Télécharger · Gratuit
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FormationsPage() {
  usePageTitle("Formations");
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, loading, refresh } = useFormations();
  const [downloading, setDownloading] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  if (!user) return null;

  const downloadedToday = data?.downloadedToday ?? false;
  const totalDownloaded = data?.totalDownloaded ?? 0;
  const total = data?.total ?? 15;

  async function handleDownload(formation: FreeFormation) {
    setDownloading(formation.id);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/formations/${formation.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string; code?: string };
        if (json.code === "DAILY_LIMIT") {
          toast({
            title: "Limite quotidienne atteinte",
            description: "Tu as déjà téléchargé une formation aujourd'hui. Reviens demain pour en débloquer une nouvelle.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Erreur", description: json.error ?? "Impossible de télécharger.", variant: "destructive" });
        }
        return;
      }

      // Déclencher le téléchargement du PDF
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trixhub-formation-${formation.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Formation téléchargée !",
        description: formation.downloaded ? "Tu peux la consulter dans tes téléchargements." : "1 formation débloquée. Reviens demain pour la suivante. 📚",
      });

      refresh();
    } finally {
      setDownloading(null);
    }
  }

  // Regrouper par catégorie
  const byCategory: Record<string, FreeFormation[]> = {};
  (data?.formations ?? []).forEach(f => {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  });

  const categoryOrder = ["argent", "business", "ventes", "mindset", "tech"];

  return (
    <Layout>
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mes Formations</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            En tant que membre actif, tu accèdes à <strong>15 formations gratuites</strong>. Télécharge-en <strong>une par jour</strong> — directement en PDF.
          </p>
        </div>

        {/* Progression */}
        {!loading && (
          <div className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary">{totalDownloaded}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {totalDownloaded} / {total} formation{totalDownloaded > 1 ? "s" : ""} téléchargée{totalDownloaded > 1 ? "s" : ""}
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-1.5">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.round((totalDownloaded / total) * 100)}%` }}
                />
              </div>
            </div>
            {downloadedToday && (
              <div className="flex-shrink-0 text-right">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-1 rounded-full block whitespace-nowrap">
                  1 aujourd'hui ✓
                </span>
              </div>
            )}
          </div>
        )}

        {/* CTA Formations Pro */}
        <Link href="/formations-pro">
          <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-purple-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-center gap-4 hover:border-purple-500/30 hover:shadow-sm transition-all cursor-pointer">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-foreground">Formations Pro</p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-500">PRO</span>
              </div>
              <p className="text-xs text-muted-foreground">TikTok, IA, WhatsApp, Affiliation… Des formations à prix mini payées depuis ton solde dépôt. Tu peux les revendre librement.</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </Link>

        {/* Catégories */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          categoryOrder
            .filter(catId => byCategory[catId]?.length)
            .map(catId => {
              const meta = CATEGORY_META[catId];
              const formations = byCategory[catId];
              const doneCount = formations.filter(f => f.downloaded).length;
              const Icon = meta.icon;
              return (
                <div key={catId} className="space-y-4">
                  <div className={cn("flex items-center gap-3 px-1 py-2 rounded-xl border", meta.bg, meta.border)}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-1", meta.iconBg)}>
                      <Icon className={cn("w-4 h-4", meta.color)} />
                    </div>
                    <div>
                      <span className={cn("text-sm font-bold", meta.color)}>{meta.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{doneCount}/{formations.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {formations.map(f => (
                      <FormationCard
                        key={f.id}
                        formation={f}
                        downloadedToday={!f.downloaded && downloadedToday}
                        onDownload={() => handleDownload(f)}
                        downloading={downloading === f.id}
                        onImageClick={(src, alt) => setLightbox({ src, alt })}
                      />
                    ))}
                  </div>
                </div>
              );
            })
        )}

        {/* Note de bas de page */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
          <Lock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">
            1 formation débloquée par jour · Téléchargement immédiat en PDF · Revendre autorisé
          </p>
        </div>

      </div>
    </Layout>
  );
}
