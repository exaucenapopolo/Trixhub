import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <img src={TRIXHUB_LOGO} alt="TRIXHUB" className="h-8 w-8 rounded-lg object-contain" />
            <span className="font-bold text-foreground">TRIXHUB</span>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-10">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Politique de confidentialité</h1>
          <p className="text-muted-foreground text-sm mb-8">Dernière mise à jour : Avril 2026</p>

          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Introduction</h2>
              <p>TRIXHUB, projet de Social Succès Group en partenariat avec Social Boost Horizon, s'engage à protéger la vie privée de ses utilisateurs. Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Données collectées</h2>
              <p>Lors de votre inscription et utilisation de TRIXHUB, nous collectons :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Adresse e-mail</li>
                <li>Numéro de téléphone (WhatsApp)</li>
                <li>Pays de résidence</li>
                <li>Informations de paiement pour l'activation et les retraits</li>
                <li>Données d'utilisation et de navigation sur la plateforme</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Utilisation des données</h2>
              <p>Vos données sont utilisées pour :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Gérer votre compte et vous fournir nos services</li>
                <li>Traiter vos commissions et demandes de retrait</li>
                <li>Vous contacter concernant votre compte</li>
                <li>Prévenir la fraude et protéger la sécurité de la plateforme</li>
                <li>Améliorer nos services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Partage des données</h2>
              <p>Nous ne vendons ni ne louons vos données personnelles à des tiers. Nous pouvons partager certaines informations avec :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Nos partenaires de paiement (Orange Money, Wave, MTN, etc.) pour traiter vos transactions</li>
                <li>Les autorités compétentes si requis par la loi</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Sécurité des données</h2>
              <p>Nous mettons en œuvre des mesures de sécurité appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction. Vos mots de passe sont chiffrés et jamais stockés en clair.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Conservation des données</h2>
              <p>Nous conservons vos données aussi longtemps que votre compte est actif ou que nécessaire pour vous fournir nos services. En cas de suppression de compte, vos données peuvent être conservées pendant une durée légalement requise.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Vos droits</h2>
              <p>Vous disposez des droits suivants concernant vos données :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Accès à vos données personnelles</li>
                <li>Rectification des données inexactes</li>
                <li>Suppression de votre compte</li>
                <li>Opposition au traitement de vos données</li>
              </ul>
              <p className="mt-2">Pour exercer ces droits, contactez-nous via la plateforme.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Cookies</h2>
              <p>TRIXHUB utilise des cookies et technologies similaires pour améliorer votre expérience, mémoriser vos préférences (thème, langue) et sécuriser votre session.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Modifications</h2>
              <p>Nous pouvons mettre à jour cette politique à tout moment. Toute modification sera publiée sur cette page avec la date de mise à jour.</p>
            </section>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © 2026 TRIXHUB — Projet de Social Succès Group en partenariat avec Social Boost Horizon
        </p>
      </div>
    </div>
  );
}
