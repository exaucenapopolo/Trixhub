import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle2, ChevronRight, Smartphone, CreditCard, Zap, TrendingUp, Users, Gift, Shield, Globe, X, Star } from "lucide-react";

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
  { id: "orange_money", name: "Orange Money", color: "bg-orange-500", emoji: "🟠" },
  { id: "wave", name: "Wave", color: "bg-blue-500", emoji: "🌊" },
  { id: "mtn_money", name: "MTN Money", color: "bg-yellow-500", emoji: "🟡" },
  { id: "moov_money", name: "Moov Money", color: "bg-teal-500", emoji: "💚" },
  { id: "airtel_money", name: "Airtel Money", color: "bg-red-500", emoji: "🔴" },
  { id: "mpesa", name: "M-Pesa", color: "bg-green-600", emoji: "💚" },
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
  {
    emoji: "💸",
    title: "Gagne de l'argent réel",
    desc: "Chaque filleul actif te rapporte jusqu'à 1 700 FCFA directement sur ton solde",
    color: "from-green-500/20 to-emerald-600/20",
    accent: "text-green-500",
  },
  {
    emoji: "👥",
    title: "Construis ton équipe",
    desc: "3 niveaux de commissions : tes filleuls, leurs filleuls, et encore leurs filleuls",
    color: "from-blue-500/20 to-blue-700/20",
    accent: "text-blue-500",
  },
  {
    emoji: "📱",
    title: "Missions sur mobile",
    desc: "Visionne des vidéos, partage du contenu et gagne des bonus supplémentaires",
    color: "from-purple-500/20 to-purple-700/20",
    accent: "text-purple-500",
  },
  {
    emoji: "🌍",
    title: "18 pays africains",
    desc: "Orange Money, Wave, M-Pesa, MTN... Payement partout en Afrique",
    color: "from-orange-500/20 to-amber-600/20",
    accent: "text-orange-500",
  },
];

export default function ActivatePage() {
  const [, navigate] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<"info" | "pay">("info");
  const [payMethod, setPayMethod] = useState("");
  const [payRef, setPayRef] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(s => (s + 1) % ILLUSTRATIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payMethod || !payRef.trim()) {
      toast({ title: "Informations requises", description: "Choisissez un mode de paiement et entrez la référence.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/auth/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentMethod: payMethod, paymentReference: payRef }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Erreur", description: data.error || "Activation échouée.", variant: "destructive" });
        return;
      }
      toast({ title: "Compte activé !", description: "Bienvenue dans la famille TRIXHUB !" });
      refreshUser();
      navigate("/dashboard");
    } catch {
      toast({ title: "Erreur réseau", description: "Réessayez dans un instant.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "info" ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"}`}>1</div>
            <div className="w-8 h-px bg-border" />
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === "pay" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2</div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {step === "info" && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Sliding illustrations */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Active ton compte TRIXHUB</h1>
                <p className="text-muted-foreground mt-2">Une seule activation pour débloquer tout le potentiel de la plateforme</p>
              </div>

              {/* Carousel */}
              <div className="relative overflow-hidden rounded-2xl">
                {ILLUSTRATIONS.map((ill, i) => (
                  <div
                    key={i}
                    className={`bg-gradient-to-br ${ill.color} border border-border rounded-2xl p-8 transition-all duration-500 ${i === currentSlide ? "block" : "hidden"}`}
                  >
                    <div className="text-5xl mb-4">{ill.emoji}</div>
                    <h3 className={`text-xl font-bold ${ill.accent} mb-2`}>{ill.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{ill.desc}</p>
                  </div>
                ))}
                <div className="flex justify-center gap-2 mt-3">
                  {ILLUSTRATIONS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === currentSlide ? "bg-primary w-6" : "bg-border"}`}
                    />
                  ))}
                </div>
              </div>

              {/* What you get vs don't get */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    Avec activation
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
                    <X className="w-4 h-4 text-destructive" />
                    Sans activation
                  </h4>
                  <ul className="space-y-2.5">
                    {BENEFITS_WITHOUT.map((b, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <X className="w-3 h-3 text-destructive flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Right: Pricing + CTA */}
            <div className="space-y-4">
              {/* Price card */}
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

              {/* Accepted countries */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <h4 className="font-semibold text-foreground text-sm mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Pays de paiement acceptés
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
                Paiement sécurisé via Mobile Money africain uniquement
              </p>
            </div>
          </div>
        )}

        {step === "pay" && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep("info")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              ← Retour
            </button>

            <h2 className="text-2xl font-bold text-foreground mb-1">Paiement</h2>
            <p className="text-muted-foreground text-sm mb-6">Choisissez votre mode de paiement et effectuez le virement</p>

            {/* Payment instructions */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-amber-900 dark:text-amber-300 text-sm mb-2 flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Comment payer ?
              </h4>
              <ol className="text-xs text-amber-800 dark:text-amber-400 space-y-1.5 list-decimal list-inside">
                <li>Sélectionnez votre opérateur Mobile Money ci-dessous</li>
                <li>Envoyez <strong>3 600 FCFA</strong> au numéro de l'opérateur (communiqué par WhatsApp)</li>
                <li>Notez la référence de la transaction</li>
                <li>Entrez cette référence dans le champ ci-dessous</li>
              </ol>
            </div>

            <form onSubmit={handleActivate} className="space-y-5">
              {/* Payment method selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Mode de paiement</label>
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

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Référence de transaction
                </label>
                <input
                  type="text"
                  required
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="Ex: TXN123456789"
                  className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1.5">La référence se trouve dans le SMS de confirmation de paiement</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Activation en cours...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Confirmer l'activation
                  </>
                )}
              </button>

              <p className="text-center text-xs text-muted-foreground">
                Une fois confirmé, votre compte sera activé immédiatement
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
