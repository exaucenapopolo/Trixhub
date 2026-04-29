import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import {
  useStartQuiz,
  useSubmitQuiz,
  getGetWeeklyStatusQueryKey,
  type QuizSession,
  type QuizResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export default function ActivitiesQuizPage() {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const start = useStartQuiz();
  const submit = useSubmitQuiz();
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleStart = async () => {
    try {
      const s = await start.mutateAsync();
      setSession(s);
      setAnswers(new Array(s.questions.length).fill(-1));
      setResult(null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string; detail?: string } } };
      toast({
        title: "Quiz indisponible",
        description: e.response?.data?.detail ?? e.response?.data?.error ?? "Erreur",
        variant: "destructive",
      });
    }
  };

  const handleSelect = (qIdx: number, optIdx: number) => {
    const next = [...answers];
    next[qIdx] = optIdx;
    setAnswers(next);
  };

  const handleSubmit = async () => {
    if (!session) return;
    if (answers.some((a) => a < 0)) {
      toast({
        title: "Réponds à toutes les questions",
        description: `Il manque ${answers.filter((a) => a < 0).length} réponse(s)`,
        variant: "destructive",
      });
      return;
    }
    try {
      const r = await submit.mutateAsync({ sessionId: session.sessionId, data: { answers } });
      setResult(r);
      await qc.invalidateQueries({ queryKey: getGetWeeklyStatusQueryKey() });
      if (r.awardError) {
        toast({
          title: "Quiz validé",
          description: r.awardError,
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Soumission échouée",
        description: e.response?.data?.error ?? "Erreur",
        variant: "destructive",
      });
    }
  };

  const handleRestart = () => {
    setSession(null);
    setAnswers([]);
    setResult(null);
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
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
            <p className="text-xs text-muted-foreground">5 questions · 10 pts par bonne réponse</p>
          </div>
        </div>

        {/* État initial */}
        {!session && !result && (
          <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-indigo-500/5">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2">Prêt à gagner jusqu'à 50 points ?</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                5 questions générées par IA sur la culture, l'Afrique, le business, la tech…
                <br />
                Score parfait = 50 points (cap quotidien : 100 pts).
              </p>
              <Button
                size="lg"
                onClick={handleStart}
                disabled={start.isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold"
                data-testid="button-start-quiz"
              >
                {start.isPending ? "Génération du quiz…" : "Démarrer le quiz"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quiz en cours */}
        {session && !result && (
          <div className="space-y-4">
            {session.questions.map((q, qIdx) => (
              <Card key={qIdx} data-testid={`question-${qIdx}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {qIdx + 1}
                    </div>
                    <div className="font-semibold text-base leading-tight">{q.question}</div>
                  </div>
                  <div className="space-y-2 ml-11">
                    {q.options.map((opt, oIdx) => {
                      const selected = answers[qIdx] === oIdx;
                      return (
                        <button
                          key={oIdx}
                          onClick={() => handleSelect(qIdx, oIdx)}
                          className={cn(
                            "w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border hover:border-primary/40 hover:bg-accent",
                          )}
                          data-testid={`option-${qIdx}-${oIdx}`}
                        >
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-6 h-6 rounded-full mr-3 text-xs font-bold",
                              selected
                                ? "bg-primary text-primary-foreground"
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
            ))}
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submit.isPending || answers.some((a) => a < 0)}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 font-bold"
              data-testid="button-submit-quiz"
            >
              {submit.isPending
                ? "Validation…"
                : answers.some((a) => a < 0)
                  ? `Encore ${answers.filter((a) => a < 0).length} réponse(s)`
                  : "Valider mes réponses"}
            </Button>
          </div>
        )}

        {/* Résultat */}
        {result && session && (
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
                <div className="text-4xl font-black mb-1">
                  {result.score} / {result.total}
                </div>
                <div className="text-2xl font-bold text-primary mb-2">
                  +{result.pointsAwarded} pts
                </div>
                <p className="text-sm text-muted-foreground">
                  {result.score === result.total
                    ? "Parfait ! Tu maîtrises ton sujet 🎉"
                    : result.score >= 3
                      ? "Pas mal ! Continue à apprendre."
                      : "Pas grave, retente plus tard !"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-3">
                <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                  Corrections
                </h3>
                {session.questions.map((q, qIdx) => {
                  const corr = result.corrections.find((c) => c.index === qIdx);
                  if (!corr) return null;
                  return (
                    <div key={qIdx} className="border-l-4 pl-3 py-1" style={{ borderColor: corr.ok ? "rgb(34 197 94)" : "rgb(239 68 68)" }}>
                      <div className="flex items-start gap-2">
                        {corr.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="text-sm flex-1">
                          <div className="font-medium">{q.question}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            <span className={corr.ok ? "text-green-600" : "text-destructive"}>
                              Ta réponse : {q.options[corr.userAnswer]}
                            </span>
                            {!corr.ok && (
                              <>
                                {" · "}
                                <span className="text-green-600 font-medium">
                                  Bonne réponse : {q.options[corr.correctIndex]}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleRestart} variant="outline" className="gap-2" data-testid="button-new-quiz">
                <RotateCcw className="w-4 h-4" /> Nouveau quiz
              </Button>
              <Link href="/activities">
                <Button className="w-full gap-2" data-testid="button-back-hub">
                  Retour <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
