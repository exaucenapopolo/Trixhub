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
  ArrowRight,
  Wallet,
  Info,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Lock,
  Zap,
} from "lucide-react";
import {
  useGetWeeklyStatus,
  useConvertWeeklyPoints,
  useGetActivitiesSchedule,
  getGetWeeklyStatusQueryKey,
  type DayActivity,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ─── Méta des activités ──────────────────────────────────────────
const ACTIVITY_META: Record<
  string,
  {
    label: string;
    shortDesc: string;
    Icon: React.ElementType;
    color: string;
    bgLight: string;
    href: string;
  }
> = {
  quiz: {
    label: "Quiz IA",
    shortDesc: "5 questions d'intelligence artificielle",
    Icon: HelpCircle,
    color: "text-blue-600 dark:text-blue-400",
    bgLight: "bg-blue-500/10",
    href: "/activities/quiz",
  },
  video: {
    label: "Vidéo",
    shortDesc: "Regarde une courte vidéo · +20 pts",
    Icon: PlayCircle,
    color: "text-red-600 dark:text-red-400",
    bgLight: "bg-red-500/10",
    href: "/activities/video",
  },
  discovery: {
    label: "Découverte",
    shortDesc: "Visite un partenaire ou un produit",
    Icon: Compass,
    color: "text-purple-600 dark:text-purple-400",
    bgLight: "bg-purple-500/10",
    href: "#",
  },
  surprise: {
    label: "Surprise",
    shortDesc: "Défi spécial du jour",
    Icon: Sparkles,
    color: "text-amber-600 dark:text-amber-400",
    bgLight: "bg-amber-500/10",
    href: "#",
  },
};

// Couleurs des points par activité (pour le calendrier)
const ACTIVITY_DOT: Record<string, string> = {
  quiz: "bg-blue-500",
  video: "bg-red-500",
  discovery: "bg-purple-500",
  surprise: "bg-amber-500",
};

const DAY_ABBR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DAYS_INDICATOR = ["L", "M", "M", "J", "V", "S", "D"];

function fmtFCFA(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

function dateToLocalDow(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

// ─── Carte d'activité individuelle ───────────────────────────────
function ActivityCard({ act }: { act: DayActivity }) {
  const meta = ACTIVITY_META[act.type];
  if (!meta) return null;
  const Icon = meta.Icon;
  const isRouteable = !act.isCompleted && meta.href !== "#";

  const inner = (
    <Card
      className={cn(
        "border-2 transition-all",
        act.isCompleted
          ? "border-muted bg-muted/30 opacity-75"
          : "border-transparent hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer",
      )}
      data-testid={`card-activity-${act.type}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Icône */}
          <div
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              meta.bgLight,
              act.isCompleted && "grayscale",
            )}
          >
            <Icon className={cn("w-6 h-6", act.isCompleted ? "text-muted-foreground" : meta.color)} />
          </div>

          {/* Points */}
          <div className="text-right">
            {act.isCompleted ? (
              <div className="flex items-center gap-1 text-green-600 dark:text-green-400 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4" />
                Fait !
              </div>
            ) : (
              <div className="text-lg font-black text-primary">+{act.points} pts</div>
            )}
          </div>
        </div>

        <div className="font-bold text-base">{meta.label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{meta.shortDesc}</div>

        {act.isCompleted ? (
          /* Verrouillé — activité déjà faite aujourd'hui */
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Lock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Activité terminée · Reviens demain !</span>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1 text-xs font-bold text-primary">
            Démarrer <ArrowRight className="w-3 h-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return isRouteable ? (
    <Link href={meta.href}>{inner}</Link>
  ) : (
    <div>{inner}</div>
  );
}

// ─── Page principale ─────────────────────────────────────────────
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

  // Activités du jour depuis le calendrier
  const todayData = useMemo(() => schedule?.days.find((d) => d.isToday), [schedule]);
  const todayActivities = todayData?.activities ?? [];
  const todayMaxPts = todayData?.maxPoints ?? 0;
  const todayDoneCount = todayActivities.filter((a) => a.isCompleted).length;
  const todayAllDone = todayActivities.length > 0 && todayDoneCount === todayActivities.length;

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
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Activités
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Jusqu'à <strong>100 pts/jour</strong> · Converti
            <strong> 700 pts</strong> chaque dimanche → 700 FCFA
          </p>
        </div>

        {/* ── Hero progression hebdo ── */}
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

              {/* Barre progression */}
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

              {/* Indicateurs jours L→D */}
              <div className="mt-5 flex items-center justify-between gap-1">
                {DAYS_INDICATOR.map((d, i) => {
                  const points = (dailyBreakdown as Record<string, number>)[String(i)] ?? 0;
                  const isToday = i === dayOfWeek;
                  const isPast = i < dayOfWeek;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 flex flex-col items-center gap-1 p-1.5 rounded-lg",
                        isToday && "bg-white/25 ring-2 ring-white",
                        i === 0 && "opacity-40", // Dimanche
                      )}
                    >
                      <div className="text-[10px] font-bold opacity-90">{d}</div>
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
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

          {/* CTA conversion */}
          <CardContent className="p-4 bg-card">
            {canConvert ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold text-base flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    700 pts prêts à convertir !
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Reçois <strong>700 FCFA</strong> sur ton solde activité.
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
                  Il te manque{" "}
                  <strong>{Math.max(0, 700 - weeklyTotal)} points</strong>. Continue avant minuit !
                </div>
              </div>
            ) : wstatus === "converted" ? (
              <div className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>
                  Converti cette semaine —{" "}
                  <strong>{status?.convertedAmount ?? "700"} FCFA</strong> crédités.
                </span>
              </div>
            ) : wstatus === "expired" ? (
              <div className="flex items-center gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <span>Semaine expirée. Nouvelle semaine dès lundi.</span>
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  Conversion le <strong className="text-foreground">dimanche</strong> si tu
                  atteins 700 pts. Aujourd'hui :{" "}
                  <strong className="text-foreground">{DAY_FULL[dayOfWeek]}</strong>.
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Activités d'aujourd'hui ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Activités du jour
            </h2>
            {todayMaxPts > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {todayAllDone
                  ? "✓ Tout fait aujourd'hui"
                  : `Jusqu'à +${todayMaxPts} pts disponibles`}
              </span>
            )}
          </div>

          {todayActivities.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Aucune activité planifiée pour aujourd'hui.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {todayActivities.map((act) => (
                <ActivityCard key={act.type} act={act} />
              ))}
            </div>
          )}
        </div>

        {/* ── Calendrier semaine lundi→samedi ── */}
        {schedule && (
          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Programme de la semaine
              </h3>

              <div className="grid grid-cols-6 gap-2">
                {schedule.days.map((day) => {
                  const dow = dateToLocalDow(day.date);
                  const dayNum = new Date(day.date + "T12:00:00Z").getUTCDate();
                  const dayLabel = DAY_ABBR[dow] ?? "?";
                  const availActs = day.activities;
                  const doneCount = availActs.filter((a) => a.isCompleted).length;
                  const allDone = availActs.length > 0 && doneCount === availActs.length;

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "flex flex-col items-center gap-2 p-2 rounded-xl min-w-0",
                        day.isToday
                          ? "bg-primary/10 ring-2 ring-primary"
                          : "bg-muted/30",
                      )}
                    >
                      {/* Jour */}
                      <div className={cn(
                        "text-[11px] font-bold uppercase",
                        day.isToday ? "text-primary" : "text-muted-foreground",
                      )}>
                        {dayLabel}
                      </div>
                      <div className={cn(
                        "text-sm font-black",
                        day.isToday ? "text-primary" : "text-foreground",
                      )}>
                        {dayNum}
                      </div>

                      {/* Icônes des activités prévues */}
                      <div className="flex flex-col gap-1 w-full items-center">
                        {availActs.map((a) => {
                          const meta = ACTIVITY_META[a.type];
                          if (!meta) return null;
                          const Icon = meta.Icon;
                          return (
                            <div
                              key={a.type}
                              title={`${meta.label} · +${a.points} pts${a.isCompleted ? " ✓" : ""}`}
                              className={cn(
                                "w-7 h-7 rounded-lg flex items-center justify-center",
                                a.isCompleted
                                  ? "bg-green-500/20"
                                  : meta.bgLight,
                              )}
                            >
                              <Icon className={cn(
                                "w-3.5 h-3.5",
                                a.isCompleted
                                  ? "text-green-600 dark:text-green-400"
                                  : meta.color,
                              )} />
                            </div>
                          );
                        })}
                      </div>

                      {/* Max points ou badge tout-fait */}
                      {allDone ? (
                        <div className="text-[9px] font-bold text-green-600 dark:text-green-400 text-center">
                          ✓ Fait
                        </div>
                      ) : day.maxPoints > 0 ? (
                        <div className={cn(
                          "text-[9px] font-bold text-center",
                          day.isToday ? "text-primary" : "text-muted-foreground",
                        )}>
                          +{day.maxPoints} pts
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Légende */}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-3">
                {Object.entries(ACTIVITY_META).map(([key, meta]) => {
                  const Icon = meta.Icon;
                  return (
                    <span key={key} className="flex items-center gap-1.5">
                      <Icon className={cn("w-3 h-3", meta.color)} />
                      {meta.label}
                    </span>
                  );
                })}
                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-3 h-3" />
                  Complété
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Liens rapides ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link href="/retraits/activite">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">Retirer mon solde activité</div>
                  <div className="text-xs text-muted-foreground">Min. 3 500 FCFA · Validé par l'admin</div>
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
              <div className="text-xs">
                <div className="font-bold text-sm mb-1">Comment ça marche ?</div>
                <ul className="space-y-0.5 text-muted-foreground">
                  <li>• Lun–Jeu + Sam : Quiz + Vidéo + Découverte (100 pts)</li>
                  <li>• Vendredi : activité Surprise (100 pts)</li>
                  <li>• Chaque activité ne peut être faite qu'une fois par jour</li>
                  <li>• Dimanche : convertis 700 pts → 700 FCFA</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
