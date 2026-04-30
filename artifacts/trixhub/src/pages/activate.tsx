import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import {
  CheckCircle2, ChevronRight, Zap, TrendingUp,
  Globe, X, Star, Loader2, Clock, ExternalLink, RefreshCw,
  Phone, Pencil, Briefcase, Share2, GraduationCap, Gift, Sparkles, Wifi, Tv, Palette
} from "lucide-react";
import PartnersFooter from "@/components/PartnersFooter";
import JoinCommunityButton from "@/components/JoinCommunityButton";
import ImageLightbox from "@/components/ImageLightbox";
import { formatLocalWithFcfa, formatLocal } from "@/lib/currency";

function buildTickerItems(country?: string | null) {
  return [
    `💰 Gagne jusqu'à ${formatLocal(1700, country)} par filleul direct activé`,
    "📹 Regarde des vidéos et sois rémunéré immédiatement",
    "✅ Réalise de petites tâches simples et sois payé",
    "🌍 Réseau de membres dans 18 pays africains",
    "📱 Tout depuis ton téléphone, partout et à tout moment",
    "💳 Retrait via Orange Money, Wave, MTN, M-Pesa et plus",
    "👥 Commissions sur 3 niveaux de parrainage",
    `🚀 Activation unique ${formatLocal(3600, country)} — Accès à vie à la plateforme`,
    "⭐ Activités quotidiennes — gagne des points convertibles en FCFA (1 pt = 1 FCFA)",
    "🔗 Partage ton lien unique et gagne des commissions sur 3 niveaux",
  ];
}

function Ticker({ country }: { country?: string | null }) {
  const base = buildTickerItems(country);
  const items = [...base, ...base];
  return (
    <div className="w-full overflow-hidden bg-primary py-2.5 relative">
      <div className="flex gap-12 whitespace-nowrap" style={{ animation: "ticker-slide 38s linear infinite" }}>
        {items.map((item, i) => (
          <span key={i} className="text-primary-foreground text-sm font-medium flex-shrink-0">
            {item} <span className="opacity-40 mx-2">•</span>
          </span>
        ))}
      </div>
      <style>{`
        @keyframes ticker-slide {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const TOKEN_KEY = "trixhub_token";
const PAYMENT_TX_KEY = "trixhub_payment_tx";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

// Liste des 18 pays africains réellement supportés par notre partenaire de paiement.
// Vérifiée en direct via leur API de méthodes de paiement.
const AFRICAN_COUNTRIES = [
  { code: "BJ", name: "Bénin", flag: "🇧🇯", method: "MTN / Moov Money", dial: "+229" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", method: "Orange Money / Moov", dial: "+226" },
  { code: "CM", name: "Cameroun", flag: "🇨🇲", method: "MTN / Orange Money", dial: "+237" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", method: "Orange / MTN / Moov / Wave", dial: "+225" },
  { code: "CG", name: "Congo-Brazzaville", flag: "🇨🇬", method: "MTN / Airtel", dial: "+242" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩", method: "M-Pesa / Orange / Airtel / Afrimoney", dial: "+243" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", method: "Airtel / Moov", dial: "+241" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", method: "MTN / Vodafone / Airtel", dial: "+233" },
  { code: "GN", name: "Guinée", flag: "🇬🇳", method: "Orange / MTN", dial: "+224" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", method: "M-Pesa / Airtel", dial: "+254" },
  { code: "ML", name: "Mali", flag: "🇲🇱", method: "Orange / Moov / Wave", dial: "+223" },
  { code: "NE", name: "Niger", flag: "🇳🇪", method: "Airtel", dial: "+227" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", method: "Tous les virements bancaires", dial: "+234" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼", method: "MTN / Airtel", dial: "+250" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", method: "Orange / Wave / Free", dial: "+221" },
  { code: "TG", name: "Togo", flag: "🇹🇬", method: "Tmoney / Moov", dial: "+228" },
  { code: "TZ", name: "Tanzanie", flag: "🇹🇿", method: "M-Pesa / Airtel / Tigo", dial: "+255" },
  { code: "UG", name: "Ouganda", flag: "🇺🇬", method: "MTN / Airtel", dial: "+256" },
];

// 5 vraies images d'illustration affichées en carrousel sur la page d'activation.
// Pas de texte par-dessus : les images sont auto-explicatives.
const IMAGE_SLIDES = [
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/file_000000002ab47243b5d65bb309e5bb77.png",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/file_00000000e388720aa27cbd8c1db9b434.png",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/Noir%20et%20Jaune%20Dessin%C3%A9%20%C3%A0%20la%20main%20Voyage%20Tutoriel%20%20Comment%20faire%20Instagram%20St_20260426_195825_0000.png",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/IMG-20260426-WA0001.jpg",
  "https://raw.githubusercontent.com/exaucenapopolo/Social-Boost-Horizon-/refs/heads/main/assets/Photo/TRIXHUB/Jaune%20Portraits%20Enseignant%20%C3%89ducation%20Comment%20Podcast%20Couverture_20260426_194410_0000.png",
];

// Liste des formations accessibles après activation (extrait — il y en a beaucoup d'autres)
const FORMATIONS_PREVIEW = [
  "Comment avoir tout Canal+ gratuitement",
  "Comment utiliser son téléphone sans gâcher sa vie",
  "Comment gagner ses premiers revenus sans abandonner ses études",
  "Comment créer une deuxième source de revenus sans stress",
];

// Bonus exclusifs débloqués après activation
const BONUS_LIST = [
  {
    icon: Tv,
    title: "Abonnement à TOUT Canal+ gratuitement",
    desc: "Reçois un abonnement complet à toutes les chaînes Canal+ (Canal+ Premium, Sport, Cinéma, Séries, etc.) sans rien payer chaque mois. Tu peux en profiter toi-même OU le revendre à tes propres clients au prix que tu fixes.",
    color: "text-red-500",
    bg: "bg-red-500/10",
  },
  {
    icon: Palette,
    title: "Compte Canva Pro à vie",
    desc: "Crée tes designs, visuels marketing et contenus professionnels avec Canva Pro débloqué à vie.",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: Wifi,
    title: "Connexion VPN gratuite",
    desc: "Notre équipe t'offre chaque jour une connexion VPN gratuite pour effectuer tes tâches sans utiliser tes propres données mobiles.",
    color: "text-green-500",
    bg: "bg-green-500/10",
  },
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
  const [payPhone, setPayPhone] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Conversion automatique du prix d'activation 3 600 FCFA en devise locale
  const priceDisplay = formatLocalWithFcfa(3600, user?.country);
  const commissionN1 = formatLocal(1700, user?.country);
  const commissionN2 = formatLocal(700, user?.country);
  const commissionN3 = formatLocal(300, user?.country);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Redirect if already activated
  useEffect(() => {
    if (user?.isActivated) navigate("/dashboard");
  }, [user]);

  // Pre-fill phone number from user profile
  useEffect(() => {
    if (user?.phone && !payPhone) setPayPhone(user.phone);
  }, [user?.phone]);

  // Auto-slide du carrousel d'images (5 vraies images, défilement toutes les 4s)
  useEffect(() => {
    const iv = setInterval(() => setCurrentSlide(s => (s + 1) % IMAGE_SLIDES.length), 4000);
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
    if (!payPhone.trim()) {
      toast({ title: "Numéro requis", description: "Veuillez renseigner votre numéro de téléphone.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${BASE}/api/swychr/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phoneNumber: payPhone.trim() }),
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
          description: "Réponse du partenaire de paiement invalide. Contactez le support.",
          variant: "destructive",
        });
        return;
      }

      // Sauvegarder l'ID transaction pour retrouver le statut au retour
      localStorage.setItem(PAYMENT_TX_KEY, data.transactionId);
      setTxId(data.transactionId);
      setCheckoutUrl(data.checkoutUrl);

      // Rediriger vers la page de checkout du partenaire de paiement
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
      {/* Scrolling ticker */}
      <Ticker country={user?.country} />

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
            {/* ── COLONNE GAUCHE : Présentation, carrousel, avantages détaillés ── */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Active ton compte TRIXHUB</h1>
                <p className="text-muted-foreground mt-2">Une seule activation pour débloquer tout le potentiel de la plateforme</p>
              </div>

              {/* Carrousel d'images réelles (cliquables pour voir l'image en grand) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLightboxSrc(IMAGE_SLIDES[currentSlide])}
                  aria-label="Voir l'image en grand"
                  className="block w-full relative overflow-hidden rounded-2xl bg-muted/30 border border-border aspect-[4/5] sm:aspect-[3/4] cursor-zoom-in group"
                >
                  {IMAGE_SLIDES.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Illustration TRIXHUB ${i + 1}`}
                      loading={i === 0 ? "eager" : "lazy"}
                      referrerPolicy="no-referrer"
                      className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${i === currentSlide ? "opacity-100" : "opacity-0"}`}
                    />
                  ))}
                  <span className="absolute bottom-2 right-2 bg-black/55 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                    Cliquer pour agrandir
                  </span>
                </button>
                <div className="flex justify-center gap-2 mt-3">
                  {IMAGE_SLIDES.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentSlide(i)}
                      aria-label={`Image ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${i === currentSlide ? "bg-primary w-7" : "bg-border w-1.5 hover:bg-muted-foreground/40"}`}
                    />
                  ))}
                </div>
              </div>

              {/* ── POURQUOI ACTIVER MON COMPTE ── */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h2 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Pourquoi activer mon compte ?
                </h2>
                <p className="text-xs text-muted-foreground mb-5">Voici tout ce que tu débloques avec ton activation à {priceDisplay.primary} :</p>

                <div className="space-y-4">

                  {/* 1. Accès aux formations */}
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                        <GraduationCap className="w-5 h-5 text-purple-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm">Accès à plusieurs formations</h3>
                        <p className="text-xs text-muted-foreground mt-1">Voici un aperçu (et bien d'autres après activation) :</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5 ml-1">
                      {FORMATIONS_PREVIEW.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                      <li className="flex items-start gap-2 text-xs text-muted-foreground italic mt-2">
                        <Sparkles className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                        <span>...et plein d'autres formations à découvrir une fois ton compte activé</span>
                      </li>
                    </ul>
                  </div>

                  {/* 2. Accès au parrainage */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <Share2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">Accès au parrainage</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Lien de parrainage unique, commissions automatiques sur 3 niveaux : <strong className="text-foreground">{commissionN1} / {commissionN2} / {commissionN3}</strong> par filleul activé.
                      </p>
                    </div>
                  </div>

                  {/* 3. Cadeaux & bonus exclusifs */}
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <Gift className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground text-sm">Cadeaux & bonus exclusifs</h3>
                        <p className="text-xs text-muted-foreground mt-1">Des bonus à valeur réelle, offerts gratuitement avec ton activation :</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {BONUS_LIST.map((b, i) => {
                        const Icon = b.icon;
                        return (
                          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-card border border-border">
                            <div className={`w-8 h-8 rounded-lg ${b.bg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`w-4 h-4 ${b.color}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground">{b.title}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{b.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                      <p className="text-[11px] text-muted-foreground italic flex items-start gap-1.5 pt-1">
                        <Sparkles className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>Et beaucoup d'autres bonus à découvrir une fois ton compte activé</span>
                      </p>
                    </div>
                  </div>

                  {/* 4. Activités de progression */}
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">Activités</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Participe chaque jour à de petites activités sur la plateforme — regarder des vidéos, répondre à des quiz, explorer des produits partenaires…
                        Chaque activité réussie te rapporte des <strong className="text-foreground">points de progression</strong>.
                        <strong className="text-foreground"> 1 point = 1 FCFA.</strong> Cumule 700 pts dans la semaine, puis convertis-les en argent réel le dimanche et retire sur ton Mobile Money.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 3 FAÇONS DE GAGNER ── (rassurer ceux qui ne veulent pas parrainer) */}
              <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-5">
                <h2 className="text-lg font-bold text-foreground mb-1">3 façons de gagner — chacun trouve son compte</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Pas obligé de parrainer pour gagner. Tu choisis le chemin qui te correspond :
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center mb-2">
                      <Briefcase className="w-4 h-4 text-primary" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Avec les activités</h4>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Participe aux activités quotidiennes, gagne des points et convertis-les en argent, même sans parrainer personne.
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center mb-2">
                      <Share2 className="w-4 h-4 text-blue-500" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Avec le parrainage</h4>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Invite des amis et touche des commissions sur 3 niveaux, automatiquement.
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center mb-2">
                      <Gift className="w-4 h-4 text-amber-500" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">Avec les bonus</h4>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Revends tes comptes Canal+ et utilise les formations pour générer tes propres revenus.
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed">
                    <strong>Dans tous les cas, tu auras de l'argent à gagner.</strong> Que tu sois un parrain motivé, un travailleur de tâches discret, ou un revendeur de bonus — TRIXHUB est fait pour toi.
                  </p>
                </div>
              </div>
            </div>

            {/* ── COLONNE DROITE : Prix, pays acceptés, CTA ── */}
            <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <div className="bg-card border-2 border-primary rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-4 right-4">
                  <span className="bg-primary text-primary-foreground text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" /> Unique
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">Frais d'activation unique</p>
                <div className="my-3">
                  <p className="text-4xl font-bold text-foreground font-mono leading-tight break-all">{priceDisplay.primary}</p>
                  {priceDisplay.secondary && (
                    <p className="text-xs text-muted-foreground mt-1">{priceDisplay.secondary}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-4">Paiement unique — accès permanent à toutes les fonctionnalités</p>
                <div className="flex items-center gap-2 p-3 bg-primary/8 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
                  <p className="text-xs text-foreground">Récupère ton activation avec seulement <strong>2 filleuls actifs</strong> (2 × {commissionN1}), ou en réalisant tes premières activités quotidiennes.</p>
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
                Paiement sécurisé via notre partenaire · Mobile Money · Toute l'Afrique
              </p>

              {/* Bouton communauté WhatsApp — accessible avant et après activation */}
              <div className="pt-2 space-y-2">
                <p className="text-center text-xs text-muted-foreground">
                  Une question ? Rejoins-nous :
                </p>
                <JoinCommunityButton />
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Payer via le partenaire de paiement */}
        {step === "pay" && (
          <div className="max-w-xl mx-auto">
            <button onClick={() => setStep("info")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
              ← Retour
            </button>

            <h2 className="text-2xl font-bold text-foreground mb-1">Paiement sécurisé</h2>
            <p className="text-muted-foreground text-sm mb-6">Tu vas être redirigé vers la page de paiement de notre partenaire</p>

            {/* Résumé de la commande */}
            <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 mb-6">
              <div className="flex items-center justify-between mb-4 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Activation compte TRIXHUB</p>
                  <p className="text-3xl font-bold text-foreground font-mono mt-1 break-all">{priceDisplay.primary}</p>
                  {priceDisplay.secondary && (
                    <p className="text-xs text-muted-foreground mt-1">{priceDisplay.secondary}</p>
                  )}
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-muted-foreground">Activation compte</span>
                  <span className="font-medium text-foreground text-right break-all">{priceDisplay.primary}</span>
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
                <li>Tu es redirigé vers la <strong>page de paiement sécurisée de notre partenaire</strong></li>
                <li>Choisis ton opérateur (MTN, Orange, Wave, etc.) et confirme le paiement</li>
                <li>Après paiement, reviens sur TRIXHUB — ton compte est <strong>activé automatiquement</strong></li>
              </ol>
            </div>

            {/* Numéro de téléphone confirmable */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Numéro de paiement Mobile Money</span>
                </div>
                {!editingPhone && (
                  <button
                    onClick={() => setEditingPhone(true)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Modifier
                  </button>
                )}
              </div>

              {editingPhone ? (
                <div className="space-y-2">
                  <input
                    type="tel"
                    value={payPhone}
                    onChange={e => setPayPhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className="w-full px-4 py-3 bg-muted/40 border border-primary rounded-xl text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => setEditingPhone(false)}
                    className="w-full py-2 text-xs bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors font-medium"
                  >
                    Confirmer ce numéro
                  </button>
                </div>
              ) : (
                <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-mono text-sm font-semibold text-foreground tracking-wide">
                    {payPhone || "—"}
                  </span>
                  <span className="ml-auto text-xs text-green-500 font-medium">✓ Confirmé</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Ce numéro sera pré-rempli sur la page de paiement de notre partenaire. Vous pourrez aussi le modifier directement sur la page de paiement.
              </p>
            </div>

            <button
              onClick={handlePay}
              disabled={isLoading || editingPhone}
              className="w-full py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-base shadow-lg shadow-primary/25"
            >
              {isLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Connexion en cours...</>
              ) : (
                <><ExternalLink className="w-5 h-5" /> Payer {priceDisplay.primary} en sécurité</>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-3">
              Paiement 100% sécurisé par notre partenaire · Orange Money, MTN, Wave et plus
            </p>

            {/* Bouton communauté WhatsApp */}
            <div className="mt-6 pt-6 border-t border-border space-y-2">
              <p className="text-center text-xs text-muted-foreground">
                Une question avant de payer ?
              </p>
              <JoinCommunityButton />
            </div>
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
              Nous vérifions automatiquement ton paiement de <strong>{priceDisplay.primary}</strong>
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Si tu viens de terminer ton paiement, la confirmation arrive dans quelques secondes.
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
                { label: "Commission N1", value: commissionN1, color: "text-green-500" },
                { label: "Commission N2", value: commissionN2, color: "text-blue-500" },
                { label: "Commission N3", value: commissionN3, color: "text-purple-500" },
              ].map((c, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3">
                  <p className={`text-base sm:text-lg font-bold ${c.color} font-mono break-all`}>{c.value}</p>
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
              Le paiement n'a pas pu être confirmé. Vérifie que tu as bien finalisé la transaction sur la page de notre partenaire.
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

      {/* Pied de page partenaires */}
      <PartnersFooter />

      {/* Modale image en grand (cliquer sur une illustration du carrousel) */}
      <ImageLightbox
        src={lightboxSrc}
        alt="Illustration TRIXHUB"
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}
