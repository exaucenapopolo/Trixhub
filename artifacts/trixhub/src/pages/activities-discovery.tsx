import { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Compass,
  Trophy,
  Lock,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Download,
  ShoppingCart,
  Star,
  Zap,
  Globe,
  Users,
  TrendingUp,
} from "lucide-react";
import {
  useStartDiscoverySession,
  useClaimDiscoveryPoints,
  useGetActivitiesSchedule,
  getGetWeeklyStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── Fiches publicitaires Social Boost Horizon ──────────────────
const OFFERS = [
  {
    id: "sbh-download",
    icon: Download,
    iconColor: "text-blue-500",
    badge: "Application",
    badgeBg: "bg-blue-500/10 text-blue-600",
    title: "Télécharge Social Boost Horizon",
    headline: "Deviens viral sur les réseaux sociaux !",
    description:
      "Pendant que les autres galèrent à faire décoller leurs pages, toi tu utilises Social Boost Horizon. Commandes de vues, abonnés, likes en quelques secondes. L'application N°1 en Afrique pour booster ta présence en ligne.",
    cta: "Télécharger l'application",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Gratuit",
  },
  {
    id: "sbh-netflix",
    icon: Star,
    iconColor: "text-red-500",
    badge: "Streaming",
    badgeBg: "bg-red-500/10 text-red-600",
    title: "Netflix à prix imbattable",
    headline: "Accède à Netflix Premium pour beaucoup moins cher !",
    description:
      "Fini de payer le plein tarif Netflix. Via Social Boost Horizon, profite d'abonnements Netflix Premium à des prix divisés par 2 ou plus. HD, 4K, profils multiples — tout ce dont tu as besoin sans te ruiner.",
    cta: "Commander sur SBH",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Économies garanties",
  },
  {
    id: "sbh-chatgpt",
    icon: Zap,
    iconColor: "text-emerald-500",
    badge: "IA",
    badgeBg: "bg-emerald-500/10 text-emerald-600",
    title: "ChatGPT Plus moins cher",
    headline: "L'intelligence artificielle à ta portée !",
    description:
      "ChatGPT Plus normalement à 20$/mois ? Via SBH, tu y accèdes à un tarif bien plus avantageux. Rédige du contenu, automatise tes tâches, génère des idées — l'IA au service de ton business.",
    cta: "Voir l'offre ChatGPT",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "IA accessible",
  },
  {
    id: "sbh-canva",
    icon: Star,
    iconColor: "text-purple-500",
    badge: "Design",
    badgeBg: "bg-purple-500/10 text-purple-600",
    title: "Canva Pro à prix réduit",
    headline: "Crée des designs professionnels pour pas cher !",
    description:
      "Canva Pro te donne accès à des milliers de templates premium, la suppression de fond, les exports en haute qualité. Via SBH, obtiens-le à prix réduit et transforme tes créations visuelles.",
    cta: "Commander Canva Pro",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Design pro",
  },
  {
    id: "sbh-reseller",
    icon: TrendingUp,
    iconColor: "text-amber-500",
    badge: "Business",
    badgeBg: "bg-amber-500/10 text-amber-600",
    title: "Deviens revendeur SBH",
    headline: "Crée ton propre business de boost en ligne !",
    description:
      "Avec le compte revendeur Social Boost Horizon, achète des services à prix grossiste et revends-les à tes propres clients. Boost de pages, abonnements streaming, outils IA — tu gères tout et tu gardes la marge.",
    cta: "Ouvrir un compte revendeur",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Revenus passifs",
  },
  {
    id: "sbh-boost-social",
    icon: Users,
    iconColor: "text-sky-500",
    badge: "Réseaux sociaux",
    badgeBg: "bg-sky-500/10 text-sky-600",
    title: "Boost tes réseaux sociaux",
    headline: "Gagne des abonnés, vues et likes en quelques minutes !",
    description:
      "Tu veux plus d'abonnés sur Instagram, TikTok, YouTube ou Facebook ? Social Boost Horizon te propose des services de boost 100% réels et rapides. Plus de visibilité = plus d'opportunités = plus de revenus.",
    cta: "Booster maintenant",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Croissance rapide",
  },
  {
    id: "sbh-website",
    icon: Globe,
    iconColor: "text-teal-500",
    badge: "Création web",
    badgeBg: "bg-teal-500/10 text-teal-600",
    title: "Site web & App mobile à petit prix",
    headline: "Lance ton projet digital sans te ruiner !",
    description:
      "Besoin d'un site vitrine, d'un e-commerce ou d'une application mobile ? Social Boost Horizon connecte les entrepreneurs africains avec des développeurs qualifiés à des tarifs accessibles. Ton business mérite une présence professionnelle.",
    cta: "Commander un site web",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Dès 15 000 FCFA",
  },
  {
    id: "sbh-spotify",
    icon: Star,
    iconColor: "text-green-500",
    badge: "Musique",
    badgeBg: "bg-green-500/10 text-green-600",
    title: "Spotify Premium moins cher",
    headline: "Écoute ta musique sans pub, même hors connexion !",
    description:
      "Spotify Premium sans les publicités, avec le téléchargement hors ligne et la qualité audio supérieure — disponible via Social Boost Horizon à un tarif largement inférieur au prix officiel.",
    cta: "Commander Spotify",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Sans pub",
  },
  {
    id: "sbh-order",
    icon: ShoppingCart,
    iconColor: "text-orange-500",
    badge: "Commande rapide",
    badgeBg: "bg-orange-500/10 text-orange-600",
    title: "Commande un service maintenant",
    headline: "Plus de 50 services disponibles sur SBH !",
    description:
      "Netflix, Spotify, ChatGPT, Canva Pro, boost Instagram, TikTok, YouTube, création de site web, application mobile... Social Boost Horizon regroupe tout ce dont tu as besoin pour ton business et ton quotidien numérique.",
    cta: "Voir le catalogue complet",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "+50 services",
  },
  {
    id: "sbh-viral",
    icon: TrendingUp,
    iconColor: "text-pink-500",
    badge: "Viral",
    badgeBg: "bg-pink-500/10 text-pink-600",
    title: "Deviens viral sur TikTok & Instagram",
    headline: "Les créateurs qui cartonnent utilisent SBH !",
    description:
      "Tes concurrents utilisent des outils de boost pendant que tu attends que l'algorithme te remarque ? Stop. Social Boost Horizon te donne les mêmes armes que les grands créateurs. Vues, likes, partages — décolle maintenant.",
    cta: "Décoller avec SBH",
    ctaUrl: "https://socialboosthorizon.com/telecharger.html",
    tag: "Tendance",
  },
] as const;

type Offer = (typeof OFFERS)[number];
type Phase = "select" | "visiting" | "ready" | "claiming" | "claimed";

const VISIT_DURATION = 60;

function TimerRing({ timeLeft }: { timeLeft: number }) {
  const pct = (timeLeft / VISIT_DURATION) * 100;
  const color =
    timeLeft > 40 ? "text-emerald-500" : timeLeft > 20 ? "text-amber-500" : "text-red-500";
  const bg =
    timeLeft > 40 ? "bg-emerald-500" : timeLeft > 20 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className={cn("flex flex-col items-center gap-1.5", color)}>
      <div className="text-3xl font-black tabular-nums">{timeLeft}s</div>
      <div className="w-36 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", bg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">avant de pouvoir réclamer</div>
    </div>
  );
}

export default function ActivitiesDiscoveryPage() {
  const { data: schedule, refetch: refetchSchedule } = useGetActivitiesSchedule();
  const [phase, setPhase] = useState<Phase>("select");
  const [selected, setSelected] = useState<Offer | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(VISIT_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs pour la détection de retour (closures stables dans les event listeners)
  const phaseRef = useRef<Phase>("select");
  const hasLeftRef = useRef(false);

  const startMut = useStartDiscoverySession();
  const claimMut = useClaimDiscoveryPoints();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Synchronise phaseRef à chaque changement de phase
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const isAlreadyDone = useMemo(() => {
    const today = schedule?.days.find((d) => d.isToday);
    return today?.activities.find((a) => a.type === "discovery")?.isCompleted ?? false;
  }, [schedule]);

  // Timer de décompte
  useEffect(() => {
    if (phase !== "visiting") return;
    setTimeLeft(VISIT_DURATION);
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

  // ── Détection de retour anticipé (anti-triche) ────────────────
  // Si l'utilisateur revient sur l'onglet TRIXHUB avant la fin des 60s
  // → annulation immédiate + message d'échec
  useEffect(() => {
    if (phase !== "visiting") return;
    hasLeftRef.current = false;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // L'utilisateur a quitté l'onglet — c'est ce qu'on attend
        hasLeftRef.current = true;
      } else if (document.visibilityState === "visible" && hasLeftRef.current) {
        // L'utilisateur est REVENU sur l'onglet
        if (phaseRef.current === "visiting") {
          // Timer pas encore fini → échec
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setPhase("select");
          setSelected(null);
          setSessionId(null);
          setTimeLeft(VISIT_DURATION);
          toast({
            title: "❌ Mission échouée !",
            description:
              "Tu es revenu sur l'application avant la fin des 60 secondes. L'activité n'a pas été réalisée correctement. Recommence et reste sur le site partenaire.",
            variant: "destructive",
          });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [phase, toast]);

  const handleSelectOffer = async (offer: Offer) => {
    setSelected(offer);
    try {
      const result = await startMut.mutateAsync({ data: { offerId: offer.id } });
      setSessionId(result.sessionId);
      setPhase("visiting");
      // Ouvre le lien partenaire dans un nouvel onglet
      window.open(offer.ctaUrl, "_blank", "noopener,noreferrer");
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
        title: "🎉 +30 pts gagnés !",
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
    setTimeLeft(VISIT_DURATION);
  };

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
              <Compass className="w-7 h-7 text-teal-500" />
              Activité Découverte
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Découvre un service partenaire, visite le lien et réclame{" "}
              <strong>+30 pts</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 bg-teal-500/10 px-3 py-2 rounded-xl">
            <Trophy className="w-4 h-4 text-teal-600" />
            <span className="font-bold text-teal-600 text-sm">+30 pts</span>
          </div>
        </div>

        {/* ── Déjà fait ── */}
        {isAlreadyDone && phase !== "claimed" ? (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold">Activité terminée pour aujourd'hui !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Tu as déjà gagné tes 30 pts. Reviens demain pour une nouvelle découverte.
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
          <Card className="border-teal-500/30 bg-teal-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-teal-500/15 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-teal-600" />
              </div>
              <div>
                <div className="text-2xl font-black text-teal-600">+30 pts gagnés !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Bravo ! Reviens demain pour une nouvelle découverte.
                </div>
              </div>
              <Link href="/activities">
                <Button className="mt-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-white">
                  Voir mon score
                  <Trophy className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : phase === "select" ? (
          /* ── Grille des offres ── */
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Choisis une offre, clique sur le CTA pour visiter le site partenaire, puis
              réclame tes points après 60 secondes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {OFFERS.map((offer) => {
                const Icon = offer.icon;
                return (
                  <button
                    key={offer.id}
                    onClick={() => void handleSelectOffer(offer)}
                    disabled={startMut.isPending}
                    className="group text-left rounded-xl border-2 border-border hover:border-teal-400/50 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 bg-card p-4 space-y-3"
                    data-testid={`offer-card-${offer.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Icon className={cn("w-5 h-5", offer.iconColor)} />
                        </div>
                        <div>
                          <div className="text-sm font-bold leading-tight">{offer.title}</div>
                          <span
                            className={cn(
                              "inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-0.5",
                              offer.badgeBg,
                            )}
                          >
                            {offer.badge}
                          </span>
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold bg-teal-500/10 text-teal-600 px-2 py-0.5 rounded-full">
                        {offer.tag}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-foreground/80 leading-snug">
                      {offer.headline}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                      {offer.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-teal-600 text-xs font-semibold group-hover:gap-2.5 transition-all">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {offer.cta}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* ── En cours de visite ── */
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToSelect}
              className="gap-2 text-muted-foreground"
              disabled={phase === "claiming"}
            >
              <ArrowLeft className="w-3 h-3" /> Choisir une autre offre
            </Button>

            {/* Carte de l'offre sélectionnée */}
            {selected && (
              <Card className="border-teal-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <selected.icon className={cn("w-5 h-5", selected.iconColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm">{selected.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {selected.description}
                      </div>
                    </div>
                  </div>

                  <a
                    href={selected.ctaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 text-xs text-teal-600 font-semibold hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Rouvrir : {selected.ctaUrl}
                  </a>
                </CardContent>
              </Card>
            )}

            {/* Timer + bouton réclamer */}
            <Card
              className={cn(
                "border-2 transition-all",
                phase === "ready" || phase === "claiming"
                  ? "border-teal-500/40 bg-teal-500/5"
                  : "border-muted",
              )}
            >
              <CardContent className="p-5 flex flex-col items-center gap-4">
                {phase === "visiting" ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <Clock className="w-4 h-4" />
                      Visite le site partenaire en arrière-plan…
                    </div>
                    <TimerRing timeLeft={timeLeft} />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                      <Lock className="w-3 h-3" />
                      Le bouton apparaîtra dans {timeLeft}s
                    </div>
                    <div className="text-xs text-muted-foreground text-center max-w-xs">
                      Le lien s'est ouvert dans un nouvel onglet. Tu peux y naviguer
                      pendant que le timer défile ici.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-teal-600 font-bold">
                      <Sparkles className="w-5 h-5" />
                      60 secondes atteintes — tu peux réclamer !
                    </div>
                    <Button
                      size="lg"
                      onClick={() => void handleClaim()}
                      disabled={phase === "claiming"}
                      className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold text-base px-8"
                      data-testid="button-claim"
                    >
                      {phase === "claiming" ? "Réclamation en cours…" : "Réclamer +30 pts"}
                      <Trophy className="w-5 h-5 ml-2" />
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Tu peux continuer à explorer le site partenaire puis réclamer quand tu veux.
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
