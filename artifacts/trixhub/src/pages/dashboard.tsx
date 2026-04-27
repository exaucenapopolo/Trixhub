import { useState } from "react";
import { useGetDashboard, useGetReferralActivity, useGetPlatformConfig, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, Users, CheckSquare, Wallet, ArrowDownRight, ArrowUpRight,
  Copy, Share2, AlertCircle, Clock, CheckCircle, Shield, Info, ExternalLink
} from "lucide-react";
import { formatDualAmount } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

function StatCard({
  title, amount, currency, exchangeRate, subtitle, icon: Icon, color, badge, info
}: {
  title: string; amount: number; currency: string; exchangeRate: number;
  subtitle?: string; icon: React.ElementType; color: string; badge?: string; info?: string;
}) {
  return (
    <Card className="border-card-border">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color)}>
            <Icon size={18} className="text-white" />
          </div>
          {badge && (
            <Badge variant="outline" className="text-xs">{badge}</Badge>
          )}
        </div>
        <div className="amount-display text-2xl font-bold text-foreground mb-0.5">
          {amount.toLocaleString("fr-FR")} <span className="text-sm font-normal text-muted-foreground">FCFA</span>
        </div>
        {currency !== "FCFA" && exchangeRate !== 1 && (
          <p className="text-xs text-muted-foreground">≈ {(amount * exchangeRate).toFixed(2)} {currency}</p>
        )}
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {info && (
          <div className="flex items-start gap-1.5 mt-2 p-2 bg-amber-500/10 rounded-lg">
            <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-600 dark:text-amber-400">{info}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityItem({ item }: { item: { id: number; type: string; message: string; amount: number | null; createdAt: string } }) {
  const getIcon = () => {
    if (item.type.includes("referral")) return <Users size={14} className="text-primary" />;
    if (item.type === "task") return <CheckSquare size={14} className="text-blue-500" />;
    if (item.type === "withdrawal") return <Wallet size={14} className="text-red-500" />;
    if (item.type === "activation") return <Shield size={14} className="text-muted-foreground" />;
    return <TrendingUp size={14} className="text-muted-foreground" />;
  };

  const isPositive = item.amount != null && item.amount > 0;
  const isNegative = item.amount != null && item.amount < 0;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{item.message}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {item.amount != null && (
        <div className={cn("text-sm font-semibold amount-display shrink-0", isPositive ? "text-primary" : "text-destructive")}>
          {isPositive ? "+" : ""}{Math.abs(item.amount).toLocaleString("fr-FR")} FCFA
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: dashboard, isLoading } = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const { data: activity } = useGetReferralActivity();
  const { data: config } = useGetPlatformConfig();

  const currency = dashboard?.currency ?? "FCFA";
  const exchangeRate = dashboard?.exchangeRate ?? 1;

  const referralLink = `${window.location.origin}/?ref=${user?.referralCode}`;

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast({ title: "Lien copié !", description: "Votre lien de parrainage a été copié dans le presse-papiers." });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
        </div>
      </Layout>
    );
  }

  const stats = [
    {
      title: "Solde Total Disponible",
      amount: dashboard?.totalBalance ?? 0,
      icon: Wallet,
      color: "gradient-green",
      badge: "Retirable",
    },
    {
      title: "Solde de Parrainage",
      amount: dashboard?.referralBalance ?? 0,
      icon: Users,
      color: "bg-primary",
      subtitle: "Commissions de votre réseau",
    },
    {
      title: "Solde Tâches & Missions",
      amount: dashboard?.taskBalance ?? 0,
      icon: CheckSquare,
      color: "bg-blue-600",
      subtitle: "Gains des missions complétées",
    },
    {
      title: "Montant Retiré",
      amount: dashboard?.withdrawnAmount ?? 0,
      icon: ArrowUpRight,
      color: "bg-slate-600",
      subtitle: "Total des retraits effectués",
    },
    {
      title: "Montant Investi",
      amount: dashboard?.spentAmount ?? 0,
      icon: ArrowDownRight,
      color: "bg-slate-500",
      subtitle: "Dont activation de compte",
    },
    {
      title: "Solde des Inactifs",
      amount: dashboard?.inactiveBalance ?? 0,
      icon: Clock,
      color: "bg-amber-600",
      subtitle: "En attente d'activation",
      info: "Ces gains seront libérés dès que vos filleuls activent leur compte",
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bonjour, {user?.firstName} !</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.isActivated ? (
              <Badge className="gap-1.5 bg-primary/10 text-primary border-primary/30">
                <Shield size={12} />Compte Actif
              </Badge>
            ) : (
              <Link href="/activate">
                <Badge variant="destructive" className="gap-1.5 cursor-pointer">
                  <AlertCircle size={12} />Activer mon compte
                </Badge>
              </Link>
            )}
          </div>
        </div>

        {/* Balance stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((s) => (
            <StatCard
              key={s.title}
              {...s}
              currency={currency}
              exchangeRate={exchangeRate}
            />
          ))}
        </div>

        {/* Team stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Niveau 1", count: dashboard?.level1Count ?? 0, commission: config?.level1Commission ?? 1700, href: "/team/level/1" },
            { label: "Niveau 2", count: dashboard?.level2Count ?? 0, commission: config?.level2Commission ?? 700, href: "/team/level/2" },
            { label: "Niveau 3", count: dashboard?.level3Count ?? 0, commission: config?.level3Commission ?? 300, href: "/team/level/3" },
          ].map(({ label, count, commission, href }) => (
            <Link key={label} href={href}>
              <Card className="border-card-border hover:border-primary/30 transition-colors cursor-pointer">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold text-foreground amount-display">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  <p className="text-xs text-primary font-medium mt-1">{commission.toLocaleString("fr-FR")} FCFA/act.</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Team overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-foreground amount-display">{dashboard?.totalReferrals ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Membres totaux</p>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-primary amount-display">{dashboard?.activeReferrals ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">Membres actifs</p>
            </CardContent>
          </Card>
          <Card className="border-card-border">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-500 amount-display">{dashboard?.inactiveReferrals ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">En attente d'activation</p>
            </CardContent>
          </Card>
        </div>

        {/* Referral link */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 size={18} className="text-primary" />
              Votre lien de parrainage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2 bg-background rounded-lg border border-border text-sm text-muted-foreground truncate font-mono">
                {referralLink}
              </div>
              <Button onClick={copyLink} size="sm" className="shrink-0 gap-1.5" data-testid="button-copy-link">
                <Copy size={14} />
                Copier
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Code de parrainage : <span className="text-primary font-mono font-semibold">{user?.referralCode}</span>
            </p>
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activité récente</CardTitle>
          </CardHeader>
          <CardContent>
            {!activity || activity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune activité pour le moment.</p>
                <p className="text-xs mt-1">Partagez votre lien pour commencer à gagner !</p>
              </div>
            ) : (
              <div>
                {activity.slice(0, 8).map(item => (
                  <ActivityItem key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
