import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  ArrowRight,
  Clock,
  Minus,
  Lock,
} from "lucide-react";
import {
  useStartQuiz,
  useSubmitQuiz,
  useGetWeeklyStatus,
  getGetWeeklyStatusQueryKey,
  type QuizSession,
  type QuizResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const QUESTION_TIME = 10;

type Phase = "idle" | "loading" | "playing" | "submitting" | "results";

export default function ActivitiesQuizPage() {
  usePageTitle('Activité Quiz');
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [session, setSession] = useState<QuizSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [result, setResult] = useState<QuizResult | null>(null);

  const answersRef = useRef<number[]>([-1, -1, -1, -1, -1]);
  const currentIdxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdvancedRef = useRef(false); // évite double-avance

  const { data: weeklyStatus } = useGetWeeklyStatus();
  const isAlreadyDone = ((weeklyStatus?.todayByType as Record<string, { count: number }> | undefined)?.quiz?.count ?? 0) > 0;

  const start = useStartQuiz();
  const submit = useSubmitQuiz();
  const { toast } = useToast();
  const qc = useQueryClient();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
  }, []);

  const submitAnswers = useCallback(
    async (answers: number[]) => {
      if (!session) return;
      setPhase("submitting");
      try {
        const r = await submit.mutateAsync({ sessionId: session.sessionId, data: { answers } });
        setResult(r);
        setPhase("results");
        await qc.invalidateQueries({ queryKey: getGetWeeklyStatusQueryKey() });
        if (r.awardError) {
          toast({ title: "Quiz validé", description: r.awardError, variant: "destructive" });
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        toast({
          title: "Soumission échouée",
          description: e.response?.data?.error ?? "Erreur",
          variant: "destructive",
        });
        setPhase("playing");
      }
    },
    [session, submit, qc, toast],
  );

  const goNext = useCallback(() => {
    if (hasAdvancedRef.current) return;
    hasAdvancedRef.current = true;
    clearTimer();

    const idx = currentIdxRef.current;
    const nextIdx = idx + 1;

    if (nextIdx >= 5) {
      void submitAnswers([...answersRef.current]);
    } else {
      hasAdvancedRef.current = false;
      currentIdxRef.current = nextIdx;
      setCurrentIdx(nextIdx);
      setSelected(null);
      setTimeLeft(QUESTION_TIME);
    }
  }, [clearTimer, submitAnswers]);

  // Garde une ref stable vers goNext pour éviter stale closures dans setInterval
  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  }, [goNext]);

  // Timer pour la question courante
  useEffect(() => {
    if (phase !== "playing") return;
    hasAdvancedRef.current = false;
    setTimeLeft(QUESTION_TIME);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          hasAdvancedRef.current = false;
          goNextRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimer();
  }, [phase, currentIdx, clearTimer]);

  const handleSelect = useCallback(
    (optIdx: number) => {
      if (selected !== null || phase !== "playing") return;
      setSelected(optIdx);
      answersRef.current[currentIdxRef.current] = optIdx;
      clearTimer();
      // Laisse 400ms pour voir la sélection puis avance
      autoAdvanceRef.current = setTimeout(() => {
        goNext();
      }, 400);
    },
    [selected, phase, clearTimer, goNext],
  );

  const handleStart = async () => {
    setPhase("loading");
    try {
      const s = await start.mutateAsync();
      answersRef.current = [-1, -1, -1, -1, -1];
      currentIdxRef.current = 0;
      hasAdvancedRef.current = false;
      setSession(s);
      setCurrentIdx(0);
      setSelected(null);
      setTimeLeft(QUESTION_TIME);
      setResult(null);
      setPhase("playing");
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; detail?: string } } };
      toast({
        title: "Quiz indisponible",
        description: e.response?.data?.detail ?? e.response?.data?.error ?? "Erreur",
        variant: "destructive",
      });
      setPhase("idle");
    }
  };

  const handleRestart = () => {
    clearTimer();
    setSession(null);
    setCurrentIdx(0);
    setSelected(null);
    setTimeLeft(QUESTION_TIME);
    setResult(null);
    answersRef.current = [-1, -1, -1, -1, -1];
    currentIdxRef.current = 0;
    hasAdvancedRef.current = false;
    setPhase("idle");
  };

  const currentQ = session?.questions[currentIdx];
  const timerPct = (timeLeft / QUESTION_TIME) * 100;
  const timerColor =
    timeLeft > 6 ? "bg-emerald-500" : timeLeft > 3 ? "bg-amber-500" : "bg-red-500";

  if (user?.blockedActivities) return (
    <Layout>
      <FeatureGate blocked feature="Activités">{null}</FeatureGate>
    </Layout>
  );

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <Link href="/activities">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Retour aux activités
          </Button>
        </Link>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Quiz IA</h1>
            <p className="text-xs text-muted-foreground">
              5 questions · 10 pts par bonne réponse · <strong>10 secondes par question</strong>
            </p>
          </div>
        </div>

        {/* ── DÉJÀ FAIT AUJOURD'HUI ───────────────────────────────── */}
        {isAlreadyDone && phase !== "results" && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-8 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <div className="text-lg font-bold">Quiz complété pour aujourd'hui !</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Tu as déjà fait ton quiz. Reviens demain pour de nouvelles questions.
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
        )}

        {/* ── IDLE ────────────────────────────────────────────────── */}
        {!isAlreadyDone && phase === "idle" && (
          <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2">Prêt à gagner jusqu'à 50 points ?</h2>
              <p className="text-sm text-muted-foreground mb-2 max-w-md mx-auto">
                5 questions générées par IA sur l'Afrique, le business, la tech…
              </p>
              <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-400 mb-6">
                <Clock className="w-4 h-4" />
                <strong>10 secondes</strong> par question — réponds vite !
              </div>
              <Button
                size="lg"
                onClick={handleStart}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold w-full"
                data-testid="button-start-quiz"
              >
                Démarrer le quiz
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── LOADING ─────────────────────────────────────────────── */}
        {phase === "loading" && (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4" />
              <p className="text-muted-foreground font-medium">
                L'IA génère tes questions…
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── PLAYING ─────────────────────────────────────────────── */}
        {phase === "playing" && currentQ && (
          <div className="space-y-4">
            {/* Progression + timer */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-bold">
                  Question {currentIdx + 1} / {session!.questions.length}
                </span>
                <span
                  className={cn(
                    "font-black text-lg tabular-nums transition-colors",
                    timeLeft > 6
                      ? "text-emerald-500"
                      : timeLeft > 3
                        ? "text-amber-500"
                        : "text-red-500 animate-pulse",
                  )}
                >
                  {timeLeft}s
                </span>
              </div>

              {/* Barre de progression globale (questions) */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((currentIdx) / 5) * 100}%` }}
                />
              </div>

              {/* Barre timer */}
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-1000 ease-linear", timerColor)}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <Card className="border-2 border-primary/20 shadow-lg" data-testid={`question-${currentIdx}`}>
              <CardContent className="p-6">
                <p className="text-lg font-bold leading-snug mb-6">{currentQ.question}</p>

                <div className="space-y-3">
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = selected === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelect(oIdx)}
                        disabled={selected !== null}
                        className={cn(
                          "w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all duration-200 text-sm font-medium",
                          isSelected
                            ? "border-blue-500 bg-blue-500/15 scale-[0.98]"
                            : selected !== null
                              ? "border-border opacity-50 cursor-not-allowed"
                              : "border-border hover:border-blue-400 hover:bg-blue-500/5 active:scale-[0.98]",
                        )}
                        data-testid={`option-${currentIdx}-${oIdx}`}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-xs font-black",
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Mini progress dots */}
            <div className="flex justify-center gap-2">
              {session!.questions.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all",
                    i < currentIdx
                      ? answersRef.current[i] >= 0
                        ? "bg-blue-500"
                        : "bg-muted-foreground"
                      : i === currentIdx
                        ? "bg-primary scale-125"
                        : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── SUBMITTING ──────────────────────────────────────────── */}
        {phase === "submitting" && (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
              <p className="text-muted-foreground font-medium">Calcul de tes résultats…</p>
            </CardContent>
          </Card>
        )}

        {/* ── RESULTS ─────────────────────────────────────────────── */}
        {phase === "results" && result && session && (
          <div className="space-y-4">
            <Card
              className={cn(
                "border-2",
                result.score === result.total
                  ? "border-green-500/30 bg-green-500/5"
                  : result.score >= 3
                    ? "border-amber-500/30 bg-amber-500/5"
                    : "border-destructive/30 bg-destructive/5",
              )}
            >
              <CardContent className="p-6 text-center">
                <Trophy
                  className={cn(
                    "w-16 h-16 mx-auto mb-3",
                    result.score === result.total
                      ? "text-green-500"
                      : result.score >= 3
                        ? "text-amber-500"
                        : "text-destructive",
                  )}
                />
                <div className="text-5xl font-black mb-1">
                  {result.score}
                  <span className="text-2xl text-muted-foreground">/{result.total}</span>
                </div>
                <div className="text-3xl font-bold text-primary mb-2">
                  +{result.pointsAwarded} pts
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.score === result.total
                    ? "🎉 Score parfait ! Tu maîtrises ton sujet !"
                    : result.score === 0
                      ? "Pas de chance ! Retente plus tard."
                      : result.score >= 3
                        ? "Bien joué ! Continue à apprendre."
                        : "Pas grave, retente demain !"}
                </p>
              </CardContent>
            </Card>

            {/* Corrections */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Corrections
                </h3>
                {session.questions.map((q, qIdx) => {
                  const corr = result.corrections.find((c) => c.index === qIdx);
                  if (!corr) return null;
                  const notAnswered = corr.userAnswer === -1;
                  return (
                    <div
                      key={qIdx}
                      className={cn(
                        "border-l-4 pl-3 py-1.5",
                        corr.ok
                          ? "border-green-500"
                          : notAnswered
                            ? "border-muted-foreground"
                            : "border-destructive",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {corr.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : notAnswered ? (
                          <Minus className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="text-sm flex-1">
                          <div className="font-semibold">{q.question}</div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {notAnswered ? (
                              <div className="text-muted-foreground italic">
                                Pas répondu (temps écoulé)
                              </div>
                            ) : (
                              <div
                                className={
                                  corr.ok ? "text-green-600 dark:text-green-400" : "text-destructive"
                                }
                              >
                                Ta réponse : {q.options[corr.userAnswer]}
                              </div>
                            )}
                            {!corr.ok && (
                              <div className="text-green-600 dark:text-green-400 font-medium">
                                Bonne réponse : {q.options[corr.correctIndex]}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-4 py-2 rounded-lg">
                <Lock className="w-3 h-3" />
                Quiz terminé pour aujourd'hui — reviens demain pour de nouvelles questions !
              </div>
              <Link href="/activities" className="w-full">
                <Button className="w-full gap-2" data-testid="button-back-hub">
                  Retour aux activités <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
