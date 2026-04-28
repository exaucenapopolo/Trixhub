import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Globe2, Users, ExternalLink, MessageCircle, CheckCircle2 } from "lucide-react";

const VPN_GROUP_URL = "https://chat.whatsapp.com/I9uoCsp8Wgz3ZRPclsP9Av";
const ASSISTANCE_PHONE = "237652205768";

export default function BonusVpnPage() {
  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 flex items-center justify-center shrink-0">
            <Shield size={24} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">VPN gratuit pour membres</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Accédez à un VPN gratuit recommandé par la communauté TRIXHUB pour sécuriser votre connexion et accéder à plus de contenus.
            </p>
          </div>
        </div>

        <Card className="border-card-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe2 size={16} className="text-primary" />
              Pourquoi utiliser un VPN ?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <p>Protégez vos données et votre identité quand vous utilisez le Wi-Fi public.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <p>Accédez à toutes les plateformes de réseaux sociaux sans restriction géographique.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <p>Améliorez votre productivité en partage de contenu sponsorisé pour vos missions.</p>
            </div>
            <div className="flex gap-3">
              <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
              <p>Communauté active : entraide, conseils et tutoriels d'installation sur tous les appareils.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-blue-500/5">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-green-500/15 flex items-center justify-center">
              <Users size={26} className="text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Rejoignez le groupe WhatsApp</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Cliquez sur le bouton ci-dessous pour rejoindre le groupe et recevoir les instructions d'installation du VPN.
              </p>
            </div>
            <Button asChild size="lg" className="gap-2 bg-green-500 hover:bg-green-600 text-white" data-testid="button-vpn-join">
              <a href={VPN_GROUP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} />
                Rejoindre le groupe VPN
                <ExternalLink size={14} className="opacity-80" />
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              Gratuit · Réservé aux membres TRIXHUB · Pas de spam
            </p>
          </CardContent>
        </Card>

        <Card className="border-card-border">
          <CardContent className="p-4 text-sm text-muted-foreground">
            <p>
              Une question ? Contactez l'assistance directement sur{" "}
              <a
                href={`https://wa.me/${ASSISTANCE_PHONE}?text=${encodeURIComponent("Bonjour, j'ai une question concernant le VPN bonus TRIXHUB.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                data-testid="link-vpn-assistance"
              >
                WhatsApp <ExternalLink size={11} />
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
