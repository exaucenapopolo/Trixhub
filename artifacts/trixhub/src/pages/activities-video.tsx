import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  ArrowLeft,
  PlayCircle,
  Trophy,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  useStartVideoSession,
  useClaimVideoPoints,
  useGetActivitiesSchedule,
  getGetWeeklyStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── Liste des 10 vidéos ─────────────────────────────────────────
const VIDEOS = [
  {
    id: "rXC5OVe2k2o",
    title: "Social Boost Horizon – Commande automatique",
    category: "Tutoriel",
  },
  {
    id: "vEJM0i9xLGs",
    title: "Meilleurs Sets de Stand-Up 2024",
    category: "Stand-Up Comedy",
  },
  {
    id: "EkXKfa3xQSc",
    title: "Best Funny Videos of 2024 – AFV",
    category: "Compilations drôles",
  },
  {
    id: "k6WNXMLTB5o",
    title: "60 Blagues en 60 Minutes",
    category: "Stand-Up Comedy",
  },
  {
    id: "5D8TBicNIb8",
    title: "Animaux les plus drôles de 2024",
    category: "Animaux drôles",
  },
  {
    id: "LLzQjxLEPYI",
    title: "Best Fails – Impossible de ne pas rire",
    category: "Fails & Bloopers",
  },
  {
    id: "l99QwtiWx4o",
    title: "Bill Burr, Kevin Hart & Ronnie Chieng – Live",
    category: "Stand-Up Comedy",
  },
  {
    id: "t71GphcRrr4",
    title: "Funniest Summer Fails – FailArmy",
    category: "Fails & Bloopers",
  },
  {
    id: "HATYKWp91lo",
    title: "Try Not To Laugh Challenge – Part 226",
    category: "Try Not To Laugh",
  },
  {
    id: "CMzctRZQIo0",
    title: "Try Not To Laugh – Best Memes Part 2",
    category: "Try Not To Laugh",
  },
] as const;

type Video = (typeof VIDEOS)[number];
type Phase = "select" | "watching" | "ready" | "claiming" | "claimed";

const WATCH_DURATION = 45; // secondes requises

function ytThumb(videoId: string) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function ytEmbed(videoId: string) {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
}

// ─── Composants ──────────────────────────────────────────────────
function TimerRing({ timeLeft }: { timeLeft: number }) {
  const pct = (timeLeft / WATCH_DURATION) * 100;
  const color =
    timeLeft > 30 ? "text-emerald-500" : timeLeft > 15 ? "text-amber-500" : "text-red-500";
  return (
    <div className={cn("flex flex-col items-center gap-1", color)}>
      <div className="text-3xl font-black tabular-nums">{timeLeft}s</div>
      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color.replace("text-", "bg-"))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">pour réclamer tes points</div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────
export default function ActivitiesVideoPage() {
  usePageTitle('Activité Vidéo');
  const { data: schedule, refetch: refetchSchedule } = useGetActivitiesSchedule();
  const [phase, setPhase] = useState<Phase>("select");
  const [selected, setSelected] = useState<Video | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(WATCH_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startMut = useStartVideoSession();
  const claimMut = useClaimVideoPoints();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Vérifie si l'activité vidéo est déjà faite aujourd'hui
  const isAlreadyDone = useMemo(() => {
    const today = schedule?.days.find((d) => d.isToday);
    return today?.activities.find((a) => a.type === "video")?.isCompleted ?? false;
  }, [schedule]);

  // Démarre le timer à la phase "watching"
  useEffect(() => {
    if (phase !== "watching") return;
    setTimeLeft(WATCH_DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setPhase("ready");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  const handleSelectVideo = async (video: Video) => {
    setSelected(video);
    try {
      const result = await startMut.mutateAsync({ data: { videoId: video.id } });
      setSessionId(result.sessionId);
      setPhase("watching");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Impossible de démarrer",
        description: e.response?.data?.error ?? "Erreur",
        variant: "destructive",
      });
      setSelected(null);
    }
  };

  const handleClaim = async () => {
    if (!sessionId) return;
    setPhase("claiming");
    try {
      const result = await claimMut.mutateAsync({ data: { sessionId } });
      setPhase("claimed");
      await qc.invalidateQueries({ queryKey: getGetWeeklyStatusQueryKey() });
      await refetchSchedule();
      toast({
        title: "🎉 +20 pts gagnés !",
        description: `Total aujourd'hui : ${result.totalToday} pts · Cette semaine : ${result.totalWeek} pts`,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Réclamation impossible",
        description: e.response?.data?.error ?? "Erreur",
        variant: "destructive",
      });
      setPhase("ready");
    }
  };

  const handleBackToSelect = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("select");
    setSelected(null);
    setSessionId(null);
    setTimeLeft(WATCH_DURATION);
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back */}
        <Link href="/activities">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Retour aux activités
          </Button>
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <PlayCircle className="w-7 h-7 text-red-500" />
              Activité Vidéo
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Regarde 45 secondes d'une vidéo et réclame <strong>+20 pts</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-xl">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-bold text-primary text-sm">+20 pts</span>
          </div>
        </div>

        {/* ── Activité déjà faite ── */}
        {isAlreadyDone && phase !== "claimed" ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold">Activité terminée pour aujourd'hui !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Tu as déjà gagné tes 20 pts. Reviens demain pour une nouvelle vidéo.
                </div>
              </div>
              <Link href="/activities">
                <Button variant="outline" className="mt-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour aux activités
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : phase === "claimed" ? (
          /* ── Réclamation réussie ── */
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/15 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-amber-600">+20 pts gagnés !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Bravo ! Reviens demain pour une nouvelle vidéo.
                </div>
              </div>
              <Link href="/activities">
                <Button className="mt-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  Voir mon score
                  <Trophy className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : phase === "select" ? (
          /* ── Grille des vidéos ── */
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Choisis une vidéo, regarde-la au moins 45 secondes, puis réclame tes points.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {VIDEOS.map((video) => (
                <button
                  key={video.id}
                  onClick={() => void handleSelectVideo(video)}
                  disabled={startMut.isPending}
                  className="group text-left rounded-xl overflow-hidden border-2 border-transparent hover:border-primary/40 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                  data-testid={`video-card-${video.id}`}
                >
                  <div className="relative">
                    <img
                      src={ytThumb(video.id)}
                      alt={video.title}
                      className="w-full aspect-video object-cover bg-muted"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow">
                        <PlayCircle className="w-7 h-7 text-red-600 fill-red-600" />
                      </div>
                    </div>
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                      {video.category}
                    </span>
                  </div>
                  <div className="p-2">
                    <div className="text-xs font-bold line-clamp-2 leading-snug">{video.title}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Lecture vidéo + timer ── */
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelect}
              className="gap-2 text-muted-foreground"
              disabled={phase === "claiming"}
            >
              <ArrowLeft className="w-3 h-3" /> Choisir une autre vidéo
            </Button>

            {/* Player YouTube */}
            <Card className="overflow-hidden">
              <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden">
                {selected && (
                  <iframe
                    key={selected.id}
                    src={ytEmbed(selected.id)}
                    title={selected.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
              <CardContent className="p-4">
                <div className="text-sm font-bold mb-1">{selected?.title}</div>
                <div className="text-xs text-muted-foreground">{selected?.category}</div>
              </CardContent>
            </Card>

            {/* Timer + bouton réclamer */}
            <Card
              className={cn(
                "border-2 transition-all",
                phase === "ready" || phase === "claiming"
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-muted",
              )}
            >
              <CardContent className="p-5 flex flex-col items-center gap-4">
                {phase === "watching" ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Clock className="w-4 h-4" />
                      Regarde la vidéo encore un moment…
                    </div>
                    <TimerRing timeLeft={timeLeft} />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                      <Lock className="w-3 h-3" />
                      Le bouton apparaîtra dans {timeLeft}s
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-amber-600 font-bold">
                      <Sparkles className="w-5 h-5" />
                      45 secondes atteintes — tu peux réclamer !
                    </div>
                    <Button
                      size="lg"
                      onClick={() => void handleClaim()}
                      disabled={phase === "claiming"}
                      className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-base px-8"
                      data-testid="button-claim"
                    >
                      {phase === "claiming" ? "Réclamation en cours…" : "Réclamer +20 pts"}
                      <Trophy className="w-5 h-5 ml-2" />
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Tu peux continuer à regarder puis réclamer quand tu veux.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
