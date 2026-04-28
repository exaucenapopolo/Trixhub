import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { GraduationCap, MessageCircle, Sparkles, Briefcase, Heart, TrendingUp } from "lucide-react";

const ASSISTANCE_PHONE = "237652205768";

type Formation = { title: string; tagline: string };

const DEV_PERSO: Formation[] = [
  { title: "Confiance en soi & Mindset gagnant", tagline: "Brisez vos blocages mentaux et osez agir." },
  { title: "Maîtrise de soi & discipline", tagline: "Tenez vos engagements et atteignez vos objectifs." },
  { title: "Productivité & gestion du temps", tagline: "Organisez vos journées pour produire plus en moins de temps." },
  { title: "Intelligence émotionnelle", tagline: "Comprenez vos émotions pour mieux décider et communiquer." },
  { title: "Gestion financière personnelle", tagline: "Maîtrisez votre argent, épargnez et investissez intelligemment." },
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

function buildWhatsappLink(formationTitle: string, userName?: string | null) {
  const message = encodeURIComponent(
    `Bonjour, je suis ${userName ?? "membre TRIXHUB"} et je souhaite m'inscrire à la formation suivante :\n\n` +
    `📚 « ${formationTitle} »\n\n` +
    `Pouvez-vous me donner les détails (durée, accès, modalités) ?`
  );
  return `https://wa.me/${ASSISTANCE_PHONE}?text=${message}`;
}

function FormationCard({ formation, accentColor, userName }: { formation: Formation; accentColor: string; userName?: string | null }) {
  return (
    <Card className="border-card-border hover:border-primary/40 hover:shadow-sm transition-all" data-testid={`card-formation-${formation.title.slice(0, 20)}`}>
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
          asChild
          variant="outline"
          size="sm"
          className="w-full gap-2 hover:border-primary/50 hover:bg-primary/5"
          data-testid={`button-request-formation-${formation.title.slice(0, 20)}`}
        >
          <a href={buildWhatsappLink(formation.title, userName)} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={14} />
            Demander cette formation
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FormationsPage() {
  const { user } = useAuth();

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
              Développez vos compétences avec nos formations exclusives. Cliquez sur « Demander » pour échanger directement avec l'équipe.
            </p>
          </div>
        </div>

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
              <FormationCard key={f.title} formation={f} accentColor="bg-pink-500" userName={user?.displayName} />
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
              <FormationCard key={f.title} formation={f} accentColor="bg-blue-500" userName={user?.displayName} />
            ))}
          </div>
        </section>

        {/* Footer note */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <TrendingUp size={18} className="text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Investissez dans vos compétences pour multiplier vos revenus.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Chaque formation est conçue pour vous donner des résultats concrets en quelques semaines. L'équipe vous répondra rapidement sur WhatsApp.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
