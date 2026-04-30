import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { queryClient } from "@/App";
import {
  PiggyBank, Phone, Loader2, ExternalLink, RefreshCw, CheckCircle2,
  ArrowLeft, Wallet, Sparkles, Shield
} from "lucide-react";
import { formatLocal } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { usePageTitle } from '@/hooks/usePageTitle';

const TOKEN_KEY = "trixhub_token";
const DEPOSIT_TX_KEY = "trixhub_deposit_tx";

const QUICK_AMOUNTS = [1000, 3600, 5000, 10000, 25000, 50000];
const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 5_000_000;

type Step = "form" | "waiting" | "success";

export default function DepotPage() {
  usePageTitle('Dépôt');
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [amount, setAmount] = useState<number | "">(3600);
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<Step>("form");
  const [txId, setTxId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Reprise d'une transaction interrompue
  useEffect(() => {
    const saved = sessionStorage.getItem(DEPOSIT_TX_KEY);
    if (saved) {
      try {
        const obj = JSON.parse(saved) as { txId: string; checkoutUrl: string };
        setTxId(obj.txId);
        setCheckoutUrl(obj.checkoutUrl);
        setStep("waiting");
      } catch {/* noop */}
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const checkStatus = useCallback(async (id: string): Promise<"success" | "failed" | "pending"> => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch(`/api/swychr/status/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      return data.status || "pending";
    } catch {
      return "pending";
    }
  }, []);

  // Applique la transition d'état d'après un statut (utilisé par polling + bouton manuel)
  const applyStatus = useCallback((status: "success" | "failed" | "pending") => {
    if (status === "success") {
      stopPolling();
      sessionStorage.removeItem(DEPOSIT_TX_KEY);
      queryClient.invalidateQueries();
      setStep("success");
    } else if (status === "failed") {
      stopPolling();
      sessionStorage.removeItem(DEPOSIT_TX_KEY);
      toast({ title: "Paiement échoué", description: "La transaction n'a pas abouti.", variant: "destructive" });
      setStep("form");
      setTxId(null);
    }
  }, [stopPolling, toast]);

  // Polling sur le statut de la transaction
  useEffect(() => {
    if (step !== "waiting" || !txId) return;
    stopPolling();

    const tick = async () => {
      const status = await checkStatus(txId);
      applyStatus(status);
    };
    tick();
    pollRef.current = window.setInterval(tick, 5000);
    return stopPolling;
  }, [step, txId, checkStatus, applyStatus, stopPolling]);

  const submit = async () => {
    const a = Number(amount);
    if (!Number.isFinite(a) || a < MIN_DEPOSIT) {
      toast({ title: "Montant invalide", description: `Minimum ${MIN_DEPOSIT} FCFA`, variant: "destructive" });
      return;
    }
    if (a > MAX_DEPOSIT) {
      toast({ title: "Montant trop élevé", description: `Maximum ${MAX_DEPOSIT.toLocaleString("fr-FR")} FCFA`, variant: "destructive" });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Numéro invalide", description: "Saisissez un numéro de téléphone correct", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch("/api/swychr/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: "deposit", amount: a, phoneNumber: cleanPhone }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        toast({ title: "Erreur", description: data.error || "Impossible de créer le paiement", variant: "destructive" });
        return;
      }
      sessionStorage.setItem(DEPOSIT_TX_KEY, JSON.stringify({ txId: data.transactionId, checkoutUrl: data.checkoutUrl }));
      setTxId(data.transactionId);
      setCheckoutUrl(data.checkoutUrl);
      setStep("waiting");
      // Ouvre la page de paiement
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast({ title: "Erreur réseau", description: "Réessayez dans un instant", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => {
    stopPolling();
    sessionStorage.removeItem(DEPOSIT_TX_KEY);
    setTxId(null);
    setCheckoutUrl(null);
    setStep("form");
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>

        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 shadow-xl">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl pointer-events-none animate-pulse" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <PiggyBank className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">Recharger mon solde dépôt</h1>
              <p className="text-sm opacity-90 mt-1">Dépose de l'argent pour activer tes filleuls et plus</p>
            </div>
          </div>
        </div>

        {step === "form" && (
          <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5">
            {/* Montant */}
            <div>
              <label className="text-sm font-bold text-foreground mb-2 block">Montant à déposer</label>
              <div className="relative">
                <input
                  type="number"
                  min={MIN_DEPOSIT}
                  max={MAX_DEPOSIT}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full text-2xl font-bold tabular-nums px-4 py-3 pr-20 border-2 border-border rounded-xl focus:border-emerald-500 focus:outline-none bg-background"
                  placeholder="3600"
                  data-testid="input-deposit-amount"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">FCFA</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Min. {formatLocal(MIN_DEPOSIT, user)} · Max. {formatLocal(MAX_DEPOSIT, user)}
              </p>

              {/* Montants rapides */}
              <div className="flex flex-wrap gap-2 mt-3">
                {QUICK_AMOUNTS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(a)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                      amount === a
                        ? "bg-emerald-500 text-white border-emerald-500 scale-105"
                        : "bg-muted text-foreground border-border hover:bg-muted/70"
                    )}
                  >
                    {formatLocal(a, user)}
                  </button>
                ))}
              </div>
            </div>

            {/* Téléphone */}
            <div>
              <label className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Phone className="w-4 h-4" /> Numéro mobile money
              </label>
              {!editingPhone ? (
                <div className="flex items-center gap-2 p-3 border border-border rounded-xl bg-muted/30">
                  <span className="flex-1 font-mono text-sm text-foreground">{phone || "Aucun numéro"}</span>
                  <button onClick={() => setEditingPhone(true)} className="text-xs text-emerald-600 font-semibold hover:underline">
                    Modifier
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="flex-1 px-3 py-2.5 border border-border rounded-xl bg-background"
                    placeholder="Ex: 691234567"
                    data-testid="input-deposit-phone"
                  />
                  <button onClick={() => setEditingPhone(false)} className="px-3 py-2.5 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 rounded-xl">
                    OK
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Le code de paiement sera envoyé à ce numéro</p>
            </div>

            {/* Sécurité */}
            <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <Shield className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Paiement sécurisé via notre partenaire de paiement automatique. Disponible dans 18 pays africains.
              </p>
            </div>

            {/* Bouton */}
            <button
              onClick={submit}
              disabled={submitting || !amount}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-500 text-white font-bold text-base hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              data-testid="button-deposit-submit"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Création du paiement...</>
              ) : (
                <><PiggyBank className="w-5 h-5" /> Déposer {amount ? formatLocal(Number(amount), user) : ""}</>
              )}
            </button>
          </div>
        )}

        {step === "waiting" && (
          <div className="bg-card border-2 border-amber-500/30 rounded-2xl p-6 shadow-sm space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">En attente du paiement</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Complète le paiement dans la nouvelle fenêtre. Ton solde sera mis à jour automatiquement.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              {checkoutUrl && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Rouvrir la page de paiement
                </a>
              )}
              <button
                onClick={async () => {
                  if (!txId) return;
                  const status = await checkStatus(txId);
                  if (status === "pending") {
                    toast({ title: "Toujours en attente", description: "Le paiement n'est pas encore confirmé." });
                  } else {
                    applyStatus(status);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/70 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Vérifier maintenant
              </button>
              <button
                onClick={cancel}
                className="text-xs text-muted-foreground hover:text-foreground underline mt-1"
              >
                Annuler ce paiement
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="bg-card border-2 border-emerald-500/40 rounded-2xl p-6 shadow-sm space-y-4 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Dépôt réussi !</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ton solde dépôt a été crédité. Tu peux maintenant activer un filleul ou retirer.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                href="/dashboard"
                onClick={() => { setStep("form"); setTxId(null); }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors"
              >
                <Wallet className="w-4 h-4" /> Voir mon solde
              </Link>
              <button
                onClick={() => { setStep("form"); setTxId(null); setAmount(3600); }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/70 transition-colors"
              >
                <Sparkles className="w-4 h-4" /> Faire un autre dépôt
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
