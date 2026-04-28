import { useListWithdrawals, useRequestWithdrawal, useGetBalances, getListWithdrawalsQueryKey, getGetBalancesQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, AlertCircle, Users, Gift, ChevronRight, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Source = "referral" | "task";

const METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Mobile Money" },
  { value: "wave", label: "Wave" },
  { value: "moov", label: "Moov Money" },
  { value: "free_money", label: "Free Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "mpesa", label: "M-Pesa" },
];

const STATUS_CONFIG = {
  pending: { label: "En cours", color: "text-amber-500 border-amber-500/30 bg-amber-500/10", icon: Clock },
  processing: { label: "En traitement", color: "text-blue-500 border-blue-500/30 bg-blue-500/10", icon: ArrowUpRight },
  completed: { label: "Validé", color: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "text-destructive border-destructive/30 bg-destructive/10", icon: XCircle },
};

const SOURCE_CONFIG: Record<Source, { label: string; min: number; icon: typeof Users; color: string; bg: string; border: string }> = {
  referral: { label: "Solde parrainage", min: 3000, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  task: { label: "Solde missions", min: 3500, icon: Gift, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/30" },
};

export default function WithdrawalsPage() {
  const { user } = useAuth();
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const { data: withdrawals, isLoading } = useListWithdrawals({ query: { queryKey: getListWithdrawalsQueryKey() } });
  const { data: balances } = useGetBalances({ query: { queryKey: getGetBalancesQueryKey() } });
  const requestWithdrawal = useRequestWithdrawal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const referralBalance = balances?.referralBalance ?? 0;
  const taskBalance = balances?.taskBalance ?? 0;

  const sourceMin = activeSource ? SOURCE_CONFIG[activeSource].min : 3000;
  const sourceBalance = activeSource === "task" ? taskBalance : referralBalance;

  const schema = z.object({
    amount: z.number({ coerce: true }).min(sourceMin, `Minimum ${formatLocal(sourceMin, user)}`),
    method: z.string().min(1, "Choisissez une méthode"),
    accountNumber: z.string().min(8, "Numéro de compte requis"),
    accountName: z.string().min(3, "Nom du compte requis"),
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: sourceMin, method: "", accountNumber: "", accountName: user?.displayName ?? "" },
  });

  const openSource = (s: Source) => {
    const cfg = SOURCE_CONFIG[s];
    setActiveSource(s);
    form.reset({
      amount: cfg.min,
      method: "",
      accountNumber: user?.phone ?? "",
      accountName: user?.displayName ?? "",
    });
  };

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!activeSource) return;

    if (values.amount > sourceBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Votre ${SOURCE_CONFIG[activeSource].label.toLowerCase()} est de ${formatLocal(sourceBalance, user)}. Vous avez demandé ${formatLocal(values.amount, user)}.`,
        variant: "destructive",
      });
      return;
    }

    try {
      await requestWithdrawal.mutateAsync({ data: { ...values, source: activeSource } });
      queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
      toast({
        title: "Demande envoyée !",
        description: "Votre retrait sera traité dans la minute. Si rien après 5 minutes, contactez l'assistance.",
      });
      form.reset();
      setActiveSource(null);
    } catch (err: unknown) {
      const errData = (err as { data?: { error?: string; available?: number; source?: string } })?.data;
      // Si le serveur renvoie le solde dispo + source → message converti dans la devise utilisateur
      if (errData?.available !== undefined) {
        toast({
          title: "Solde insuffisant",
          description: `Votre solde est de ${formatLocal(errData.available, user)}. Vous avez demandé ${formatLocal(values.amount, user)}.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Erreur", description: errData?.error || "Erreur lors de la demande", variant: "destructive" });
      }
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Retraits</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Choisissez quel solde vous voulez retirer.
          </p>
        </div>

        {/* DEUX CARTES SOLDE → DEUX CHEMINS DE RETRAIT */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(Object.keys(SOURCE_CONFIG) as Source[]).map((src) => {
            const cfg = SOURCE_CONFIG[src];
            const balance = src === "task" ? taskBalance : referralBalance;
            const enough = balance >= cfg.min;
            const Icon = cfg.icon;
            return (
              <button
                key={src}
                onClick={() => openSource(src)}
                disabled={!enough}
                className={cn(
                  "relative overflow-hidden text-left p-5 rounded-2xl border-2 transition-all",
                  "bg-card hover:shadow-lg hover:scale-[1.01]",
                  enough ? cfg.border : "border-border opacity-60 cursor-not-allowed"
                )}
                data-testid={`button-withdraw-${src}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", cfg.bg)}>
                    <Icon className={cn("w-6 h-6", cfg.color)} />
                  </div>
                  <ChevronRight className={cn("w-5 h-5", enough ? cfg.color : "text-muted-foreground")} />
                </div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1">{cfg.label}</p>
                <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums amount-display">
                  {formatLocal(balance, user)}
                </p>
                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Min. retrait</span>
                  <span className={cn("font-semibold", enough ? "text-foreground" : "text-amber-500")}>
                    {formatLocal(cfg.min, user)}
                  </span>
                </div>
                {!enough && (
                  <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Il manque {formatLocal(Math.max(0, cfg.min - balance), user)}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* INFO PAIEMENT AUTOMATIQUE */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-foreground">Paiement automatique en 1 minute</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Les retraits sont envoyés automatiquement sur votre Mobile Money. Si vous n'avez rien reçu après 5 minutes,
              contactez l'assistance via WhatsApp.
            </p>
          </div>
        </div>

        {/* HISTORIQUE */}
        <Card className="border-card-border">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Historique des retraits</CardTitle>
            {(withdrawals?.length ?? 0) > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {withdrawals?.length}
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
              </div>
            ) : !withdrawals || withdrawals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Wallet size={40} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Aucun retrait pour le moment</p>
                <p className="text-xs mt-1">Choisissez un solde ci-dessus pour faire votre premier retrait.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {withdrawals.map(w => {
                  const status = STATUS_CONFIG[w.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  const Icon = status.icon;
                  const sourceLabel = w.source === "task" ? "Missions" : "Parrainage";
                  return (
                    <div key={w.id} className="flex items-center gap-4 p-4 hover:bg-muted/40 transition-colors" data-testid={`row-withdrawal-${w.id}`}>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        w.source === "task" ? "bg-purple-500/10" : "bg-blue-500/10"
                      )}>
                        {w.source === "task" ? (
                          <Gift className={cn("w-5 h-5 text-purple-500")} />
                        ) : (
                          <Users className={cn("w-5 h-5 text-blue-500")} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground">
                            {METHODS.find(m => m.value === w.method)?.label ?? w.method}
                          </p>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {sourceLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{w.accountName} · {w.accountNumber}</p>
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                          {new Date(w.requestedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold text-foreground tabular-nums amount-display">{formatLocal(w.amount, user)}</p>
                        <Badge variant="outline" className={cn("text-xs gap-1 mt-1", status.color)}>
                          <Icon size={10} />{status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* MODAL DEMANDE DE RETRAIT */}
      <Dialog open={activeSource !== null} onOpenChange={(o) => !o && setActiveSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeSource && (
                <>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", SOURCE_CONFIG[activeSource].bg)}>
                    {(() => {
                      const Icon = SOURCE_CONFIG[activeSource].icon;
                      return <Icon className={cn("w-4 h-4", SOURCE_CONFIG[activeSource].color)} />;
                    })()}
                  </div>
                  Retrait — {SOURCE_CONFIG[activeSource].label}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="p-1">
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-3 bg-muted/50 rounded-xl text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Solde dispo</p>
                <p className="text-base font-bold text-primary tabular-nums amount-display mt-1">{formatLocal(sourceBalance, user)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-xl text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Minimum</p>
                <p className="text-base font-bold tabular-nums amount-display mt-1">{formatLocal(sourceMin, user)}</p>
              </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant à retirer (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        placeholder={String(sourceMin)}
                        data-testid="input-withdrawal-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="method" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Méthode de paiement</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-withdrawal-method">
                          <SelectValue placeholder="Choisissez" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="accountNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de téléphone</FormLabel>
                    <FormControl><Input {...field} placeholder="+237 6XX XX XX XX" data-testid="input-withdrawal-account" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="accountName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du titulaire</FormLabel>
                    <FormControl><Input {...field} placeholder="Nom complet" data-testid="input-withdrawal-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                  <AlertCircle size={14} className="text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground">
                    Traitement <strong>automatique en 1 minute maximum</strong>. Si rien reçu après 5 minutes, contactez l'assistance.
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={requestWithdrawal.isPending}
                  data-testid="button-submit-withdrawal"
                >
                  {requestWithdrawal.isPending ? "Envoi en cours..." : "Confirmer la demande"}
                </Button>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
