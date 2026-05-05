import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { formatLocalWithFcfa, formatLocal, type CurrencyTarget } from "@/lib/currency";
import {
  Star, CheckCircle2, Loader2, ZoomIn, X, ChevronRight,
  Wallet, Gift, ShoppingCart, BookOpen, Zap, Target, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

import imgTikTokMonetisable from "@assets/file_00000000eea0724682fc7609161c560d_1778021933052.png";
import imgTikTokClients from "@assets/file_0000000065087246996ca51f4278b672_1778021933036.png";
import imgWhatsAppSystem from "@assets/file_0000000091807246a07e284f628a4c4d_1778021933020.png";
import imgIA from "@assets/file_000000000ac872469ef351ab5dc0f679_1778021932995.png";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function priceStr(amountFcfa: number, ct: CurrencyTarget): string {
  const r = formatLocalWithFcfa(amountFcfa, ct);
  return r.secondary ? `${r.primary} (${r.secondary})` : r.primary;
}

type FormationWithImage = {
  id: string; title: string; price: number;
  image: string; tag: string; tagColor: string; tagBg: string;
  description: string; points: string[];
};
type FormationList = {
  id: string; title: string; price: number;
  emoji: string; tag: string; tagColor: string; tagBg: string;
  description: string; points: string[];
};

const FORMATIONS_WITH_IMAGES: FormationWithImage[] = [
  {
    id: "tiktok-monetisable",
    title: "Comment créer un compte TikTok monétisable depuis l'Afrique ?",
    price: 250, image: imgTikTokMonetisable,
    tag: "TikTok", tagColor: "text-pink-500", tagBg: "bg-pink-500/10",
    description: "C'est un service ultra recherché qui se revend entre 2 500 et 7 000 FCFA. Quand tu sais le faire, tu as une compétence monnayable immédiatement. On te l'enseigne à 250 FCFA.",
    points: [
      "Créer un compte TikTok professionnel depuis l'Afrique",
      "Paramétrer correctement pour être éligible à la monétisation",
      "Atteindre les critères requis (vues, abonnés, région)",
      "Vendre ce service à d'autres à partir de 3 000 FCFA",
    ],
  },
  {
    id: "tiktok-clients",
    title: "Comment transformer TikTok en source de clients ?",
    price: 250, image: imgTikTokClients,
    tag: "TikTok", tagColor: "text-pink-500", tagBg: "bg-pink-500/10",
    description: "Fais de TikTok ton meilleur outil d'acquisition client. Stratégies concrètes pour attirer, engager et convertir une audience africaine.",
    points: [
      "Créer du contenu qui attire et qui convertit",
      "Gagner en visibilité et en crédibilité",
      "Générer des leads et des ventes directement depuis TikTok",
      "Automatiser la fidélisation de ta communauté",
    ],
  },
  {
    id: "whatsapp-systeme",
    title: "Comment créer un système WhatsApp qui vend tout seul ?",
    price: 250, image: imgWhatsAppSystem,
    tag: "WhatsApp", tagColor: "text-green-500", tagBg: "bg-green-500/10",
    description: "Configure WhatsApp Business comme un tunnel de vente automatisé. Ton business génère des ventes 24h/24, même quand tu dors.",
    points: [
      "Configurer un compte WhatsApp Business optimisé",
      "Créer un tunnel de vente automatisé",
      "Rédiger des messages qui convertissent",
      "Mettre en place des relances automatiques efficaces",
    ],
  },
  {
    id: "ia-vendre",
    title: "Comment utiliser l'IA pour produire et vendre plus vite ?",
    price: 250, image: imgIA,
    tag: "Intelligence Artificielle", tagColor: "text-purple-500", tagBg: "bg-purple-500/10",
    description: "Exploite ChatGPT et les autres IA pour créer du contenu, des offres et des visuels 10x plus vite. Prends de l'avance sur ta concurrence.",
    points: [
      "Maîtriser les meilleurs outils IA pour ton activité",
      "Créer du contenu IA qui convertit",
      "Automatiser tes processus répétitifs",
      "Booster tes ventes grâce à des stratégies IA éprouvées",
    ],
  },
];

const FORMATIONS_LIST: FormationList[] = [
  {
    id: "whatsapp-business",
    title: "Comment prospecter et vendre sur WhatsApp Business en Afrique ?",
    price: 100, emoji: "💬",
    tag: "WhatsApp", tagColor: "text-green-500", tagBg: "bg-green-500/10",
    description: "Maîtrise la prospection, les messages qui convertissent et la fidélisation — tout adapté au marché africain.",
    points: [
      "Optimiser son profil WhatsApp Business comme un pro",
      "Trouver des prospects sans budget pub",
      "Envoyer le premier message qui crée l'intérêt",
      "Transformer les conversations en ventes concrètes",
    ],
  },
  {
    id: "marketing-affiliation",
    title: "La base du marketing d'affiliation",
    price: 100, emoji: "🔗",
    tag: "Affiliation", tagColor: "text-blue-500", tagBg: "bg-blue-500/10",
    description: "Comprends les fondements du marketing d'affiliation et commence à générer tes premières commissions dès aujourd'hui.",
    points: [
      "Comprendre le fonctionnement de l'affiliation",
      "Choisir les bons programmes à promouvoir",
      "Générer tes premières commissions",
      "Scaler ton activité d'affilié",
    ],
  },
  {
    id: "business-telephone",
    title: "Créer un business en ligne avec son téléphone",
    price: 100, emoji: "📱",
    tag: "Business", tagColor: "text-amber-500", tagBg: "bg-amber-500/10",
    description: "Zéro bureau, zéro ordinateur. Démarre et développe ton activité digitale avec uniquement ton smartphone.",
    points: [
      "Identifier ton niche business depuis ton téléphone",
      "Créer tes contenus et tes offres",
      "Gérer tes paiements et tes clients",
      "Automatiser et faire croître ton business",
    ],
  },
];

const BONUS_FORMATION = {
  id: "recruter-trixhub",
  title: "Comment recruter pour TRIXHUB sans mentir ?",
  price: 0, emoji: "🎁",
  description: "La méthode honnête pour parrainer avec succès. Présente TRIXHUB avec intégrité et convertis mieux — sans pression, sans fausses promesses.",
  points: [
    "Présenter TRIXHUB de façon honnête et convaincante",
    "Répondre aux objections courantes des prospects",
    "Recruter des filleuls qui restent actifs longtemps",
    "Bâtir une équipe solide et durable",
  ],
};

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt={alt} className="max-h-[90vh] max-w-full rounded-2xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
    </div>
  );
}

function ContentModal({
  open, onClose, title, points,
}: { open: boolean; onClose: () => void; title: string; points: string[] }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            Formation débloquée
          </DialogTitle>
          <DialogDescription className="text-left text-xs leading-relaxed">
            <span className="font-semibold text-foreground block mb-3">"{title}"</span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 -mt-2">
          <p className="text-xs font-semibold text-foreground">Ce que tu vas apprendre :</p>
          <ul className="space-y-2">
            {points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                {pt}
              </li>
            ))}
          </ul>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
            Le contenu complet est en cours de préparation. Tu seras notifié sur WhatsApp dès qu'il est disponible.
          </div>
          <Button className="w-full" onClick={onClose}>Compris !</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FormationsProPage() {
  usePageTitle("Formations Pro");
  const { user } = useAuth();
  const { toast } = useToast();

  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [depositBalance, setDepositBalance] = useState<number | null>(null);

  const [buyDialog, setBuyDialog] = useState<{ id: string; title: string; price: number; points: string[] } | null>(null);
  const [buying, setBuying] = useState(false);
  const [contentDialog, setContentDialog] = useState<{ title: string; points: string[] } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const token = () => localStorage.getItem(TOKEN_KEY);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/formations-pro`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) {
        const data = await res.json() as { purchasedIds: string[] };
        setPurchasedIds(new Set(data.purchasedIds));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBalance = useCallback(async () => {
    const res = await fetch(`${BASE}/api/balances/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    if (res.ok) {
      const data = await res.json() as { depositBalance: number };
      setDepositBalance(Number(data.depositBalance));
    }
  }, []);

  useEffect(() => {
    refresh();
    fetchBalance();
  }, [refresh, fetchBalance]);

  const openBuyDialog = (id: string, title: string, price: number, points: string[]) => {
    setBuyDialog({ id, title, price, points });
  };

  const handlePurchase = async () => {
    if (!buyDialog) return;
    setBuying(true);
    try {
      const res = await fetch(`${BASE}/api/formations-pro/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ formationId: buyDialog.id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; code?: string };
      if (!res.ok) {
        if (json.code === "INSUFFICIENT_BALANCE") {
          toast({
            title: "Solde insuffisant",
            description: "Recharge ton solde dépôt pour accéder à cette formation.",
            variant: "destructive",
          });
        } else {
          toast({ title: "Erreur", description: json.error ?? "Une erreur est survenue.", variant: "destructive" });
        }
        return;
      }
      setBuyDialog(null);
      await Promise.all([refresh(), fetchBalance()]);
      toast({ title: "Formation débloquée !", description: "Tu as maintenant accès à cette formation." });
      setContentDialog({ title: buyDialog.title, points: buyDialog.points });
    } finally {
      setBuying(false);
    }
  };

  const ct: CurrencyTarget = user ?? undefined;

  const totalFormations = FORMATIONS_WITH_IMAGES.length + FORMATIONS_LIST.length + 1;
  const totalPurchased = purchasedIds.size;

  return (
    <Layout>
      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      {contentDialog && (
        <ContentModal
          open={!!contentDialog}
          onClose={() => setContentDialog(null)}
          title={contentDialog.title}
          points={contentDialog.points}
        />
      )}

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 flex items-center justify-center mx-auto">
            <Star className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Formations Pro</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Des formations professionnelles à <strong className="text-foreground">prix mini</strong> — payées depuis ton solde dépôt, accessibles immédiatement.
          </p>
        </div>

        {/* Solde dépôt + progression */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Solde dépôt</p>
              <p className="text-sm font-bold text-foreground">
                {depositBalance === null ? "—" : formatLocal(depositBalance, ct)}
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Formations</p>
              <p className="text-sm font-bold text-foreground">{totalPurchased} / {totalFormations}</p>
            </div>
          </div>
        </div>

        {/* Lien vers dépôt si besoin */}
        {depositBalance !== null && depositBalance < 100 && (
          <Link href="/depot">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-red-500/15 transition-colors">
              <Wallet className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400 flex-1">
                Solde dépôt insuffisant pour acheter des formations. <strong>Recharger maintenant →</strong>
              </p>
            </div>
          </Link>
        )}

        {/* ─── FORMATIONS AVEC IMAGES ─── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div>
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Formations Professionnelles
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FORMATIONS_WITH_IMAGES.map(f => {
                  const owned = purchasedIds.has(f.id);
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "bg-card border rounded-2xl overflow-hidden transition-all",
                        owned ? "border-emerald-500/30 bg-emerald-500/5" : "border-border hover:border-primary/30"
                      )}
                    >
                      {/* Image cliquable */}
                      <div
                        className="relative group cursor-zoom-in overflow-hidden"
                        onClick={() => setLightbox({ src: f.image, alt: f.title })}
                      >
                        <img
                          src={f.image}
                          alt={f.title}
                          className="w-full h-44 object-cover object-top transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/20 backdrop-blur-sm rounded-full p-3">
                            <ZoomIn className="w-6 h-6 text-white" />
                          </div>
                        </div>
                        {owned && (
                          <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" /> Débloquée
                          </div>
                        )}
                        <div className={cn("absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full", f.tagBg, f.tagColor)}>
                          {f.tag}
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none" />
                      </div>

                      {/* Contenu */}
                      <div className="p-4 space-y-3">
                        <div>
                          <p className="text-sm font-bold text-foreground leading-snug mb-1">{f.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-primary">
                            {priceStr(f.price, ct)}
                          </span>
                          {owned ? (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-8 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              onClick={() => setContentDialog({ title: f.title, points: f.points })}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accéder
                            </Button>
                          ) : (
                            <Button
                              size="sm" className="text-xs h-8"
                              onClick={() => openBuyDialog(f.id, f.title, f.price, f.points)}
                            >
                              <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Acheter
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── FORMATIONS LISTE (sans image) ─── */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-500" />
                Formations Pratiques
              </h2>
              <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
                {FORMATIONS_LIST.map(f => {
                  const owned = purchasedIds.has(f.id);
                  return (
                    <div key={f.id} className={cn("p-4 flex items-start gap-3 transition-colors", owned && "bg-emerald-500/5")}>
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl mt-0.5", f.tagBg)}>
                        {f.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">{f.title}</p>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5", f.tagBg, f.tagColor)}>
                            {f.tag}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-sm font-bold text-primary">{priceStr(f.price, ct)}</span>
                          {owned ? (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-7 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              onClick={() => setContentDialog({ title: f.title, points: f.points })}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Accéder
                            </Button>
                          ) : (
                            <Button
                              size="sm" className="text-xs h-7"
                              onClick={() => openBuyDialog(f.id, f.title, f.price, f.points)}
                            >
                              <ShoppingCart className="w-3 h-3 mr-1" /> Acheter
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── BONUS ─── */}
            <div>
              <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-500" />
                Bonus Offert
              </h2>
              {(() => {
                const owned = purchasedIds.has(BONUS_FORMATION.id);
                return (
                  <div className={cn(
                    "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border rounded-2xl p-4",
                    owned ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/25"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-xl">
                        {BONUS_FORMATION.emoji}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-foreground">{BONUS_FORMATION.title}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">BONUS</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{BONUS_FORMATION.description}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Gratuit</span>
                          {owned ? (
                            <Button
                              size="sm" variant="outline"
                              className="text-xs h-7 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              onClick={() => setContentDialog({ title: BONUS_FORMATION.title, points: BONUS_FORMATION.points })}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Accéder
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white"
                              onClick={() => openBuyDialog(BONUS_FORMATION.id, BONUS_FORMATION.title, 0, BONUS_FORMATION.points)}
                            >
                              <Gift className="w-3 h-3 mr-1" /> Obtenir gratuitement
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Note bas */}
            <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
              <Lock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">
                Paiement depuis ton solde dépôt · Accès immédiat · Contenu livré sur WhatsApp
              </p>
            </div>
          </>
        )}
      </div>

      {/* Dialog achat */}
      <Dialog open={!!buyDialog} onOpenChange={() => setBuyDialog(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-primary" />
              {buyDialog?.price === 0 ? "Obtenir le bonus" : "Confirmer l'achat"}
            </DialogTitle>
            <DialogDescription className="text-left pt-1 leading-relaxed">
              <span className="font-semibold text-foreground block mb-1 text-sm">"{buyDialog?.title}"</span>
            </DialogDescription>
          </DialogHeader>

          {buyDialog && (
            <div className="space-y-4 pt-1">
              <div className="bg-muted/60 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Prix de la formation</span>
                  <span className="font-bold text-foreground">
                    {buyDialog.price === 0 ? "Gratuit" : priceStr(buyDialog.price, ct)}
                  </span>
                </div>
                {depositBalance !== null && buyDialog.price > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Solde dépôt actuel</span>
                    <span className={cn("font-semibold", depositBalance >= buyDialog.price ? "text-emerald-600 dark:text-emerald-400" : "text-red-500")}>
                      {formatLocal(depositBalance, ct)}
                    </span>
                  </div>
                )}
              </div>

              {depositBalance !== null && buyDialog.price > 0 && depositBalance < buyDialog.price && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Solde insuffisant. Il te manque <strong>{priceStr(buyDialog.price - depositBalance, ct)}</strong>.{" "}
                    <Link href="/depot" className="underline" onClick={() => setBuyDialog(null)}>
                      Recharger le solde →
                    </Link>
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setBuyDialog(null)} disabled={buying}>
                  Annuler
                </Button>
                <Button
                  className="flex-1 font-bold"
                  onClick={handlePurchase}
                  disabled={buying || (buyDialog.price > 0 && depositBalance !== null && depositBalance < buyDialog.price)}
                >
                  {buying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {buyDialog.price === 0 ? "Obtenir" : "Payer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
