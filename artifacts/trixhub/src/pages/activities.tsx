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
  Clock,
} from "lucide-react";
import {
  useGetWeeklyStatus,
  useConvertWeeklyPoints,
  useGetActivitiesSchedule,
  getGetWeeklyStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const ACTIVITY_META: Record<
  string,
  {
    label: string;
    desc: string;
    reward: string;
    Icon: React.ElementType;
    color: string;
    ringColor: string;
    href: string;
  }
> = {
  quiz: {
    label: "Quiz",
    desc: "5 questions IA · 10 pts par bonne réponse",
    reward: "50 pts max",
    Icon: HelpCircle,
    color: "from-blue-500 to-indigo-600",
    ringColor: "ring-blue-500/30",
    href: "/activities/quiz",
  },
  video: {
    label: "Vidéo",
    desc: "Regarde une vidéo courte",
    reward: "20 pts",
    Icon: PlayCircle,
    color: "from-red-500 to-orange-600",
    ringColor: "ring-red-500/30",
    href: "#",
  },
  discovery: {
    label: "Découverte",
    desc: "Visite un partenaire, un produit",
    reward: "30 pts",
    Icon: Compass,
    color: "from-purple-500 to-fuchsia-600",
    ringColor: "ring-purple-500/30",
    href: "#",
  },
  surprise: {
    label: "Surprise",
    desc: "Défi du jour publié par l'admin",
    reward: "≤100 pts",
    Icon: Sparkles,
    color: "from-amber-500 to-yellow-600",
    ringColor: "ring-amber-500/30",
    href: "#",
  },
};

const DAY_ABBR = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

function localDateStr(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_ABBR[d.getDay()];
}

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

export default function ActivitiesPage() {
  const { data: status, isLoading, refetch } = useGetWeeklyStatus();
  const { data: schedule } = useGetActivitiesSchedule();
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

  // Activités disponibles aujourd'hui selon le calendrier
  const todayActivities = useMemo(() => {
    const today = schedule?.days.find((d) => d.isToday);
    if (!today) {
      // Fallback : quiz toujours disponible, les autres pas encore
      return [
        { type: "quiz", isAvailable: true, isCompleted: false, scheduleId: null },
        { type: "video", isAvailable: false, isCompleted: false, scheduleId: null },
        { type: "discovery", isAvailable: false, isCompleted: false, scheduleId: null },
        { type: "surprise", isAvailable: false, isCompleted: false, scheduleId: null },
      ];
    }
    return today.activities;
  }, [schedule]);

  const handleConvert = async () => {
    try {
      const result = await convert.mutateAsync();
      toast({
        title: "🎉 Conversion réussie !",
        description: `${fmtFCFA(result.convertedAmount ?? 700)} crédités sur ton solde activité`,
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
                    Aujourd'hui : {dailyTotal} / {dailyCap} pts
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

              {/* Progress bar hebdo */}
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

              {/* Day indicator Lundi→Dimanche */}
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
                        {points > 0 ? points : isPast ? "—" : "·"}
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
                  vite avant minuit !
                </div>
              </div>
            ) : wstatus === "converted" ? (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>
                  Tu as converti cette semaine. Crédité :{" "}
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
                  atteins 700 pts. Aujourd'hui :{" "}
                  <strong className="text-foreground">{DAY_FULL[dayOfWeek]}</strong>.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activités disponibles aujourd'hui */}
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Activités disponibles aujourd'hui
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {todayActivities.map((act) => {
              const meta = ACTIVITY_META[act.type];
              if (!meta) return null;
              const Icon = meta.Icon;
              const isRouteable = act.isAvailable && !act.isCompleted && meta.href !== "#";

              const cardContent = (
                <Card
                  className={cn(
                    "border-2 transition-all",
                    act.isCompleted
                      ? "border-green-500/30 bg-green-500/5"
                      : act.isAvailable
                        ? cn("cursor-pointer hover:shadow-xl hover:-translate-y-0.5 ring-2", meta.ringColor)
                        : "opacity-55",
                  )}
                  data-testid={`card-activity-${act.type}`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-lg",
                          meta.color,
                          (!act.isAvailable || act.isCompleted) && "grayscale",
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground font-medium">Récompense</div>
                        <div className={cn(
                          "text-lg font-black",
                          act.isCompleted ? "text-green-600 dark:text-green-400" : act.isAvailable ? "text-primary" : "text-muted-foreground",
                        )}>
                          {act.isCompleted ? "✓ Fait" : `+${meta.reward}`}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-base flex items-center gap-2 flex-wrap">
                      {meta.label}
                      {act.isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Déjà fait
                        </span>
                      )}
                      {!act.isAvailable && !act.isCompleted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <Lock className="w-3 h-3" /> Pas aujourd'hui
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{meta.desc}</div>
                    {act.isAvailable && !act.isCompleted && (
                      <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
                        Démarrer <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );

              return isRouteable ? (
                <Link key={act.type} href={meta.href}>
                  {cardContent}
                </Link>
              ) : (
                <div key={act.type}>{cardContent}</div>
              );
            })}
          </div>
        </div>

        {/* Mini-calendrier 7 jours */}
        {schedule && (
          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Calendrier de la semaine
              </h3>
              <div className="grid grid-cols-7 gap-1.5">
                {schedule.days.map((day) => {
                  const availableCount = day.activities.filter((a) => a.isAvailable).length;
                  const completedCount = day.activities.filter((a) => a.isCompleted).length;
                  const dayLabel = localDateStr(day.date);
                  const dayNum = new Date(day.date + "T00:00:00").getDate();

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-2 rounded-xl",
                        day.isToday
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wide",
                        day.isToday ? "text-primary" : "text-muted-foreground",
                      )}>
                        {dayLabel}
                      </div>
                      <div className={cn(
                        "text-sm font-black",
                        day.isToday ? "text-primary" : "",
                      )}>
                        {dayNum}
                      </div>
                      {/* Dots pour les activités planifiées */}
                      <div className="flex gap-0.5 flex-wrap justify-center">
                        {day.activities.filter((a) => a.isAvailable).map((a) => (
                          <div
                            key={a.type}
                            title={`${ACTIVITY_META[a.type]?.label ?? a.type}${a.isCompleted ? " ✓" : ""}`}
                            className={cn(
                              "w-2 h-2 rounded-full",
                              a.isCompleted
                                ? "bg-green-500"
                                : a.type === "quiz"
                                  ? "bg-blue-500"
                                  : a.type === "video"
                                    ? "bg-red-500"
                                    : a.type === "discovery"
                                      ? "bg-purple-500"
                                      : "bg-amber-500",
                            )}
                          />
                        ))}
                        {availableCount === 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      {completedCount > 0 && (
                        <div className="text-[9px] font-bold text-green-600 dark:text-green-400">
                          {completedCount}/{availableCount}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {Object.entries(ACTIVITY_META).map(([key, meta]) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2.5 h-2.5 rounded-full inline-block",
                      key === "quiz" ? "bg-blue-500" : key === "video" ? "bg-red-500" : key === "discovery" ? "bg-purple-500" : "bg-amber-500",
                    )} />
                    {meta.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  Complété
                </span>
              </div>
            </CardContent>
          </Card>
        )}

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
