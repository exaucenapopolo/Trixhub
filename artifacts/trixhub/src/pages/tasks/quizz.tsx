import { useEffect, useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetBalancesQueryKey, getGetReferralActivityQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, HelpCircle, CheckCircle2, XCircle, Trophy, Clock, RotateCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Question = { id: number; q: string; choices: string[] };

export default function MissionQuizzPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [finished, setFinished] = useState<{ score: number; reward: number } | null>(null);
  const [status, setStatus] = useState<{ available: boolean; rewardPerCorrect: number; nextAvailableAt: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchStatus = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const res = await fetch(`${BASE}/api/missions/quizz/status`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setStatus(await res.json());
  };

  useEffect(() => { void fetchStatus(); }, []);

  const startQuizz = async () => {
    setStarting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/missions/quizz/questions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Pas encore disponible", description: data.error || "Réessayez plus tard", variant: "destructive" });
        await fetchStatus();
        return;
      }
      setQuestions(data.questions ?? []);
      setCurrent(0);
      setAnswers([]);
      setSelected(null);
      setFinished(null);
    } finally {
      setStarting(false);
    }
  };

  const selectAnswer = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx);
    const newAnswers = [...answers, idx];
    setAnswers(newAnswers);
    setTimeout(() => {
      setSelected(null);
      if (current + 1 < questions.length) {
        setCurrent(current + 1);
      } else {
        void submitAnswers(newAnswers);
      }
    }, 600);
  };

  const submitAnswers = async (finalAnswers: number[]) => {
    setSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const payload = {
        answers: questions.map((q, i) => ({ id: q.id, choice: finalAnswers[i] })),
      };
      const res = await fetch(`${BASE}/api/missions/quizz/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Pas encore disponible", description: data.error || "Réessayez plus tard", variant: "destructive" });
        await fetchStatus();
        return;
      }
      setFinished({ score: data.score, reward: data.reward });
      qc.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetReferralActivityQueryKey() });
      await fetchStatus();
    } finally {
      setSubmitting(false);
    }
  };

  const cooldownText = status?.nextAvailableAt
    ? `Prochain quizz disponible ${new Date(status.nextAvailableAt).toLocaleString("fr-FR", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}`
    : null;

  // Écran de fin
  if (finished) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Quizz terminé !</h2>
            <p className="opacity-90">Tu as eu <strong>{finished.score} / 5</strong> bonnes réponses</p>
            <div className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/20 text-lg font-bold">
              <Sparkles className="w-5 h-5" /> +{formatLocal(finished.reward, user)}
            </div>
          </div>
          <div className="bg-card border border-card-border rounded-2xl p-4 text-center text-sm text-muted-foreground">
            Reviens demain pour un nouveau quizz !
          </div>
          <Link href="/tasks" className="block w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-center hover:opacity-90 transition-opacity">
            Retour aux missions
          </Link>
        </div>
      </Layout>
    );
  }

  // Écran d'intro
  if (questions.length === 0) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto space-y-5">
          <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Retour aux missions
          </Link>

          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <HelpCircle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Mission Quizz</h1>
                <p className="text-sm opacity-90">5 questions de culture africaine</p>
              </div>
            </div>
            <div className="bg-white/15 rounded-xl p-3 mt-4">
              <div className="flex items-center justify-between text-sm">
                <span>Récompense par bonne réponse</span>
                <span className="font-bold">{formatLocal(status?.rewardPerCorrect ?? 100, user)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span>Maximum par jour</span>
                <span className="font-bold">{formatLocal((status?.rewardPerCorrect ?? 100) * 5, user)}</span>
              </div>
            </div>
          </div>

          {status && !status.available ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">Quizz déjà fait aujourd'hui</p>
                <p className="text-xs text-muted-foreground mt-1">{cooldownText}</p>
              </div>
            </div>
          ) : (
            <button
              onClick={startQuizz}
              disabled={starting}
              className="w-full py-4 rounded-2xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="button-start-quizz"
            >
              <RotateCw className={cn("w-5 h-5", starting && "animate-spin")} />
              {starting ? "Chargement..." : "Démarrer le quizz"}
            </button>
          )}
        </div>
      </Layout>
    );
  }

  // Écran question
  const q = questions[current];
  const progress = ((current) / questions.length) * 100;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Question {current + 1} / {questions.length}</span>
          <span className="text-blue-500 font-semibold">+{formatLocal(status?.rewardPerCorrect ?? 100, user)} si correct</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="bg-card border border-card-border rounded-2xl p-6">
          <h2 className="text-lg md:text-xl font-bold text-foreground mb-5 leading-snug">{q.q}</h2>
          <div className="space-y-2.5">
            {q.choices.map((c, i) => {
              const isSelected = selected === i;
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(i)}
                  disabled={selected !== null || submitting}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-center justify-between",
                    "hover:border-blue-500 hover:bg-blue-500/5",
                    isSelected && "border-blue-500 bg-blue-500/10",
                    !isSelected && "border-border bg-background"
                  )}
                  data-testid={`button-choice-${i}`}
                >
                  <span className="text-sm font-medium text-foreground">{c}</span>
                  {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
