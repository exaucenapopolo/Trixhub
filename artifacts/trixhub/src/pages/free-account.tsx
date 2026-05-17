import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, type UserData } from "@/context/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import {
  Share2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Loader2, ArrowRight, Users, Zap, GraduationCap, Wifi,
  Palette, Tv, Star, Gift, TrendingUp, AlertCircle, Clock,
  ArrowLeft, ShieldCheck, Sparkles, Trophy, CreditCard, Phone, Pencil,
} from "lucide-react";

const FREE_PAYMENT_TX_KEY = "trixhub_free_payment_tx";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const TOKEN_KEY = "trixhub_token";
const FREE_ACCOUNT_THRESHOLD = 3400;

const TRIXHUB_LOGO = "/logo.png";

const ALLOWED = [
  { icon: Share2, label: "Lien de parrainage unique", desc: "Partage ton lien et gagne des commissions quand tes filleuls activent leur compte payant." },
  { icon: Users, label: "Tableau de bord complet", desc: "Accès à ton tableau de bord, tes statistiques d'équipe et le suivi de ton crédit d'activation." },
  { icon: TrendingUp, label: "Achat de contacts", desc: "Tu peux acheter des contacts depuis ton solde dépôt pour développer ton réseau." },
  { icon: GraduationCap, label: "Formations premium (achat)", desc: "Tu peux acquérir des formations pro depuis ton solde dépôt — sans attendre l'activation." },
];

const BLOCKED = [
  { icon: Star, label: "Activités quotidiennes rémunérées", desc: "Disponibles après activation complète." },
  { icon: GraduationCap, label: "Formations gratuites incluses", desc: "Catalogue débloqué après activation." },
  { icon: Tv, label: "Abonnement Canal+ gratuit", desc: "Bonus offert à l'activation complète." },
  { icon: Palette, label: "Compte Canva Pro à vie", desc: "Offert à l'activation complète." },
  { icon: Wifi, label: "Connexion VPN offerte", desc: "Disponible après activation complète." },
];

const FAQS = [
  {
    q: "Mon parrain reçoit-il toujours sa commission quand j'utilise l'option gratuite ?",
    a: "Oui, absolument. Ton choix n'a aucun impact sur ton parrain ni sur les autres membres. Quand les personnes que tu parrainas activent leur compte payant, ton parrain reçoit toujours sa commission N2 normalement. Ton option gratuite est un accord uniquement entre toi et TRIXHUB — personne d'autre n'est affecté.",
  },
  {
    q: "Que se passe-t-il si les personnes que j'invite choisissent aussi l'option gratuite ?",
    a: "Pas de problème. Quand leurs propres filleuls activent un compte payant, tu reçois quand même tes commissions N2 (700 FCFA) et N3 (200 FCFA). Ces commissions s'accumulent dans ton crédit d'activation. La chaîne continue à fonctionner — tant que quelqu'un dans le réseau paie son activation, les commissions remontent à tous les niveaux.",
  },
  {
    q: "Que se passe-t-il exactement quand j'atteins 3 400 FCFA de crédit ?",
    a: "Ton compte s'active automatiquement, sans aucune action de ta part. Toutes tes fonctionnalités sont immédiatement débloquées : activités quotidiennes, formations gratuites, Canal+, Canva Pro, VPN. Si tu avais accumulé un peu plus de 3 400 FCFA, le surplus est directement crédité dans ton solde parrainage retirable.",
  },
  {
    q: "Ma première commission après activation — pourquoi elle va à mon parrain ?",
    a: "En choisissant l'option gratuite, tu n'as pas payé les 3 600 FCFA normaux. Ton parrain (la personne qui t'a parrainé) aurait dû recevoir 1 700 FCFA de commission quand tu t'es activé. Puisque tu n'as rien payé directement, cette commission lui est due. TRIXHUB la récupère automatiquement sur ta toute première commission après activation et la reverse à ton parrain. Si ta première commission est de 1 700 FCFA (un filleul direct), elle va intégralement à ton parrain. Si elle est plus petite (700 FCFA ou 200 FCFA), la déduction s'étale jusqu'à rembourser les 1 700 FCFA complets. Ensuite, toutes les commissions suivantes te reviennent normalement.",
  },
  {
    q: "Puis-je encore décider de payer les 3 600 FCFA directement après avoir choisi l'option gratuite ?",
    a: "Oui. Depuis la page d'activation, le paiement direct reste disponible. Si tu paies, ton compte s'active immédiatement et ton crédit déjà accumulé est crédité dans ton solde parrainage.",
  },
  {
    q: "Combien de temps ai-je pour accumuler les 3 400 FCFA ?",
    a: "Il n'y a pas de délai imposé. Ton crédit ne disparaît jamais. Tu avances à ton rythme — 1 semaine ou plusieurs mois. L'essentiel est d'amener des personnes qui choisissent de payer leur activation.",
  },
  {
    q: "Est-ce que je peux retirer les commissions accumulées avant mon activation ?",
    a: "Non. Tant que ton compte n'est pas activé, toutes les commissions que tu reçois (N1, N2, N3) vont exclusivement dans ton crédit d'activation. Elles servent uniquement à payer ton accès. Tu ne peux pas les retirer avant d'avoir atteint 3 400 FCFA.",
  },
  {
    q: "Est-ce une option légale ? Y a-t-il un risque ?",
    a: "Cette option est parfaitement transparente et légalement défendable. Tu sais exactement ce que tu signes : accès limité au parrainage, commissions utilisées pour ton activation, et déblocage automatique une fois le seuil atteint. Il n'y a aucun frais caché. Tu n'es pas piégé — tu choisis librement.",
  },
  {
    q: "Combien de parrainages directs payants me faut-il pour m'activer ?",
    a: "Avec 2 parrainages directs payants, tu accumules 2 × 1 700 FCFA = 3 400 FCFA, ce qui suffit pour l'activation automatique. Tu peux aussi atteindre ce seuil plus vite grâce aux commissions N2 (700 FCFA) et N3 (200 FCFA) — chaque activation dans ton réseau compte.",
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="text-sm font-medium text-foreground leading-snug">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function FreeAccountPage() {
  usePageTitle("Compte Gratuit — Rejoindre sans payer");
  const [, navigate] = useLocation();
  const { user, setUserData, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // ── Payer le reste ─────────────────────────────────────────────
  const [payStep, setPayStep] = useState<"idle" | "waiting" | "success">("idle");
  const [payTxId, setPayTxId] = useState<string | null>(null);
  const [payPhone, setPayPhone] = useState(user?.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ACTIVATION_FULL_AMOUNT = 3600;
  const activationCredit = parseFloat(user?.activationCredit ?? "0");
  const progress = Math.min(100, (activationCredit / FREE_ACCOUNT_THRESHOLD) * 100);
  const remaining = Math.max(0, FREE_ACCOUNT_THRESHOLD - activationCredit);
  const remainingAmount = Math.ceil(Math.max(0, ACTIVATION_FULL_AMOUNT - activationCredit));
  const isFreeAccount = user?.isFreeAccount ?? false;
  const isActivated = user?.isActivated ?? false;

  // Pré-rempli depuis le profil
  useEffect(() => {
    if (user?.phone && !payPhone) setPayPhone(user.phone);
  }, [user?.phone]);

  // Reprendre un paiement en attente (retour du checkout)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const savedTx =
      params.get("tx_id") ||
      params.get("transaction_id") ||
      localStorage.getItem(FREE_PAYMENT_TX_KEY);
    if (savedTx && isFreeAccount && !isActivated) {
      setPayTxId(savedTx);
      setPayStep("waiting");
    }
  }, [isFreeAccount, isActivated]);

  function startPolling() {
    stopPolling();
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    pollRef.current = setInterval(doPoll, 5000);
    setTimeout(doPoll, 1500);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  const doPoll = useCallback(async () => {
    const currentTxId = payTxId || localStorage.getItem(FREE_PAYMENT_TX_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (!currentTxId || !token) return;
    try {
      const res = await fetch(`${BASE}/api/swychr/status/${encodeURIComponent(currentTxId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { success: boolean; status: string; isPaid: boolean };
      if (data.isPaid || data.status === "success") {
        stopPolling();
        localStorage.removeItem(FREE_PAYMENT_TX_KEY);
        await refreshUser();
        setPayStep("success");
        navigate("/dashboard");
        return;
      }
      if (data.status === "failed") {
        stopPolling();
        localStorage.removeItem(FREE_PAYMENT_TX_KEY);
        toast({ title: "Paiement échoué", description: "Votre paiement n'a pas abouti. Réessayez.", variant: "destructive" });
        setPayStep("idle");
      }
    } catch { /* retry next tick */ }
  }, [payTxId, refreshUser, toast, navigate]);

  useEffect(() => {
    if (payStep === "waiting" && payTxId) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [payStep, payTxId]);

  useEffect(() => {
    if (payStep !== "waiting") return;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = setInterval(doPoll, 5000);
    }
  }, [doPoll]);

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const handlePayRemainder = async () => {
    const phone = payPhone.trim();
    if (!phone) {
      toast({ title: "Numéro requis", description: "Renseignez votre numéro de téléphone mobile money.", variant: "destructive" });
      return;
    }
    setIsInitiating(true);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${BASE}/api/swychr/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ purpose: "free_self_activation", phoneNumber: phone }),
      });
      const data = await res.json() as {
        success: boolean;
        transactionId?: string;
        checkoutUrl?: string;
        amount?: number;
        error?: string;
      };
      if (!res.ok || !data.success) {
        toast({ title: "Erreur", description: data.error ?? "Impossible d'initier le paiement.", variant: "destructive" });
        return;
      }
      if (!data.checkoutUrl || !data.transactionId) {
        toast({ title: "Erreur", description: "Réponse invalide du partenaire. Contactez le support.", variant: "destructive" });
        return;
      }
      localStorage.setItem(FREE_PAYMENT_TX_KEY, data.transactionId);
      setPayTxId(data.transactionId);
      window.location.href = data.checkoutUrl;
    } catch {
      toast({ title: "Erreur réseau", description: "Réessayez dans un instant.", variant: "destructive" });
    } finally {
      setIsInitiating(false);
    }
  };

  const handleChooseFreeAccount = async () => {
    setIsSubmitting(true);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${BASE}/api/auth/choose-free-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { user?: UserData; error?: string };
      if (!res.ok) {
        toast({ title: "Erreur", description: data.error ?? "Une erreur est survenue.", variant: "destructive" });
        return;
      }
      // Mettre à jour le state immédiatement avec les données renvoyées par l'API
      // (isFreeAccount=true) — ceci déclenche la redirection dans FreeAccountRoute
      if (data.user) setUserData(data.user);
      toast({ title: "Compte activé !", description: "Bienvenue ! Tu as accès à ton tableau de bord." });
      navigate("/dashboard");
    } catch {
      toast({ title: "Erreur réseau", description: "Réessaie dans un instant.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/activate" className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">TRIXHUB</span>
          </div>
        </div>

        {/* ── PROGRESSION (si déjà compte gratuit) ── */}
        {isFreeAccount && !isActivated && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-foreground text-sm">Ton crédit d'activation</h2>
                <p className="text-xs text-muted-foreground">Partage ton lien pour accumuler des commissions</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-extrabold text-foreground tabular-nums">{activationCredit.toLocaleString("fr-FR")} FCFA</span>
                <span className="text-sm text-muted-foreground font-medium">sur {FREE_ACCOUNT_THRESHOLD.toLocaleString("fr-FR")} FCFA</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{Math.round(progress)}% accompli</span>
                <span className="font-medium text-foreground">Il reste {remaining.toLocaleString("fr-FR")} FCFA</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 bg-card border border-border rounded-xl p-3 leading-relaxed">
              Chaque fois qu'un membre de ton réseau active son compte payant, tes commissions (N1 : 1 700 FCFA, N2 : 700 FCFA, N3 : 200 FCFA) s'accumulent automatiquement dans ce crédit. À 3 400 FCFA, ton compte est activé et toutes les fonctionnalités sont débloquées.
            </p>
          </div>
        )}

        {/* ── HÉRO (si pas encore free account) ── */}
        {!isFreeAccount && (
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Option spéciale — Rejoins sans payer maintenant
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Commence gratuitement,<br />active via le parrainage</h1>
            <p className="text-muted-foreground leading-relaxed">
              Tu n'as pas les 3 600 FCFA pour activer ton compte maintenant ? Pas de problème. Rejoins TRIXHUB gratuitement, partage ton lien de parrainage, et dès que tes commissions atteignent <strong className="text-foreground">3 400 FCFA</strong>, ton compte s'active automatiquement — sans rien payer.
            </p>
          </div>
        )}

        {/* ── CE QUE TU PEUX FAIRE ── */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Ce que tu peux faire dès maintenant
          </h2>
          <div className="space-y-3">
            {ALLOWED.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CE QUI EST BLOQUÉ ── */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Débloqué dès ton activation (à 3 400 FCFA de crédit)
          </h2>
          <div className="space-y-2">
            {BLOCKED.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{item.label}</p>
                  </div>
                  <span className="ml-auto text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded-full flex-shrink-0">bientôt</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COMMENT ÇA MARCHE ── */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Comment ça marche
          </h2>
          <div className="space-y-4">
            {[
              { n: "1", title: "Tu rejoins gratuitement", desc: "Ton tableau de bord est actif. Tu reçois ton lien de parrainage unique." },
              { n: "2", title: "Tu partages ton lien", desc: "Tes contacts s'inscrivent et activent leur compte payant (3 600 FCFA chacun)." },
              { n: "3", title: "Tes commissions s'accumulent", desc: "1 700 FCFA par parrainage direct, 700 FCFA (N2) et 200 FCFA (N3) pour les filleuls de tes filleuls — tout va dans ton crédit." },
              { n: "4", title: "À 3 400 FCFA → activation automatique", desc: "Ton compte s'active tout seul. Tous les avantages sont débloqués immédiatement." },
              { n: "5", title: "Ta 1ère commission rembourse ton parrain (1 700 FCFA)", desc: "Après ton activation, ta toute première commission est automatiquement reversée à ton parrain N1. C'est la commission qu'il aurait reçue si tu avais payé directement. Ensuite, tout est normal — les commissions suivantes te reviennent intégralement." },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {step.n}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── GARANTIE TRANSPARENCE ── */}
        <div className="flex items-start gap-3 bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
          <ShieldCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">Option transparente et sans risque</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Ton parrain reçoit toujours ses commissions normalement. Tes filleuls aussi. Cette option n'affecte personne d'autre que toi. Aucun frais caché. Si tu changes d'avis, tu peux toujours payer directement les 3 600 FCFA depuis la page d'activation.
            </p>
          </div>
        </div>

        {/* ── FAQ ── */}
        <div className="mb-6">
          <h2 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" /> Questions fréquentes
          </h2>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <FaqItem
                key={i}
                q={faq.q}
                a={faq.a}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        {!isFreeAccount ? (
          <div className="space-y-4">
            {/* Checkbox d'acceptation obligatoire */}
            <label className="flex items-start gap-3 cursor-pointer bg-card border border-border rounded-2xl p-4 hover:bg-muted/20 transition-colors">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="sr-only peer"
                />
                <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${termsAccepted ? "bg-primary border-primary" : "border-border bg-background"}`}>
                  {termsAccepted && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                J'ai lu et j'accepte les{" "}
                <Link href="/terms" className="text-primary underline-offset-2 hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
                  conditions d'utilisation
                </Link>{" "}
                de TRIXHUB, notamment les règles du compte gratuit : mes commissions alimentent mon crédit d'activation (3 400 FCFA), et ma première commission après activation sera reversée à mon parrain (1 700 FCFA). Je comprends et j'accepte ces règles.
              </div>
            </label>

            <button
              type="button"
              onClick={handleChooseFreeAccount}
              disabled={isSubmitting || !termsAccepted}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-base font-bold shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
              {isSubmitting ? "Activation en cours..." : "Choisir l'option gratuite"}
            </button>
            {!termsAccepted && (
              <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                Coche la case ci-dessus pour continuer.
              </p>
            )}
            <Link
              href="/activate"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Retour — je préfère payer directement
            </Link>
          </div>
        ) : payStep === "waiting" ? (
          /* ── ÉTAT D'ATTENTE : paiement en cours de vérification ── */
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">Vérification de votre paiement</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Paiement de <strong className="text-foreground">{remainingAmount.toLocaleString("fr-FR")} FCFA</strong> en cours de vérification…
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Temps écoulé : {formatElapsed(elapsedSeconds)} — vérification automatique toutes les 5 secondes
              </p>
            </div>
            <p className="text-xs text-muted-foreground bg-card border border-border rounded-xl p-3 leading-relaxed">
              Dès que le paiement est confirmé, votre compte est activé automatiquement et vous êtes redirigé vers votre tableau de bord. Vous pouvez garder cette page ouverte ou fermer et revenir plus tard.
            </p>
            <button
              type="button"
              onClick={() => { stopPolling(); localStorage.removeItem(FREE_PAYMENT_TX_KEY); setPayStep("idle"); setPayTxId(null); }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
            >
              Annuler et retourner à l'accueil
            </button>
          </div>
        ) : (
          /* ── COMPTE GRATUIT EXISTANT : accès dashboard + payer le reste ── */
          <div className="space-y-4">

            {/* Bloc "Payer le reste" — affiché uniquement si remaining > 0 */}
            {remainingAmount > 0 && (
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">Activer maintenant — payer seulement le solde restant</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Tu as déjà <strong className="text-foreground">{activationCredit.toLocaleString("fr-FR")} FCFA</strong> de crédit accumulé.
                      Il ne te reste que <strong className="text-green-600 dark:text-green-400 text-sm">{remainingAmount.toLocaleString("fr-FR")} FCFA</strong> à payer et ton compte est activé immédiatement.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ton crédit accumulé sera transféré dans ton solde parrainage.
                    </p>
                  </div>
                </div>

                {/* Numéro de téléphone mobile money */}
                <div className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" /> Numéro mobile money
                    </span>
                    {!editingPhone && (
                      <button
                        type="button"
                        onClick={() => setEditingPhone(true)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" /> Modifier
                      </button>
                    )}
                  </div>
                  {editingPhone ? (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={payPhone}
                        onChange={(e) => setPayPhone(e.target.value)}
                        placeholder="Ex : +237 6XX XX XX XX"
                        className="flex-1 text-sm bg-background border border-border rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setEditingPhone(false)}
                        className="text-xs bg-primary text-primary-foreground px-3 py-2 rounded-lg font-medium"
                      >
                        OK
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-mono text-foreground">{payPhone || <span className="text-muted-foreground italic">Non renseigné</span>}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePayRemainder}
                  disabled={isInitiating || !payPhone.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-base font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isInitiating ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                  {isInitiating
                    ? "Préparation du paiement…"
                    : `Payer ${remainingAmount.toLocaleString("fr-FR")} FCFA et activer mon compte`}
                </button>
                <p className="text-center text-[11px] text-muted-foreground">
                  Paiement sécurisé via notre partenaire AccountPE • Mobile Money uniquement
                </p>
              </div>
            )}

            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow hover:opacity-90 transition-all"
            >
              <ArrowRight className="w-4 h-4" /> Aller à mon tableau de bord
            </Link>
            <Link
              href="/activate"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              Payer directement les 3 600 FCFA à la place
            </Link>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          © 2026 TRIXHUB — Projet de Social Succès Group
        </p>
      </div>
    </div>
  );
}
