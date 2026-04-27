import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2, ChevronRight, Smartphone, Zap, TrendingUp,
  Globe, X, Star, Loader2, AlertCircle, RefreshCw, Clock
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const TOKEN_KEY = "trixhub_token";

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

const PAYMENT_METHODS = [
  { id: "ORANGE_MONEY", name: "Orange Money", emoji: "🟠" },
  { id: "WAVE", name: "Wave", emoji: "🌊" },
  { id: "MTN_MONEY", name: "MTN Money", emoji: "🟡" },
  { id: "MOOV_MONEY", name: "Moov Money", emoji: "💚" },
  { id: "AIRTEL_MONEY", name: "Airtel Money", emoji: "🔴" },
  { id: "MPESA", name: "M-Pesa", emoji: "🟢" },
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
  const [payMethod, setPayMethod] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [paymentRef, setPaymentRef] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [pollCount, setPollCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user?.isActivated) {
      navigate("/dashboard");
    }
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentSlide(s => (s + 1) % ILLUSTRATIONS.length), 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step !== "waiting") {
      stopPolling();
      return;
    }
    startPolling();
    return () => stopPolling();
  }, [step, paymentRef]);

  function startPolling() {
    stopPolling();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    pollIntervalRef.current = setInterval(() => {
      setPollCount(c => c + 1);
    }, 5000);
  }

  function stopPolling() {
    if (pollIntervalRef.current) { clearInterval(pollIntervalRef.current); pollIntervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  useEffect(() => {
    if (step !== "waiting" || !paymentRef || pollCount === 0) return;
    checkPaymentStatus();
  }, [pollCount]);

  async function checkPaymentStatus() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !paymentRef) return;
    try {
      const res = await fetch(`${BASE}/api/swychr/status/${paymentRef}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; status: string; activated: boolean };
      if (data.status === "SUCCESS" || data.activated) {
        stopPolling();
        await refreshUser();
        setStep("success");
        return;
      }
      if (data.status === "FAILED") {
        stopPolling();
        setStep("failed");
        return;
      }
      if (elapsedSeconds > 600) {
        stopPolling();
        toast({ title: "Délai dépassé", description: "La vérification a pris trop de temps. Vérifiez votre paiement et revenez.", variant: "destructive" });
        setStep("pay");
      }
    } catch {
      // silent — will retry on next poll
    }
  }

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payMethod) {
      toast({ title: "Mode de paiement requis", description: "Sélectionnez votre opérateur Mobile Money.", variant: "destructive" });
      return;
    }
    if (!phoneNumber.trim()) {
      toast({ title: "Numéro requis", description: "Entrez votre numéro Mobile Money.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/swychr/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), paymentMethod: payMethod, purpose: "activation" }),
      });
      const data = await res.json() as { success: boolean; reference?: string; paymentUrl?: string; ussdCode?: string; message?: string; error?: string };
      if (!res.ok || !data.success) {
        toast({ title: "Erreur paiement", description: data.error || "Impossible d'initier le paiement.", variant: "destructive" });
        return;
      }
      setPaymentRef(data.reference ?? null);
      setPaymentUrl(data.paymentUrl ?? null);
      setUssdCode(data.ussdCode ?? null);
      setPaymentMessage(data.message || "");
      setStep("waiting");

      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
      }
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
            {(["info", "pay", "waiting", "failed"] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s || (s === "waiting" && step === "success") || (i < ["info","pay","waiting","success"].indexOf(step))
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* STEP 1 : Info */}
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
                Paiement sécurisé via Mobile Money · Propulsé par Swychr Connect
              </p>
            </div>
          </div>
        )}

        {/* STEP 2 : Formulaire de paiement */}
        {step === "pay" && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep("info")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              ← Retour
            </button>

            <h2 className="text-2xl font-bold text-foreground mb-1">Paiement via Mobile Money</h2>
            <p className="text-muted-foreground text-sm mb-6">Paiement automatique sécurisé via Swychr Connect</p>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 text-sm mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Comment ça fonctionne
              </h4>
              <ol className="text-xs text-blue-800 dark:text-blue-400 space-y-1.5 list-decimal list-inside">
                <li>Sélectionnez votre opérateur Mobile Money</li>
                <li>Entrez votre numéro de téléphone Mobile Money</li>
                <li>Cliquez sur <strong>"Payer 3 600 FCFA"</strong></li>
                <li>Vous recevrez une <strong>notification sur votre téléphone</strong> — confirmez le paiement</li>
                <li>L'activation se fait <strong>automatiquement</strong> dès confirmation</li>
              </ol>
            </div>

            <form onSubmit={handleInitiatePayment} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Opérateur Mobile Money</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {PAYMENT_METHODS.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPayMethod(m.id)}
                      className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all ${payMethod === m.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}
                    >
                      <span className="text-2xl">{m.emoji}</span>
                      <span className="text-xs font-medium text-foreground text-center leading-tight">{m.name}</span>
                      {payMethod === m.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Numéro Mobile Money
                </label>
                <input
                  type="tel"
                  required
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1.5">Le numéro sur lequel vous recevrez la notification de paiement</p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                  💡 Montant à payer : <strong>3 600 FCFA</strong> — Ce montant sera débité de votre compte Mobile Money
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Connexion à Swychr...</>
                ) : (
                  <><Zap className="w-4 h-4" /> Payer 3 600 FCFA via {payMethod ? PAYMENT_METHODS.find(m => m.id === payMethod)?.name : "Mobile Money"}</>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Paiement sécurisé via Swychr Connect · Aucun partage de données bancaires
              </p>
            </form>
          </div>
        )}

        {/* STEP 3 : Vérification en cours */}
        {step === "waiting" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 relative">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
            </div>

            <h2 className="text-2xl font-bold text-foreground mb-2">En attente de votre paiement</h2>
            <p className="text-muted-foreground mb-6">
              {paymentMessage || "Confirmez le paiement de 3 600 FCFA sur votre téléphone"}
            </p>

            {ussdCode && (
              <div className="bg-card border border-border rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-muted-foreground mb-1">Code USSD à composer</p>
                <p className="text-2xl font-mono font-bold text-primary tracking-wider">{ussdCode}</p>
              </div>
            )}

            {paymentUrl && (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-all mb-6"
              >
                Ouvrir la page de paiement →
              </a>
            )}

            <div className="bg-muted/50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="w-4 h-4" />
                <span>Vérification automatique en cours</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Temps écoulé : <span className="font-mono font-medium text-foreground">{formatElapsed(elapsedSeconds)}</span>
              </p>
              <div className="flex justify-center gap-1 mt-3">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={checkPaymentStatus}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-xl text-sm text-foreground hover:bg-muted/50 transition-all"
              >
                <RefreshCw className="w-4 h-4" /> Vérifier maintenant
              </button>
              <button
                onClick={() => { stopPolling(); setStep("pay"); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour (annuler ce paiement)
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 : Succès */}
        {step === "success" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Compte activé ! 🎉</h2>
            <p className="text-muted-foreground mb-2">
              Bienvenue dans la famille TRIXHUB. Ton paiement de <strong>3 600 FCFA</strong> a bien été confirmé.
            </p>
            <p className="text-muted-foreground mb-8 text-sm">
              Tu peux maintenant parrainer, faire des missions et retirer tes gains.
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 text-base"
            >
              Accéder au tableau de bord
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* STEP : Paiement échoué */}
        {step === "failed" && (
          <div className="max-w-lg mx-auto text-center py-8">
            <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Paiement non confirmé</h2>
            <p className="text-muted-foreground mb-8">
              Le paiement a été annulé ou a échoué. Aucun montant n'a été débité. Tu peux réessayer avec un autre opérateur.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => { setPaymentRef(null); setPayMethod(""); setPhoneNumber(""); setStep("pay"); }}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all"
              >
                Réessayer le paiement
              </button>
              <button
                onClick={() => setStep("info")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Retour à l'info
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
