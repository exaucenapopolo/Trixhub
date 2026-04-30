import { useState, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { useGetDashboard, useGetReferralActivity, useGetPlatformConfig } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Copy, CheckCheck, Users, Wallet, ArrowDownLeft, Zap, Gift,
  PlayCircle, HelpCircle, Compass, Sparkles, ChevronRight, Clock,
  Bell, TrendingUp, UserPlus, CheckCircle2, XCircle, AlertCircle,
  Award, PiggyBank, ArrowUpRight, Plus, Star, Crown, Share2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCountUp } from "@/hooks/use-count-up";
import { formatLocal } from "@/lib/currency";
import { cn, resolveAvatarUrl } from "@/lib/utils";

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
// ─── SVG logos réseaux sociaux ────────────────────────────────────
function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.117 1.534 5.845L.054 23.285a.75.75 0 0 0 .916.916l5.44-1.48A11.934 11.934 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.645-.52-5.153-1.42l-.368-.214-3.83 1.042 1.042-3.83-.214-.368A9.944 9.944 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}
function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}
function IconTelegram() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}
function IconTwitterX() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}
function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  );
}

function HeroReferralLink({ link, copied, onCopy, perReferral, currency }: {
  link: string; copied: boolean; onCopy: () => void; perReferral: number; currency: any;
}) {
  const shareMessage = encodeURIComponent(
    `📱 Ton téléphone peut te rendre riche ou pauvre… tout dépend de comment tu l'utilises !\n\n` +
    `💰 Rejoins *TRIXHUB* et gagne de l'argent chaque jour avec ta connexion Internet :\n` +
    `✅ Regarde des vidéos\n✅ Réponds à des quizz\n✅ Parraine tes proches\n✅ Lis des articles\n\n` +
    `📲 Inscris-toi gratuitement ici :\n${link}\n\n` +
    `Tu veux plus d'infos ? Écris-moi, je t'explique tout ! 🚀`
  );
  const shareUrl = encodeURIComponent(link);
  const shareTitle = encodeURIComponent("Rejoins TRIXHUB et gagne de l'argent chaque jour 💰");

  const socials = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${shareMessage}`,
      bg: "bg-[#25D366] hover:bg-[#20BA5A]",
      icon: <IconWhatsApp />,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${shareTitle}`,
      bg: "bg-[#1877F2] hover:bg-[#0D65D9]",
      icon: <IconFacebook />,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${shareUrl}&text=${shareMessage}`,
      bg: "bg-[#229ED9] hover:bg-[#1A8EC5]",
      icon: <IconTelegram />,
    },
    {
      label: "Twitter / X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`📱 Gagne de l'argent chaque jour avec ta connexion internet ! Rejoins TRIXHUB 💰`)}&url=${shareUrl}`,
      bg: "bg-[#000000] hover:bg-[#333333]",
      icon: <IconTwitterX />,
    },
    {
      label: "TikTok",
      href: `https://www.tiktok.com`,
      bg: "bg-[#010101] hover:bg-[#222222]",
      icon: <IconTikTok />,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        navigator.clipboard.writeText(link);
        window.open("https://www.tiktok.com", "_blank");
      },
    },
  ];

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
            "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm mb-3",
            copied ? "bg-green-500 text-white scale-[1.01]" : "bg-primary text-primary-foreground hover:scale-[1.01]"
          )}
          data-testid="button-copy-referral"
        >
          {copied ? <><CheckCheck className="w-4 h-4" /> Copié !</> : <><Copy className="w-4 h-4" /> Copier mon lien</>}
        </button>

        {/* Boutons de partage réseaux sociaux */}
        <div className="border-t border-border/50 pt-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
            <Share2 className="w-3 h-3" /> Partager directement
          </p>
          <div className="flex gap-2 flex-wrap">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={s.onClick}
                title={`Partager sur ${s.label}`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-xs font-semibold transition-all hover:scale-[1.03] active:scale-[0.97] shadow-sm",
                  s.bg
                )}
              >
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </a>
            ))}
          </div>
        </div>
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
  usePageTitle('Tableau de bord');
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
      const fcfaAmount = dashboard.dailyBonusAmount ?? 5;
      const currency = dashboard.currency ?? "FCFA";
      const rate = dashboard.exchangeRate ?? 1;
      const localAmount = Math.round(fcfaAmount * rate * 100) / 100;
      const displayed = currency === "FCFA"
        ? `${fcfaAmount} FCFA`
        : `${localAmount.toLocaleString("fr-FR")} ${currency} (≈ ${fcfaAmount} FCFA)`;
      toast({
        title: "🎁 Bonus de connexion !",
        description: `+${displayed} crédités sur ton solde bonus pour ta connexion du jour.`,
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* GAINS POTENTIELS (inactiveBalance) — bloc dédié */}
        {(dashboard?.inactiveBalance ?? 0) > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400">Gains potentiels</span>
                {(dashboard?.inactiveReferrals ?? 0) > 0 && (
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-full">
                    {dashboard?.inactiveReferrals} filleul{(dashboard?.inactiveReferrals ?? 0) > 1 ? "s" : ""} inactif{(dashboard?.inactiveReferrals ?? 0) > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold tabular-nums text-foreground">{formatLocal(dashboard?.inactiveBalance ?? 0, user)}</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-1 leading-snug">
                Ces gains te seront versés automatiquement dès que tes filleuls activent leur compte — que ce soit eux-mêmes, un parrain ou un admin.
              </p>
            </div>
          </div>
        )}

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

        {/* MON PARRAIN */}
        {dashboard?.sponsor && (
          <div className="bg-gradient-to-br from-amber-500/10 via-card to-orange-500/5 border border-amber-500/20 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <Crown className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider mb-0.5">Mon parrain · Mon leader</p>
              <p className="text-base font-bold text-foreground truncate">{dashboard.sponsor.name}</p>
              <p className="text-xs text-muted-foreground">C'est lui qui t'a ouvert les portes de TRIXHUB 🙏</p>
            </div>
            {(() => {
              const sponsorAvatarSrc = resolveAvatarUrl(dashboard.sponsor.avatarUrl);
              return (
                <div className="flex-shrink-0 w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
                  {sponsorAvatarSrc ? (
                    <img
                      src={sponsorAvatarSrc}
                      alt={dashboard.sponsor.name as string}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = "none";
                        const fallback = el.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <span
                    style={{ display: sponsorAvatarSrc ? "none" : "flex" }}
                    className="text-lg font-bold text-amber-500 items-center justify-center w-full h-full"
                  >
                    {(dashboard.sponsor.name as string).charAt(0).toUpperCase()}
                  </span>
                </div>
              );
            })()}
          </div>
        )}

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
