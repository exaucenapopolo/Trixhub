import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBalancesQueryKey, getGetReferralActivityQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, PlayCircle, Lock, CheckCircle2, Clock, Trophy } from "lucide-react";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

// Catalogue de vidéos courtes (YouTube embed). On garde des vidéos publiques courtes.
const VIDEOS = [
  { id: "v1", title: "Réussir son business en Afrique", url: "https://www.youtube.com/embed/dQw4w9WgXcQ?modestbranding=1&rel=0" },
  { id: "v2", title: "Marketing digital : les bases", url: "https://www.youtube.com/embed/dQw4w9WgXcQ?modestbranding=1&rel=0" },
];

export default function MissionVideoPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState<{ available: boolean; reward: number; nextAvailableAt: string | null } | null>(null);
  const [watching, setWatching] = useState<string | null>(null);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const tickRef = useRef<number | null>(null);

  const REQUIRED_SECONDS = 30;

  const fetchStatus = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const res = await fetch(`${BASE}/api/missions/video/status`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => { void fetchStatus(); }, []);

  // Compteur quand une vidéo est en lecture
  useEffect(() => {
    if (!watching) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    setWatchedSeconds(0);
    tickRef.current = window.setInterval(() => setWatchedSeconds((s) => s + 1), 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [watching]);

  // Démarre la session vidéo côté serveur dès qu'on commence à regarder
  const startWatching = async (videoId: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`${BASE}/api/missions/video/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({ title: "Pas encore disponible", description: data.error || "Réessayez plus tard", variant: "destructive" });
      await fetchStatus();
      return;
    }
    setWatching(videoId);
  };

  const claim = async () => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/missions/video/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Pas encore disponible", description: data.error || "Réessayez plus tard", variant: "destructive" });
      } else {
        toast({
          title: "Récompense créditée !",
          description: `+${formatLocal(data.reward, user)} ajoutés à ton solde missions.`,
        });
        qc.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetReferralActivityQueryKey() });
      }
      setWatching(null);
      await fetchStatus();
    } finally {
      setSubmitting(false);
    }
  };

  const cooldownText = status?.nextAvailableAt
    ? `Prochaine vidéo disponible ${new Date(status.nextAvailableAt).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour aux missions
        </Link>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mission Vidéo</h1>
              <p className="text-xs opacity-90">Regarde 30 sec d'une vidéo pour gagner</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <Trophy className="w-4 h-4" />
            <span className="text-sm font-semibold">Récompense : {formatLocal(status?.reward ?? 75, user)}</span>
          </div>
        </div>

        {/* État cooldown */}
        {status && !status.available && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">Mission temporairement indisponible</p>
              <p className="text-xs text-muted-foreground mt-1">{cooldownText}</p>
            </div>
          </div>
        )}

        {/* Catalogue vidéos */}
        <div className="space-y-3">
          {VIDEOS.map((v) => (
            <div key={v.id} className="bg-card border border-card-border rounded-2xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <PlayCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{v.title}</p>
                  <p className="text-xs text-muted-foreground">Vidéo courte · ~30 sec</p>
                </div>
                {!status?.available ? (
                  <button disabled className="px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Verrouillé
                  </button>
                ) : watching === v.id ? null : (
                  <button
                    onClick={() => void startWatching(v.id)}
                    className="px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                    data-testid={`button-watch-${v.id}`}
                  >
                    Regarder
                  </button>
                )}
              </div>

              {watching === v.id && (
                <div className="border-t border-border">
                  <div className="aspect-video bg-black">
                    <iframe
                      src={v.url + "&autoplay=1"}
                      title={v.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-semibold">{Math.min(watchedSeconds, REQUIRED_SECONDS)} / {REQUIRED_SECONDS} sec</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300"
                        style={{ width: `${Math.min(100, (watchedSeconds / REQUIRED_SECONDS) * 100)}%` }}
                      />
                    </div>
                    {watchedSeconds >= REQUIRED_SECONDS ? (
                      <button
                        onClick={claim}
                        disabled={submitting}
                        className="w-full py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                        data-testid="button-claim-video"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {submitting ? "Crédit en cours..." : `Réclamer ${formatLocal(status?.reward ?? 75, user)}`}
                      </button>
                    ) : (
                      <p className="text-xs text-center text-muted-foreground">
                        Continuez à regarder pour débloquer la récompense...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
