import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import {
  Users, TrendingUp, Wallet, Activity, Search, RefreshCw,
  Ban, Trash2, Key, Edit3, ChevronRight, CheckCircle,
  XCircle, Clock, AlertCircle, ShieldCheck, User, ArrowUpRight,
  Filter, Eye, DollarSign, Building2, BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function authHeader() {
  const token = localStorage.getItem("trixhub_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...authHeader(), ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Erreur réseau" }));
    throw new Error(err.error ?? "Erreur");
  }
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────
interface AdminStats {
  users: { total: number; active: number; inactive: number; banned: number };
  withdrawals: { pendingCount: number; pendingAmount: number; processingCount: number; totalPaid: number };
  activityWithdrawals: { pendingCount: number; approvedCount: number };
  finance: { companyProfit: number; totalRevenue: number; profitPerActivation: number };
}

interface AdminUser {
  id: number; displayName: string; email: string; phone: string; country: string;
  isActivated: boolean; isBanned: boolean; isAdmin: boolean; referralCode: string;
  referredByCode: string | null; createdAt: string;
  referralBalance: string; taskBalance: string; bonusBalance: string;
  depositBalance: string; activityBalance: string; inactiveBalance: string;
  withdrawnAmount: string; spentAmount: string;
}

interface Withdrawal {
  id: number; userId: number; amount: string; method: string;
  accountNumber: string; accountName: string; source: string;
  status: string; rejectionReason: string | null; proofUrl: string | null;
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

// ─── Section : Vue d'ensemble ────────────────────────────────────
function OverviewSection({ stats, onRefresh }: { stats: AdminStats | null; onRefresh: () => void }) {
  if (!stats) return <div className="flex items-center justify-center h-64"><RefreshCw className="animate-spin text-muted-foreground" /></div>;
  const { users, withdrawals, activityWithdrawals, finance } = stats;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Vue d'ensemble</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>
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
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-amber-500" /> Calcul du revenu par activation</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          {[
            { label: "Pack client", value: "3 600 FCFA", color: "text-foreground" },
            { label: "Commission N1", value: "− 1 700 FCFA", color: "text-red-500" },
            { label: "Commission N2", value: "− 700 FCFA", color: "text-orange-500" },
            { label: "Commission N3", value: "− 300 FCFA", color: "text-amber-500" },
            { label: "Profit net", value: "= 900 FCFA", color: "text-emerald-600 font-bold" },
          ].map(item => (
            <div key={item.label} className="bg-muted/50 rounded-xl p-3">
              <p className={cn("text-base font-bold", item.color)}>{item.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Avec <strong>{users.active}</strong> membres actifs → profit total estimé : <strong className="text-emerald-600">{finance.companyProfit.toLocaleString("fr-FR")} FCFA</strong>
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
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={18} className="text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{data?.user.displayName ?? "Chargement..."}</h3>
              <p className="text-xs text-muted-foreground">{data?.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={toggleBlock} disabled={saving} className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", data.user.isBanned ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25" : "bg-red-500/15 text-red-600 hover:bg-red-500/25")}>
                {data.user.isBanned ? "Débloquer" : "Bloquer"}
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">✕</button>
          </div>
        </div>

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
                ["Statut", data.user.isActivated ? "✅ Activé" : "⏳ Inactif"],
                ["Banni", data.user.isBanned ? "🔴 Oui" : "🟢 Non"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground font-medium">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
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
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load()} placeholder="Rechercher par email, nom, téléphone..." className="w-full pl-9 pr-4 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[["all", "Tous"], ["active", "Actifs"], ["inactive", "Inactifs"], ["banned", "Bloqués"]].map(([val, label]) => (
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
                  {["Membre", "Statut", "Solde total", "Pays", "Inscrit le", "Actions"].map(h => (
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
                        <p className="font-medium text-xs">{u.displayName}</p>
                        <p className="text-[10px] text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={u.isActivated ? "paid" : "pending"} />
                          {u.isBanned && <StatusBadge status="rejected" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs">{totalBalance.toLocaleString("fr-FR")} F</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{u.country}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(u.createdAt)}</td>
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
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
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
                    <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
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
                        <div className="flex items-center gap-1">
                          <button onClick={() => setStatus(w.id, "completed")} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors">
                            <CheckCircle size={13} />
                          </button>
                          <button onClick={() => setRejectId(w.id)} disabled={actioning === w.id} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                            <XCircle size={13} />
                          </button>
                        </div>
                      )}
                      {(w.status === "completed" || w.status === "rejected") && (
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

// ─── Page principale Admin ────────────────────────────────────────
const ADMIN_EMAILS = ["exaucenapopolo2@gmail.com", "mcexauofficiel@gmail.com"];

export default function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "withdrawals" | "activities">("overview");
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
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "withdrawals", label: "Retraits", icon: Wallet },
    { id: "activities", label: "Activités", icon: Activity },
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

        {activeTab === "overview" && <OverviewSection stats={stats} onRefresh={loadStats} />}
        {activeTab === "users" && <UsersSection />}
        {activeTab === "withdrawals" && <WithdrawalsSection />}
        {activeTab === "activities" && <ActivitiesSection />}
      </div>
    </Layout>
  );
}
