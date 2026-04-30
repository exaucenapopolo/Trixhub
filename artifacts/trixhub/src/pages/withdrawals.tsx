import {
  useListWithdrawals, useRequestWithdrawal, useGetBalances,
  useGetPayoutMethods, useGetPlatformConfig,
  getListWithdrawalsQueryKey, getGetBalancesQueryKey,
  getGetPayoutMethodsQueryKey, getGetPlatformConfigQueryKey,
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
import {
  Wallet, ArrowUpRight, Clock, CheckCircle, XCircle, AlertCircle,
  Users, ChevronRight, Upload, ImageIcon, Loader2, ShieldCheck, Zap,
  Star, Phone, MessageCircle,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const MAX_PROOF_SIZE = 5 * 1024 * 1024;

// Clé localStorage pour sauvegarder les numéros favoris
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
  // Dédupliquer par accountNumber
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
  pending: { label: "AccountPE : en attente", color: "text-amber-500" },
  success: { label: "AccountPE : envoyé ✓", color: "text-green-500" },
  failed: { label: "AccountPE : échec", color: "text-red-500" },
};

const MIN_REFERRAL_DEFAULT = 3100;
const PAYOUT_FEE_DEFAULT = 550;

export default function WithdrawalsPage() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proofTargetRef = useRef<number | null>(null);
  const [savedNumbers, setSavedNumbers] = useState<SavedNumber[]>([]);

  const { data: withdrawals, isLoading } = useListWithdrawals({ query: { queryKey: getListWithdrawalsQueryKey() } });
  const { data: balances } = useGetBalances({ query: { queryKey: getGetBalancesQueryKey() } });
  const { data: platformConfig } = useGetPlatformConfig({
    query: { queryKey: getGetPlatformConfigQueryKey() },
  });
  const { data: payoutMethodsData, isLoading: loadingMethods } = useGetPayoutMethods({
    query: { queryKey: getGetPayoutMethodsQueryKey(), enabled: dialogOpen },
  });
  const requestWithdrawal = useRequestWithdrawal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const MIN_REFERRAL = platformConfig?.minimumWithdrawal ?? MIN_REFERRAL_DEFAULT;
  const PAYOUT_FEE = platformConfig?.payoutFee ?? PAYOUT_FEE_DEFAULT;
  const payoutMethods = payoutMethodsData?.methods ?? [];

  const schema = z.object({
    amount: z.number({ coerce: true }).min(MIN_REFERRAL, `Minimum ${MIN_REFERRAL.toLocaleString("fr-FR")} FCFA`),
    payoutMethodId: z.string().min(1, "Choisissez une méthode"),
    accountNumber: z.string().min(8, "Numéro Mobile Money requis (min. 8 chiffres)"),
    accountName: z.string().min(3, "Nom du titulaire requis"),
    whatsappNumber: z.string().min(8, "Numéro WhatsApp obligatoire"),
  });

  type FormValues = z.infer<typeof schema>;

  const referralBalance = balances?.referralBalance ?? 0;
  const canWithdraw = referralBalance >= MIN_REFERRAL;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: MIN_REFERRAL,
      payoutMethodId: "",
      accountNumber: user?.phone ?? "",
      accountName: user?.displayName ?? "",
      whatsappNumber: user?.phone ?? "",
    },
  });

  // Recharger les favoris quand le dialog s'ouvre
  useEffect(() => {
    if (dialogOpen) {
      setSavedNumbers(loadSavedNumbers());
    }
  }, [dialogOpen]);

  // Pré-remplir les méthodes si une seule disponible
  useEffect(() => {
    if (payoutMethods.length === 1 && !form.getValues("payoutMethodId")) {
      form.setValue("payoutMethodId", payoutMethods[0].id);
    }
  }, [payoutMethods]);

  const openDialog = () => {
    form.reset({
      amount: MIN_REFERRAL,
      payoutMethodId: "",
      accountNumber: user?.phone ?? "",
      accountName: user?.displayName ?? "",
      whatsappNumber: user?.phone ?? "",
    });
    setDialogOpen(true);
  };

  const applyFavorite = (fav: SavedNumber) => {
    form.setValue("accountNumber", fav.accountNumber);
    form.setValue("accountName", fav.accountName);
    form.setValue("whatsappNumber", fav.whatsappNumber);
    if (fav.payoutMethodId) form.setValue("payoutMethodId", fav.payoutMethodId);
  };

  const onSubmit = async (values: FormValues) => {
    if (values.amount > referralBalance) {
      toast({
        title: "Solde insuffisant",
        description: `Votre solde parrainage est de ${formatLocal(referralBalance, user)}. Vous avez demandé ${formatLocal(values.amount, user)}.`,
        variant: "destructive",
      });
      return;
    }

    const selectedMethod = payoutMethods.find(m => m.id === values.payoutMethodId);

    try {
      await requestWithdrawal.mutateAsync({
        data: {
          amount: values.amount,
          method: values.payoutMethodId,
          accountNumber: values.accountNumber,
          accountName: values.accountName,
          source: "referral",
          whatsappNumber: values.whatsappNumber,
          payoutMethod: values.payoutMethodId,
        },
      });

      // Sauvegarder comme numéro favori
      saveFavoriteNumber({
        accountNumber: values.accountNumber,
        accountName: values.accountName,
        whatsappNumber: values.whatsappNumber,
        payoutMethodId: values.payoutMethodId,
        payoutMethodName: selectedMethod?.name ?? values.payoutMethodId,
      });

      queryClient.invalidateQueries({ queryKey: getListWithdrawalsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetBalancesQueryKey() });
      toast({
        title: "Retrait en cours !",
        description: `Votre virement de ${formatLocal(values.amount - PAYOUT_FEE, user)} (après 550 FCFA de frais) a été lancé automatiquement.`,
      });
      form.reset();
      setDialogOpen(false);
    } catch (err: unknown) {
      const errData = (err as { data?: { error?: string; available?: number } })?.data;
      if (errData?.available !== undefined) {
        toast({
          title: "Solde insuffisant",
          description: `Votre solde est de ${formatLocal(errData.available, user)}.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Erreur", description: errData?.error || "Erreur lors de la demande", variant: "destructive" });
      }
    }
  };

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

  const watchedAmount = form.watch("amount");
  const amountAfterFee = Math.max(0, (watchedAmount || 0) - PAYOUT_FEE);

  return (
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
              onClick={openDialog}
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
              Dès que votre demande est envoyée, le virement Mobile Money est déclenché automatiquement via AccountPe.
              Frais de traitement : <strong>550 FCFA</strong>. Si rien reçu après 5 minutes, contactez l'assistance.
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
                  return (
                    <div key={w.id} className="p-4 hover:bg-muted/40 transition-colors" data-testid={`row-withdrawal-${w.id}`}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">
                              {w.method}
                            </p>
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

      {/* MODAL RETRAIT PARRAINAGE */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <p className="text-base font-bold tabular-nums amount-display mt-1">{formatLocal(MIN_REFERRAL, user)}</p>
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
                    <FormLabel>Montant à retirer (FCFA)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                        placeholder={String(MIN_REFERRAL)}
                        data-testid="input-withdrawal-amount"
                      />
                    </FormControl>
                    {watchedAmount >= MIN_REFERRAL && (
                      <p className="text-[11px] text-muted-foreground">
                        Vous recevrez <strong className="text-foreground">{formatLocal(amountAfterFee, user)}</strong> (après 550 FCFA de frais AccountPe)
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Méthode de paiement (dynamique depuis AccountPE) */}
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
                    <FormMessage />
                  </FormItem>
                )} />

                {/* Numéro Mobile Money */}
                <FormField control={form.control} name="accountNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <Phone size={13} /> Numéro Mobile Money
                    </FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+237 6XX XX XX XX" data-testid="input-withdrawal-account" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

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

                {/* Info frais */}
                <div className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <Zap size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground">
                    Virement <strong>automatique en moins de 1 minute</strong> via AccountPe.
                    Frais : 550 FCFA déduits du montant envoyé.
                  </p>
                </div>

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
      </Dialog>
    </Layout>
  );
}
