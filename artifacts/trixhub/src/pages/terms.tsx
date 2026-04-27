import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

export default function TermsPage() {
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Conditions d'utilisation</h1>
          <p className="text-muted-foreground text-sm mb-8">Dernière mise à jour : Avril 2026</p>

          <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">1. Acceptation des conditions</h2>
              <p>En vous inscrivant sur la plateforme TRIXHUB, vous acceptez pleinement et sans réserve les présentes conditions d'utilisation. Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser notre plateforme.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Description du service</h2>
              <p>TRIXHUB est une plateforme d'affiliation africaine permettant à ses membres de générer des revenus grâce au parrainage et à l'accomplissement de missions. La plateforme est disponible dans 18 pays africains.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Conditions d'inscription</h2>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Vous devez avoir au moins 18 ans pour vous inscrire.</li>
                <li>Un seul compte par personne est autorisé. La création de plusieurs comptes avec la même adresse e-mail ou le même numéro de téléphone est strictement interdite.</li>
                <li>Vous devez fournir des informations exactes et à jour lors de votre inscription.</li>
                <li>Vous êtes responsable de la confidentialité de votre mot de passe.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Activation du compte</h2>
              <p>Pour accéder à toutes les fonctionnalités de la plateforme et commencer à gagner des commissions, vous devez activer votre compte en payant des frais d'activation de <strong>3 600 FCFA</strong>. Ces frais sont non remboursables.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Système de parrainage et commissions</h2>
              <p>TRIXHUB utilise un système de commissions à 3 niveaux :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Niveau 1 (filleuls directs) : <strong>1 700 FCFA</strong> par activation</li>
                <li>Niveau 2 : <strong>700 FCFA</strong> par activation</li>
                <li>Niveau 3 : <strong>300 FCFA</strong> par activation</li>
              </ul>
              <p className="mt-2">Les commissions sont créditées sur votre solde uniquement lorsque votre filleul active son compte.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Retraits</h2>
              <p>Le retrait minimum est de <strong>3 000 FCFA</strong>. Les demandes de retrait sont traitées dans un délai de 24 à 72 heures ouvrables. TRIXHUB se réserve le droit de refuser toute demande de retrait en cas de suspicion de fraude.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Comportements interdits</h2>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Créer plusieurs comptes (multi-compte)</li>
                <li>Utiliser des informations fausses ou usurper l'identité d'une autre personne</li>
                <li>Toute tentative de manipulation du système de parrainage</li>
                <li>Diffuser des informations mensongères sur la plateforme</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Suspension et résiliation</h2>
              <p>TRIXHUB se réserve le droit de suspendre ou de supprimer tout compte en cas de violation des présentes conditions, sans préavis et sans remboursement des soldes éventuels.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Modifications</h2>
              <p>TRIXHUB se réserve le droit de modifier les présentes conditions à tout moment. Les modifications entrent en vigueur dès leur publication sur la plateforme. Il est de votre responsabilité de les consulter régulièrement.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. Contact</h2>
              <p>Pour toute question concernant ces conditions, vous pouvez nous contacter via notre page de support sur la plateforme.</p>
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
