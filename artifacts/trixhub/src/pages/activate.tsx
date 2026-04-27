import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2, ChevronRight, Zap, TrendingUp,
  Globe, X, Star, Loader2, Clock, ExternalLink, RefreshCw
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const TOKEN_KEY = "trixhub_token";
const PAYMENT_TX_KEY = "trixhub_payment_tx";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

const AFRICAN_COUNTRIES = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯", method: "MTN / Moov Money" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", method: "Orange Money / Moov" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲", method: "MTN / Orange Money" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", method: "Orange / MTN / Wave" },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", method: "MTN / Airtel" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩", method: "Airtel / Vodacom" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", method: "Airtel / Moov" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", method: "MTN / Vodafone" },
  { code: "GN", name: "Guinée", flag: "🇬🇳", method: "Orange / MTN" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", method: "M-Pesa" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", method: "MVola / Airtel" },
  { code: "ML", name: "Mali", flag: "🇲🇱", method: "Orange / Moov" },
  { code: "NE", name: "Niger", flag: "🇳🇪", method: "Airtel / Moov" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", method: "MTN / Airtel / Glo" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", method: "MTN / Airtel" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", method: "Orange / Wave / Free" },
  { code: "TG", name: "Togo", flag: "🇹🇬", method: "Moov / Togocel" },
  { code: "TZ", name: "Tanzanie", flag: "🇹🇿", method: "M-Pesa / Airtel" },
];

const BENEFITS_WITH = [
  { icon: "💰", title: "Commissions immédiates", desc: "1 700 FCFA par filleul direct qui active son compte" },
  { icon: "🔗", title: "Lien de parrainage unique", desc: "Partage et génère des revenus automatiquement" },
  { icon: "📊", title: "Tableau de bord complet", desc: "Suivi en temps réel de tes gains et ton équipe" },
  { icon: "🌍", title: "Réseau africain", desc: "Connecte-toi à des membres dans 18 pays" },
  { icon: "📱", title: "Missions rémunérées", desc: "Gagne en regardant des vidéos, lisant du contenu..." },
  { icon: "💳", title: "Retrait flexible", desc: "Via Orange Money, Wave, MTN et plus encore" },
];

const BENEFITS_WITHOUT = [
  "Pas de commissions de parrainage",
  "Impossible d'accéder au tableau de bord",
  "Pas de missions disponibles",
  "Pas de retrait d'argent",
  "Lien de parrainage inactif",
];

const ILLUSTRATIONS = [
  { emoji: "💸", title: "Gagne de l'argent réel", desc: "Chaque filleul actif te rapporte jusqu'à 1 700 FCFA directement sur ton solde", color: "from-green-500/20 to-emerald-600/20", accent: "text-green-500" },
  { emoji: "👥", title: "Construis ton équipe", desc: "3 niveaux de commissions : tes filleuls, leurs filleuls, et encore leurs filleuls", color: "from-blue-500/20 to-blue-700/20", accent: "text-blue-500" },
  { emoji: "📱", title: "Missions sur mobile", desc: "Visionne des vidéos, partage du contenu et gagne des bonus supplémentaires", color: "from-purple-500/20 to-purple-700/20", accent: "text-purple-500" },
  { emoji: "🌍", title: "18 pays africains", desc: "Orange Money, Wave, M-Pesa, MTN... Paiement partout en Afrique", color: "from-orange-500/20 to-amber-600/20", accent: "text-orange-500" },
];

type Step = "info" | "pay" | "waiting" | "success" | "failed";

export default function ActivatePage() {
  const [, navigate] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("info");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [txId, setTxId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already activated
  useEffect(() => {
    if (user?.isActivated) navigate("/dashboard");
  }, [user]);

  // Auto-slide
  useEffect(() => {
    const iv = setInterval(() => setCurrentSlide(s => (s + 1) % ILLUSTRATIONS.length), 3500);
    return () => clearInterval(iv);
  }, []);

  // On mount: check URL params or localStorage for a pending payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pendingTx =
      params.get("tx_id") ||
      params.get("transaction_id") ||
      params.get("payment_id") ||
      localStorage.getItem(PAYMENT_TX_KEY);

    if (pendingTx) {
      setTxId(pendingTx);
      setStep("waiting");
    }
  }, []);

  // Start/stop polling when step changes
  useEffect(() => {
    if (step === "waiting" && txId) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [step, txId]);

  function startPolling() {
    stopPolling();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    pollRef.current = setInterval(doPoll, 5000);
    // Also check immediately on start (after short delay)
    setTimeout(doPoll, 1500);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const doPoll = useCallback(async () => {
    const currentTxId = txId || localStorage.getItem(PAYMENT_TX_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!currentTxId || !token) return;

    try {
      const res = await fetch(`${BASE}/api/swychr/status/${encodeURIComponent(currentTxId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; status: string; isPaid: boolean };

      if (data.isPaid || data.status === "success") {
        stopPolling();
        localStorage.removeItem(PAYMENT_TX_KEY);
        await refreshUser();
        setStep("success");
        return;
      }
      if (data.status === "failed") {
        stopPolling();
        localStorage.removeItem(PAYMENT_TX_KEY);
        setStep("failed");
      }
    } catch {
      // Silent — will retry on next interval
    }
  }, [txId, refreshUser]);

  // Keep doPoll up-to-date when txId changes
  useEffect(() => {
    if (step !== "waiting") return;
    // Restart poll interval with fresh reference
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(doPoll, 5000);
    }
  }, [doPoll]);

  const handlePay = async () => {
    setIsLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${BASE}/api/swychr/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json() as {
        success: boolean;
        transactionId?: string;
        checkoutUrl?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        toast({
          title: "Erreur de paiement",
          description: data.error || "Impossible d'initier le paiement. Réessayez.",
          variant: "destructive",
        });
        return;
      }

      if (!data.checkoutUrl || !data.transactionId) {
        toast({
          title: "Erreur",
          description: "Réponse AccountPE invalide. Contactez le support.",
          variant: "destructive",
        });
        return;
      }

      // Sauvegarder l'ID transaction pour retrouver le statut au retour
      localStorage.setItem(PAYMENT_TX_KEY, data.transactionId);
      setTxId(data.transactionId);
      setCheckoutUrl(data.checkoutUrl);

      // Rediriger vers la page de checkout AccountPE
      window.location.href = data.checkoutUrl;
    } catch {
      toast({ title: "Erreur réseau", description: "Réessayez dans un instant.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const stepIndex = { info: 0, pay: 1, waiting: 2, success: 3, failed: 2 };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">TRIXHUB</span>
          </div>
          <div className="flex items-center gap-2">
            {(["Infos", "Paiement", "Vérification"] as const).map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <div className={`flex items-center gap-1.5`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    stepIndex[step] >= i
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>{i + 1}</div>
                  <span className="hidden sm:block text-xs text-muted-foreground">{label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* ÉTAPE 1 : Présentation */}
        {step === "info" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Active ton compte TRIXHUB</h1>
                <p className="text-muted-foreground mt-2">Une seule activation pour débloquer tout le potentiel de la plateforme</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl">
                {ILLUSTRATIONS.map((ill, i) => (
                  <div key={i} className={`bg-gradient-to-br ${ill.color} border border-border rounded-2xl p-8 transition-all duration-500 ${i === currentSlide ? "block" : "hidden"}`}>
                    <div className="text-5xl mb-4">{ill.emoji}</div>
                    <h3 className={`text-xl font-bold ${ill.accent} mb-2`}>{ill.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{ill.desc}</p>
                  </div>
                ))}
                <div className="flex justify-center gap-2 mt-3">
                  {ILLUSTRATIONS.map((_, i) => (
                    <button key={i} onClick={() => setCurrentSlide(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? "bg-primary w-6" : "bg-border"}`} />
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" /> Avec activation
                  </h4>
                  <ul className="space-y-2">
                    {BENEFITS_WITH.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-base leading-none">{b.icon}</span>
                        <span><strong className="text-foreground">{b.title}</strong><br />{b.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
                  <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-1.5">
                    <X className="w-4 h-4 text-destructive" /> Sans activation
                  </h4>
                  <ul className="space-y-2.5">
                    {BENEFITS_WITHOUT.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <X className="w-3 h-3 text-destructive flex-shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-card border-2 border-primary rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Unique
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">Frais d'activation unique</p>
                <div className="flex items-baseline gap-2 my-3">
                  <span className="text-4xl font-bold text-foreground font-mono">3 600</span>
                  <span className="text-xl font-semibold text-muted-foreground">FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Paiement unique — accès permanent à toutes les fonctionnalités</p>
                <div className="flex items-center gap-2 p-3 bg-primary/8 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-xs text-foreground">Récupère tes 3 600 FCFA avec seulement <strong>2 filleuls actifs</strong> (2 × 1 700 = 3 400 FCFA)</p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-4">
                <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" /> Pays de paiement acceptés
                </h4>
                <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
                  {AFRICAN_COUNTRIES.map(c => (
                    <div key={c.code} className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <span className="text-base">{c.flag}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.method}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setStep("pay")}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/25"
              >
                Activer mon compte maintenant
                <ChevronRight className="w-5 h-5" />
              </button>
              <p className="text-center text-xs text-muted-foreground">
                Paiement sécurisé via AccountPE · Mobile Money · Toute l'Afrique
              </p>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Payer via AccountPE */}
        {step === "pay" && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep("info")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              ← Retour
            </button>

            <h2 className="text-2xl font-bold text-foreground mb-1">Paiement sécurisé</h2>
            <p className="text-muted-foreground text-sm mb-6">Tu vas être redirigé vers la page de paiement AccountPE</p>

            {/* Résumé de la commande */}
            <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Activation compte TRIXHUB</p>
                  <p className="text-3xl font-bold text-foreground font-mono mt-1">3 600 FCFA</p>
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Activation compte</span>
                  <span className="font-medium text-foreground">3 600 FCFA</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Accès parrainage</span>
                  <span className="text-green-500 font-medium">Inclus</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dashboard & missions</span>
                  <span className="text-green-500 font-medium">Inclus</span>
                </div>
              </div>
            </div>

            {/* Comment ça marche */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-2">Comment ça fonctionne</h4>
              <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1.5 list-decimal list-inside">
                <li>Clique sur le bouton ci-dessous</li>
                <li>Tu es redirigé vers la <strong>page de paiement sécurisée AccountPE</strong></li>
                <li>Choisis ton opérateur (MTN, Orange, Wave, etc.) et confirme le paiement</li>
                <li>Après paiement, reviens sur TRIXHUB — ton compte est <strong>activé automatiquement</strong></li>
              </ol>
            </div>

            <button
              onClick={handlePay}
              disabled={isLoading}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/25"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Connexion à AccountPE...</>
              ) : (
                <><ExternalLink className="w-5 h-5" /> Payer 3 600 FCFA via AccountPE</>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-3">
              Paiement 100% sécurisé par AccountPE · Orange Money, MTN, Wave et plus
            </p>
          </div>
        )}

        {/* ÉTAPE 3 : Vérification en cours (retour de checkout) */}
        {step === "waiting" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">Vérification du paiement</h2>
            <p className="text-muted-foreground mb-2">
              Nous vérifions automatiquement ton paiement de <strong>3 600 FCFA</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Si tu viens de terminer ton paiement sur AccountPE, la confirmation arrive dans quelques secondes.
            </p>

            {checkoutUrl && (
              <a
                href={checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary/5 transition-all mb-6"
              >
                <ExternalLink className="w-4 h-4" /> Retourner sur la page de paiement
              </a>
            )}

            <div className="bg-muted/50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="w-4 h-4" />
                <span>Vérification automatique toutes les 5 secondes</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Temps écoulé : <span className="font-mono font-medium text-foreground">{formatElapsed(elapsedSeconds)}</span>
              </p>
              <div className="flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={doPoll}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm text-foreground hover:bg-muted/50 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Vérifier maintenant
              </button>
              <button
                onClick={() => {
                  stopPolling();
                  localStorage.removeItem(PAYMENT_TX_KEY);
                  setStep("pay");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Je n'ai pas encore payé
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : Succès */}
        {step === "success" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-14 h-14 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Paiement confirmé ! 🎉</h2>
            <p className="text-muted-foreground mb-8">
              Ton compte TRIXHUB est maintenant <strong className="text-green-500">activé</strong>.<br />
              Bienvenue dans la communauté !
            </p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Commission N1", value: "1 700 FCFA", color: "text-green-500" },
                { label: "Commission N2", value: "700 FCFA", color: "text-blue-500" },
                { label: "Commission N3", value: "300 FCFA", color: "text-purple-500" },
              ].map((c, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3">
                  <p className={`text-lg font-bold ${c.color} font-mono`}>{c.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all text-base shadow-lg shadow-primary/25 flex items-center justify-center gap-2"
            >
              Accéder à mon tableau de bord
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* ÉTAPE ÉCHEC */}
        {step === "failed" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
              <X className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Paiement non confirmé</h2>
            <p className="text-muted-foreground mb-6">
              Le paiement n'a pas pu être confirmé. Vérifie que tu as bien finalisé la transaction sur AccountPE.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setStep("pay"); setTxId(null); setCheckoutUrl(null); }}
                className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-2xl hover:opacity-90 transition-all"
              >
                Réessayer le paiement
              </button>
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 border border-border rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
              >
                Retour à l'accueil
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
