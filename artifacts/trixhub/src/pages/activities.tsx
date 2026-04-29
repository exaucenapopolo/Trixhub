import { useMemo } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  HelpCircle,
  PlayCircle,
  Compass,
  Sparkles,
  Trophy,
  Flame,
  Calendar,
  Lock,
  ArrowRight,
  Wallet,
  Info,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import {
  useGetWeeklyStatus,
  useConvertWeeklyPoints,
  getGetWeeklyStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

export default function ActivitiesPage() {
  const { data: status, isLoading, refetch } = useGetWeeklyStatus();
  const convert = useConvertWeeklyPoints();
  const { toast } = useToast();
  const qc = useQueryClient();

  const weeklyTotal = status?.weeklyTotal ?? 0;
  const weeklyCap = status?.weeklyCap ?? 700;
  const dailyTotal = status?.dailyTotal ?? 0;
  const dailyCap = status?.dailyCap ?? 100;
  const dayOfWeek = status?.dayOfWeek ?? 0;
  const isSunday = status?.isSunday ?? false;
  const canConvert = status?.canConvert ?? false;
  const wstatus = status?.status ?? "accumulating";
  const dailyBreakdown = status?.dailyBreakdown ?? {};

  const weekProgress = useMemo(
    () => Math.min(100, (weeklyTotal / weeklyCap) * 100),
    [weeklyTotal, weeklyCap],
  );
  const dayProgress = useMemo(
    () => Math.min(100, (dailyTotal / dailyCap) * 100),
    [dailyTotal, dailyCap],
  );

  const handleConvert = async () => {
    try {
      const result = await convert.mutateAsync();
      toast({
        title: "🎉 Conversion réussie !",
        description: `${result.convertedAmount} FCFA crédités sur ton solde activité`,
      });
      await qc.invalidateQueries({ queryKey: getGetWeeklyStatusQueryKey() });
      await refetch();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      toast({
        title: "Conversion impossible",
        description: e.response?.data?.error ?? e.message ?? "Erreur",
        variant: "destructive",
      });
    }
  };

  const activities = [
    {
      key: "quiz",
      title: "Quiz",
      desc: "5 questions IA · 10 pts par bonne réponse",
      reward: status?.activityRewards?.quiz ?? 50,
      Icon: HelpCircle,
      color: "from-blue-500 to-indigo-600",
      ringColor: "ring-blue-500/30",
      href: "/activities/quiz",
      active: true,
    },
    {
      key: "video",
      title: "Vidéo",
      desc: "Regarde une vidéo courte",
      reward: status?.activityRewards?.video ?? 20,
      Icon: PlayCircle,
      color: "from-red-500 to-orange-600",
      ringColor: "ring-red-500/30",
      href: "#",
      active: false,
    },
    {
      key: "discovery",
      title: "Découverte",
      desc: "Visite un partenaire, un produit",
      reward: status?.activityRewards?.discovery ?? 30,
      Icon: Compass,
      color: "from-purple-500 to-fuchsia-600",
      ringColor: "ring-purple-500/30",
      href: "#",
      active: false,
    },
    {
      key: "surprise",
      title: "Surprise",
      desc: "Défi du jour publié par l'admin",
      reward: status?.activityRewards?.surprise ?? 100,
      Icon: Sparkles,
      color: "from-amber-500 to-yellow-600",
      ringColor: "ring-amber-500/30",
      href: "#",
      active: false,
    },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Activités
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gagne jusqu'à <strong>700 points / semaine</strong> · Convertis-les en FCFA chaque dimanche · 1 pt = 1 FCFA
          </p>
        </div>

        {/* Hero progression hebdo */}
        <Card className="overflow-hidden border-2 border-primary/20 shadow-lg">
          <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-6">
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-80 font-bold">
                    Semaine en cours
                  </div>
                  <div className="text-4xl md:text-5xl font-black mt-1">
                    {isLoading ? "—" : weeklyTotal}
                    <span className="text-xl opacity-70 font-bold"> / {weeklyCap} pts</span>
                  </div>
                  <div className="text-xs mt-1 opacity-80">
                    Cap quotidien : {dailyTotal} / {dailyCap} pts aujourd'hui
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide opacity-70 font-bold">Statut</div>
                  <div className="mt-1">
                    {wstatus === "converted" ? (
                      <span className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" /> Convertis
                      </span>
                    ) : wstatus === "expired" ? (
                      <span className="inline-flex items-center gap-1 bg-destructive/30 px-3 py-1 rounded-full text-xs font-bold">
                        <AlertTriangle className="w-3 h-3" /> Expirés
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
                        <Flame className="w-3 h-3" /> En cours
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress hebdo */}
              <div className="space-y-2">
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${weekProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] opacity-80">
                  <span>0 pt</span>
                  <span className="font-bold">{Math.round(weekProgress)}%</span>
                  <span>{weeklyCap} pts</span>
                </div>
              </div>

              {/* Day indicator */}
              <div className="mt-5 flex items-center justify-between gap-1.5">
                {DAYS.map((d, i) => {
                  const points = (dailyBreakdown as Record<string, number>)[String(i)] ?? 0;
                  const isToday = i === dayOfWeek;
                  const isPast = i < dayOfWeek;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 p-2 rounded-lg",
                        isToday && "bg-white/25 ring-2 ring-white",
                      )}
                      data-testid={`day-${i}`}
                    >
                      <div className="text-[10px] font-bold opacity-90">{d}</div>
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          points >= 100
                            ? "bg-amber-400 text-amber-900"
                            : points > 0
                              ? "bg-white/40 text-white"
                              : isPast
                                ? "bg-white/10 text-white/50"
                                : "bg-white/15 text-white/70",
                        )}
                      >
                        {points || (isPast ? "—" : "·")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CTA Conversion */}
          <CardContent className="p-4 bg-card">
            {canConvert ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    700 pts prêts à convertir !
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Reçois <strong>700 FCFA</strong> sur ton solde activité maintenant.
                  </div>
                </div>
                <Button
                  onClick={handleConvert}
                  disabled={convert.isPending}
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold"
                  data-testid="button-convert"
                >
                  {convert.isPending ? "Conversion…" : "Convertir 700 pts → 700 FCFA"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            ) : isSunday && wstatus === "accumulating" ? (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-foreground">Dimanche, mais pas encore 700 pts.</strong>
                  <br />
                  Il te manque <strong>{Math.max(0, 700 - weeklyTotal)} points</strong>. Continue
                  vite avant minuit, sinon les points expireront.
                </div>
              </div>
            ) : wstatus === "converted" ? (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>
                  Tu as déjà converti tes points cette semaine. Crédité :{" "}
                  <strong>{status?.convertedAmount ?? "700"} FCFA</strong>
                </span>
              </div>
            ) : wstatus === "expired" ? (
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span>Semaine expirée. Une nouvelle semaine commence lundi.</span>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  Conversion possible <strong className="text-foreground">dimanche</strong> si tu
                  atteins 700 points. Aujourd'hui : <strong>{DAY_FULL[dayOfWeek]}</strong>.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4 cards activités */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Choisis ton activité
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {activities.map((act) => {
              const Icon = act.Icon;
              return act.active ? (
                <Link key={act.key} href={act.href}>
                  <Card
                    className={cn(
                      "cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all border-2",
                      "ring-2",
                      act.ringColor,
                    )}
                    data-testid={`card-activity-${act.key}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg",
                            act.color,
                          )}
                        >
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground font-medium">Récompense</div>
                          <div className="text-lg font-black text-primary">+{act.reward} pts</div>
                        </div>
                      </div>
                      <div className="font-bold text-base">{act.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">{act.desc}</div>
                      <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
                        Démarrer <ArrowRight className="w-3 h-3" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ) : (
                <Card key={act.key} className="border-2 opacity-60" data-testid={`card-activity-${act.key}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg grayscale",
                          act.color,
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground font-medium">Récompense</div>
                        <div className="text-lg font-black text-muted-foreground">
                          +{act.reward} pts
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-base flex items-center gap-2">
                      {act.title}
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        <Lock className="w-3 h-3" /> Bientôt
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{act.desc}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/retraits/activite">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Retirer mon solde activité</div>
                  <div className="text-xs text-muted-foreground">Minimum 3 500 FCFA · Validé par l'admin</div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Card className="bg-muted/30">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 text-xs">
                <div className="font-bold text-sm mb-1">Comment ça marche ?</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>• Lundi → Samedi : gagne des points</li>
                  <li>• Cap : 100 pts/jour, 700 pts/semaine</li>
                  <li>• Dimanche : convertis 700 pts → 700 FCFA</li>
                  <li>• Sinon, les points expirent à minuit</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
