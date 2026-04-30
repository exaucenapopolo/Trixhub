import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { GraduationCap, Send, Sparkles, Briefcase, Heart, TrendingUp, Loader2, CheckCircle2, ShieldCheck, Lock } from "lucide-react";
import { usePageTitle } from '@/hooks/usePageTitle';

const TOKEN_KEY = "trixhub_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type Formation = { title: string; tagline: string };

const DEV_PERSO: Formation[] = [
  { title: "Confiance en soi & Mindset gagnant", tagline: "Brisez vos blocages mentaux et osez agir." },
  { title: "Maîtrise de soi & discipline", tagline: "Tenez vos engagements et atteignez vos objectifs." },
  { title: "Productivité & gestion du temps", tagline: "Organisez vos journées pour produire plus en moins de temps." },
  { title: "Intelligence émotionnelle", tagline: "Comprenez vos émotions pour mieux décider et communiquer." },
  { title: "Gestion financière personnelle", tagline: "Maîtrisez votre argent, épargnez et gérez vos finances intelligemment." },
  { title: "Communication efficace & leadership", tagline: "Inspirez et fédérez autour de vous." },
];

const VENTES_BUSINESS: Formation[] = [
  { title: "Marketing digital pour débutants", tagline: "Les bases pour générer du trafic et des ventes en ligne." },
  { title: "Création de contenu sur les réseaux sociaux", tagline: "Captez l'attention et construisez votre audience." },
  { title: "Stratégies de vente WhatsApp Business", tagline: "Transformez vos conversations en clients fidèles." },
  { title: "Création et gestion d'une boutique en ligne", tagline: "Lancez votre e-commerce de A à Z." },
  { title: "Copywriting persuasif", tagline: "Écrivez des textes qui font vendre." },
  { title: "Closing & techniques de négociation", tagline: "Finalisez vos ventes avec confiance." },
  { title: "Construire un business rentable en Afrique", tagline: "Adaptez votre modèle aux réalités du marché africain." },
];

function FormationCard({ formation, accentColor, onRequest, sending, requested, locked, isMine }: {
  formation: Formation;
  accentColor: string;
  onRequest: (title: string) => void;
  sending: boolean;
  requested: boolean;
  locked: boolean;
  isMine: boolean;
}) {
  const disabled = sending || locked;
  const showAsRequested = requested || isMine;

  return (
    <Card
      className={`border-card-border transition-all ${isMine ? "border-primary/40 bg-primary/5" : "hover:border-primary/40 hover:shadow-sm"}`}
      data-testid={`card-formation-${formation.title.slice(0, 20)}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-lg ${accentColor} flex items-center justify-center shrink-0`}>
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-tight">{formation.title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">{formation.tagline}</p>
          </div>
        </div>
        <Button
          variant={showAsRequested ? "secondary" : "outline"}
          size="sm"
          className="w-full gap-2 hover:border-primary/50 hover:bg-primary/5"
          disabled={disabled}
          onClick={() => onRequest(formation.title)}
          data-testid={`button-request-formation-${formation.title.slice(0, 20)}`}
        >
          {isMine ? (
            <><CheckCircle2 size={14} className="text-primary" /> Vous avez choisi celle-ci</>
          ) : showAsRequested ? (
            <><CheckCircle2 size={14} className="text-primary" /> Demande envoyée</>
          ) : locked ? (
            <><Lock size={14} /> Verrouillé</>
          ) : sending ? (
            <><Loader2 size={14} className="animate-spin" /> Envoi...</>
          ) : (
            <><Send size={14} /> Demander cette formation</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FormationsPage() {
  usePageTitle('Formations');
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [sendingTitle, setSendingTitle] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  // Anti-fraude : 1 seule formation par membre. Verrouillage global.
  const alreadyRequestedTitle = user?.formationRequestedTitle ?? null;
  const formationsLocked = Boolean(user?.formationRequestedAt);

  const requestFormation = async (title: string) => {
    if (formationsLocked) {
      toast({
        title: "Demande déjà enregistrée",
        description: alreadyRequestedTitle
          ? `Vous avez déjà demandé « ${alreadyRequestedTitle} ». Une seule demande est autorisée par membre.`
          : "Vous avez déjà demandé une formation.",
        variant: "destructive",
      });
      return;
    }
    setSendingTitle(title);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/contact/formation`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title }),
        });
      } catch {
        toast({
          title: "Connexion impossible",
          description: "Vérifiez votre connexion internet et réessayez.",
          variant: "destructive",
        });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({
          title: "Échec de l'envoi",
          description: data.error || "Impossible d'envoyer la demande. Réessayez plus tard.",
          variant: "destructive",
        });
        if (res.status === 409) refreshUser();
        return;
      }
      setRequested((prev) => new Set(prev).add(title));
      refreshUser();
      toast({
        title: "Demande envoyée !",
        description: `L'équipe vous contactera concernant « ${title} ».`,
      });
    } finally {
      setSendingTitle(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-8 max-w-5xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <GraduationCap size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Formations TRIXHUB</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Développez vos compétences avec nos formations exclusives.
            </p>
            <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-primary" />
              <span><strong>1 seule formation</strong> peut être demandée par membre.</span>
            </p>
          </div>
        </div>

        {formationsLocked && alreadyRequestedTitle && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-primary">Vous avez choisi : « {alreadyRequestedTitle} »</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Notre équipe vous contactera prochainement par WhatsApp pour vous donner accès à cette formation.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section Développement personnel */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 flex items-center justify-center">
              <Heart size={18} className="text-pink-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Développement personnel</h2>
              <p className="text-xs text-muted-foreground">{DEV_PERSO.length} formations pour devenir la meilleure version de vous-même</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DEV_PERSO.map(f => (
              <FormationCard
                key={f.title}
                formation={f}
                accentColor="bg-pink-500"
                onRequest={requestFormation}
                sending={sendingTitle === f.title}
                requested={requested.has(f.title)}
                locked={formationsLocked}
                isMine={alreadyRequestedTitle === f.title}
              />
            ))}
          </div>
        </section>

        {/* Section Ventes & Business */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Briefcase size={18} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Ventes & Business</h2>
              <p className="text-xs text-muted-foreground">{VENTES_BUSINESS.length} formations pour générer plus de revenus</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VENTES_BUSINESS.map(f => (
              <FormationCard
                key={f.title}
                formation={f}
                accentColor="bg-blue-500"
                onRequest={requestFormation}
                sending={sendingTitle === f.title}
                requested={requested.has(f.title)}
                locked={formationsLocked}
                isMine={alreadyRequestedTitle === f.title}
              />
            ))}
          </div>
        </section>

        {/* Footer note */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Développez vos compétences pour multiplier vos opportunités de revenus.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chaque formation est conçue pour vous donner des résultats concrets en quelques semaines.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
