import { useState } from "react";
import { Link, Redirect } from "wouter";
import { useGetDashboard, useGetReferralActivity, useGetPlatformConfig } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import {
  Copy, CheckCheck, Users, Wallet, ArrowDownLeft, Zap, Gift,
  PlayCircle, HelpCircle, Compass, Sparkles, ChevronRight, Clock,
  Bell, TrendingUp, UserPlus, CheckCircle2, XCircle, AlertCircle,
  Wallet2, Award
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatLocal } from "@/lib/currency";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MISSION_TYPES = [
  {
    icon: PlayCircle, label: "Mission Vidéo", href: "/tasks/video",
    color: "text-red-500", bg: "from-red-500/15 to-red-500/5",
    border: "border-red-500/20", soon: false,
    desc: "Regarde des vidéos courtes et gagne",
  },
  {
    icon: HelpCircle, label: "Mission Quizz", href: "/tasks/quizz",
    color: "text-blue-500", bg: "from-blue-500/15 to-blue-500/5",
    border: "border-blue-500/20", soon: false,
    desc: "Réponds à 5 questions de culture",
  },
  {
    icon: Compass, label: "Mission Découverte", href: "/tasks/decouverte",
    color: "text-purple-500", bg: "from-purple-500/15 to-purple-500/5",
    border: "border-purple-500/20", soon: false,
    desc: "Découvre des produits africains",
  },
  {
    icon: Sparkles, label: "Mission Surprise", href: "/tasks/surprise",
    color: "text-amber-500", bg: "from-amber-500/15 to-amber-500/5",
    border: "border-amber-500/20", soon: false,
    desc: "Une surprise différente chaque jour",
  },
];

// Mappe un type de transaction → icône + couleur de badge
function activityVisuals(type: string) {
  if (type.startsWith("referral")) return { Icon: UserPlus, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (type === "task") return { Icon: CheckCircle2, color: "text-purple-500", bg: "bg-purple-500/10" };
  if (type === "activation") return { Icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10" };
  if (type === "withdrawal") return { Icon: ArrowDownLeft, color: "text-green-500", bg: "bg-green-500/10" };
  return { Icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" };
}

function statusBadge(status: string) {
  if (status === "pending") return { label: "En cours", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: Clock };
  if (status === "cancelled" || status === "failed" || status === "rejected") return { label: "Échec", className: "bg-destructive/10 text-destructive border-destructive/30", Icon: XCircle };
  return { label: "Terminé", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30", Icon: CheckCircle2 };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Vérification activation : redirection si non activé
  if (user && !user.isActivated) {
    return <Redirect to="/activate" />;
  }

  const { data: dashboard, isLoading: dashLoading } = useGetDashboard();
  const { data: activity } = useGetReferralActivity();
  const { data: config } = useGetPlatformConfig();

  const referralLink = `${window.location.origin}${BASE}/?ref=${user?.referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast({ title: "Lien copié !", description: "Partagez-le pour gagner des commissions." });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const referralBalance = dashboard?.referralBalance ?? 0;
  const taskBalance = dashboard?.taskBalance ?? 0;
  const totalBalance = dashboard?.totalBalance ?? 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              Bonjour, {user?.displayName || user?.email?.split("@")[0]} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Voici un aperçu de ton activité</p>
          </div>
          <button className="relative p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {(activity?.length ?? 0) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </button>
        </div>

        {/* HERO : Lien parrainage + solde total combinés */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-6 shadow-xl">
          {/* Decorative glow */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-20 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />

          <div className="relative grid md:grid-cols-2 gap-6">
            {/* Bloc solde total */}
            <div>
              <div className="flex items-center gap-2 opacity-80 mb-2">
                <Wallet className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Solde total disponible</span>
              </div>
              <div className="text-4xl md:text-5xl font-bold tabular-nums amount-display leading-tight">
                {dashLoading ? "..." : formatLocal(totalBalance, user)}
              </div>
              <p className="text-xs opacity-70 mt-1">Parrainage + Missions</p>
              <Link
                href="/withdrawals"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-semibold transition-colors backdrop-blur-sm"
              >
                <ArrowDownLeft className="w-4 h-4" /> Retirer mes gains
              </Link>
            </div>

            {/* Bloc lien parrainage */}
            <div className="md:border-l md:border-white/15 md:pl-6">
              <div className="flex items-center gap-2 opacity-80 mb-2">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Mon lien de parrainage</span>
              </div>
              <div className="bg-black/25 backdrop-blur-sm rounded-xl p-3 mb-3">
                <p className="text-xs font-mono break-all opacity-90">{referralLink}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyLink}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all",
                    copied ? "bg-green-500 text-white" : "bg-white text-primary hover:opacity-90"
                  )}
                  data-testid="button-copy-referral"
                >
                  {copied ? <><CheckCheck className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier le lien</>}
                </button>
              </div>
              <p className="text-xs opacity-70 mt-2">
                Gagne jusqu'à <strong className="opacity-100">{formatLocal(1700, user)}</strong> par filleul actif
              </p>
            </div>
          </div>
        </div>

        {/* DEUX SOLDES SÉPARÉS — parrainage + missions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Solde parrainage */}
          <div className="bg-card border border-card-border rounded-2xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Solde parrainage</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">3 niveaux de commissions</p>
                </div>
              </div>
              <Link href="/withdrawals" className="text-xs text-blue-500 font-semibold hover:underline flex items-center gap-0.5">
                Retirer <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground tabular-nums amount-display">
              {formatLocal(referralBalance, user)}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Min. retrait</span>
              <span className="font-semibold text-foreground">{formatLocal(3000, user)}</span>
            </div>
          </div>

          {/* Solde missions */}
          <div className="bg-card border border-card-border rounded-2xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Gift className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Solde missions</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Vidéos, quizz, découverte…</p>
                </div>
              </div>
              <Link href="/withdrawals" className="text-xs text-purple-500 font-semibold hover:underline flex items-center gap-0.5">
                Retirer <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-foreground tabular-nums amount-display">
              {formatLocal(taskBalance, user)}
            </div>
            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Min. retrait</span>
              <span className="font-semibold text-foreground">{formatLocal(3500, user)}</span>
            </div>
          </div>
        </div>

        {/* PETITES STATS — investi / retiré / inactifs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Investi</span>
            </div>
            <p className="text-base md:text-lg font-bold tabular-nums amount-display">{formatLocal(dashboard?.spentAmount ?? 0, user)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Retiré</span>
            </div>
            <p className="text-base md:text-lg font-bold tabular-nums amount-display">{formatLocal(dashboard?.withdrawnAmount ?? 0, user)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">En attente</span>
            </div>
            <p className="text-base md:text-lg font-bold tabular-nums amount-display">{formatLocal(dashboard?.inactiveBalance ?? 0, user)}</p>
          </div>
        </div>

        {/* MON ÉQUIPE */}
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Award className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Mon équipe</h3>
                <p className="text-xs text-muted-foreground">{dashboard?.totalReferrals ?? 0} membres au total</p>
              </div>
            </div>
            <Link href="/team" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
              Voir tout <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Niveau 1", count: dashboard?.level1Count ?? 0, commission: config?.level1Commission ?? 1700, accent: "bg-primary/10 text-primary" },
              { label: "Niveau 2", count: dashboard?.level2Count ?? 0, commission: config?.level2Commission ?? 700, accent: "bg-blue-500/10 text-blue-500" },
              { label: "Niveau 3", count: dashboard?.level3Count ?? 0, commission: config?.level3Commission ?? 300, accent: "bg-purple-500/10 text-purple-500" },
            ].map((lvl, i) => (
              <Link
                key={i}
                href={`/team/level/${i + 1}`}
                className={cn("text-center p-3 rounded-xl transition-all hover:scale-[1.02]", lvl.accent)}
              >
                <div className="text-2xl font-bold">{dashLoading ? "-" : lvl.count}</div>
                <div className="text-xs font-medium opacity-80 mt-0.5">{lvl.label}</div>
                <div className="text-[10px] font-semibold opacity-70 mt-1">{formatLocal(lvl.commission, user)}/filleul</div>
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-foreground font-medium">{dashboard?.activeReferrals ?? 0}</span>
              <span className="text-muted-foreground">actifs</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 bg-muted-foreground/50 rounded-full" />
              <span className="text-foreground font-medium">{dashboard?.inactiveReferrals ?? 0}</span>
              <span className="text-muted-foreground">inactifs</span>
            </div>
          </div>
        </div>

        {/* MES MISSIONS — 4 nouvelles missions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-foreground">Mes missions</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Choisis une mission et commence à gagner</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MISSION_TYPES.map((m, i) => (
              <Link
                key={i}
                href={m.href}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-4 border transition-all duration-200",
                  "bg-gradient-to-br hover:scale-[1.02] hover:shadow-md",
                  m.bg, m.border
                )}
                data-testid={`card-mission-${m.label.split(" ")[1].toLowerCase()}`}
              >
                <div className={cn("w-10 h-10 rounded-xl bg-card flex items-center justify-center mb-3 shadow-sm")}>
                  <m.icon className={cn("w-5 h-5", m.color)} />
                </div>
                <p className="text-sm font-semibold text-foreground leading-tight">{m.label}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{m.desc}</p>
                <ChevronRight className={cn("w-4 h-4 absolute top-4 right-4 opacity-40", m.color)} />
              </Link>
            ))}
          </div>
        </div>

        {/* TABLEAU D'ACTIVITÉ — vrai tableau avec badges */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="p-5 pb-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Activité récente</h3>
                <p className="text-xs text-muted-foreground">Tes 10 dernières opérations</p>
              </div>
            </div>
            {(activity?.length ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">
                {activity?.length ?? 0}
              </span>
            )}
          </div>

          {!activity || activity.length === 0 ? (
            <div className="text-center py-12 px-5">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">Aucune activité pour le moment</p>
              <p className="text-xs text-muted-foreground mt-1">
                Commence à parrainer ou complète une mission pour voir ton activité ici.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity.slice(0, 10).map((item) => {
                const v = activityVisuals(item.type);
                const status = statusBadge(item.status ?? "completed");
                const StatusIcon = status.Icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors"
                    data-testid={`row-activity-${item.id}`}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", v.bg)}>
                      <v.Icon className={cn("w-4.5 h-4.5", v.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug truncate">{item.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                            status.className
                          )}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {status.label}
                        </span>
                      </div>
                    </div>
                    {item.amount !== null && item.amount !== undefined && (
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums amount-display flex-shrink-0",
                          item.amount > 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                        )}
                      >
                        {item.amount > 0 ? "+" : ""}{formatLocal(Math.abs(item.amount), user)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
