import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Users, TrendingUp, TrendingDown, Wallet, Activity, Search, RefreshCw,
  Ban, Trash2, Key, Edit3, ChevronRight, CheckCircle,
  XCircle, Clock, AlertCircle, ShieldCheck, User, ArrowUpRight,
  Filter, Eye, DollarSign, Building2, BarChart3, ArrowLeft, Minus,
  Globe, AlertTriangle, Info, BookUser, GraduationCap, Star, Download,
  Trophy, Medal, Phone, UserCheck, Sparkles, ImagePlus, Send, X as XIcon, Gift,
} from "lucide-react";
import { cn, resolveAvatarUrl } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("trixhub_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error ?? "Erreur");
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────
interface AdminStats {
  users: { total: number; active: number; inactive: number; banned: number; noSponsor: number; noReferrals: number };
  withdrawals: { pendingCount: number; pendingAmount: number; processingCount: number; totalPaid: number };
  activityWithdrawals: { pendingCount: number; approvedCount: number };
  finance: { companyProfit: number; secondaryIncome: number; totalCompanyIncome: number; commissionsPaid: number; totalRevenue: number; profitPerActivation: number };
}

interface PeriodData {
  today: number; yesterday: number;
  thisWeek: number; lastWeek: number;
  thisMonth: number; lastMonth: number;
}
interface GrowthData {
  registrations: PeriodData;
  activations: PeriodData;
  inactive: PeriodData;
  revenue: PeriodData;
}

interface AdminUser {
  id: number; displayName: string; email: string; phone: string; country: string;
  isActivated: boolean; isBanned: boolean; isFreeAccount: boolean; isAdmin: boolean; referralCode: string;
  referredByCode: string | null; createdAt: string; lastLoginAt: string | null; avatarUrl: string | null;
  referralBalance: string; taskBalance: string; bonusBalance: string;
  depositBalance: string; activityBalance: string; inactiveBalance: string;
  withdrawnAmount: string; spentAmount: string;
  blockedActivities: boolean; blockedFormations: boolean; blockedCanva: boolean;
  blockedContacts: boolean; blockedReferral: boolean;
}

interface TopUser {
  id: number; displayName: string; email: string; phone: string;
  avatarUrl: string | null; country: string; metric: number;
  metricActive?: number;
}
interface TopUsersData {
  recruiters: TopUser[];
  activities: TopUser[];
  balances: TopUser[];
  withdrawals: TopUser[];
}
interface WalletUser {
  id: number; displayName: string; email: string;
  avatarUrl: string | null; country: string | null;
  referralBalance: number; activityBalance: number;
  bonusBalance: number; depositBalance: number; totalBalance: number;
}

interface Withdrawal {
  id: number; userId: number; amount: string; method: string;
  accountNumber: string; accountName: string; source: string;
  status: string; payoutStatus: string | null; payoutRef: string | null;
  rejectionReason: string | null; proofUrl: string | null;
  createdAt: string; processedAt: string | null;
  userEmail: string; userDisplayName: string;
}

interface ActivityWithdrawal {
  id: number; userId: number; amount: string; method: string;
  accountNumber: string; accountName: string; whatsappNumber: string | null;
  status: string; adminNote: string | null; rejectionReason: string | null;
  createdAt: string; approvedAt: string | null; paidAt: string | null;
  userEmail: string; userDisplayName: string;
}

interface SurpriseSubmission {
  id: number; userId: number;
  userDisplayName: string; userPhone: string; userCountry: string;
  screenshotUrl: string | null;
  status: string; adminNote: string | null;
  pointsAwarded: number; weekStart: string; createdAt: string;
}

interface UserDetail {
  user: AdminUser & { lastLoginAt: string | null; avatarUrl: string | null };
  balances: { referralBalance: string; taskBalance: string; bonusBalance: string; depositBalance: string; activityBalance: string; inactiveBalance: string };
  teamN1: { id: number; displayName: string; email: string; isActivated: boolean; createdAt: string }[];
  transactions: { id: number; type: string; amount: string; description: string; status: string; createdAt: string }[];
}

// ─── Composants UI ───────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex items-start gap-4">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function pct(current: number, previous: number): { value: number; dir: "up" | "down" | "flat" } {
  if (previous === 0 && current === 0) return { value: 0, dir: "flat" };
  if (previous === 0) return { value: 100, dir: "up" };
  const v = Math.round(((current - previous) / previous) * 100);
  return { value: Math.abs(v), dir: v > 0 ? "up" : v < 0 ? "down" : "flat" };
}

function TrendBadge({ current, previous, label }: { current: number; previous: number; label: string }) {
  const { value, dir } = pct(current, previous);
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-semibold tabular-nums">{current.toLocaleString("fr-FR")}</span>
        <span className={cn(
          "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
          dir === "up" ? "bg-emerald-500/15 text-emerald-600" :
          dir === "down" ? "bg-red-500/15 text-red-500" :
          "bg-muted text-muted-foreground"
        )}>
          {dir === "up" ? <TrendingUp size={9} /> : dir === "down" ? <TrendingDown size={9} /> : <Minus size={9} />}
          {dir !== "flat" ? `${value}%` : "="}
        </span>
        <span className="text-[10px] text-muted-foreground">vs {previous.toLocaleString("fr-FR")}</span>
      </div>
    </div>
  );
}

function GrowthCard({ icon: Icon, label, color, data, unit = "", invertTrend = false }: {
  icon: React.ElementType; label: string; color: string;
  data: PeriodData; unit?: string; invertTrend?: boolean;
}) {
  const fmt = (n: number) => unit === "FCFA" ? n.toLocaleString("fr-FR") + " F" : n.toLocaleString("fr-FR");
  const dayTrend = pct(data.today, data.yesterday);
  const mainDir = invertTrend
    ? (dayTrend.dir === "up" ? "down" : dayTrend.dir === "down" ? "up" : "flat")
    : dayTrend.dir;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className={cn("flex items-center gap-3 p-4 border-b border-border")}>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
          <Icon size={17} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl font-bold">{fmt(data.today)}</span>
            <span className={cn(
              "flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              mainDir === "up" ? "bg-emerald-500/15 text-emerald-600" :
              mainDir === "down" ? "bg-red-500/15 text-red-500" :
              "bg-muted text-muted-foreground"
            )}>
              {mainDir === "up" ? <TrendingUp size={9} /> : mainDir === "down" ? <TrendingDown size={9} /> : <Minus size={9} />}
              {dayTrend.dir !== "flat" ? `${dayTrend.value}%` : "stable"}
            </span>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-0.5">
        <TrendBadge current={data.today}     previous={data.yesterday} label="Aujourd'hui / Hier" />
        <TrendBadge current={data.thisWeek}  previous={data.lastWeek}  label="Cette semaine / Sem. dernière" />
        <TrendBadge current={data.thisMonth} previous={data.lastMonth} label="Ce mois / Mois dernier" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: "En attente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
    processing: { label: "En cours", className: "bg-blue-500/15 text-blue-600" },
    completed: { label: "Complété", className: "bg-emerald-500/15 text-emerald-600" },
    approved: { label: "Approuvé", className: "bg-blue-500/15 text-blue-600" },
    paid: { label: "Payé", className: "bg-emerald-500/15 text-emerald-600" },
    rejected: { label: "Refusé", className: "bg-red-500/15 text-red-600" },
  };
  const s = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", s.className)}>{s.label}</span>;
}

function fmt(val: string | number) {
  return parseFloat(String(val)).toLocaleString("fr-FR") + " FCFA";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function UserAvatar({ avatarUrl, name, size = "sm" }: { avatarUrl: string | null | undefined; name: string; size?: "sm" | "md" | "lg" }) {
  const src = resolveAvatarUrl(avatarUrl);
  const initials = name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "?";
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  return (
    <div className={cn("rounded-full overflow-hidden flex-shrink-0 bg-primary/15 flex items-center justify-center font-bold text-primary", sizes[size])}>
      {src
        ? <img src={src} alt={name} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        : <span>{initials}</span>
      }
    </div>
  );
}

// ─── Section : Vue d'ensemble ────────────────────────────────────
interface ApkStats { total: number; today: number; thisWeek: number; thisMonth: number; }

function OverviewSection({ stats, onRefresh }: { stats: AdminStats | null; onRefresh: () => void }) {
  const [growth, setGrowth] = useState<GrowthData | null>(null);
  const [loadingGrowth, setLoadingGrowth] = useState(true);
  const [apkStats, setApkStats] = useState<ApkStats | null>(null);

  const loadGrowth = useCallback(async () => {
    setLoadingGrowth(true);
    try { setGrowth(await apiFetch("/api/admin/growth")); } catch {}
    setLoadingGrowth(false);
  }, []);

  const loadApkStats = useCallback(async () => {
    try { setApkStats(await apiFetch("/api/admin/apk-stats")); } catch {}
  }, []);

  useEffect(() => { loadGrowth(); loadApkStats(); }, [loadGrowth, loadApkStats]);

  const handleRefreshAll = () => { onRefresh(); loadGrowth(); loadApkStats(); };

  if (!stats) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-muted-foreground" /></div>;
  const { users, withdrawals, activityWithdrawals, finance } = stats;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Vue d'ensemble</h2>
        <button onClick={handleRefreshAll} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser tout
        </button>
      </div>

      {/* ── Métriques globales ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total membres" value={users.total} sub={`${users.active} actifs`} color="bg-primary" />
        <StatCard icon={CheckCircle} label="Comptes actifs" value={users.active} sub={`${users.inactive} inactifs`} color="bg-emerald-500" />
        <StatCard icon={Ban} label="Comptes bloqués" value={users.banned} color="bg-red-500" />
        <StatCard icon={Building2} label="Profit entreprise" value={finance.companyProfit.toLocaleString("fr-FR") + " FCFA"} sub={`${finance.profitPerActivation} FCFA/activation`} color="bg-amber-500" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Retraits en attente" value={withdrawals.pendingCount} sub={withdrawals.pendingAmount.toLocaleString("fr-FR") + " FCFA"} color="bg-orange-500" />
        <StatCard icon={Activity} label="En cours" value={withdrawals.processingCount} color="bg-blue-500" />
        <StatCard icon={Wallet} label="Activités en attente" value={activityWithdrawals.pendingCount} sub={`${activityWithdrawals.approvedCount} approuvées`} color="bg-purple-500" />
        <StatCard icon={DollarSign} label="Total retiré" value={withdrawals.totalPaid.toLocaleString("fr-FR") + " FCFA"} color="bg-teal-500" />
      </div>

      {/* ── Téléchargements APK Android ────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-green-500/5">
          <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Download size={14} className="text-green-500" />
          </div>
          <h3 className="text-sm font-bold">Téléchargements de l'application Android</h3>
          <span className="ml-auto text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full font-semibold border border-green-500/20">
            {apkStats ? apkStats.total : "—"} au total
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/50">
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Star size={13} className="text-green-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">Aujourd'hui</span>
            </div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">{apkStats?.today ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">téléchargements ce jour</p>
          </div>
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp size={13} className="text-blue-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">Cette semaine</span>
            </div>
            <p className="text-3xl font-bold">{apkStats?.thisWeek ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">téléchargements</p>
          </div>
          <div className="p-5 flex flex-col gap-1 bg-green-500/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <ArrowUpRight size={13} className="text-emerald-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">Ce mois</span>
            </div>
            <p className="text-3xl font-bold text-emerald-600">{apkStats?.thisMonth ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">téléchargements</p>
          </div>
        </div>
      </div>

      {/* ── Analyse du réseau ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-muted/30">
          <Globe size={16} className="text-primary" />
          <h3 className="text-sm font-bold">Analyse du réseau de parrainage</h3>
          <span className="ml-auto text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{users.total} membres au total</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border/50">
          {/* Sans parrain */}
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-slate-500/15 flex items-center justify-center">
                <User size={13} className="text-slate-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">Sans parrain</span>
            </div>
            <p className="text-2xl font-bold">{users.noSponsor}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Inscrits sans code de parrainage. Leurs 3 600 FCFA d'activation reviennent entièrement à l'entreprise.
            </p>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1">
              + {(users.noSponsor * 3600).toLocaleString("fr-FR")} FCFA récupérés (si activés)
            </p>
          </div>
          {/* Avec parrain, 0 filleul */}
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                <AlertTriangle size={13} className="text-amber-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">0 filleul direct</span>
            </div>
            <p className="text-2xl font-bold">{users.noReferrals}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ont un parrain mais n'ont encore parrainé personne. Les commissions L1/L2/L3 de leurs futurs filleuls leur reviendraient à eux.
            </p>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
              Réseau non encore actif
            </p>
          </div>
          {/* Commissions versées */}
          <div className="p-5 flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <ArrowUpRight size={13} className="text-blue-500" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">Commissions versées</span>
            </div>
            <p className="text-2xl font-bold">{finance.commissionsPaid.toLocaleString("fr-FR")}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              FCFA versés aux filleuls L1, L2 et L3 sur toutes les activations. Maximum possible : {(users.active * 2700).toLocaleString("fr-FR")} FCFA.
            </p>
            <p className="text-xs font-semibold text-blue-500 mt-1">
              sur {users.active} activations
            </p>
          </div>
          {/* Revenu secondaire */}
          <div className="p-5 flex flex-col gap-1 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <DollarSign size={13} className="text-emerald-600" />
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">2ème revenu</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{finance.secondaryIncome.toLocaleString("fr-FR")}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              FCFA de commissions non versées car les niveaux L1/L2/L3 étaient absents. Ce budget peut financer les tâches &amp; activités.
            </p>
            <p className="text-xs font-bold text-emerald-600 mt-1">
              Total entreprise : {finance.totalCompanyIncome.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        </div>
      </div>

      {/* ── Section Tendances ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-primary" />
          <h3 className="text-base font-bold">Tendances & Progressions</h3>
          <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full ml-1">Aujourd'hui · Semaine · Mois</span>
        </div>
        {loadingGrowth || !growth ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GrowthCard
              icon={Users}
              label="Nouvelles inscriptions"
              color="bg-primary"
              data={growth.registrations}
            />
            <GrowthCard
              icon={CheckCircle}
              label="Nouveaux actifs"
              color="bg-emerald-500"
              data={growth.activations}
            />
            <GrowthCard
              icon={AlertCircle}
              label="Inactifs (non-activés)"
              color="bg-amber-500"
              data={growth.inactive}
              invertTrend
            />
            <GrowthCard
              icon={DollarSign}
              label="Revenus générés"
              color="bg-teal-500"
              data={growth.revenue}
              unit="FCFA"
            />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-3">
          Les revenus sont estimés à 900 FCFA par activation. Les inactifs correspondent aux comptes inscrits mais non encore activés.
        </p>
      </div>

      {/* ── Calcul du revenu ──────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
        <h3 className="font-semibold text-sm flex items-center gap-2"><BarChart3 size={16} className="text-amber-500" /> Calcul du revenu par activation</h3>

        {/* Formule */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            { label: "Pack client", value: "3 600 FCFA", color: "text-foreground" },
            { label: "Commission N1", value: "− 1 700 FCFA", color: "text-red-500" },
            { label: "Commission N2", value: "− 700 FCFA", color: "text-orange-500" },
            { label: "Commission N3", value: "− 200 FCFA", color: "text-amber-500" },
            { label: "Profit net garanti", value: "= 1 000 FCFA", color: "text-emerald-600 font-bold" },
          ].map(item => (
            <div key={item.label} className="bg-muted/50 rounded-xl p-3">
              <p className={cn("text-base font-bold", item.color)}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Deux sources de revenu */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wide mb-1">1er revenu — Profit garanti</p>
            <p className="text-xl font-bold text-emerald-600">{finance.companyProfit.toLocaleString("fr-FR")} FCFA</p>
            <p className="text-[10px] text-muted-foreground mt-1">{users.active} activations × 1 000 FCFA</p>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wide mb-1">2ème revenu — Chaînes incomplètes</p>
            <p className="text-xl font-bold text-blue-600">{finance.secondaryIncome.toLocaleString("fr-FR")} FCFA</p>
            <p className="text-[10px] text-muted-foreground mt-1">Commissions N1/N2/N3 non versées (niveaux absents). Ce fonds peut financer les tâches &amp; activités des membres.</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col justify-center">
            <p className="text-[10px] text-primary font-semibold uppercase tracking-wide mb-1">Revenu total entreprise</p>
            <p className="text-2xl font-bold text-primary">{finance.totalCompanyIncome.toLocaleString("fr-FR")} FCFA</p>
            <p className="text-[10px] text-muted-foreground mt-1">1er + 2ème revenu combinés</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Le 2ème revenu correspond aux commissions N1/N2/N3 qui n'ont pas pu être attribuées car les niveaux correspondants n'existaient pas dans la chaîne de parrainage.
        </p>
      </div>
    </div>
  );
}

// ─── Modal : Détail utilisateur ───────────────────────────────────
function UserDetailModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"info" | "balances" | "team" | "history">("info");
  const [balanceForm, setBalanceForm] = useState<Record<string, string>>({});
  const [pwForm, setPwForm] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    apiFetch(`/api/admin/users/${userId}`).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (data?.balances) {
      setBalanceForm({
        referralBalance: parseFloat(data.balances.referralBalance).toFixed(2),
        taskBalance: parseFloat(data.balances.taskBalance).toFixed(2),
        bonusBalance: parseFloat(data.balances.bonusBalance).toFixed(2),
        depositBalance: parseFloat(data.balances.depositBalance).toFixed(2),
        activityBalance: parseFloat(data.balances.activityBalance).toFixed(2),
        inactiveBalance: parseFloat(data.balances.inactiveBalance).toFixed(2),
      });
    }
  }, [data]);

  const saveBalances = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/balances`, { method: "PATCH", body: JSON.stringify(balanceForm) });
      toast({ title: "Soldes mis à jour" });
      const fresh = await apiFetch(`/api/admin/users/${userId}`);
      setData(fresh);
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!pwForm.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/password`, { method: "PATCH", body: JSON.stringify({ password: pwForm }) });
      toast({ title: "Mot de passe modifié" });
      setPwForm("");
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleBlock = async () => {
    if (!data) return;
    const newBanned = !data.user.isBanned;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/block`, { method: "PATCH", body: JSON.stringify({ banned: newBanned }) });
      toast({ title: newBanned ? "Utilisateur bloqué" : "Utilisateur débloqué" });
      const fresh = await apiFetch(`/api/admin/users/${userId}`);
      setData(fresh);
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const toggleActivation = async () => {
    if (!data) return;
    const newActivated = !data.user.isActivated;
    if (!newActivated && !confirm(`Désactiver le compte de ${data.user.displayName} ? Il n'aura plus accès au tableau de bord.`)) return;
    setSaving(true);
    try {
      await apiFetch(`/api/admin/users/${userId}/activate`, { method: "PATCH", body: JSON.stringify({ activated: newActivated }) });
      toast({ title: newActivated ? "Compte activé" : "Compte désactivé" });
      const fresh = await apiFetch(`/api/admin/users/${userId}`);
      setData(fresh);
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setSaving(false);
  };

  const BALANCE_LABELS: Record<string, string> = {
    referralBalance: "Parrainage",
    taskBalance: "Missions/Activités",
    bonusBalance: "Bonus",
    depositBalance: "Dépôt",
    activityBalance: "Activité convertie",
    inactiveBalance: "En attente",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-border">

        {/* Barre supérieure : Retour + Actions rapides */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Retour à la liste
          </button>
          <div className="flex items-center gap-2">
            {data && (
              <>
                <button
                  onClick={toggleActivation}
                  disabled={saving}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                    data.user.isActivated
                      ? "bg-orange-500/15 text-orange-600 hover:bg-orange-500/25"
                      : "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                  )}
                >
                  {saving ? "..." : data.user.isActivated ? "Désactiver" : "✓ Activer"}
                </button>
                <button
                  onClick={toggleBlock}
                  disabled={saving}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                    data.user.isBanned
                      ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                      : "bg-red-500/15 text-red-600 hover:bg-red-500/25"
                  )}
                >
                  {saving ? "..." : data.user.isBanned ? "Débloquer" : "Bloquer"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* En-tête membre */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-border">
          <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-lg">
              {data?.user.displayName?.charAt(0).toUpperCase() ?? "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base truncate">{data?.user.displayName ?? "Chargement..."}</h3>
            <p className="text-xs text-muted-foreground truncate">{data?.user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {data && (
                <>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", data.user.isActivated ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                    {data.user.isActivated ? "✓ Activé" : "⏳ Inactif"}
                  </span>
                  {data.user.isBanned && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-600">
                      🚫 Bloqué
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{data.user.country}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-border px-5 gap-1">
          {(["info", "balances", "team", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-3 text-xs font-medium border-b-2 transition-colors", tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {t === "info" ? "Informations" : t === "balances" ? "Soldes" : t === "team" ? "Équipe" : "Historique"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading && <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-muted-foreground" /></div>}
          {!loading && data && tab === "info" && (
            <div className="space-y-4">
              {[
                ["Email", data.user.email], ["Téléphone", data.user.phone], ["Pays", data.user.country],
                ["Code parrainage", data.user.referralCode], ["Parrainé par", data.user.referredByCode ?? "—"],
                ["Inscrit le", fmtDate(data.user.createdAt)], ["Dernière connexion", fmtDate(data.user.lastLoginAt)],
                ["Statut", data.user.isBanned ? "🚫 Bloqué" : data.user.isActivated ? "✅ Activé" : data.user.isFreeAccount ? "✦ Compte gratuit" : "⏳ Inactif"],
                ["Banni", data.user.isBanned ? "🔴 Oui" : "🟢 Non"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
              {/* ── Restrictions d'accès ── */}
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                <p className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-orange-500" />
                  Restrictions d'accès
                </p>
                {([
                  ["blockedActivities", "Activités (quiz, vidéo, découverte, surprise)"],
                  ["blockedFormations", "Formations gratuites"],
                  ["blockedCanva", "Canva Pro"],
                  ["blockedContacts", "Achat de contacts"],
                  ["blockedReferral", "Parrainage (équipe)"],
                ] as const).map(([field, label]) => {
                  const isBlocked = data.user[field];
                  return (
                    <div key={field} className="flex items-center justify-between gap-3 py-1.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                      <span className="text-xs text-foreground flex-1">{label}</span>
                      <button
                        onClick={async () => {
                          setSaving(true);
                          try {
                            await apiFetch(`/api/admin/users/${userId}/restrictions`, {
                              method: "PATCH",
                              body: JSON.stringify({ [field]: !isBlocked }),
                            });
                            toast({ title: !isBlocked ? `🔒 ${label} — accès bloqué` : `✅ ${label} — accès restauré` });
                            const fresh = await apiFetch(`/api/admin/users/${userId}`);
                            setData(fresh);
                          } catch (e: unknown) {
                            toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
                          }
                          setSaving(false);
                        }}
                        disabled={saving}
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 shrink-0",
                          isBlocked
                            ? "bg-red-500/15 text-red-600 hover:bg-red-500/25"
                            : "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                        )}
                      >
                        {isBlocked ? "🔒 Bloqué" : "✅ Autorisé"}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold mb-2">Changer le mot de passe</p>
                <div className="flex gap-2">
                  <input type="text" value={pwForm} onChange={e => setPwForm(e.target.value)} placeholder="Nouveau mot de passe" className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <button onClick={changePassword} disabled={saving || !pwForm.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50">
                    <Key size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
          {!loading && data && tab === "balances" && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Modifie les soldes directement. Sauvegarde avant de fermer.</p>
              {Object.entries(balanceForm).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-muted-foreground w-36 flex-shrink-0">{BALANCE_LABELS[key]}</label>
                  <input type="number" min="0" step="0.01" value={val} onChange={e => setBalanceForm(f => ({ ...f, [key]: e.target.value }))} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  <span className="text-xs text-muted-foreground">FCFA</span>
                </div>
              ))}
              <button onClick={saveBalances} disabled={saving} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 mt-2">
                {saving ? "Enregistrement..." : "Enregistrer les soldes"}
              </button>
            </div>
          )}
          {!loading && data && tab === "team" && (
            <div className="space-y-2">
              {data.teamN1.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun filleul direct</p>}
              {data.teamN1.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/40 rounded-xl">
                  <div>
                    <p className="text-sm font-medium">{m.displayName}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.isActivated ? "paid" : "pending"} />
                    <span className="text-[10px] text-muted-foreground">{fmtDate(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && data && tab === "history" && (
            <div className="space-y-2">
              {data.transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune transaction</p>}
              {data.transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 bg-muted/40 rounded-xl">
                  <div>
                    <p className="text-xs font-medium">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{fmtDate(tx.createdAt)}</p>
                  </div>
                  <span className={cn("text-sm font-bold", parseFloat(tx.amount) >= 0 ? "text-emerald-600" : "text-red-500")}>
                    {parseFloat(tx.amount) >= 0 ? "+" : ""}{parseFloat(tx.amount).toLocaleString("fr-FR")} F
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Section : Utilisateurs ───────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (filter !== "all") params.set("filter", filter);
    params.set("limit", "100");
    try {
      const d = await apiFetch(`/api/admin/users?${params}`);
      setUsers(d.users);
      setTotal(d.total);
    } catch {}
    setLoading(false);
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer définitivement ${name} ? Cette action est irréversible.`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      toast({ title: "Utilisateur supprimé" });
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      {selectedId !== null && <UserDetailModal userId={selectedId} onClose={() => { setSelectedId(null); load(); }} />}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-xl font-bold">Utilisateurs <span className="text-sm font-normal text-muted-foreground">({total})</span></h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Rechercher par email, nom, téléphone, code parrainage..." className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[["all", "Tous"], ["active", "Actifs"], ["inactive", "Inactifs"], ["free", "Gratuits"], ["banned", "Bloqués"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} className={cn("px-3 py-2 rounded-xl text-xs font-medium transition-colors", filter === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Aucun utilisateur trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Membre", "Statut", "Solde total", "Pays", "Inscrit le", "Dernière connexion", "Actions"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map(u => {
                  const totalBalance = [u.referralBalance, u.taskBalance, u.bonusBalance, u.depositBalance, u.activityBalance].reduce((s, v) => s + parseFloat(v ?? "0"), 0);
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <UserAvatar avatarUrl={u.avatarUrl} name={u.displayName} size="sm" />
                          <div>
                            <p className="font-medium text-xs">{u.displayName}</p>
                            <p className="text-[10px] text-muted-foreground">{u.email}</p>
                            {u.phone && (
                              <a
                                href={`https://wa.me/${u.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400 hover:underline mt-0.5"
                                title={`Contacter sur WhatsApp : ${u.phone}`}
                              >
                                <Phone size={9} />
                                {u.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {u.isBanned ? (
                            <StatusBadge status="rejected" />
                          ) : u.isActivated ? (
                            <StatusBadge status="paid" />
                          ) : u.isFreeAccount ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">✦ Gratuit</span>
                          ) : (
                            <StatusBadge status="pending" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs">{totalBalance.toLocaleString("fr-FR")} F</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.country}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : <span className="text-muted-foreground/50 italic">jamais</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedId(u.id)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors" title="Voir détails">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setSelectedId(u.id)} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-600 transition-colors" title="Modifier soldes">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(u.id, u.displayName)} disabled={deleting === u.id} className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors" title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section : Retraits ───────────────────────────────────────────
function WithdrawalsSection() {
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actioning, setActioning] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [forceModal, setForceModal] = useState<{ w: Withdrawal; mode: "complete" | "refund" } | null>(null);
  const [forceNote, setForceNote] = useState("");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/admin/withdrawals/all${filter !== "all" ? `?filter=${filter}` : ""}`);
      setItems(d);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: number, status: string, reason?: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/withdrawals/${id}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) });
      toast({ title: `Statut → ${status}` });
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setActioning(null);
    setRejectId(null);
    setRejectReason("");
  };

  const forceResolve = async () => {
    if (!forceModal) return;
    setActioning(forceModal.w.id);
    try {
      await apiFetch(`/api/admin/withdrawals/${forceModal.w.id}/force-resolve`, {
        method: "POST",
        body: JSON.stringify({ mode: forceModal.mode, adminNote: forceNote || undefined }),
      });
      toast({
        title: forceModal.mode === "complete" ? "Retrait forcé en complété ✓" : "Remboursement forcé ✓",
        description: forceModal.mode === "complete"
          ? "Le solde a été re-débité si nécessaire."
          : "Le solde a été restitué à l'utilisateur.",
      });
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setActioning(null);
    setForceModal(null);
    setForceNote("");
  };

  const isTimeout = (w: Withdrawal) =>
    w.rejectionReason?.includes("Timeout réseau") ||
    w.rejectionReason?.includes("vérification AccountPE");

  return (
    <div className="space-y-4">
      {rejectId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-border">
            <h3 className="font-bold">Motif de refus</h3>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Expliquez le motif du refus..." rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => { setRejectId(null); setRejectReason(""); }} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
              <button onClick={() => setStatus(rejectId, "rejected", rejectReason)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold">Refuser</button>
            </div>
          </div>
        </div>
      )}

      {forceModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl border border-border">
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-xl", forceModal.mode === "complete" ? "bg-emerald-500/10" : "bg-red-500/10")}>
                {forceModal.mode === "complete" ? <CheckCircle className="text-emerald-600" size={20} /> : <XCircle className="text-red-500" size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-base">
                  {forceModal.mode === "complete" ? "Forcer la complétion" : "Forcer le remboursement"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">Retrait #{forceModal.w.id} — {forceModal.w.userDisplayName} — {fmt(forceModal.w.amount)}</p>
              </div>
            </div>

            {forceModal.mode === "complete" && forceModal.w.status === "rejected" && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-semibold">⚠️ Re-débit automatique du solde</p>
                <p>Le retrait était "rejeté" (solde déjà remboursé). Confirmer cela <strong>re-débitera {fmt(forceModal.w.amount)}</strong> du solde de {forceModal.w.userDisplayName}.</p>
                <p>N'utilisez cette action que si vous avez confirmé sur AccountPE que le paiement a bien eu lieu.</p>
              </div>
            )}
            {forceModal.mode === "complete" && forceModal.w.status === "processing" && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400">
                <p className="font-semibold">ℹ️ Aucune modification du solde</p>
                <p>Le retrait est en "traitement" (solde non remboursé). Seul le statut sera mis à jour.</p>
              </div>
            )}
            {forceModal.mode === "refund" && (
              <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-400">
                <p className="font-semibold">ℹ️ Remboursement du solde</p>
                <p>Le solde bloqué sera restitué à {forceModal.w.userDisplayName} et le retrait sera marqué comme rejeté.</p>
              </div>
            )}

            {forceModal.w.payoutRef && (
              <div className="text-xs text-muted-foreground font-mono bg-muted/50 rounded-lg px-3 py-2">
                Réf. AccountPE : {forceModal.w.payoutRef}
              </div>
            )}

            <textarea
              value={forceNote}
              onChange={e => setForceNote(e.target.value)}
              placeholder="Note admin (optionnelle)..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => { setForceModal(null); setForceNote(""); }} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
              <button
                onClick={forceResolve}
                disabled={actioning === forceModal.w.id}
                className={cn("flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors",
                  forceModal.mode === "complete" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-500 hover:bg-red-600")}
              >
                {actioning === forceModal.w.id ? "..." : forceModal.mode === "complete" ? "Confirmer complétion" : "Confirmer remboursement"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Retraits</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={13} /> Actualiser</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[["pending", "En attente"], ["processing", "En cours"], ["completed", "Complétés"], ["rejected", "Refusés"], ["all", "Tous"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={cn("px-3 py-2 rounded-xl text-xs font-medium transition-colors", filter === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
            {label}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Aucun retrait dans cette catégorie</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Membre", "Montant", "Méthode", "Compte", "Source", "Statut", "Date", "Actions"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map(w => (
                  <tr key={w.id} className={cn("hover:bg-muted/30 transition-colors", isTimeout(w) && "bg-amber-500/5")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{w.userDisplayName}</p>
                      <p className="text-[10px] text-muted-foreground">{w.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-sm">{fmt(w.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{w.method.replace("_", " ")}</td>
                    <td className="px-4 py-3 text-xs">
                      <p>{w.accountName}</p>
                      <p className="text-muted-foreground">{w.accountNumber}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{w.source}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={w.status} />
                      {isTimeout(w) && (
                        <p className="text-[9px] text-amber-600 font-semibold mt-0.5">⏱ TIMEOUT</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{fmtDate(w.createdAt)}</td>
                    <td className="px-4 py-3">
                      {w.status === "pending" && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setStatus(w.id, "processing")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title="Passer en cours">
                            <Clock size={13} />
                          </button>
                          <button onClick={() => setStatus(w.id, "completed")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title="Marquer payé">
                            <CheckCircle size={13} />
                          </button>
                          <button onClick={() => setRejectId(w.id)} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" title="Refuser">
                            <XCircle size={13} />
                          </button>
                        </div>
                      )}
                      {w.status === "processing" && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {w.source === "referral" && isTimeout(w) ? (
                            <>
                              <button
                                onClick={() => setForceModal({ w, mode: "complete" })}
                                disabled={actioning === w.id}
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                                title="Paiement confirmé → Forcer complétion"
                              >
                                <CheckCircle size={13} />
                              </button>
                              <button
                                onClick={() => setForceModal({ w, mode: "refund" })}
                                disabled={actioning === w.id}
                                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                                title="Paiement non exécuté → Forcer remboursement"
                              >
                                <XCircle size={13} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => setStatus(w.id, "completed")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                                <CheckCircle size={13} />
                              </button>
                              <button onClick={() => setRejectId(w.id)} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                                <XCircle size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                      {w.status === "rejected" && w.source === "referral" && (
                        <button
                          onClick={() => setForceModal({ w, mode: "complete" })}
                          disabled={actioning === w.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 transition-colors text-[10px] font-semibold"
                          title="Paiement confirmé sur AccountPE — re-débiter et compléter"
                        >
                          <AlertTriangle size={11} /> Forcer
                        </button>
                      )}
                      {(w.status === "completed" || (w.status === "rejected" && w.source !== "referral")) && (
                        <span className="text-[10px] text-muted-foreground">{fmtDate(w.processedAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section : Activités (conversions) ───────────────────────────
function ActivitiesSection() {
  const [items, setItems] = useState<ActivityWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actioning, setActioning] = useState<number | null>(null);
  const [noteForm, setNoteForm] = useState<{ id: number; note: string } | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/admin/activity-withdrawals${filter !== "all" ? `?filter=${filter}` : ""}`);
      setItems(d);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id: number, status: string, adminNote?: string, rejectionReason?: string) => {
    setActioning(id);
    try {
      await apiFetch(`/api/admin/withdrawals/activity/${id}`, { method: "PATCH", body: JSON.stringify({ status, adminNote, rejectionReason }) });
      toast({ title: `Statut → ${status}` });
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setActioning(null);
    setNoteForm(null);
  };

  return (
    <div className="space-y-4">
      {noteForm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-border">
            <h3 className="font-bold">Motif de refus</h3>
            <textarea value={noteForm.note} onChange={e => setNoteForm(f => f ? { ...f, note: e.target.value } : null)} placeholder="Expliquez le motif..." rows={3} className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none resize-none" />
            <div className="flex gap-3">
              <button onClick={() => setNoteForm(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
              <button onClick={() => setStatus(noteForm.id, "rejected", undefined, noteForm.note)} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold">Refuser</button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Conversions d'activités</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"><RefreshCw size={13} /> Actualiser</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {[["pending", "En attente"], ["approved", "Approuvées"], ["paid", "Payées"], ["rejected", "Refusées"], ["all", "Toutes"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={cn("px-3 py-2 rounded-xl text-xs font-medium transition-colors", filter === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
            {label}
          </button>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Aucune demande dans cette catégorie</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Membre", "Montant", "Méthode", "Compte", "WhatsApp", "Statut", "Date", "Actions"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map(w => (
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-xs">{w.userDisplayName}</p>
                      <p className="text-[10px] text-muted-foreground">{w.userEmail}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-sm">{fmt(w.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{w.method.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs">
                      <p>{w.accountName}</p>
                      <p className="text-muted-foreground">{w.accountNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{w.whatsappNumber ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{fmtDate(w.createdAt)}</td>
                    <td className="px-4 py-3">
                      {(w.status === "pending" || w.status === "approved") && (
                        <div className="flex items-center gap-1">
                          {w.status === "pending" && (
                            <button onClick={() => setStatus(w.id, "approved")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors" title="Approuver">
                              <CheckCircle size={13} />
                            </button>
                          )}
                          <button onClick={() => setStatus(w.id, "paid")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors" title="Marquer payé">
                            <DollarSign size={13} />
                          </button>
                          <button onClick={() => setNoteForm({ id: w.id, note: "" })} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors" title="Refuser">
                            <XCircle size={13} />
                          </button>
                        </div>
                      )}
                      {(w.status === "paid" || w.status === "rejected") && (
                        <span className="text-[10px] text-muted-foreground">{fmtDate(w.paidAt ?? w.approvedAt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section : Activités Surprise ────────────────────────────────
function SurprisesSection() {
  const [items, setItems] = useState<SurpriseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [actioning, setActioning] = useState<number | null>(null);
  const [validateForm, setValidateForm] = useState<{ id: number; points: number } | null>(null);
  const [rejectForm, setRejectForm] = useState<{ id: number; note: string } | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiFetch(`/api/admin/surprises?status=${filter}`);
      setItems(d as SurpriseSubmission[]);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleValidate = async () => {
    if (!validateForm) return;
    setActioning(validateForm.id);
    try {
      await apiFetch(`/api/admin/surprises/${validateForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "approve", points: validateForm.points }),
      });
      toast({ title: `✅ +${validateForm.points} pts crédités !` });
      setValidateForm(null);
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setActioning(null);
  };

  const handleReject = async () => {
    if (!rejectForm) return;
    setActioning(rejectForm.id);
    try {
      await apiFetch(`/api/admin/surprises/${rejectForm.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "reject", adminNote: rejectForm.note }),
      });
      toast({ title: "Soumission refusée" });
      setRejectForm(null);
      load();
    } catch (e: unknown) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    }
    setActioning(null);
  };

  return (
    <div className="space-y-4">
      {/* Modal Validation */}
      {validateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-sm p-6 space-y-5 shadow-2xl border border-border">
            <div>
              <h3 className="font-bold text-lg">Valider la soumission</h3>
              <p className="text-xs text-muted-foreground mt-1">Choisissez le nombre de points à attribuer (1–100)</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Points</span>
                <span className="text-2xl font-black text-purple-600">{validateForm.points}</span>
              </div>
              <input
                type="range"
                min={1} max={100}
                value={validateForm.points}
                onChange={(e) => setValidateForm(f => f ? { ...f, points: parseInt(e.target.value) } : null)}
                className="w-full accent-purple-600"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>1 pt (peu de vues)</span>
                <span>100 pts (max)</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setValidateForm(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
              <button
                onClick={() => void handleValidate()}
                disabled={actioning === validateForm.id}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {actioning === validateForm.id ? "..." : `Valider +${validateForm.points} pts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Refus */}
      {rejectForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-background rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl border border-border">
            <h3 className="font-bold">Motif de refus (optionnel)</h3>
            <textarea
              value={rejectForm.note}
              onChange={(e) => setRejectForm(f => f ? { ...f, note: e.target.value } : null)}
              placeholder="Capture illisible, nombre de vues insuffisant..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectForm(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium">Annuler</button>
              <button
                onClick={() => void handleReject()}
                disabled={actioning === rejectForm.id}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
              >
                {actioning === rejectForm.id ? "..." : "Refuser (0 pts)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Activités Surprise</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["pending", "En attente"], ["approved", "Validées"], ["rejected", "Refusées"], ["all", "Toutes"]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={cn("px-3 py-2 rounded-xl text-xs font-medium transition-colors", filter === val ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70")}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Aucune soumission dans cette catégorie</div>
        ) : (
          <div className="space-y-0 divide-y divide-border/50">
            {items.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row gap-4 hover:bg-muted/20 transition-colors">
                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.userDisplayName}</span>
                    <StatusBadge status={item.status} />
                    {item.pointsAwarded > 0 && (
                      <span className="text-xs font-bold text-purple-600">+{item.pointsAwarded} pts</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{item.userPhone} · {item.userCountry}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Semaine du {item.weekStart} · Soumis le {fmtDate(item.createdAt)}
                  </div>
                  {item.adminNote && (
                    <div className="text-[11px] text-amber-600 mt-1 bg-amber-500/5 px-2 py-1 rounded-lg">
                      Note : {item.adminNote}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {item.screenshotUrl && (
                    <a
                      href={item.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                    >
                      <Eye size={13} />
                      Voir
                    </a>
                  )}
                  {item.status === "pending" && (
                    <>
                      <button
                        onClick={() => setValidateForm({ id: item.id, points: 100 })}
                        disabled={actioning === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        <CheckCircle size={13} />
                        Valider
                      </button>
                      <button
                        onClick={() => setRejectForm({ id: item.id, note: "" })}
                        disabled={actioning === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-xs font-medium disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section : Portefeuilles pays ────────────────────────────────
interface WalletRow {
  country: string; countryCode: string; currency: string;
  userCount: number; usersWithBalance: number; usersReadyToWithdraw: number;
  totalReferralFcfa: number; eligibleReferralFcfa: number; pendingWithdrawalFcfa: number;
  minimumFcfa: number; recommendedFcfa: number;
  totalReferralLocal: number; eligibleReferralLocal: number; pendingWithdrawalLocal: number;
  minimumLocal: number; recommendedLocal: number;
}

function fmtLocal(amount: number, currency: string) {
  return amount.toLocaleString("fr-FR") + " " + currency;
}

function FundingBadge({ ready, total }: { ready: number; total: number }) {
  if (total === 0) return <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">Vide</span>;
  if (ready === 0) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">OK pour l&apos;instant</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-semibold">{ready} prêt{ready > 1 ? "s" : ""} à retirer</span>;
}

function WalletsSection() {
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [walletUsers, setWalletUsers] = useState<WalletUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WalletRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exposure, users] = await Promise.all([
        apiFetch("/api/admin/wallet-exposure") as Promise<WalletRow[]>,
        apiFetch("/api/admin/wallet-users") as Promise<WalletUser[]>,
      ]);
      setRows(exposure);
      setWalletUsers(users);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRecommended = rows.reduce((s, r) => s + r.recommendedFcfa, 0);
  const totalReady = rows.reduce((s, r) => s + r.usersReadyToWithdraw, 0);

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Portefeuilles par pays</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Montants à déposer chez notre partenaire de paiement pour éviter les échecs
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualiser
        </button>
      </div>

      {/* Bandeau résumé global */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Utilisateurs prêts à retirer</p>
          <p className="text-2xl font-bold mt-1">{totalReady}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sur tous les pays</p>
        </div>
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-xs text-primary font-medium">Budget recommandé total</p>
          <p className="text-xl font-bold mt-1">{totalRecommended.toLocaleString("fr-FR")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">FCFA équivalent (toutes devises)</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-2xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Le <strong>budget recommandé</strong> = soldes des utilisateurs prêts à retirer + retraits en cours + 20% de marge de sécurité.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Aucune donnée disponible</div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const urgent = row.usersReadyToWithdraw > 0;
            return (
              <div key={row.country} className={cn(
                "bg-card border rounded-2xl overflow-hidden transition-all",
                urgent ? "border-amber-500/40" : "border-border"
              )}>
                {/* Header ligne */}
                <button
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setSelected(selected?.country === row.country ? null : row)}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold",
                    urgent ? "bg-amber-500/15 text-amber-600" : "bg-primary/10 text-primary"
                  )}>
                    {row.countryCode}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{row.country}</span>
                      <FundingBadge ready={row.usersReadyToWithdraw} total={row.usersWithBalance} />
                      {urgent && <AlertTriangle size={13} className="text-amber-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {row.userCount} membre{row.userCount > 1 ? "s" : ""} · devise : <strong>{row.currency}</strong>
                    </p>
                  </div>
                  {/* Montant recommandé mis en avant */}
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">À déposer</p>
                    <p className={cn("text-base font-bold tabular-nums", urgent ? "text-amber-500" : "text-foreground")}>
                      {row.recommendedLocal > 0 ? fmtLocal(row.recommendedLocal, row.currency) : "—"}
                    </p>
                  </div>
                </button>

                {/* Détail déployable */}
                {selected?.country === row.country && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-2 font-medium uppercase tracking-wide text-[10px]">Utilisateurs</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Total membres</span><span className="font-semibold">{row.userCount}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Avec solde &gt; 0</span><span className="font-semibold">{row.usersWithBalance}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Prêts à retirer</span><span className={cn("font-bold", row.usersReadyToWithdraw > 0 ? "text-amber-500" : "")}>{row.usersReadyToWithdraw}</span></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2 font-medium uppercase tracking-wide text-[10px]">Soldes (FCFA)</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Tous les soldes</span><span className="font-semibold">{row.totalReferralFcfa.toLocaleString("fr-FR")} F</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Soldes éligibles</span><span className="font-semibold text-amber-500">{row.eligibleReferralFcfa.toLocaleString("fr-FR")} F</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Retraits en cours</span><span className="font-semibold text-blue-500">{row.pendingWithdrawalFcfa.toLocaleString("fr-FR")} F</span></div>
                        </div>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <p className="text-muted-foreground mb-2 font-medium uppercase tracking-wide text-[10px]">À déposer ({row.currency})</p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Minimum absolu</span><span className="font-semibold">{fmtLocal(row.minimumLocal, row.currency)}</span></div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Recommandé (+20%)</span>
                            <span className={cn("font-bold text-sm", urgent ? "text-amber-500" : "text-emerald-600")}>{row.recommendedLocal > 0 ? fmtLocal(row.recommendedLocal, row.currency) : "—"}</span>
                          </div>
                        </div>
                        {row.recommendedLocal > 0 && (
                          <div className={cn(
                            "mt-3 p-2.5 rounded-xl text-[11px] leading-relaxed",
                            urgent ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          )}>
                            {urgent
                              ? `⚠️ Déposez ${fmtLocal(row.recommendedLocal, row.currency)} dans votre portefeuille ${row.country} pour éviter les erreurs de solde insuffisant.`
                              : `✅ Recommandé : ${fmtLocal(row.recommendedLocal, row.currency)} dans le portefeuille ${row.country}.`
                            }
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Liste individuelle des membres avec solde ─────────────── */}
      {!loading && walletUsers.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users size={15} className="text-primary" />
              Membres avec solde actif
              <span className="text-[11px] font-normal text-muted-foreground">({walletUsers.length} membres — comptes admin exclus)</span>
            </h3>
          </div>
          <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
            {walletUsers.map((wu, idx) => (
              <div key={wu.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                {/* Rang */}
                <span className="w-6 text-center text-xs font-bold text-muted-foreground flex-shrink-0">
                  {idx + 1}
                </span>
                {/* Avatar */}
                <UserAvatar avatarUrl={wu.avatarUrl} name={wu.displayName} size="sm" />
                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{wu.displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{wu.email}</p>
                  {wu.country && <p className="text-[10px] text-muted-foreground">{wu.country}</p>}
                </div>
                {/* Soldes */}
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm tabular-nums text-foreground">
                    {wu.totalBalance.toLocaleString("fr-FR")} F
                  </p>
                  <div className="flex gap-2 mt-0.5 justify-end flex-wrap text-[10px]">
                    {wu.referralBalance > 0 && (
                      <span className="text-blue-500">{wu.referralBalance.toLocaleString("fr-FR")} Parr.</span>
                    )}
                    {wu.activityBalance > 0 && (
                      <span className="text-purple-500">{wu.activityBalance.toLocaleString("fr-FR")} Act.</span>
                    )}
                    {wu.bonusBalance > 0 && (
                      <span className="text-amber-500">{wu.bonusBalance.toLocaleString("fr-FR")} Bonus</span>
                    )}
                    {wu.depositBalance > 0 && (
                      <span className="text-emerald-600">{wu.depositBalance.toLocaleString("fr-FR")} Dép.</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section : Ventes de contacts ────────────────────────────────
interface ContactPurchaseRow {
  id: number;
  buyerId: number;
  buyerName: string | null;
  buyerEmail: string | null;
  quantity: number;
  priceFcfa: string;
  currency: string;
  priceInCurrency: string;
  orderType: string;
  createdAt: string;
}

interface ContactsRevenue {
  totalRevenue: number;
  totalPurchases: number;
  totalContacts: number;
  history: ContactPurchaseRow[];
}

function ContactsSection() {
  const [data, setData] = useState<ContactsRevenue | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch("/api/admin/contacts-revenue")); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ventes de contacts</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Erreur de chargement.</div>
      ) : (
        <>
          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={DollarSign} label="Revenus contacts" value={fmt(data.totalRevenue)} color="bg-emerald-500" />
            <StatCard icon={BookUser} label="Achats effectués" value={data.totalPurchases.toLocaleString("fr-FR")} color="bg-blue-500" />
            <StatCard icon={Users} label="Contacts vendus" value={data.totalContacts.toLocaleString("fr-FR")} color="bg-purple-500" />
          </div>

          {/* Historique */}
          {data.history.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Aucun achat de contacts pour l'instant.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <BookUser size={16} className="text-primary" />
                <span className="font-semibold text-sm">Historique des achats ({data.history.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Acheteur</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Contacts</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Prix FCFA</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Devise</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Ordre</th>
                      <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.history.map(row => (
                      <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground truncate max-w-[140px]">{row.buyerName ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.buyerEmail ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.quantity.toLocaleString("fr-FR")}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">{fmt(row.priceFcfa)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{row.currency}</span>
                          <p className="text-[10px] text-muted-foreground tabular-nums">{parseFloat(row.priceInCurrency).toLocaleString("fr-FR")}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {row.orderType === "newest" ? "Nouveaux" : "Anciens"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Section : Formations ─────────────────────────────────────────
const PRO_FORMATION_LABELS: Record<string, string> = {
  "tiktok-monetisable":    "TikTok Monétisable",
  "tiktok-clients":        "TikTok Clients",
  "whatsapp-systeme":      "WhatsApp Système",
  "ia-vendre":             "IA pour Vendre",
  "whatsapp-business":     "WhatsApp Business",
  "marketing-affiliation": "Affiliation",
  "business-telephone":    "Business Téléphone",
  "recruter-trixhub":      "Recruter TRIXHUB (gratuit)",
};

const FREE_FORMATION_LABELS: Record<string, string> = {
  "vie-financiere":            "Vie Financière",
  "fin-mois-sans-argent":      "Fin de mois",
  "deuxieme-source-revenu":    "2ème Source Revenu",
  "business-stable":           "Business Stable",
  "revenus-etudes":            "Revenus Études",
  "canal-plus":                "Canal+",
  "vendre-whatsapp":           "Vendre WhatsApp",
  "convertir-contacts":        "Convertir Contacts",
  "viral-reseaux":             "Viral Réseaux",
  "confiance-en-soi":          "Confiance en Soi",
  "serieux-30-jours":          "Sérieux 30 Jours",
  "controle-90-jours":         "Contrôle 90 Jours",
  "meilleure-version":         "Meilleure Version",
  "telephone":                 "Téléphone",
  "intelligence-artificielle": "Intelligence Artificielle",
};

interface ProPurchaseRow {
  id: number;
  formationId: string;
  priceFcfa: number;
  currency: string;
  priceInCurrency: string;
  createdAt: string;
  buyerName: string | null;
  buyerEmail: string | null;
}

interface FreeDownloadRow {
  id: number;
  formationId: string;
  downloadedAt: string;
  userName: string | null;
  userEmail: string | null;
}

interface FormationsData {
  pro: { totalRevenue: number; totalPurchases: number; history: ProPurchaseRow[] };
  free: { totalDownloads: number; history: FreeDownloadRow[] };
}

function FormationsSection() {
  const [data, setData] = useState<FormationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pro" | "free">("pro");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch("/api/admin/formations")); } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Formations</h2>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
      ) : !data ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Erreur de chargement.</div>
      ) : (
        <>
          {/* Stats globales */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={DollarSign}      label="Revenus Formations Pro"         value={data.pro.totalRevenue.toLocaleString("fr-FR") + " FCFA"} color="bg-emerald-500" />
            <StatCard icon={Star}            label="Achats Formations Pro"           value={data.pro.totalPurchases.toLocaleString("fr-FR")}          color="bg-purple-500" />
            <StatCard icon={Download}        label="Téléchargements Gratuits"        value={data.free.totalDownloads.toLocaleString("fr-FR")}         color="bg-blue-500"   />
          </div>

          {/* Sous-onglets */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-xl w-fit">
            <button onClick={() => setTab("pro")}  className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all", tab === "pro"  ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><Star size={14} /> Pro</button>
            <button onClick={() => setTab("free")} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all", tab === "free" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}><GraduationCap size={14} /> Gratuites</button>
          </div>

          {/* Table Formations Pro */}
          {tab === "pro" && (
            data.pro.history.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun achat de formation pro pour l'instant.</div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <Star size={16} className="text-purple-500" />
                  <span className="font-semibold text-sm">Achats Formations Pro ({data.pro.history.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Acheteur</th>
                        <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Formation</th>
                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Prix FCFA</th>
                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pro.history.map(row => (
                        <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground truncate max-w-[140px]">{row.buyerName ?? "—"}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.buyerEmail ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded font-medium">
                              {PRO_FORMATION_LABELS[row.formationId] ?? row.formationId}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            {row.priceFcfa === 0 ? <span className="text-xs text-muted-foreground">Gratuit</span> : `${row.priceFcfa} F`}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Table Formations Gratuites */}
          {tab === "free" && (
            data.free.history.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-sm text-muted-foreground">Aucun téléchargement de formation gratuite pour l'instant.</div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <GraduationCap size={16} className="text-blue-500" />
                  <span className="font-semibold text-sm">Téléchargements Formations Gratuites ({data.free.history.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Utilisateur</th>
                        <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Formation</th>
                        <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.free.history.map(row => (
                        <tr key={row.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground truncate max-w-[140px]">{row.userName ?? "—"}</p>
                            <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.userEmail ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-medium">
                              {FREE_FORMATION_LABELS[row.formationId] ?? row.formationId}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.downloadedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// ─── Section : Top Utilisateurs ──────────────────────────────────
const TOP_CATS = [
  { id: "recruiters" as const, label: "Top Recruteurs",  icon: Users,        color: "text-blue-500",   bg: "bg-blue-500/10",   fmt: (m: number) => `${m} filleul${m !== 1 ? "s" : ""}` },
  { id: "activities" as const, label: "Top Activités",   icon: Activity,     color: "text-purple-500", bg: "bg-purple-500/10", fmt: (m: number) => `${m} pts` },
  { id: "balances"   as const, label: "Gros Soldes",     icon: Wallet,       color: "text-emerald-500",bg: "bg-emerald-500/10",fmt: (m: number) => parseFloat(String(m)).toLocaleString("fr-FR") + " F" },
  { id: "withdrawals"as const, label: "Gros Retraits",   icon: ArrowUpRight, color: "text-amber-500",  bg: "bg-amber-500/10",  fmt: (m: number) => parseFloat(String(m)).toLocaleString("fr-FR") + " F" },
] as const;

const RANK_STYLES = [
  { medal: "🥇", border: "border-amber-400/40",   bg: "bg-amber-500/5"   },
  { medal: "🥈", border: "border-slate-400/40",   bg: "bg-slate-500/5"   },
  { medal: "🥉", border: "border-orange-400/40",  bg: "bg-orange-500/5"  },
];

function TopSection() {
  const [data, setData] = useState<TopUsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<"recruiters" | "activities" | "balances" | "withdrawals">("recruiters");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch("/api/admin/top-users")); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const catCfg = TOP_CATS.find(c => c.id === cat)!;
  const CatIcon = catCfg.icon;
  const users: TopUser[] = data?.[cat] ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-amber-500" />
          <h2 className="text-xl font-bold">Top Utilisateurs</h2>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {/* Tabs catégories */}
      <div className="flex gap-2 flex-wrap">
        {TOP_CATS.map(c => {
          const Ic = c.icon;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all",
              cat === c.id ? `${c.bg} ${c.color} font-semibold` : "bg-muted text-muted-foreground hover:bg-muted/70"
            )}>
              <Ic size={13} /> {c.label}
            </button>
          );
        })}
      </div>

      {/* Catégorie active label */}
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold", catCfg.bg, catCfg.color)}>
        <CatIcon size={15} />
        {catCfg.label}
        {cat === "activities" && <span className="text-[10px] font-normal opacity-75 ml-1">— semaine en cours</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-muted-foreground" /></div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Medal size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Aucune donnée disponible pour cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, idx) => {
            const rank = RANK_STYLES[idx] ?? { medal: `#${idx + 1}`, border: "border-border", bg: "" };
            return (
              <div key={u.id} className={cn(
                "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                rank.border, rank.bg,
                idx >= 3 ? "bg-card border-border/50" : ""
              )}>
                {/* Rang */}
                <div className="w-8 text-center flex-shrink-0">
                  {idx < 3 ? (
                    <span className="text-xl">{rank.medal}</span>
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground">#{idx + 1}</span>
                  )}
                </div>

                {/* Avatar */}
                <UserAvatar avatarUrl={u.avatarUrl} name={u.displayName} size="md" />

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{u.displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                  <p className="text-[10px] text-muted-foreground">{u.country}</p>
                </div>

                {/* Métrique + détail actifs pour recruteurs */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {cat === "recruiters" ? (
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className={cn("text-sm font-bold tabular-nums", catCfg.color)}>{u.metric} total</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 justify-end">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{u.metricActive ?? 0} actif{(u.metricActive ?? 0) !== 1 ? "s" : ""}</span>
                        <span className="text-[10px] text-muted-foreground">· {(u.metric - (u.metricActive ?? 0))} inactif{(u.metric - (u.metricActive ?? 0)) !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                  ) : (
                    <div className={cn("text-sm font-bold tabular-nums", catCfg.color)}>
                      {catCfg.fmt(u.metric)}
                    </div>
                  )}
                  {u.phone && (
                    <a
                      href={`https://wa.me/${u.phone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-500 transition-colors"
                    >
                      <Phone size={10} />
                      {u.phone}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Légende */}
      <div className="bg-muted/50 rounded-xl p-3 flex items-start gap-2">
        <UserCheck size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          Classement basé sur les membres <strong>actifs</strong> uniquement. Le téléphone affiché est cliquable — il ouvre WhatsApp directement.
        </p>
      </div>
    </div>
  );
}

// ─── Section Preuves Admin ────────────────────────────────────────
const PROOF_COUNTRIES = [
  "Cameroun","Côte d'Ivoire","Sénégal","Mali","Burkina Faso","Togo","Bénin",
  "Niger","Gabon","Congo-Brazzaville","RD Congo","Ghana","Nigeria","Kenya",
  "Rwanda","Guinée","Tanzanie","Ouganda",
];

const PROOF_METHODS = [
  { value: "mtn_momo", label: "MTN MoMo" },
  { value: "orange_money", label: "Orange Money" },
  { value: "wave", label: "Wave" },
  { value: "moov_money", label: "Moov Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "m_pesa", label: "M-Pesa" },
  { value: "free_money", label: "Free Money" },
];

interface AdminProofItem {
  id: number;
  userName: string;
  country: string;
  amount: number;
  method: string;
  description: string | null;
  imageUrl: string;
  imageToken: string;
  publishedAt: string;
}

function ProofsAdminSection() {
  const { toast } = useToast();
  const [proofs, setProofs] = useState<AdminProofItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [country, setCountry] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [description, setDescription] = useState("");

  const token = localStorage.getItem("trixhub_token");

  const loadProofs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/proofs");
      setProofs(data);
    } catch { toast({ title: "Erreur", description: "Impossible de charger les preuves", variant: "destructive" }); }
    setLoading(false);
  };

  useEffect(() => { loadProofs(); }, []);

  const handleFile = (f: File | null) => {
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast({ title: "Image manquante", variant: "destructive" }); return; }
    if (!userName.trim() || !country || !amount || !method) {
      toast({ title: "Remplissez tous les champs obligatoires", variant: "destructive" }); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userName", userName.trim());
      fd.append("country", country);
      fd.append("amount", amount);
      fd.append("method", method);
      if (description.trim()) fd.append("description", description.trim());

      const res = await fetch(`${BASE}/api/admin/proof-publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur");

      toast({ title: "Preuve publiée !", description: "Elle apparaîtra sur la page /preuves." });
      setFile(null);
      setPreview(null);
      setUserName("");
      setCountry("");
      setAmount("");
      setMethod("");
      setDescription("");
      await loadProofs();
    } catch (err) {
      toast({ title: "Échec de l'upload", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Supprimer cette preuve ?")) return;
    try {
      await apiFetch(`/api/admin/proofs/${id}`, { method: "DELETE" });
      setProofs(p => p.filter(x => x.id !== id));
      toast({ title: "Supprimée" });
    } catch { toast({ title: "Erreur lors de la suppression", variant: "destructive" }); }
  };

  const methodLabel = (v: string) => PROOF_METHODS.find(m => m.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      {/* Formulaire d'upload */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <ImagePlus size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Publier une preuve de retrait</h2>
            <p className="text-xs text-muted-foreground">L'image apparaîtra sur la page /preuves pour tous les membres.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zone image */}
          <div
            className="border-2 border-dashed border-muted rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
            style={{ minHeight: 160 }}
            onClick={() => document.getElementById("proof-file-input")?.click()}
          >
            {preview ? (
              <img src={preview} alt="Aperçu" className="object-contain max-h-60 w-full" />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <ImagePlus size={28} />
                <span className="text-sm">Cliquez pour choisir une image (PNG/JPG/WEBP)</span>
                <span className="text-xs">Max 10 Mo</span>
              </div>
            )}
            <input
              id="proof-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {preview && (
            <button type="button" onClick={() => handleFile(null)} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              <XIcon size={12} /> Retirer l'image
            </button>
          )}

          {/* Champs texte */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nom affiché *</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="Ex: Jean K."
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Pays *</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              >
                <option value="">Choisir un pays</option>
                {PROOF_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Montant (FCFA) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ex: 5000"
                min={1}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Méthode *</label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                required
              >
                <option value="">Choisir une méthode</option>
                {PROOF_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description (optionnelle)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Retrait validé en 2h, service impeccable !"
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-muted/50 border text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={uploading}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
              uploading ? "bg-primary/50 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <Send size={15} />
            {uploading ? "Publication en cours…" : "Publier la preuve"}
          </button>
        </form>
      </div>

      {/* Liste des preuves publiées */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Preuves publiées ({proofs.length})</h3>
          <button onClick={loadProofs} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : proofs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Aucune preuve publiée pour l'instant.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {proofs.map(p => {
              const imgUrl = `${BASE}/api/storage/admin-proofs/${p.id}/${p.imageToken}`;
              return (
                <div key={p.id} className="rounded-2xl border bg-card overflow-hidden">
                  <img
                    src={imgUrl}
                    alt="Preuve"
                    className="w-full object-cover"
                    style={{ maxHeight: 200 }}
                    loading="lazy"
                  />
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{p.userName}</span>
                      <span className="text-xs text-muted-foreground">{p.country}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-semibold text-primary">{p.amount.toLocaleString("fr-FR")} FCFA</span>
                      <span>•</span>
                      <span>{methodLabel(p.method)}</span>
                    </div>
                    {p.description && <p className="text-xs text-muted-foreground italic">"{p.description}"</p>}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">{new Date(p.publishedAt).toLocaleDateString("fr-FR")}</span>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section : Comptes Gratuits ──────────────────────────────────
interface FreeAccountUser {
  id: number; displayName: string; email: string; phone: string; country: string;
  isActivated: boolean; isBanned: boolean; isFreeAccount: boolean;
  activationCredit: string; freeAccountDebt: string;
  referralCode: string; referredByCode: string | null;
  createdAt: string;
  parrainName: string | null; parrainPhone: string | null; parrainEmail: string | null;
}
interface FreeAccountsData {
  summary: { total: number; activated: number; pending: number; totalCreditPending: number; totalDebtRemaining: number };
  users: FreeAccountUser[];
}
const FREE_THRESHOLD = 3400;

function FreeAccountsSection() {
  const [data, setData] = useState<FreeAccountsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await apiFetch("/api/admin/free-accounts")); }
    catch (e) { toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const doAction = useCallback(async (userId: number, endpoint: string, body: object, successMsg: string) => {
    setActionLoading(userId);
    try {
      await apiFetch(endpoint, { method: "PATCH", body: JSON.stringify(body) });
      toast({ title: "✓ " + successMsg });
      await load();
    } catch (e) {
      toast({ title: "Erreur", description: (e as Error).message, variant: "destructive" });
    } finally { setActionLoading(null); }
  }, [load, toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <Gift size={20} className="text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Comptes Gratuits</h2>
            <p className="text-xs text-muted-foreground">Membres ayant choisi l'activation gratuite par parrainage — dette N1 : 1 700 FCFA</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Actualiser">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Cartes de statistiques */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Users} label="Total inscrits" value={data.summary.total} color="bg-primary" />
          <StatCard icon={CheckCircle} label="Activés" value={data.summary.activated} color="bg-green-500" />
          <StatCard icon={Clock} label="En attente" value={data.summary.pending} color="bg-amber-500" />
          <StatCard icon={TrendingUp} label="Crédit en cours" value={`${data.summary.totalCreditPending.toLocaleString("fr-FR")} FCFA`} color="bg-blue-500" />
          <StatCard icon={AlertCircle} label="Dettes parrains" value={`${data.summary.totalDebtRemaining.toLocaleString("fr-FR")} FCFA`} color="bg-red-500" />
        </div>
      )}

      {/* Explication */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-amber-700 dark:text-amber-400">Logique compte gratuit</p>
        <p>• Le compte s'active automatiquement après <strong className="text-foreground">3 400 FCFA</strong> de crédit accumulés via ses filleuls.</p>
        <p>• Après activation, sa <strong className="text-foreground">1ère commission</strong> est redirigée vers son parrain (N1 = 1 700 FCFA) pour solder la dette.</p>
        <p>• La dette diminue progressivement à chaque commission perçue jusqu'à remboursement complet.</p>
      </div>

      {/* Tableau des utilisateurs */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" />
            <p className="text-sm">Chargement...</p>
          </div>
        ) : !data || data.users.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <Gift size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun compte gratuit pour le moment</p>
            <p className="text-xs mt-1">Les comptes gratuits apparaîtront ici dès qu'un utilisateur choisit l'option.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Compte gratuit</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Parrain (N1)</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Statut</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Crédit / Progression</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Dette restante</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Inscription</th>
                  <th className="text-left p-3 text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => {
                  const credit = parseFloat(u.activationCredit);
                  const progress = Math.min(100, (credit / FREE_THRESHOLD) * 100);
                  const debt = parseFloat(u.freeAccountDebt);
                  const isLoading = actionLoading === u.id;
                  return (
                    <tr key={u.id} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", u.isBanned && "opacity-60 bg-red-500/5")}>
                      {/* Compte gratuit */}
                      <td className="p-3 min-w-[170px]">
                        <p className="font-semibold text-foreground">{u.displayName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {u.phone && (
                          <a href={`https://wa.me/${u.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline mt-0.5">
                            <Phone size={10} /> {u.phone}
                          </a>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{u.country}</p>
                      </td>
                      {/* Parrain */}
                      <td className="p-3 min-w-[150px]">
                        {u.parrainName ? (
                          <>
                            <p className="text-sm font-medium text-foreground">{u.parrainName}</p>
                            {u.parrainPhone && (
                              <a href={`https://wa.me/${u.parrainPhone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                                <Phone size={10} /> {u.parrainPhone}
                              </a>
                            )}
                            <p className="text-[10px] text-muted-foreground">{u.parrainEmail}</p>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sans parrain</span>
                        )}
                      </td>
                      {/* Statut */}
                      <td className="p-3">
                        {u.isBanned ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                            <Ban size={10} /> Banni
                          </span>
                        ) : u.isActivated ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                            <CheckCircle size={10} /> Activé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Clock size={10} /> En attente
                          </span>
                        )}
                      </td>
                      {/* Crédit */}
                      <td className="p-3">
                        <div className="space-y-1.5 min-w-[140px]">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold tabular-nums">{credit.toLocaleString("fr-FR")} FCFA</span>
                            <span className="text-muted-foreground">{Math.round(progress)}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div className={cn("h-full rounded-full transition-all", u.isActivated ? "bg-green-500" : "bg-amber-500")} style={{ width: `${progress}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Seuil : {FREE_THRESHOLD.toLocaleString("fr-FR")} FCFA</p>
                        </div>
                      </td>
                      {/* Dette */}
                      <td className="p-3">
                        {debt > 0 ? (
                          <div>
                            <span className="text-sm font-bold text-destructive tabular-nums">{debt.toLocaleString("fr-FR")} FCFA</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">→ dû au parrain N1</p>
                          </div>
                        ) : u.isActivated ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 font-semibold">
                            <CheckCircle size={10} /> Soldée
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      {/* Date */}
                      <td className="p-3">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </td>
                      {/* Actions */}
                      <td className="p-3">
                        <div className="flex flex-col gap-1.5 min-w-[130px]">
                          {/* Activer manuellement */}
                          {!u.isActivated && !u.isBanned && (
                            <button
                              disabled={isLoading}
                              onClick={() => doAction(u.id, `/api/admin/users/${u.id}/activate`, { activate: true }, "Compte activé manuellement")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-700 dark:text-green-400 text-xs font-semibold hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                            >
                              <UserCheck size={11} /> Activer
                            </button>
                          )}
                          {/* Bloquer / Débloquer */}
                          {u.isBanned ? (
                            <button
                              disabled={isLoading}
                              onClick={() => doAction(u.id, `/api/admin/users/${u.id}/block`, { ban: false }, "Compte débloqué")}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                            >
                              <CheckCircle size={11} /> Débloquer
                            </button>
                          ) : (
                            <button
                              disabled={isLoading}
                              onClick={() => {
                                if (!confirm(`Bloquer le compte de ${u.displayName} ?`)) return;
                                doAction(u.id, `/api/admin/users/${u.id}/block`, { ban: true }, "Compte bloqué");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-700 dark:text-red-400 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                            >
                              <Ban size={11} /> Bloquer
                            </button>
                          )}
                          {isLoading && <RefreshCw size={12} className="animate-spin text-muted-foreground mx-auto" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale Admin ────────────────────────────────────────
const ADMIN_EMAILS = ["exaucenapopolo2@gmail.com", "mcexauofficiel@gmail.com"];

export default function AdminPage() {
  usePageTitle('Administration');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "withdrawals" | "activities" | "surprises" | "wallets" | "contacts" | "formations" | "top" | "preuves" | "free">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);

  const isAdmin = user && (user.isAdmin || ADMIN_EMAILS.includes(user.email));

  const loadStats = useCallback(async () => {
    try { setStats(await apiFetch("/api/admin/stats")); } catch {}
  }, []);

  useEffect(() => { if (isAdmin) loadStats(); }, [isAdmin, loadStats]);

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <ShieldCheck size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Accès refusé</h1>
          <p className="text-sm text-muted-foreground text-center max-w-xs">Cette page est réservée aux administrateurs TRIXHUB.</p>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: "overview",    label: "Vue d'ensemble", icon: BarChart3      },
    { id: "users",       label: "Utilisateurs",   icon: Users          },
    { id: "withdrawals", label: "Retraits",        icon: Wallet         },
    { id: "activities",  label: "Activités",       icon: Activity       },
    { id: "surprises",   label: "Surprises",       icon: Sparkles       },
    { id: "wallets",     label: "Portefeuilles",   icon: Globe          },
    { id: "contacts",    label: "Contacts",        icon: BookUser       },
    { id: "formations",  label: "Formations",      icon: GraduationCap  },
    { id: "top",         label: "Top Membres",     icon: Trophy         },
    { id: "preuves",     label: "Preuves",          icon: ImagePlus      },
    { id: "free",        label: "Comptes Gratuits", icon: Gift           },
  ] as const;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord Admin</h1>
            <p className="text-xs text-muted-foreground">Gestion complète de la plateforme TRIXHUB</p>
          </div>
        </div>

        <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all", activeTab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "overview"    && <OverviewSection stats={stats} onRefresh={loadStats} />}
        {activeTab === "users"       && <UsersSection />}
        {activeTab === "withdrawals" && <WithdrawalsSection />}
        {activeTab === "activities"  && <ActivitiesSection />}
        {activeTab === "surprises"   && <SurprisesSection />}
        {activeTab === "wallets"     && <WalletsSection />}
        {activeTab === "contacts"    && <ContactsSection />}
        {activeTab === "formations"  && <FormationsSection />}
        {activeTab === "top"         && <TopSection />}
        {activeTab === "preuves"     && <ProofsAdminSection />}
        {activeTab === "free"        && <FreeAccountsSection />}
      </div>
    </Layout>
  );
}
