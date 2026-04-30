import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  GraduationCap, CheckCircle2, Lock, Loader2, CalendarClock,
  DollarSign, Rocket, MessageSquare, Brain, Zap, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Formation = {
  title: string;
  description: string;
  emoji: string;
};

type Category = {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
  formations: Formation[];
};

const CATEGORIES: Category[] = [
  {
    id: "argent",
    label: "Argent & Finance",
    icon: DollarSign,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    iconBg: "bg-emerald-500/20",
    formations: [
      {
        title: "Comment organiser sa vie financière même avec un petit revenu",
        description: "Organise ton budget mois par mois, élimine les dépenses inutiles et commence à épargner dès aujourd'hui, même avec un petit revenu.",
        emoji: "💰",
      },
      {
        title: "Comment ne plus finir le mois sans argent",
        description: "Anticipe tes dépenses, évite les emprunts d'urgence et construis un matelas financier qui te protège chaque fin de mois.",
        emoji: "📊",
      },
      {
        title: "Comment créer une deuxième source de revenu sans stress",
        description: "Identifie 3 sources de revenus adaptées à ton profil et lance la première en moins de 2 semaines, sans investissement de départ.",
        emoji: "💎",
      },
    ],
  },
  {
    id: "business",
    label: "Business & Revenus",
    icon: Rocket,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/25",
    iconBg: "bg-blue-500/20",
    formations: [
      {
        title: "Comment bâtir un business stable même en partant de rien",
        description: "Construis ton activité pas à pas : idée → validation → premiers clients → revenus réguliers. Zéro capital de départ nécessaire.",
        emoji: "🏗️",
      },
      {
        title: "Comment gagner ses premiers revenus sans abandonner ses études",
        description: "Freelance, affiliation, revente — des méthodes concrètes pour gagner de l'argent en ligne, adaptées aux étudiants africains.",
        emoji: "🎓",
      },
      {
        title: "Comment avoir tout canal+ gratuitement ?",
        description: "Accède à Canal+ et ses bouquets premium à prix zéro grâce à des techniques légales méconnues du grand public.",
        emoji: "📺",
      },
    ],
  },
  {
    id: "ventes",
    label: "Ventes & Marketing",
    icon: MessageSquare,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/25",
    iconBg: "bg-purple-500/20",
    formations: [
      {
        title: "Comment vendre sur WhatsApp sans forcer les gens",
        description: "Maîtrise les messages, statuts et groupes WhatsApp pour vendre naturellement, sans harceler tes contacts ni les perdre.",
        emoji: "💬",
      },
      {
        title: "Comment convertir ses amis et contacts en premiers clients",
        description: "Transforme ta liste de contacts en clients fidèles avec des scripts de conversation simples et des techniques de confiance éprouvées.",
        emoji: "🤝",
      },
      {
        title: "Comment devenir viral sur les réseaux sociaux ?",
        description: "Crée du contenu qui se partage seul : visuels, vidéos courtes, textes accrocheurs — sans budget publicitaire.",
        emoji: "🚀",
      },
    ],
  },
  {
    id: "mindset",
    label: "Mindset & Discipline",
    icon: Brain,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    iconBg: "bg-amber-500/20",
    formations: [
      {
        title: "Comment avoir confiance en soi quand personne ne croit en toi",
        description: "Développe une confiance inébranlable en toi, même dans les moments de doute, de critique ou d'échec collectif.",
        emoji: "💪",
      },
      {
        title: "Comment devenir sérieux et discipliné en 30 jours",
        description: "Plan d'action de 30 jours pour devenir quelqu'un de fiable, constant et productif dans tous les domaines de ta vie.",
        emoji: "🎯",
      },
      {
        title: "Comment reprendre le contrôle de sa vie en 90 jours",
        description: "Programme de transformation sur 90 jours : santé, finances, relations, mental — reprends les rênes de ton existence.",
        emoji: "🔄",
      },
      {
        title: "Comment devenir une meilleure version de soi (plan concret)",
        description: "Évalue qui tu es aujourd'hui, décide qui tu veux être demain et applique les changements concrets semaine après semaine.",
        emoji: "⭐",
      },
      {
        title: "Comment utiliser son téléphone sans gâcher sa vie",
        description: "Utilise ton smartphone comme un outil de croissance, pas de distraction : productivité, réseaux, apprentissage continu.",
        emoji: "📱",
      },
    ],
  },
  {
    id: "tech",
    label: "Tech & Intelligence Artificielle",
    icon: Zap,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/25",
    iconBg: "bg-cyan-500/20",
    formations: [
      {
        title: "Comment utiliser l'intelligence artificielle pour améliorer sa vie quotidienne",
        description: "Découvre comment ChatGPT, Gemini et les autres IA peuvent te faire gagner des heures chaque jour et booster tes revenus.",
        emoji: "🤖",
      },
    ],
  },
];

type FormationRequest = { formationTitle: string; requestedAt: string };
type FormationData = { requests: FormationRequest[]; requestedToday: boolean; totalRequested: number };

function useFormationRequests() {
  const [data, setData] = useState<FormationData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);
    fetch(`${BASE}/api/formations/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((d: FormationData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);
  return { data, loading, refresh };
}

function FormationCard({
  formation,
  category,
  isRequested,
  requestedToday,
  onRequest,
  sending,
}: {
  formation: Formation;
  category: Category;
  isRequested: boolean;
  requestedToday: boolean;
  onRequest: () => void;
  sending: boolean;
}) {
  const Icon = category.icon;
  const blocked = isRequested || requestedToday || sending;

  return (
    <div
      className={cn(
        "bg-card border rounded-2xl overflow-hidden transition-all",
        isRequested
          ? "border-emerald-500/30 bg-emerald-500/5"
          : requestedToday
            ? "border-card-border opacity-70"
            : "border-card-border hover:border-primary/30 hover:shadow-sm",
      )}
    >
      {/* Illustration */}
      <div className={cn("relative flex items-center justify-center py-8", category.bg)}>
        <span className="text-6xl select-none" role="img" aria-hidden>
          {formation.emoji}
        </span>
        <div className={cn("absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center", category.iconBg)}>
          <Icon className={cn("w-3.5 h-3.5", category.color)} />
        </div>
        {isRequested && (
          <div className="absolute top-3 left-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Demandée
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground leading-snug mb-1">{formation.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{formation.description}</p>
        </div>

        {isRequested ? (
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Notre équipe te contactera sur WhatsApp
          </div>
        ) : requestedToday ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <CalendarClock className="w-4 h-4 text-amber-500" />
            Reviens demain pour demander celle-ci
          </div>
        ) : (
          <Button
            size="sm"
            onClick={onRequest}
            disabled={blocked}
            className="w-full text-xs font-bold h-9"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 mr-1" />
            )}
            Demander cette formation
          </Button>
        )}
      </div>
    </div>
  );
}

export default function FormationsPage() {
  usePageTitle("Formations");
  const { user } = useAuth();
  const { toast } = useToast();
  const { data, loading, refresh } = useFormationRequests();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState(user?.phone ?? "");
  const [sending, setSending] = useState(false);

  const requestedTitles = new Set(data?.requests.map(r => r.formationTitle) ?? []);
  const requestedToday = data?.requestedToday ?? false;
  const totalRequested = data?.totalRequested ?? 0;
  const totalFormations = CATEGORIES.reduce((s, c) => s + c.formations.length, 0);

  function openDialog(title: string) {
    setSelectedTitle(title);
    setWhatsapp(user?.phone ?? "");
    setDialogOpen(true);
  }

  async function handleRequest() {
    if (!whatsapp.trim() || whatsapp.trim().length < 8) {
      toast({ title: "Numéro requis", description: "Entre ton numéro WhatsApp.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${BASE}/api/contact/formation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: selectedTitle, whatsappNumber: whatsapp.trim() }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        toast({ title: "Erreur", description: json.error ?? "Une erreur est survenue.", variant: "destructive" });
      } else {
        setDialogOpen(false);
        toast({
          title: "Demande envoyée !",
          description: "Notre équipe te contactera sur WhatsApp dans les plus brefs délais. 📚",
        });
        refresh();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Layout>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Mes Formations</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            En tant que membre actif, tu as accès à toutes les formations. Demandes-en <strong>une par jour</strong> — notre équipe te contacte sur WhatsApp.
          </p>
        </div>

        {/* Progression */}
        {!loading && (
          <div className="bg-card border border-card-border rounded-2xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary">{totalRequested}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {totalRequested} / {totalFormations} formation{totalRequested > 1 ? "s" : ""} demandée{totalRequested > 1 ? "s" : ""}
              </p>
              <div className="w-full bg-muted rounded-full h-2 mt-1.5">
                <div
                  className="bg-primary rounded-full h-2 transition-all"
                  style={{ width: `${Math.round((totalRequested / totalFormations) * 100)}%` }}
                />
              </div>
            </div>
            {requestedToday && (
              <div className="flex-shrink-0 text-right">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-1 rounded-full block whitespace-nowrap">
                  1 aujourd'hui ✓
                </span>
              </div>
            )}
          </div>
        )}

        {/* Catégories */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          CATEGORIES.map(cat => (
            <div key={cat.id} className="space-y-4">
              {/* En-tête catégorie */}
              <div className={cn("flex items-center gap-3 px-1 py-2 rounded-xl border", cat.bg, cat.border)}>
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ml-1", cat.iconBg)}>
                  <cat.icon className={cn("w-4 h-4", cat.color)} />
                </div>
                <div>
                  <span className={cn("text-sm font-bold", cat.color)}>{cat.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {cat.formations.filter(f => requestedTitles.has(f.title)).length}/{cat.formations.length}
                  </span>
                </div>
              </div>

              {/* Grille formations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cat.formations.map(f => (
                  <FormationCard
                    key={f.title}
                    formation={f}
                    category={cat}
                    isRequested={requestedTitles.has(f.title)}
                    requestedToday={!requestedTitles.has(f.title) && requestedToday}
                    onRequest={() => openDialog(f.title)}
                    sending={sending && selectedTitle === f.title}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {/* Note de bas de page */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-center">
          <Lock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
          <p className="text-xs text-muted-foreground">
            1 demande autorisée par jour · Formation livrée sur WhatsApp dans les 24h
          </p>
        </div>
      </div>

      {/* Dialog demande */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Confirmer la demande
            </DialogTitle>
            <DialogDescription className="text-left pt-1 leading-relaxed">
              <span className="font-semibold text-foreground block mb-1">"{selectedTitle}"</span>
              Notre équipe te contactera sur WhatsApp pour t'envoyer cette formation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="whatsapp-input" className="text-sm font-semibold">
                Ton numéro WhatsApp
              </Label>
              <Input
                id="whatsapp-input"
                type="tel"
                placeholder="+237 6XX XXX XXX"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                className="text-base"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Assure-toi que ce numéro reçoit bien des messages WhatsApp.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
                disabled={sending}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 font-bold"
                onClick={handleRequest}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : null}
                Confirmer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
