import { useState } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  ArrowLeft,
  Info,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertCircle,
  ShieldAlert,
  MessageCircle,
  User,
  Loader2,
} from "lucide-react";
import {
  useGetDashboard,
  useListActivityWithdrawals,
  useRequestActivityWithdrawal,
  getGetDashboardQueryKey,
  getListActivityWithdrawalsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { formatLocal } from "@/lib/currency";

const MIN_AMOUNT = 3500;

const METHODS = [
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Mobile Money" },
  { value: "wave", label: "Wave" },
  { value: "moov", label: "Moov Money" },
  { value: "free_money", label: "Free Money" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "mpesa", label: "M-Pesa" },
];

function statusBadge(s: string) {
  if (s === "pending")
    return { label: "En attente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30", Icon: Clock };
  if (s === "approved")
    return { label: "Approuvé", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", Icon: CheckCircle2 };
  if (s === "paid")
    return { label: "Payé", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30", Icon: CheckCircle2 };
  return { label: "Rejeté", className: "bg-destructive/15 text-destructive border-destructive/30", Icon: XCircle };
}

export default function ActivityWithdrawalPage() {
  const { data: dashboard } = useGetDashboard();
  const { data: history, refetch } = useListActivityWithdrawals();
  const submit = useRequestActivityWithdrawal();
  const { toast } = useToast();
  const qc = useQueryClient();

  const balance = dashboard?.activityBalance ?? 0;
  const { user } = useAuth();

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("");

  const numericAmount = parseFloat(amount.replace(/\s/g, "")) || 0;
  const valid =
    numericAmount >= MIN_AMOUNT &&
    numericAmount <= balance &&
    method &&
    accountNumber.trim().length >= 7 &&
    whatsappNumber.trim().length >= 7 &&
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2;

  const handleSubmit = async () => {
    if (!valid) return;
    try {
      await submit.mutateAsync({
        data: {
          amount: numericAmount,
          method,
          accountNumber: accountNumber.trim(),
          accountName: `${firstName.trim()} ${lastName.trim()}`,
          whatsappNumber: whatsappNumber.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country: country.trim() || null,
        },
      });
      toast({
        title: "Demande envoyée !",
        description: "L'admin va vérifier ta demande et te contacter sur WhatsApp pour confirmer.",
      });
      setAmount("");
      setMethod("");
      setAccountNumber("");
      setWhatsappNumber("");
      setFirstName("");
      setLastName("");
      setCountry("");
      await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      await qc.invalidateQueries({ queryKey: getListActivityWithdrawalsQueryKey() });
      await refetch();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Demande refusée",
        description: e.response?.data?.error ?? "Une erreur est survenue, réessaie.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-5">
        <Link href="/activities">
          <Button variant="ghost" size="sm" className="gap-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" /> Retour aux activités
          </Button>
        </Link>

        {/* HERO SOLDE ACTIVITÉ */}
        <div className="relative overflow-hidden rounded-3xl shadow-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600" />
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-white/10 blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: "4s" }} />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          <div className="relative p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-xs text-white/70 uppercase tracking-widest font-bold">Solde activité</p>
              <div
                className="text-4xl md:text-5xl font-black text-white mt-1 tabular-nums amount-display"
                data-testid="text-activity-balance"
              >
                {formatLocal(balance, user)}
              </div>
              <p className="text-xs text-white/70 mt-1">Issu des points hebdomadaires convertis · 1 pt = 1 FCFA</p>
            </div>
          </div>
        </div>

        {/* AVERTISSEMENT SOLDE INSUFFISANT */}
        {balance < MIN_AMOUNT && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Solde insuffisant</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Il te manque <strong>{formatLocal(MIN_AMOUNT - balance, user)}</strong> pour atteindre le minimum de {formatLocal(MIN_AMOUNT, user)}.
                Continue à gagner des points dans les activités quotidiennes !
              </p>
            </div>
          </div>
        )}

        {/* FORMULAIRE */}
        <Card className="border-card-border overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Send className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Demande de retrait</h2>
              <p className="text-xs text-muted-foreground">Remplis tous les champs — l'admin t'appellera sur WhatsApp</p>
            </div>
          </div>
          <CardContent className="p-5 space-y-5">

            {/* INFO PROCESS */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Traitement manuel · Délai 24h max</strong><br />
                Ta demande est examinée par notre équipe avant tout paiement (vérification anti-fraude).
                Tu seras contacté(e) sur ton numéro WhatsApp ci-dessous pour confirmer.
                Minimum : <strong className="text-foreground">{formatLocal(MIN_AMOUNT, user)}</strong>
              </div>
            </div>

            {/* SECTION PAIEMENT */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5" /> Informations de paiement
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Montant (FCFA)</Label>
                  <Input
                    id="amount"
                    type="number"
                    inputMode="numeric"
                    min={MIN_AMOUNT}
                    max={balance}
                    placeholder={String(MIN_AMOUNT)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="input-amount"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Min : {formatLocal(MIN_AMOUNT, user)} · Max : {formatLocal(balance, user)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="method">Méthode de paiement</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="method" data-testid="select-method">
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="accountNumber">Numéro Mobile Money (destinataire)</Label>
                  <Input
                    id="accountNumber"
                    placeholder="+237 6XX XX XX XX"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    data-testid="input-account-number"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Numéro où l'argent sera envoyé (Orange, MTN, Wave…)
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION IDENTITÉ */}
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> Identité du bénéficiaire
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    placeholder="Ex : Jean"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    data-testid="input-first-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom de famille</Label>
                  <Input
                    id="lastName"
                    placeholder="Ex : Dupont"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    data-testid="input-last-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber" className="flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-green-500" />
                    Numéro WhatsApp
                  </Label>
                  <Input
                    id="whatsappNumber"
                    placeholder="+237 6XX XX XX XX"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    data-testid="input-whatsapp-number"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    L'admin te contacte sur ce numéro pour valider le paiement
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Pays</Label>
                  <Input
                    id="country"
                    placeholder="Ex : Cameroun"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    data-testid="input-country"
                  />
                </div>
              </div>
            </div>

            {/* AVERTISSEMENT ANTI-FRAUDE */}
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3 flex items-start gap-2.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Vérification anti-fraude</strong><br />
                Notre équipe vérifie la date de ton inscription et tes premières activités avant tout paiement.
                Toute tentative de fraude entraîne la suspension définitive du compte.
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-bold rounded-xl"
              onClick={handleSubmit}
              disabled={!valid || submit.isPending}
              data-testid="button-submit"
            >
              {submit.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Envoi en cours…</span>
              ) : (
                <span className="flex items-center gap-2"><Send className="w-4 h-4" />Envoyer la demande</span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* HISTORIQUE */}
        <Card className="border-card-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="font-bold text-sm text-foreground">Historique de mes demandes</h3>
          </div>
          <CardContent className="p-0">
            {!history || history.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Wallet size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucune demande pour l'instant.</p>
                <p className="text-xs mt-1">Ton historique apparaîtra ici.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.map((w) => {
                  const badge = statusBadge(w.status);
                  const Icon = badge.Icon;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/40 transition-colors"
                      data-testid={`withdrawal-${w.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{formatLocal(Number(w.amount), user)}</p>
                          <p className="text-xs text-muted-foreground">
                            {METHODS.find((m) => m.value === w.method)?.label ?? w.method}
                            {" · "}
                            {new Date(w.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {w.accountNumber && (
                            <p className="text-[11px] text-muted-foreground/70">{w.accountNumber}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shrink-0",
                          badge.className,
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
