import { Link } from "wouter";
import { useGetBalances, getGetBalancesQueryKey } from "@workspace/api-client-react";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";
import { PlayCircle, HelpCircle, Compass, Sparkles, ChevronRight, Wallet, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

const MISSIONS = [
  {
    href: "/tasks/video", label: "Mission Vidéo", desc: "Regarde une vidéo courte et reçois un crédit instantané.",
    Icon: PlayCircle, color: "text-red-500", bg: "from-red-500/15 to-red-500/5", border: "border-red-500/30",
    badge: "Jusqu'à 75 FCFA / vidéo", reward: 75,
  },
  {
    href: "/tasks/quizz", label: "Mission Quizz", desc: "5 questions de culture africaine. 100 FCFA par bonne réponse.",
    Icon: HelpCircle, color: "text-blue-500", bg: "from-blue-500/15 to-blue-500/5", border: "border-blue-500/30",
    badge: "Jusqu'à 500 FCFA / jour", reward: 500,
  },
  {
    href: "/tasks/decouverte", label: "Mission Découverte", desc: "Découvre des produits et services partenaires.",
    Icon: Compass, color: "text-purple-500", bg: "from-purple-500/15 to-purple-500/5", border: "border-purple-500/30",
    badge: "Bientôt", reward: 0,
  },
  {
    href: "/tasks/surprise", label: "Mission Surprise", desc: "Une nouvelle surprise chaque jour.",
    Icon: Sparkles, color: "text-amber-500", bg: "from-amber-500/15 to-amber-500/5", border: "border-amber-500/30",
    badge: "Bientôt", reward: 0,
  },
];

export default function TasksHub() {
  const { user } = useAuth();
  const { data: balances } = useGetBalances({ query: { queryKey: getGetBalancesQueryKey() } });
  const taskBalance = balances?.taskBalance ?? 0;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mes missions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gagne des bonus en plus de tes commissions de parrainage.
          </p>
        </div>

        {/* Solde missions */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 opacity-80 mb-1">
                <Gift className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Solde missions</span>
              </div>
              <div className="text-3xl md:text-4xl font-bold tabular-nums amount-display">
                {formatLocal(taskBalance, user)}
              </div>
              <p className="text-xs opacity-80 mt-1">Min. retrait : {formatLocal(3500, user)}</p>
            </div>
            <Link href="/withdrawals" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-semibold transition-colors">
              <Wallet className="w-4 h-4" /> Retirer
            </Link>
          </div>
        </div>

        {/* Cartes missions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MISSIONS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "relative overflow-hidden p-5 rounded-2xl border-2 transition-all",
                "bg-gradient-to-br hover:shadow-md hover:scale-[1.01]",
                m.bg, m.border
              )}
              data-testid={`card-mission-${m.label.split(" ")[1].toLowerCase()}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center shadow-sm">
                  <m.Icon className={cn("w-6 h-6", m.color)} />
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded-full bg-card", m.color)}>
                  {m.badge}
                </span>
              </div>
              <p className="font-semibold text-foreground">{m.label}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{m.desc}</p>
              <div className="flex items-center justify-end mt-3">
                <ChevronRight className={cn("w-5 h-5", m.color)} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
