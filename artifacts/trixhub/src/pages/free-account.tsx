import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useToast } from "@/hooks/use-toast";
import {
  Share2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Loader2, ArrowRight, Users, Zap, GraduationCap, Wifi,
  Palette, Tv, Star, Gift, TrendingUp, AlertCircle, Clock,
  ArrowLeft, ShieldCheck, Sparkles, Trophy,
} from "lucide-react";

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
    q: "Les 200 FCFA manquants par rapport aux 3 600 FCFA — comment sont-ils récupérés ?",
    a: "Tu dois 200 FCFA à TRIXHUB puisque tu as eu accès à 200 FCFA de moins. Lors de ta toute prochaine commission de parrainage après activation, ces 200 FCFA sont automatiquement déduits. Par exemple, si tu parraines quelqu'un qui paie, tu reçois 1 500 FCFA au lieu de 1 700 FCFA pour ce parrainage-là. Ensuite, tout revient à la normale — les commissions suivantes sont complètes.",
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
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const activationCredit = parseFloat(user?.activationCredit ?? "0");
  const progress = Math.min(100, (activationCredit / FREE_ACCOUNT_THRESHOLD) * 100);
  const remaining = Math.max(0, FREE_ACCOUNT_THRESHOLD - activationCredit);
  const isFreeAccount = user?.isFreeAccount ?? false;
  const isActivated = user?.isActivated ?? false;

  const handleChooseFreeAccount = async () => {
    setIsSubmitting(true);
    const token = localStorage.getItem(TOKEN_KEY);
    try {
      const res = await fetch(`${BASE}/api/auth/choose-free-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        toast({ title: "Erreur", description: data.error ?? "Une erreur est survenue.", variant: "destructive" });
        return;
      }
      await refreshUser();
      toast({ title: "Option activée !", description: "Tu as accès à ton tableau de bord. Commence à parrainer pour accumuler ton crédit." });
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
              { n: "5", title: "200 FCFA récupérés sur la prochaine commission", desc: "Une seule déduction de 200 FCFA sur ta prochaine commission. Ensuite, tout est normal." },
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
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleChooseFreeAccount}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-base font-bold shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
              {isSubmitting ? "Activation en cours..." : "Choisir l'option gratuite"}
            </button>
            <p className="text-center text-xs text-muted-foreground">
              Tu acceptes les{" "}
              <Link href="/terms" className="text-primary underline-offset-2 hover:underline">conditions d'utilisation</Link>
              {" "}incluant les règles du compte gratuit.
            </p>
            <Link
              href="/activate"
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Retour — je préfère payer directement
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground text-base font-bold shadow-lg hover:opacity-90 transition-all"
            >
              <ArrowRight className="w-5 h-5" /> Aller à mon tableau de bord
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
