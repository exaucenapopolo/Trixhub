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
  const [accountName, setAccountName] = useState("");
  const [country, setCountry] = useState("");

  const numericAmount = parseFloat(amount.replace(/\s/g, "")) || 0;
  const valid =
    numericAmount >= MIN_AMOUNT &&
    numericAmount <= balance &&
    method &&
    accountNumber.trim().length > 0 &&
    accountName.trim().length > 0;

  const handleSubmit = async () => {
    if (!valid) return;
    try {
      await submit.mutateAsync({
        data: {
          amount: numericAmount,
          method,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          country: country.trim() || null,
        },
      });
      toast({
        title: "✅ Demande envoyée",
        description: "L'admin va vérifier ta demande. Tu recevras une notification.",
      });
      setAmount("");
      setMethod("");
      setAccountNumber("");
      setAccountName("");
      setCountry("");
      await qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      await qc.invalidateQueries({ queryKey: getListActivityWithdrawalsQueryKey() });
      await refetch();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast({
        title: "Demande refusée",
        description: e.response?.data?.error ?? "Erreur",
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

        {/* Hero solde */}
        <Card className="border-2 border-emerald-500/20 overflow-hidden">
          <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-6">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-widest opacity-90 font-bold">Solde activité</div>
                <div className="text-3xl md:text-4xl font-black mt-1" data-testid="text-activity-balance">
                  {formatLocal(balance, user)}
                </div>
                <div className="text-xs opacity-80 mt-0.5">Issu des points hebdomadaires convertis</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              <h2 className="font-bold text-base">Demande de retrait</h2>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2 text-xs">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Minimum : {formatLocal(MIN_AMOUNT, user)}</strong>. Ta demande sera vérifiée par l'admin
                avant paiement (anti-fraude). Tu seras notifié(e) par WhatsApp.
              </div>
            </div>

            {balance < MIN_AMOUNT && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-start gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  Il te manque <strong>{formatLocal(MIN_AMOUNT - balance, user)}</strong> pour pouvoir retirer.
                  Continue à gagner des points dans les activités !
                </div>
              </div>
            )}

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
                <div className="text-[11px] text-muted-foreground">
                  Min : {formatLocal(MIN_AMOUNT, user)} · Max : {formatLocal(balance, user)}
                </div>
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

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Numéro destinataire</Label>
                <Input
                  id="accountNumber"
                  placeholder="+237 6XX XX XX XX"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  data-testid="input-account-number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountName">Nom du titulaire</Label>
                <Input
                  id="accountName"
                  placeholder="Prénom Nom"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  data-testid="input-account-name"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="country">Pays (optionnel)</Label>
                <Input
                  id="country"
                  placeholder="Cameroun"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  data-testid="input-country"
                />
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-bold"
              onClick={handleSubmit}
              disabled={!valid || submit.isPending}
              data-testid="button-submit"
            >
              {submit.isPending ? "Envoi…" : "Envoyer la demande"}
            </Button>
          </CardContent>
        </Card>

        {/* Historique */}
        <Card>
          <CardContent className="p-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-3">
              Historique de mes demandes
            </h3>
            {!history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune demande pour l'instant.
              </p>
            ) : (
              <div className="space-y-2">
                {history.map((w) => {
                  const badge = statusBadge(w.status);
                  const Icon = badge.Icon;
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-3 border rounded-xl hover:bg-accent/30"
                      data-testid={`withdrawal-${w.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm">{formatLocal(Number(w.amount), user)}</div>
                          <div className="text-xs text-muted-foreground">
                            {METHODS.find((m) => m.value === w.method)?.label ?? w.method} ·{" "}
                            {new Date(w.createdAt).toLocaleDateString("fr-FR")}
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border",
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
