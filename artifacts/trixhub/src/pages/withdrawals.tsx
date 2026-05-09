import {
  useListWithdrawals, useRequestWithdrawal, useGetBalances,
  useGetPayoutMethods, useGetPlatformConfig,
  getListWithdrawalsQueryKey, getGetBalancesQueryKey,
  getGetPayoutMethodsQueryKey, getGetPlatformConfigQueryKey,
  type GetPayoutMethodsQueryResult,
} from "@workspace/api-client-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { usePageTitle } from '@/hooks/usePageTitle';
import {
  Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, AlertCircle,
  Users, ChevronRight, Upload, ImageIcon, Loader2, ShieldCheck, Zap,
  Star, Phone, MessageCircle, CreditCard, Coins,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect, useMemo, Component, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const MAX_PROOF_SIZE = 5 * 1024 * 1024;

const SAVED_NUMBERS_KEY = "trixhub_saved_withdraw_numbers";
const MAX_SAVED = 3;

interface SavedNumber {
  accountNumber: string;
  accountName: string;
  whatsappNumber: string;
  payoutMethodId: string;
  payoutMethodName: string;
  label?: string;
}

function loadSavedNumbers(): SavedNumber[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_NUMBERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveFavoriteNumber(data: SavedNumber) {
  const existing = loadSavedNumbers();
  const filtered = existing.filter(n => n.accountNumber !== data.accountNumber);
  const updated = [data, ...filtered].slice(0, MAX_SAVED);
  localStorage.setItem(SAVED_NUMBERS_KEY, JSON.stringify(updated));
}

const STATUS_CONFIG = {
  pending: { label: "En cours", color: "text-amber-500 border-amber-500/30 bg-amber-500/10", icon: Clock },
  processing: { label: "En traitement", color: "text-blue-500 border-blue-500/30 bg-blue-500/10", icon: ArrowUpRight },
  completed: { label: "Validé", color: "text-green-600 dark:text-green-400 border-green-500/30 bg-green-500/10", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "text-destructive border-destructive/30 bg-destructive/10", icon: XCircle },
};

const PAYOUT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Partenaire : en attente", color: "text-amber-500" },
  success: { label: "Partenaire : envoyé ✓", color: "text-green-500" },
  failed: { label: "Partenaire : échec", color: "text-red-500" },
};

const MIN_REFERRAL_DEFAULT = 3100;

// Schéma Zod défini UNE SEULE FOIS — hors de tout composant
const withdrawalSchema = z.object({
  amount: z.number({ coerce: true }).min(1, "Montant invalide"),
  payoutMethodId: z.string().min(1, "Choisissez une méthode"),
  accountNumber: z.string().min(8, "Numéro Mobile Money requis (min. 8 chiffres)"),
  accountName: z.string().min(3, "Nom du titulaire requis"),
  whatsappNumber: z.string().min(8, "Numéro WhatsApp obligatoire"),
  feeMode: z.enum(["from_amount", "from_balance"]),
});
type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

// Barème progressif des frais (en FCFA, miroir du backend)
function getPayoutFeeLocal(amountFcfa: number): number {
  if (!amountFcfa || !isFinite(amountFcfa) || amountFcfa <= 0) return 550;
  if (amountFcfa < 10_000)   return 550;
  if (amountFcfa < 20_000)   return 750;
  if (amountFcfa < 50_000)   return 1_000;
  if (amountFcfa < 100_000)  return 1_500;
  if (amountFcfa < 200_000)  return 2_000;
  if (amountFcfa < 500_000)  return 2_500;
  if (amountFcfa < 1_000_000) return 3_000;
  return 4_000;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────
class PageErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode | ((error: Error | null) => ReactNode) },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode | ((error: Error | null) => ReactNode) }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("[WithdrawalsPage] Erreur capturée:", error?.message, error?.stack);
  }
  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === "function") return fallback(this.state.error);
      if (fallback) return fallback;
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center p-6">
          <AlertCircle className="w-12 h-12 text-destructive opacity-60" />
          <div>
            <p className="font-semibold text-foreground">Une erreur est survenue</p>
            <p className="text-sm text-muted-foreground mt-1">Veuillez rafraîchir la page.</p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground/70 mt-2 font-mono bg-muted/50 rounded px-3 py-1.5 max-w-xs mx-auto break-words">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>Rafraîchir</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Sous-composant isolé pour le contenu du Dialog ───────────────────────────
// En l'isolant ici, les re-renders causés par form.watch() n'affectent PAS
// la page principale (historique, hero, etc.).
interface WithdrawalDialogContentProps {
  open: boolean;
  onClose: () => void;
  referralBalance: number;
  minReferral: number;
  user: ReturnType<typeof useAuth>["user"];
  payoutMethodsData: GetPayoutMethodsQueryResult | undefined;
  loadingMethods: boolean;
}

function WithdrawalDialogContent({ open, onClose, referralBalance, minReferral, user, payoutMethodsData, loadingMethods }: WithdrawalDialogContentProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savedNumbers, setSavedNumbers] = useState<SavedNumber[]>([]);

  const requestWithdrawal = useRequestWithdrawal();

  // Stabiliser le tableau de méthodes.
  // Array.isArray() est critique : l'ancien cache backend renvoyait un objet
  // à la place d'un tableau, ce qui causait "map is not a function" → crash.
  const payoutMethods = useMemo(() => {
    const raw = payoutMethodsData?.methods;
    return Array.isArray(raw) ? raw : [];
  }, [payoutMethodsData]);

  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: minReferral,
      payoutMethodId: "",
      accountNumber: "",
      accountName: "",
      whatsappNumber: "",
      feeMode: "from_amount",
    },
  });

  // Recharger les favoris quand le dialog s'ouvre
  useEffect(() => {
    if (open) {
      setSavedNumbers(loadSavedNumbers());
      form.reset({
        amount: minReferral,
        payoutMethodId: "",
        accountNumber: user?.phone ?? "",
        accountName: user?.displayName ?? "",
        whatsappNumber: user?.phone ?? "",
        feeMode: "from_amount",
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pré-remplir si une seule méthode disponible
  useEffect(() => {
    if (open && payoutMethods.length === 1 && !form.getValues("payoutMethodId")) {
      form.setValue("payoutMethodId", payoutMethods[0].id);
    }
  }, [open, payoutMethods]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFavorite = (fav: SavedNumber) => {
    form.setValue("accountNumber", fav.accountNumber);
    form.setValue("accountName", fav.accountName);
    form.setValue("whatsappNumber", fav.whatsappNumber);
    if (fav.payoutMethodId) form.setValue("payoutMethodId", fav.payoutMethodId);
  };

  const onSubmit = async (values: WithdrawalFormValues) => {
    const safeAmount = isFinite(values.amount) && values.amount > 0 ? values.amount : 0;

    if (safeAmount < minReferral) {
      form.setError("amount", { message: `Minimum ${formatLocal(minReferral, user)} (${minReferral.toLocaleString("fr-FR")} FCFA)` });
      return;
    }

    const fee = getPayoutFeeLocal(safeAmount);
    const debitTotal = values.feeMode === "from_balance" ? safeAmount + fee : safeAmount;

    if (debitTotal > referralBalance) {
      const msg = values.feeMode === "from_balance"
        ? `Il vous faut ${formatLocal(debitTotal, user)} (montant + frais ${formatLocal(fee, user)}) mais votre solde est de ${formatLocal(referralBalance, user)}.`
        : `Votre solde parrainage est de ${formatLocal(referralBalance, user)}. Vous avez demandé ${formatLocal(safeAmount, user)}.`;
      toast({ title: "Solde insuffisant", description: msg, variant: "destructive" });
      return;
    }

    const selectedMethod = payoutMethods.find(m => m.id === values.payoutMethodId);

    try {
      const withdrawalResult = await requestWithdrawal.mutateAsync({
        data: {
          amount: safeAmount,
          method: values.payoutMethodId,
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          source: "referral",
          whatsappNumber: values.whatsappNumber,
          payoutMethod: values.payoutMethodId,
          feeMode: values.feeMode,
        },
      });

      saveFavoriteNumber({
        accountNumber: values.accountNumber,
        accountName: values.accountName,
        whatsappNumber: values.whatsappNumber,
        payoutMethodId: values.payoutMethodId,
        payoutMethodName: selectedMethod?.name ?? values.payoutMethodId,
      });

      queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });

      const received = values.feeMode === "from_balance" ? safeAmount : safeAmount - fee;
      const isConfirmed = (withdrawalResult as { status?: string })?.status === "completed";
      toast({
        title: isConfirmed ? "Paiement confirmé ✅" : "Paiement envoyé !",
        description: isConfirmed
          ? `${formatLocal(received, user)} envoyés sur votre compte Mobile Money.`
          : `Votre paiement de ${formatLocal(received, user)} est en cours de traitement. Vous le recevrez dans quelques instants.`,
        duration: 7000,
      });
      onClose();
    } catch (err: unknown) {
      const errData = (err as { data?: { error?: string; available?: number; code?: string } })?.data;
      if (errData?.available !== undefined) {
        // Solde utilisateur insuffisant (vérifié côté DB)
        toast({
          title: "Solde insuffisant",
          description: `Votre solde est de ${formatLocal(errData.available, user)}.`,
          variant: "destructive",
        });
      } else if (errData?.code === "OPERATOR_INSUFFICIENT_FUNDS") {
        // Portefeuille AccountPE vide — solde utilisateur restitué automatiquement
        toast({
          title: "Paiement temporairement indisponible",
          description: errData.error ?? "Contactez l'assistance pour finaliser votre retrait.",
          variant: "destructive",
          duration: 10000,
        });
      } else if (errData?.code === "PAYOUT_FAILED") {
        // Autre erreur AccountPE — solde restitué
        toast({
          title: "Erreur de paiement",
          description: errData.error ?? "Votre solde a été restitué. Contactez l'assistance.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({ title: "Erreur", description: errData?.error || "Erreur lors de la demande", variant: "destructive" });
      }
    }
  };

  // Ces valeurs sont calculées DANS ce composant isolé — pas de re-render de la page principale
  // Tous les form.watch() sont au niveau composant (jamais dans des render props)
  const watchedAmount = form.watch("amount");
  const watchedFeeMode = form.watch("feeMode");
  const watchedPayoutMethodId = form.watch("payoutMethodId");
  const safeAmount = isFinite(watchedAmount) && watchedAmount > 0 ? watchedAmount : 0;
  const currentFee = getPayoutFeeLocal(safeAmount);
  const amountReceived = watchedFeeMode === "from_balance"
    ? safeAmount
    : Math.max(0, safeAmount - currentFee);
  const totalDebit = watchedFeeMode === "from_balance"
    ? safeAmount + currentFee
    : safeAmount;
  const hasEnoughForFromBalance = referralBalance >= totalDebit;

  return (
    <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/10">
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          Retrait — Solde parrainage
        </DialogTitle>
      </DialogHeader>
      <div className="p-1">
        {/* Informations solde */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-muted/50 rounded-xl text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Solde disponible</p>
            <p className="text-base font-bold text-primary tabular-nums amount-display mt-1">{formatLocal(referralBalance, user)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-xl text-center">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Minimum</p>
            <p className="text-base font-bold tabular-nums amount-display mt-1">{formatLocal(minReferral, user)}</p>
          </div>
        </div>

        {/* Numéros favoris */}
        {savedNumbers.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
              <Star size={11} className="text-amber-500" /> Numéros sauvegardés
            </p>
            <div className="flex flex-col gap-1.5">
              {savedNumbers.map((fav, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => applyFavorite(fav)}
                  className="text-left w-full p-2.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{fav.accountName} · {fav.accountNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{fav.payoutMethodName}</p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold shrink-0">
                      Utiliser
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* Montant */}
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormLabel>Montant à retirer (FCFA interne)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    value={field.value || ""}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      field.onChange(isNaN(v) ? 0 : v);
                    }}
                    onBlur={field.onBlur}
                    name={field.name}
                    placeholder={String(minReferral)}
                    data-testid="input-withdrawal-amount"
                  />
                </FormControl>
                {safeAmount > 0 && safeAmount !== minReferral && (
                  <p className="text-[11px] text-muted-foreground">
                    ≈ {formatLocal(safeAmount, user)} converti dans votre devise
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {/* ─── Mode de paiement des frais ─── */}
            {safeAmount >= minReferral && (
              <FormField control={form.control} name="feeMode" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Comment payer les frais ?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value ?? "from_amount"}
                      onValueChange={field.onChange}
                      className="grid grid-cols-1 gap-2 mt-1"
                    >
                      {/* Option 1 : frais déduits du montant reçu */}
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => field.onChange("from_amount")}
                        onKeyDown={e => e.key === "Enter" && field.onChange("from_amount")}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors select-none",
                          field.value === "from_amount"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <RadioGroupItem value="from_amount" className="mt-0.5 pointer-events-none" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CreditCard size={14} className="text-primary shrink-0" />
                            <span className="text-sm font-medium">Déduire du montant reçu</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Vous demandez <strong>{formatLocal(safeAmount, user)}</strong>,
                            vous recevrez <strong className="text-foreground">{formatLocal(amountReceived, user)}</strong>{" "}
                            (frais <strong>{formatLocal(currentFee, user)}</strong> déduits).
                            Votre solde est débité de <strong>{formatLocal(safeAmount, user)}</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Option 2 : frais prélevés sur le solde */}
                      <div
                        role="button"
                        tabIndex={hasEnoughForFromBalance ? 0 : -1}
                        onClick={() => hasEnoughForFromBalance && field.onChange("from_balance")}
                        onKeyDown={e => e.key === "Enter" && hasEnoughForFromBalance && field.onChange("from_balance")}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-colors select-none",
                          !hasEnoughForFromBalance ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
                          field.value === "from_balance"
                            ? "border-emerald-500 bg-emerald-500/5"
                            : "border-border hover:border-emerald-500/50"
                        )}
                      >
                        <RadioGroupItem
                          value="from_balance"
                          className="mt-0.5 pointer-events-none"
                          disabled={!hasEnoughForFromBalance}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Coins size={14} className="text-emerald-500 shrink-0" />
                            <span className="text-sm font-medium">Prélever sur mon solde</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-semibold">Recommandé</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Vous recevrez le montant plein{" "}
                            <strong className="text-foreground">{formatLocal(safeAmount, user)}</strong>.
                            Votre solde est débité de{" "}
                            <strong>{formatLocal(totalDebit, user)}</strong>{" "}
                            (montant + <strong>{formatLocal(currentFee, user)}</strong> de frais).
                            {!hasEnoughForFromBalance && (
                              <span className="block text-amber-500 mt-0.5">
                                Solde insuffisant — il vous manque{" "}
                                {formatLocal(Math.max(0, totalDebit - referralBalance), user)}.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />
            )}

            {/* Méthode de paiement */}
            <FormField control={form.control} name="payoutMethodId" render={({ field }) => (
              <FormItem>
                <FormLabel>Méthode de paiement</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-withdrawal-method">
                      {loadingMethods ? (
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" /> Chargement...
                        </span>
                      ) : (
                        <SelectValue placeholder="Choisissez une méthode" />
                      )}
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {payoutMethods.length === 0 && !loadingMethods && (
                      <SelectItem value="__none" disabled>Aucune méthode disponible</SelectItem>
                    )}
                    {payoutMethods.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {payoutMethodsData?.fallback && !loadingMethods && (
                  <p className="text-[11px] text-amber-500/90 flex items-center gap-1 mt-1">
                    <AlertCircle size={11} /> Liste de base — vérifiez que la méthode correspond bien à votre opérateur.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {/* Numéro Mobile Money */}
            <FormField control={form.control} name="accountNumber" render={({ field }) => {
              const selectedMethod = payoutMethods.find(m => m.id === watchedPayoutMethodId);
              // Construire un placeholder lisible : remplacer les X par des chiffres exemple
              const rawFormat = selectedMethod?.mobileFormat;
              const examplePlaceholder = rawFormat
                ? rawFormat.replace(/X/gi, (_, i) => String((i % 9) + 1))
                : "6 81 23 45 67";
              return (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Phone size={13} /> Numéro Mobile Money
                  </FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={examplePlaceholder} data-testid="input-withdrawal-account" inputMode="numeric" />
                  </FormControl>
                  <div className="flex items-start gap-1.5 mt-1">
                    <AlertCircle size={11} className="text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-tight">
                      Saisissez votre numéro <strong>sans l'indicatif pays</strong> (sans +237, +225…). L'indicatif est ajouté automatiquement.
                      {rawFormat && <span className="text-muted-foreground"> Format attendu : <strong>{rawFormat}</strong></span>}
                    </p>
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }} />

            {/* Nom du titulaire */}
            <FormField control={form.control} name="accountName" render={({ field }) => (
              <FormItem>
                <FormLabel>Nom du titulaire</FormLabel>
                <FormControl><Input {...field} placeholder="Prénom Nom" data-testid="input-withdrawal-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Numéro WhatsApp */}
            <FormField control={form.control} name="whatsappNumber" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <MessageCircle size={13} className="text-green-500" />
                  Numéro WhatsApp
                  <span className="text-[10px] text-destructive font-semibold ml-1">obligatoire</span>
                </FormLabel>
                <FormControl>
                  <Input {...field} placeholder="+237 6XX XX XX XX" data-testid="input-withdrawal-whatsapp" />
                </FormControl>
                <p className="text-[11px] text-muted-foreground">
                  L'assistance vous contactera sur ce numéro en cas de problème.
                </p>
                <FormMessage />
              </FormItem>
            )} />

            {/* Info frais — dynamique selon le montant saisi */}
            {safeAmount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Zap size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                <div className="text-xs text-foreground space-y-1.5">
                  <p>Virement <strong>automatique en moins de 1 minute</strong> via notre partenaire de paiement.</p>
                  <div className="flex flex-col gap-1 pt-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Frais de traitement</span>
                      <span className="font-semibold text-amber-500">{formatLocal(currentFee, user)}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-emerald-500/20 pt-1">
                      <span className="text-muted-foreground">Vous recevrez</span>
                      <span className="font-bold text-emerald-500">{formatLocal(amountReceived, user)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full font-bold"
              disabled={requestWithdrawal.isPending || loadingMethods}
              data-testid="button-submit-withdrawal"
            >
              {requestWithdrawal.isPending ? (
                <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" />Envoi en cours...</span>
              ) : (
                <span className="flex items-center gap-2"><ChevronRight size={16} />Confirmer la demande</span>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </DialogContent>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function WithdrawalsPage() {
  usePageTitle('Retraits');
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofTargetRef = useRef<number | null>(null);

  const { data: withdrawals, isLoading } = useListWithdrawals({ query: { queryKey: getListWithdrawalsQueryKey() } });
  const { data: balances } = useGetBalances({ query: { queryKey: getGetBalancesQueryKey() } });
  const { data: platformConfig } = useGetPlatformConfig({
    query: { queryKey: getGetPlatformConfigQueryKey() },
  });

  const queryClient = useQueryClient();

  // Invalider le cache des méthodes au montage pour effacer toute donnée corrompue
  // (l'ancien backend renvoyait un objet au lieu d'un tableau → "map is not a function")
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: getGetPayoutMethodsQueryKey() });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch des méthodes dès le chargement de la page — pas seulement à l'ouverture du dialog.
  // staleTime court (60s) : permet de rafraîchir les données si le cache contient
  // d'anciennes données incorrectes, sans pour autant refetch à chaque re-render.
  const { data: payoutMethodsData, isLoading: loadingMethods } = useGetPayoutMethods({
    query: {
      queryKey: getGetPayoutMethodsQueryKey(),
      staleTime: 60_000,
      retry: 2,
    },
  });
  const { toast } = useToast();

  const MIN_REFERRAL = platformConfig?.minimumWithdrawal ?? MIN_REFERRAL_DEFAULT;
  const referralBalance = balances?.referralBalance ?? 0;
  const canWithdraw = referralBalance >= MIN_REFERRAL;

  const triggerProofUpload = (withdrawalId: number) => {
    proofTargetRef.current = withdrawalId;
    fileInputRef.current?.click();
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const wid = proofTargetRef.current;
    proofTargetRef.current = null;
    if (!file || !wid) return;

    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      toast({ title: "Format invalide", description: "Image PNG, JPG ou WEBP uniquement.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PROOF_SIZE) {
      toast({ title: "Fichier trop lourd", description: "Maximum 5 Mo.", variant: "destructive" });
      return;
    }

    setUploadingId(wid);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/api/withdrawals/${wid}/proof`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: "Échec de l'envoi", description: data.error || "Réessayez plus tard.", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
      toast({ title: "Preuve envoyée !", description: "Votre capture d'écran a bien été transmise à l'assistance." });
    } catch {
      toast({ title: "Connexion impossible", description: "Vérifiez votre internet.", variant: "destructive" });
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <PageErrorBoundary>
      <Layout>
        <div className="max-w-5xl mx-auto space-y-6">

          {/* HERO SOLDE */}
          <div className="relative overflow-hidden rounded-3xl shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600" />
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "5s" }} />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Solde parrainage</p>
                    <div
                      className="text-4xl md:text-5xl font-black text-white mt-1 tabular-nums amount-display"
                      data-testid="text-referral-balance"
                    >
                      {formatLocal(referralBalance, user)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                    canWithdraw ? "bg-white/20 text-white" : "bg-white/10 text-white/60"
                  )}>
                    <AlertCircle className="w-3 h-3" />
                    Min. {formatLocal(MIN_REFERRAL, user)} pour retirer
                  </div>
                  {!canWithdraw && (
                    <span className="text-xs text-white/60">
                      — Il manque {formatLocal(Math.max(0, MIN_REFERRAL - referralBalance), user)}
                    </span>
                  )}
                </div>
              </div>
              <Button
                size="lg"
                onClick={() => setDialogOpen(true)}
                disabled={!canWithdraw}
                className="bg-white text-blue-700 hover:bg-white/90 font-bold px-8 rounded-2xl shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                data-testid="button-withdraw-referral"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Demander un retrait
              </Button>
            </div>
          </div>

          {/* BADGE PAIEMENT AUTO */}
          <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Paiement automatique en 1 minute</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Dès que votre demande est envoyée, le virement Mobile Money est déclenché automatiquement via notre partenaire de paiement.
                Frais de traitement à partir de <strong>{formatLocal(550, user)}</strong>. Si rien reçu après 5 minutes, contactez l'assistance.
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
                  <p className="text-xs mt-1">Appuyez sur "Demander un retrait" pour commencer.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {withdrawals.map(w => {
                    const status = STATUS_CONFIG[w.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                    const Icon = status.icon;
                    const wAny = w as typeof w & {
                      proofUrl?: string | null;
                      proofUploadedAt?: string | null;
                      payoutStatus?: string | null;
                    };
                    const hasProof = Boolean(wAny.proofUrl);
                    const isUploading = uploadingId === w.id;
                    const canUploadProof = !hasProof && (w.status === "completed" || w.status === "processing" || w.status === "pending");
                    const payoutSt = wAny.payoutStatus;
                    const requestedAtStr = w.requestedAt ? new Date(w.requestedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <div key={w.id} className="p-4 hover:bg-muted/40 transition-colors" data-testid={`row-withdrawal-${w.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10">
                            <Users className="w-5 h-5 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-foreground">{w.method}</p>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                Parrainage
                              </span>
                              {payoutSt && PAYOUT_STATUS_CONFIG[payoutSt] && (
                                <span className={cn("text-[10px] font-semibold", PAYOUT_STATUS_CONFIG[payoutSt].color)}>
                                  · {PAYOUT_STATUS_CONFIG[payoutSt].label}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{w.accountName} · {w.accountNumber}</p>
                            {requestedAtStr && (
                              <p className="text-[11px] text-muted-foreground/80 mt-0.5">{requestedAtStr}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold text-foreground tabular-nums amount-display">{formatLocal(w.amount, user)}</p>
                            <Badge variant="outline" className={cn("text-xs gap-1 mt-1", status.color)}>
                              <Icon size={10} />{status.label}
                            </Badge>
                          </div>
                        </div>
                        {canUploadProof && (
                          <div className="mt-3 ml-14 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2 text-xs">
                              <ImageIcon size={14} className="text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="font-semibold text-foreground">Avez-vous reçu votre paiement ?</p>
                                <p className="text-muted-foreground mt-0.5">
                                  Envoyez la capture d'écran du SMS de confirmation pour valider.
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={isUploading}
                              onClick={() => triggerProofUpload(w.id)}
                              data-testid={`button-upload-proof-${w.id}`}
                              className="shrink-0 gap-1.5"
                            >
                              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                              {isUploading ? "Envoi..." : "Envoyer preuve"}
                            </Button>
                          </div>
                        )}
                        {hasProof && (
                          <div className="mt-3 ml-14 p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-xs flex items-center gap-2 text-green-700 dark:text-green-400">
                            <ShieldCheck size={14} />
                            <span>Preuve de paiement envoyée{wAny.proofUploadedAt ? ` le ${new Date(wAny.proofUploadedAt).toLocaleDateString("fr-FR")}` : ""}.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleProofFileChange}
          data-testid="input-proof-file"
        />

        {/* MODAL RETRAIT PARRAINAGE — tout le form est dans WithdrawalDialogContent */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <PageErrorBoundary
            fallback={(err) => (
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Demande de retrait</DialogTitle>
                </DialogHeader>
                <div className="p-4 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-destructive mx-auto opacity-60" />
                  <p className="text-sm font-semibold text-foreground">Une erreur est survenue.</p>
                  <p className="text-xs text-muted-foreground">Envoyez une capture de ce message à l'assistance.</p>
                  {err?.message && (
                    <p className="text-xs font-mono bg-muted rounded px-3 py-2 text-left text-muted-foreground max-h-32 overflow-auto break-all">
                      {err.message}
                    </p>
                  )}
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Fermer</Button>
                </div>
              </DialogContent>
            )}
          >
            <WithdrawalDialogContent
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              referralBalance={referralBalance}
              minReferral={MIN_REFERRAL}
              user={user}
              payoutMethodsData={payoutMethodsData}
              loadingMethods={loadingMethods}
            />
          </PageErrorBoundary>
        </Dialog>
      </Layout>
    </PageErrorBoundary>
  );
}
