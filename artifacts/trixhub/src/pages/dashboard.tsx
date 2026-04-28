import { useState } from "react";
import { Link, Redirect } from "wouter";
import { useGetDashboard, useGetReferralActivity, useGetPlatformConfig } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Copy, CheckCheck, TrendingUp, Users, Wallet, ArrowDownLeft, Zap, Gift, PlayCircle, BookOpen, Share2, Compass, ChevronRight, Clock, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatLocal } from "@/lib/currency";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const MISSION_TYPES = [
  { icon: PlayCircle, label: "Mission Vidéo", color: "text-red-500 bg-red-50 dark:bg-red-950/30", desc: "Regarde des vidéos et gagne des FCFA", soon: false },
  { icon: BookOpen, label: "Mission Lecture", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30", desc: "Lis du contenu sponsorisé", soon: false },
  { icon: Share2, label: "Mission Partage", color: "text-green-500 bg-green-50 dark:bg-green-950/30", desc: "Partage sur tes réseaux sociaux", soon: false },
  { icon: Compass, label: "Mission Découverte", color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30", desc: "Découvre de nouveaux produits africains", soon: true },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Vérification simple d'activation : si user n'est pas activé, on redirige vers /activate.
  // Le AuthContext recharge déjà l'utilisateur au montage de l'app, donc user.isActivated est à jour.
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
      toast({ title: "Lien copié !", description: "Partagez ce lien pour recruter des filleuls." });
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Bonjour, {user?.displayName || user?.email?.split("@")[0]} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Voici un aperçu de vos revenus</p>
          </div>
          <button className="relative p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            {(activity?.length ?? 0) > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {/* Referral link banner */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Votre lien de parrainage</p>
              <p className="text-sm text-foreground font-mono truncate">{referralLink}</p>
              <p className="text-xs text-muted-foreground mt-1">Partagez ce lien pour gagner jusqu'à {formatLocal(1700, user)} par filleul actif</p>
            </div>
            <button
              onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex-shrink-0 ${copied ? "bg-green-500 text-white" : "bg-primary text-primary-foreground hover:opacity-90"}`}
            >
              {copied ? <><CheckCheck className="w-4 h-4" /> Copié</> : <><Copy className="w-4 h-4" /> Copier</>}
            </button>
          </div>
        </div>

        {/* Main balances grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Total available — primary card */}
          <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
            <div className="flex items-center gap-2 mb-3 opacity-80">
              <Wallet className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Solde total disponible</span>
            </div>
            <div className="text-3xl font-bold font-mono tabular-nums mb-1 amount-display">
              {dashLoading ? "..." : formatLocal(dashboard?.totalBalance ?? 0, user)}
            </div>
            <p className="text-xs opacity-60">Parrainage + Missions</p>
          </div>

          {/* Activation spent */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-orange-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Activation</span>
            </div>
            <div className="text-lg font-bold text-foreground font-mono amount-display">
              {formatLocal(dashboard?.spentAmount ?? 0, user)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Montant investi</p>
          </div>

          {/* Referral balance */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center">
                <Users className="w-3.5 h-3.5 text-blue-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Parrainage</span>
            </div>
            <div className="text-lg font-bold text-foreground font-mono amount-display">
              {formatLocal(dashboard?.referralBalance ?? 0, user)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Commissions gagnées</p>
          </div>

          {/* Withdrawn */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <ArrowDownLeft className="w-3.5 h-3.5 text-green-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Retiré</span>
            </div>
            <div className="text-lg font-bold text-foreground font-mono amount-display">
              {formatLocal(dashboard?.withdrawnAmount ?? 0, user)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Total encaissé</p>
          </div>

          {/* Inactive balance */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Inactifs en attente</span>
            </div>
            <div className="text-lg font-bold text-foreground font-mono amount-display">
              {formatLocal(dashboard?.inactiveBalance ?? 0, user)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Débloqué à activation</p>
          </div>

          {/* Task balance */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                <Gift className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Missions</span>
            </div>
            <div className="text-lg font-bold text-foreground font-mono amount-display">
              {formatLocal(dashboard?.taskBalance ?? 0, user)}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Gains missions</p>
          </div>
        </div>

        {/* Team summary */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Mon équipe</h3>
            <Link href="/team" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              Voir tout <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Niveau 1", count: dashboard?.level1Count ?? 0, commission: config?.level1Commission ?? 1700, color: "text-primary" },
              { label: "Niveau 2", count: dashboard?.level2Count ?? 0, commission: config?.level2Commission ?? 700, color: "text-blue-500" },
              { label: "Niveau 3", count: dashboard?.level3Count ?? 0, commission: config?.level3Commission ?? 300, color: "text-purple-500" },
            ].map((lvl, i) => (
              <div key={i} className="text-center p-3 bg-muted/40 rounded-xl">
                <div className={`text-2xl font-bold ${lvl.color}`}>{dashLoading ? "-" : lvl.count}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{lvl.label}</div>
                <div className="text-xs font-medium text-foreground mt-1">{formatLocal(lvl.commission, user)}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              {dashboard?.activeReferrals ?? 0} actifs
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-2 h-2 bg-muted-foreground rounded-full" />
              {dashboard?.inactiveReferrals ?? 0} inactifs
            </div>
            <div className="ml-auto text-xs text-muted-foreground font-medium">
              {dashboard?.totalReferrals ?? 0} total
            </div>
          </div>
        </div>

        {/* Missions */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Types de missions</h3>
            <Link href="/tasks" className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
              Voir les missions <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {MISSION_TYPES.map((m, i) => (
              <Link
                key={i}
                href={m.soon ? "#" : "/tasks"}
                className={`bg-card border border-border rounded-xl p-4 flex items-start gap-3 transition-all ${m.soon ? "opacity-60 cursor-default" : "hover:border-primary/40 hover:shadow-sm"}`}
              >
                <div className={`w-9 h-9 rounded-lg ${m.color} flex items-center justify-center flex-shrink-0`}>
                  <m.icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground leading-tight">{m.label}</p>
                    {m.soon && <span className="text-[10px] font-bold text-amber-500 bg-amber-100 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">Bientôt</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        {activity && activity.length > 0 && (
          <div>
            <h3 className="font-semibold text-foreground mb-3">Activité récente</h3>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {activity.slice(0, 5).map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 p-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{item.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  {item.amount && (
                    <span className={`text-sm font-bold flex-shrink-0 amount-display ${item.amount > 0 ? "text-green-500" : "text-destructive"}`}>
                      {item.amount > 0 ? "+" : ""}{formatLocal(Math.abs(item.amount), user)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
