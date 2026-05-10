import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, ExternalLink, ImageIcon, Loader2, Shield, TrendingUp, Users, X, ZoomIn } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const COUNTRY_FLAGS: Record<string, string> = {
  "Cameroun": "🇨🇲", "Côte d'Ivoire": "🇨🇮", "Sénégal": "🇸🇳", "Mali": "🇲🇱",
  "Burkina Faso": "🇧🇫", "Togo": "🇹🇬", "Bénin": "🇧🇯", "Niger": "🇳🇪",
  "Gabon": "🇬🇦", "Congo-Brazzaville": "🇨🇬", "RD Congo": "🇨🇩", "Ghana": "🇬🇭",
  "Nigeria": "🇳🇬", "Kenya": "🇰🇪", "Rwanda": "🇷🇼", "Guinée": "🇬🇳",
  "Tanzanie": "🇹🇿", "Ouganda": "🇺🇬",
};

const METHOD_COLORS: Record<string, string> = {
  MTN: "bg-yellow-400/20 text-yellow-700 dark:text-yellow-400 border-yellow-400/30",
  Orange: "bg-orange-400/20 text-orange-700 dark:text-orange-400 border-orange-400/30",
  Wave: "bg-blue-400/20 text-blue-700 dark:text-blue-400 border-blue-400/30",
  Moov: "bg-emerald-400/20 text-emerald-700 dark:text-emerald-400 border-emerald-400/30",
};

interface ProofItem {
  id: string;
  amount: number;
  method: string;
  userName: string;
  country: string | null;
  proofImageUrl: string;
  processedAt: string | null;
  description: string | null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function methodLabel(method: string): string {
  if (method.startsWith("mtn")) return "MTN";
  if (method.startsWith("orange")) return "Orange";
  if (method.toLowerCase().includes("wave")) return "Wave";
  if (method.toLowerCase().includes("moov")) return "Moov";
  return method;
}

function ProofCard({ item, onZoom }: { item: ProofItem; onZoom: (url: string) => void }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const label = methodLabel(item.method);
  const colorClass = METHOD_COLORS[label] || "bg-primary/10 text-primary border-primary/20";
  const flag = item.country ? (COUNTRY_FLAGS[item.country] ?? "🌍") : "🌍";

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div
        className="relative bg-muted cursor-zoom-in group"
        style={{ aspectRatio: "4/3" }}
        onClick={() => !imgError && onZoom(item.proofImageUrl)}
      >
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        )}
        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="w-8 h-8 opacity-40" />
            <span className="text-xs opacity-60">Image indisponible</span>
          </div>
        ) : (
          <img
            src={item.proofImageUrl}
            alt={`Preuve retrait #${item.id}`}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              imgLoaded ? "opacity-100" : "opacity-0"
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => { setImgError(true); setImgLoaded(true); }}
          />
        )}
        {imgLoaded && !imgError && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 rounded-full p-2">
              <ZoomIn className="w-4 h-4 text-gray-700" />
            </div>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", colorClass)}>
            {label}
          </span>
        </div>
        <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-0.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      </div>

      <div className="p-3 space-y-1">
        <p className="text-base font-black text-foreground font-mono">
          {formatAmount(item.amount)}
        </p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">
            {flag} {item.userName}{item.country ? ` · ${item.country}` : ""}
          </p>
        </div>
        {item.description && (
          <p className="text-[11px] text-muted-foreground italic leading-snug">"{item.description}"</p>
        )}
        {item.processedAt && (
          <p className="text-[10px] text-muted-foreground/70">{formatDate(item.processedAt)}</p>
        )}
      </div>
    </div>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white bg-white/10 rounded-full p-2 hover:bg-white/20 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={url}
        alt="Preuve de retrait"
        className="max-w-full max-h-[90vh] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function PreuvesPage() {
  usePageTitle("Preuves de retrait — TRIXHUB");
  const [proofs, setProofs] = useState<ProofItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomedUrl, setZoomedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/withdrawals/proofs`)
      .then((r) => r.json())
      .then((data) => {
        setProofs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger les preuves.");
        setLoading(false);
      });
  }, []);

  const totalPaid = proofs.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      {zoomedUrl && <Lightbox url={zoomedUrl} onClose={() => setZoomedUrl(null)} />}

      {/* HEADER */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="p-1.5 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-7 w-7 rounded-lg object-contain" />
          <span className="font-black text-foreground tracking-tight">TRIXHUB</span>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:block">Preuves de retrait réels</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* HERO */}
        <div className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold">
            <Shield className="w-3.5 h-3.5" />
            100% Réels — Aucune mise en scène
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-foreground leading-tight">
            Nos membres retirent<br />
            <span className="text-primary">vraiment leur argent</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Voici les preuves de paiement envoyées par nos membres après réception de leurs retraits.
            Chaque capture est authentique et vérifiée par notre équipe.
          </p>
        </div>

        {/* STATS */}
        {!loading && proofs.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-foreground">{proofs.length}</p>
              <p className="text-xs text-muted-foreground">Retraits prouvés</p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {new Intl.NumberFormat("fr-FR").format(totalPaid)}
              </p>
              <p className="text-xs text-muted-foreground">FCFA versés (prouvés)</p>
            </div>
          </div>
        )}

        {/* GRILLE DES PREUVES */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm">Chargement des preuves…</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16 text-muted-foreground text-sm">{error}</div>
        )}

        {!loading && !error && proofs.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <ImageIcon className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-sm">Aucune preuve disponible pour l'instant.</p>
            <p className="text-xs text-muted-foreground/60">Les preuves apparaissent ici dès qu'un membre envoie sa capture après réception.</p>
          </div>
        )}

        {!loading && proofs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {proofs.map((item) => (
              <ProofCard key={item.id} item={item} onZoom={(url) => setZoomedUrl(url)} />
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 text-center space-y-4">
          <h2 className="font-black text-foreground text-lg">Rejoins-les maintenant</h2>
          <p className="text-sm text-muted-foreground">
            Crée ton compte gratuitement et active-le pour commencer à gagner et retirer.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-all text-sm"
            >
              Créer mon compte
              <ExternalLink className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors text-sm"
            >
              Se connecter
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
