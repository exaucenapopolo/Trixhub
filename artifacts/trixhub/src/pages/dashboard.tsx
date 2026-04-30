import { useState, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { useGetDashboard, useGetReferralActivity, useGetPlatformConfig } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import {
  Copy, CheckCheck, Users, Wallet, ArrowDownLeft, Zap, Gift,
  PlayCircle, HelpCircle, Compass, Sparkles, ChevronRight, Clock,
  Bell, TrendingUp, UserPlus, CheckCircle2, XCircle, AlertCircle,
  Award, PiggyBank, ArrowUpRight, Plus, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCountUp } from "@/hooks/use-count-up";
import { formatLocal } from "@/lib/currency";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";


function activityVisuals(type: string) {
  if (type.startsWith("referral")) return { Icon: UserPlus, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (type === "task") return { Icon: CheckCircle2, color: "text-purple-500", bg: "bg-purple-500/10" };
  if (type === "activation") return { Icon: Zap, color: "text-orange-500", bg: "bg-orange-500/10" };
  if (type === "withdrawal") return { Icon: ArrowDownLeft, color: "text-green-500", bg: "bg-green-500/10" };
  if (type === "deposit") return { Icon: PiggyBank, color: "text-emerald-500", bg: "bg-emerald-500/10" };
  if (type === "bonus_activation" || type === "bonus_daily") return { Icon: Gift, color: "text-pink-500", bg: "bg-pink-500/10" };
  if (type.startsWith("child_activation")) return { Icon: UserPlus, color: "text-cyan-500", bg: "bg-cyan-500/10" };
  if (type === "activity_video") return { Icon: PlayCircle, color: "text-red-500", bg: "bg-red-500/10" };
  if (type === "activity_quiz") return { Icon: HelpCircle, color: "text-blue-500", bg: "bg-blue-500/10" };
  if (type === "activity_discovery") return { Icon: Compass, color: "text-teal-500", bg: "bg-teal-500/10" };
  if (type === "activity_surprise") return { Icon: Sparkles, color: "text-purple-500", bg: "bg-purple-500/10" };
  if (type.startsWith("activity_")) return { Icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" };
  return { Icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" };
}

function statusBadge(status: string) {
  if (status === "pending") return { label: "En cours", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", Icon: Clock };
  if (status === "cancelled" || status === "failed" || status === "rejected") return { label: "Échec", className: "bg-destructive/10 text-destructive border-destructive/30", Icon: XCircle };
  return { label: "Terminé", className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30", Icon: CheckCircle2 };
}

// ─── HERO Solde Total ─────────────────────────────────────────────
function HeroBalance({ total, loading, currency }: { total: number; loading: boolean; currency: any }) {
  const animated = useCountUp(loading ? 0 : total);
  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl group">
      {/* Background gradient + animated glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/70" />
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/15 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "4s" }} />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-amber-300/20 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "6s" }} />
      {/* Conic shimmer */}
      <div className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
           style={{ background: "conic-gradient(from 0deg at 50% 50%, transparent, rgba(255,255,255,0.18), transparent 30%)" }} />

      <div className="relative p-7 md:p-9 text-primary-foreground">
        <div className="flex items-center gap-2 opacity-90 mb-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Wallet className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest">Solde total disponible</span>
        </div>
        <div className="text-5xl md:text-6xl font-extrabold tabular-nums amount-display leading-none drop-shadow-md">
          {loading ? "…" : formatLocal(Math.round(animated), currency)}
        </div>
        <p className="text-xs opacity-80 mt-2 font-medium">Parrainage + Missions + Bonus + Dépôt</p>

        <div className="flex flex-wrap gap-2 mt-5">
          <Link
            href="/withdrawals"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-primary text-sm font-bold shadow-md hover:scale-[1.03] transition-transform"
            data-testid="button-hero-withdraw"
          >
            <ArrowDownLeft className="w-4 h-4" /> Retirer
          </Link>
          <Link
            href="/depot"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-sm font-bold transition-colors"
            data-testid="button-hero-deposit"
          >
            <Plus className="w-4 h-4" /> Déposer
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── HERO Lien Parrainage (séparé) ────────────────────────────────
function HeroReferralLink({ link, copied, onCopy, perReferral, currency }: {
  link: string; copied: boolean; onCopy: () => void; perReferral: number; currency: any;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-amber-500/5 p-5 md:p-6 shadow-md hover:shadow-lg transition-shadow">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Mon lien de parrainage</h3>
              <p className="text-[11px] text-muted-foreground">Partage et gagne {formatLocal(perReferral, currency)} par filleul actif</p>
            </div>
          </div>
          <Star className="w-4 h-4 text-amber-500 fill-amber-500 animate-pulse" />
        </div>
        <div className="bg-background/70 backdrop-blur-sm border border-border rounded-xl p-3 mb-3">
          <p className="text-xs font-mono break-all text-foreground/80">{link}</p>
        </div>
        <button
          onClick={onCopy}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm",
            copied ? "bg-green-500 text-white scale-[1.01]" : "bg-primary text-primary-foreground hover:scale-[1.01]"
          )}
          data-testid="button-copy-referral"
        >
          {copied ? <><CheckCheck className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier mon lien</>}
        </button>
      </div>
    </div>
  );
}

// ─── Carte de solde individuelle ──────────────────────────────────
type BalanceCardProps = {
  label: string;
  value: number;
  loading: boolean;
  Icon: any;
  hue: string;        // ex: "blue", "purple", "pink", "emerald"
  caption?: string;
  cta?: { label: string; href: string };
  badge?: string;
  currency: any;
};

function BalanceCard({ label, value, loading, Icon, hue, caption, cta, badge, currency }: BalanceCardProps) {
  const animated = useCountUp(loading ? 0 : value);
  const hueMap: Record<string, { ring: string; bg: string; text: string; soft: string; gradient: string }> = {
    blue:    { ring: "border-blue-500/25",     bg: "bg-blue-500/15",     text: "text-blue-600 dark:text-blue-400",       soft: "bg-blue-500/5",     gradient: "from-blue-500/10 to-transparent" },
    purple:  { ring: "border-purple-500/25",   bg: "bg-purple-500/15",   text: "text-purple-600 dark:text-purple-400",   soft: "bg-purple-500/5",   gradient: "from-purple-500/10 to-transparent" },
    pink:    { ring: "border-pink-500/25",     bg: "bg-pink-500/15",     text: "text-pink-600 dark:text-pink-400",       soft: "bg-pink-500/5",     gradient: "from-pink-500/10 to-transparent" },
    emerald: { ring: "border-emerald-500/25",  bg: "bg-emerald-500/15",  text: "text-emerald-600 dark:text-emerald-400", soft: "bg-emerald-500/5",  gradient: "from-emerald-500/10 to-transparent" },
  };
  const c = hueMap[hue] ?? hueMap.blue;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border bg-card p-4 md:p-5 transition-all hover:scale-[1.015] hover:shadow-lg group",
      c.ring
    )}>
      {/* Décor */}
      <div className={cn("absolute inset-0 bg-gradient-to-br pointer-events-none opacity-60", c.gradient)} />
      <div className={cn("absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-50", c.soft)} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", c.bg)}>
              <Icon className={cn("w-5 h-5", c.text)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
              {caption && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{caption}</p>}
            </div>
          </div>
          {badge && (
            <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full border animate-bounce", c.bg, c.text, c.ring)}>
              {badge}
            </span>
          )}
        </div>
        <div className={cn("text-2xl md:text-3xl font-extrabold tabular-nums amount-display", c.text)}>
          {loading ? "…" : formatLocal(Math.round(animated), currency)}
        </div>
        {cta && (
          <Link
            href={cta.href}
            className={cn("mt-3 inline-flex items-center gap-1 text-xs font-semibold hover:underline", c.text)}
          >
            {cta.label} <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (user && !user.isActivated) return <Redirect to="/activate" />;

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

  // Toast quand le bonus quotidien vient d'être attribué
  useEffect(() => {
    if (dashboard?.dailyBonusClaimed) {
      toast({
        title: "🎁 Bonus de connexion !",
        description: `+${dashboard.dailyBonusAmount ?? 5} FCFA crédités sur ton solde bonus pour ta connexion du jour.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard?.dailyBonusClaimed]);

  const referralBalance = dashboard?.referralBalance ?? 0;
  const taskBalance = dashboard?.taskBalance ?? 0;
  const activityBalance = dashboard?.activityBalance ?? 0;
  const bonusBalance = dashboard?.bonusBalance ?? 0;
  const depositBalance = dashboard?.depositBalance ?? 0;
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

        {/* HERO Solde total — bloc principal animé */}
        <HeroBalance total={totalBalance} loading={dashLoading} currency={user} />

        {/* HERO Lien parrainage — bloc séparé, juste en dessous */}
        <HeroReferralLink
          link={referralLink}
          copied={copied}
          onCopy={copyLink}
          perReferral={config?.level1Commission ?? 1700}
          currency={user}
        />

        {/* 4 CASES DE SOLDE */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Mes soldes</h3>
            <Link href="/withdrawals" className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
              Tout voir <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <BalanceCard
              label="Parrainage"
              value={referralBalance}
              loading={dashLoading}
              Icon={Users}
              hue="blue"
              caption="3 niveaux de commissions"
              cta={{ label: "Retirer", href: "/withdrawals" }}
              currency={user}
            />
            <BalanceCard
              label="Activité"
              value={activityBalance + taskBalance}
              loading={dashLoading}
              Icon={Gift}
              hue="purple"
              caption="Points hebdo convertis · ≥3 500 FCFA"
              cta={{ label: "Retirer", href: "/retraits/activite" }}
              currency={user}
            />
            <BalanceCard
              label="Bonus"
              value={bonusBalance}
              loading={dashLoading}
              Icon={Sparkles}
              hue="pink"
              caption="Activation + connexion quotidienne"
              badge={dashboard?.dailyBonusClaimed ? `+${dashboard?.dailyBonusAmount ?? 5}` : undefined}
              currency={user}
            />
            <BalanceCard
              label="Dépôt"
              value={depositBalance}
              loading={dashLoading}
              Icon={PiggyBank}
              hue="emerald"
              caption="Recharge via mobile money"
              cta={{ label: "Déposer", href: "/depot" }}
              currency={user}
            />
          </div>
        </div>

        {/* PETITES STATS */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-card-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">Activation</span>
            </div>
            <p className="text-base md:text-lg font-bold tabular-nums amount-display">{formatLocal(dashboard?.spentAmount ?? 0, user)}</p>
          </div>
          <div className="bg-card border border-card-border rounded-xl p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-green-500" />
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
            {(dashboard?.inactiveReferrals ?? 0) > 0 && (
              <Link href="/team/level/1" className="ml-auto text-[11px] font-bold text-primary hover:underline flex items-center gap-1">
                Activer un filleul <ChevronRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* TABLEAU D'ACTIVITÉ */}
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
                Commence à parrainer ou effectue une activité pour voir ton historique ici.
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
