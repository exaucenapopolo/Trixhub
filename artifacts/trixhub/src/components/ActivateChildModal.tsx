import { useState, useEffect, useCallback, useRef } from "react";
import { useActivateChild, useGetBalances } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/App";
import {
  X, PiggyBank, Users, ExternalLink, Loader2, CheckCircle2,
  Zap, AlertTriangle, Phone, ChevronRight
} from "lucide-react";
import { formatLocal } from "@/lib/currency";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";

const ACTIVATION_AMOUNT = 3600;
const REFERRAL_FEE = 500;

type Method = "deposit" | "referral" | "swychr";

type Props = {
  open: boolean;
  onClose: () => void;
  child: { id: number; displayName: string; country: string };
};

export default function ActivateChildModal({ open, onClose, child }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<Method>("deposit");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);

  // Step Swychr
  const [swychrStep, setSwychrStep] = useState<"form" | "waiting" | "success" | null>(null);
  const [swychrTxId, setSwychrTxId] = useState<string | null>(null);
  const [swychrUrl, setSwychrUrl] = useState<string | null>(null);
  const [swychrSubmitting, setSwychrSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const { data: balances } = useGetBalances();
  const activateMutation = useActivateChild();

  const depositBal = balances?.depositBalance ?? 0;
  const referralBal = balances?.referralBalance ?? 0;

  const referralCost = ACTIVATION_AMOUNT + REFERRAL_FEE; // 4100

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Reset à l'ouverture
  useEffect(() => {
    if (open) {
      setMethod("deposit");
      setSwychrStep(null);
      setSwychrTxId(null);
      setSwychrUrl(null);
      setEditingPhone(false);
      setPhone(user?.phone ?? "");
    } else {
      stopPolling();
    }
  }, [open, user?.phone, stopPolling]);

  // Polling Swychr
  useEffect(() => {
    if (swychrStep !== "waiting" || !swychrTxId) return;
    stopPolling();

    const tick = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const r = await fetch(`/api/swychr/status/${swychrTxId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json();
        if (data.status === "success") {
          stopPolling();
          queryClient.invalidateQueries();
          setSwychrStep("success");
        } else if (data.status === "failed") {
          stopPolling();
          toast({ title: "Paiement échoué", variant: "destructive" });
          setSwychrStep("form");
          setSwychrTxId(null);
        }
      } catch {/* noop */}
    };
    tick();
    pollRef.current = window.setInterval(tick, 5000);
    return stopPolling;
  }, [swychrStep, swychrTxId, stopPolling, toast]);

  if (!open) return null;

  // ─── Méthode interne (deposit / referral) ───
  const submitInternal = async () => {
    if (method !== "deposit" && method !== "referral") return;
    try {
      const r = await activateMutation.mutateAsync({
        childId: child.id,
        data: { source: method },
      });
      toast({ title: "Filleul activé !", description: r.message });
      queryClient.invalidateQueries();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Erreur lors de l'activation";
      toast({ title: "Échec", description: msg, variant: "destructive" });
    }
  };

  // ─── Méthode Swychr (paiement direct) ───
  const submitSwychr = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 8) {
      toast({ title: "Numéro invalide", variant: "destructive" });
      return;
    }
    setSwychrSubmitting(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const r = await fetch("/api/swychr/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: "child_activation", childId: child.id, phoneNumber: cleanPhone }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) {
        toast({ title: "Erreur", description: data.error || "Création paiement impossible", variant: "destructive" });
        return;
      }
      setSwychrTxId(data.transactionId);
      setSwychrUrl(data.checkoutUrl);
      setSwychrStep("waiting");
      window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast({ title: "Erreur réseau", variant: "destructive" });
    } finally {
      setSwychrSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div
        className="bg-card border border-card-border rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-5 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-foreground">Activer ce filleul</h3>
              <p className="text-sm text-muted-foreground truncate">
                {child.displayName} · {child.country}
              </p>
            </div>
          </div>
        </div>

        {/* Step Swychr workflow ou choix méthode */}
        {swychrStep === "waiting" ? (
          <div className="p-6 text-center space-y-4">
            <Loader2 className="w-12 h-12 mx-auto text-amber-500 animate-spin" />
            <div>
              <h4 className="text-lg font-bold">En attente du paiement</h4>
              <p className="text-sm text-muted-foreground mt-1">Complète le paiement dans la nouvelle fenêtre.</p>
            </div>
            {swychrUrl && (
              <a
                href={swychrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold w-full"
              >
                <ExternalLink className="w-4 h-4" /> Rouvrir la page de paiement
              </a>
            )}
            <button
              onClick={() => { stopPolling(); setSwychrStep("form"); setSwychrTxId(null); }}
              className="text-xs text-muted-foreground hover:underline"
            >
              Annuler
            </button>
          </div>
        ) : swychrStep === "success" ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/15 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h4 className="text-xl font-bold">Filleul activé !</h4>
              <p className="text-sm text-muted-foreground mt-1">
                {child.displayName} a été activé. Tu vas recevoir tes commissions.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
            >
              Fermer
            </button>
          </div>
        ) : swychrStep === "form" ? (
          <div className="p-5 space-y-4">
            <button onClick={() => setSwychrStep(null)} className="text-xs text-muted-foreground hover:text-foreground">
              ← Retour aux méthodes
            </button>
            <div>
              <label className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                <Phone className="w-4 h-4" /> Numéro mobile money
              </label>
              {!editingPhone ? (
                <div className="flex items-center gap-2 p-3 border border-border rounded-xl bg-muted/30">
                  <span className="flex-1 font-mono text-sm">{phone}</span>
                  <button onClick={() => setEditingPhone(true)} className="text-xs text-primary font-semibold hover:underline">
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
                  />
                  <button onClick={() => setEditingPhone(false)} className="px-3 py-2.5 text-sm font-semibold text-primary">
                    OK
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Tu paieras {formatLocal(ACTIVATION_AMOUNT, user)} pour activer ce filleul</p>
            </div>
            <button
              onClick={submitSwychr}
              disabled={swychrSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50"
            >
              {swychrSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              Payer {formatLocal(ACTIVATION_AMOUNT, user)}
            </button>
          </div>
        ) : (
          // ─── Choix de la méthode ───
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisis comment payer les <strong className="text-foreground">{formatLocal(ACTIVATION_AMOUNT, user)}</strong> d'activation pour ce filleul.
            </p>

            {/* Méthode 1: Solde dépôt */}
            <MethodCard
              selected={method === "deposit"}
              onSelect={() => setMethod("deposit")}
              Icon={PiggyBank}
              hue="emerald"
              title="Solde dépôt"
              cost={ACTIVATION_AMOUNT}
              available={depositBal}
              detail="Aucun frais — paiement direct depuis ton solde dépôt"
              currency={user}
            />

            {/* Méthode 2: Solde parrainage (avec frais) */}
            <MethodCard
              selected={method === "referral"}
              onSelect={() => setMethod("referral")}
              Icon={Users}
              hue="blue"
              title="Solde parrainage"
              cost={referralCost}
              available={referralBal}
              detail={`${formatLocal(ACTIVATION_AMOUNT, user)} + ${formatLocal(REFERRAL_FEE, user)} de frais`}
              currency={user}
            />

            {/* Méthode 3: Paiement direct Swychr */}
            <MethodCard
              selected={method === "swychr"}
              onSelect={() => setMethod("swychr")}
              Icon={ExternalLink}
              hue="primary"
              title="Paiement mobile money"
              cost={ACTIVATION_AMOUNT}
              available={null}
              detail="Aucun frais — paie directement via Orange/MTN/Wave/M-Pesa"
              currency={user}
            />

            {/* Bouton de confirmation */}
            <div className="pt-2 space-y-2">
              {method === "deposit" && depositBal < ACTIVATION_AMOUNT && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">
                    Solde dépôt insuffisant. <a href="/depot" className="font-bold underline">Recharger →</a>
                  </p>
                </div>
              )}
              {method === "referral" && referralBal < referralCost && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground">
                    Solde parrainage insuffisant. Il te manque {formatLocal(referralCost - referralBal, user)}.
                  </p>
                </div>
              )}

              <button
                onClick={() => method === "swychr" ? setSwychrStep("form") : submitInternal()}
                disabled={
                  activateMutation.isPending ||
                  (method === "deposit" && depositBal < ACTIVATION_AMOUNT) ||
                  (method === "referral" && referralBal < referralCost)
                }
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                data-testid="button-confirm-activate-child"
              >
                {activateMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                {method === "swychr"
                  ? `Continuer vers le paiement`
                  : `Activer pour ${formatLocal(method === "deposit" ? ACTIVATION_AMOUNT : referralCost, user)}`
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MethodCard({ selected, onSelect, Icon, hue, title, cost, available, detail, currency }: {
  selected: boolean;
  onSelect: () => void;
  Icon: any;
  hue: "emerald" | "blue" | "primary";
  title: string;
  cost: number;
  available: number | null;
  detail: string;
  currency: any;
}) {
  const hueMap = {
    emerald: { ring: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
    blue:    { ring: "border-blue-500",    bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400" },
    primary: { ring: "border-primary",     bg: "bg-primary/10",     text: "text-primary" },
  };
  const c = hueMap[hue];
  const insufficient = available !== null && available < cost;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-xl border-2 transition-all",
        selected ? cn(c.ring, "shadow-md scale-[1.01]") : "border-border hover:border-foreground/20"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", c.bg)}>
          <Icon className={cn("w-5 h-5", c.text)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-foreground text-sm">{title}</p>
            <p className={cn("font-extrabold tabular-nums", c.text)}>{formatLocal(cost, currency)}</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>
          {available !== null && (
            <p className={cn("text-[11px] mt-1 font-semibold", insufficient ? "text-amber-600" : c.text)}>
              Disponible : {formatLocal(available, currency)}
            </p>
          )}
        </div>
        <ChevronRight className={cn("w-4 h-4 flex-shrink-0", selected ? c.text : "text-muted-foreground/40")} />
      </div>
    </button>
  );
}
