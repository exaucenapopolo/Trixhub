import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from '@/hooks/usePageTitle';

const TRIXHUB_LOGO = "https://raw.githubusercontent.com/exaucenapopolo/SOCIAL-SUCC-S-GROUP-/refs/heads/main/Tof/Logo%20Initiales%20Typographique%20Vintage%20Noir%20Beige%20Rouge_20260423_215340_0000.png";

export default function TermsPage() {
  usePageTitle("Conditions d'utilisation");
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
              <h2 className="text-lg font-semibold text-foreground mb-2">2. Nature de la plateforme</h2>
              <p>
                TRIXHUB est une <strong className="text-foreground">plateforme de marketing d'affiliation</strong> opérant en Afrique.
                Elle met à la disposition de ses membres un ensemble d'outils et de ressources pour développer leurs compétences et générer des revenus grâce à leurs efforts personnels.
              </p>
              <p className="mt-2">
                <strong className="text-foreground">TRIXHUB n'est pas une plateforme d'investissement.</strong> Aucune somme d'argent n'est placée, investie ou mise en jeu en vue d'un rendement garanti. Les membres ne versent pas de fonds dans le but de les faire fructifier passivement. Les gains sur TRIXHUB sont exclusivement le fruit du travail, de l'engagement et de la régularité de chaque membre.
              </p>
              <p className="mt-2">
                La plateforme est disponible dans 18 pays africains.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">3. Frais d'activation du compte — Ce que vous payez réellement</h2>
              <p>
                Pour accéder aux fonctionnalités complètes de TRIXHUB, chaque membre doit s'acquitter de <strong className="text-foreground">frais d'activation unique de 3 600 FCFA</strong>. Ces frais sont définitifs et non remboursables.
              </p>
              <p className="mt-2 font-medium text-foreground">⚠️ Point important : vous ne payez pas ces 3 600 FCFA pour accéder simplement à une plateforme, pour gagner de l'argent garanti, ni pour réaliser des activités rémunérées.</p>
              <p className="mt-2">Ces frais vous donnent accès à un <strong className="text-foreground">pack complet</strong> composé de :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li><strong className="text-foreground">Formations exclusives</strong> — un catalogue de formations pratiques sur le développement personnel, le marketing digital, la gestion financière, la vente et l'entrepreneuriat.</li>
                <li><strong className="text-foreground">Accès au système de parrainage</strong> — un lien de parrainage unique permettant de toucher des commissions lorsque vos filleuls activent leur compte.</li>
                <li><strong className="text-foreground">Cadeaux & bonus exclusifs</strong> — abonnement Canal+, compte Canva Pro, VPN offert par l'équipe, et autres bonus à valeur réelle.</li>
                <li><strong className="text-foreground">Accès aux activités de progression</strong> — un espace d'activités quotidiennes (vidéos, quiz, découverte de produits partenaires) permettant d'accumuler des points convertibles.</li>
              </ul>
              <p className="mt-3">
                En résumé : vous payez pour un <strong className="text-foreground">pack d'accès</strong>, non pour une promesse de gains. Les revenus que vous pourrez générer dépendent entièrement de votre implication.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">4. Conditions d'inscription</h2>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Vous devez avoir au moins 18 ans pour vous inscrire.</li>
                <li>Un seul compte par personne est autorisé. La création de plusieurs comptes avec la même adresse e-mail ou le même numéro de téléphone est strictement interdite.</li>
                <li>Vous devez fournir des informations exactes et à jour lors de votre inscription.</li>
                <li>Vous êtes responsable de la confidentialité de votre mot de passe.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Système de parrainage et commissions</h2>
              <p>TRIXHUB utilise un système de commissions à 3 niveaux :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Niveau 1 (filleuls directs) : <strong className="text-foreground">1 700 FCFA</strong> par activation</li>
                <li>Niveau 2 : <strong className="text-foreground">700 FCFA</strong> par activation</li>
                <li>Niveau 3 : <strong className="text-foreground">300 FCFA</strong> par activation</li>
              </ul>
              <p className="mt-2">Les commissions sont créditées sur votre solde uniquement lorsque votre filleul active son compte en payant ses propres frais d'activation. Il n'y a aucune commission automatique sans action réelle.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">6. Activités de progression et points</h2>
              <p>
                TRIXHUB propose des activités quotidiennes (visionnage de vidéos, quiz, découverte de produits partenaires, activités surprise). Ces activités rapportent des <strong className="text-foreground">points de progression</strong>.
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li><strong className="text-foreground">1 point = 1 FCFA</strong></li>
                <li>La conversion des points en argent est possible chaque dimanche, à condition d'avoir accumulé au minimum <strong className="text-foreground">700 points</strong> dans la semaine.</li>
                <li>La conversion n'est pas automatique : elle nécessite une action volontaire du membre.</li>
              </ul>
              <p className="mt-2">
                <strong className="text-foreground">Les gains liés aux activités ne sont pas garantis.</strong> Ils dépendent de la régularité de participation, du score obtenu et du respect des critères de validation définis par la plateforme. Une activité mal réalisée ou non validée ne rapporte aucun point.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">7. Absence de garantie de gains</h2>
              <p>
                TRIXHUB ne garantit aucun revenu minimum ni aucun retour sur les frais d'activation. Les gains réalisés sur la plateforme dépendent exclusivement des efforts, de la régularité et de l'engagement de chaque membre. Il est faux de penser que l'activation du compte suffit à générer de l'argent sans rien faire.
              </p>
              <p className="mt-2">
                Pour gagner sur TRIXHUB, vous devez :
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Parrainer activement et accompagner vos filleuls à activer leur compte.</li>
                <li>Participer régulièrement aux activités quotidiennes.</li>
                <li>Exploiter les formations pour développer vos compétences et créer des opportunités.</li>
                <li>Revendre les bonus (Canal+, formations, etc.) si vous choisissez cette voie.</li>
              </ul>
              <p className="mt-2">
                TRIXHUB n'est pas un système où l'argent vient automatiquement. C'est une plateforme où vous travaillez pour gagner.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">8. Retraits</h2>
              <p>Le retrait minimum depuis le solde parrainage est de <strong className="text-foreground">3 000 FCFA</strong>, et depuis le solde activités est de <strong className="text-foreground">3 500 FCFA</strong>. Les demandes de retrait sont vérifiées par notre équipe avant tout paiement. TRIXHUB se réserve le droit de refuser toute demande de retrait en cas de suspicion de fraude ou de non-respect des présentes conditions.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9. Comportements interdits</h2>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Créer plusieurs comptes (multi-compte)</li>
                <li>Utiliser des informations fausses ou usurper l'identité d'une autre personne</li>
                <li>Toute tentative de manipulation du système de parrainage ou des activités</li>
                <li>Diffuser des informations mensongères sur la plateforme, notamment promettre des gains garantis à de futurs membres</li>
                <li>Présenter TRIXHUB comme une plateforme d'investissement ou promettre un retour sur investissement</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">9b. Recrutement honnête — obligation de vérité</h2>
              <p>
                Tout membre qui parraine d'autres personnes s'engage à leur présenter TRIXHUB de manière <strong className="text-foreground">honnête, complète et sans exagération</strong>. Le parrainage sur TRIXHUB n'est pas un droit de tromper autrui pour encaisser une commission.
              </p>
              <p className="mt-2 font-medium text-foreground">Sont strictement interdits lors du recrutement de filleuls :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Promettre des gains faciles, rapides ou en grande quantité sans effort réel</li>
                <li>Affirmer que la plateforme rémunère automatiquement sans travail ni engagement</li>
                <li>Mentir sur le montant, la fréquence ou la garantie des gains potentiels</li>
                <li>Exercer une pression, un harcèlement ou une manipulation sur une personne pour la forcer à s'inscrire ou à activer son compte</li>
                <li>Faire croire qu'il s'agit d'un système d'enrichissement rapide ou d'un investissement</li>
                <li>Omettre volontairement d'informer un futur membre que les gains dépendent de son propre travail et ne sont pas garantis</li>
              </ul>
              <p className="mt-3">
                <strong className="text-foreground">Le rôle d'un bon parrain sur TRIXHUB est d'expliquer clairement la plateforme</strong> : ce qu'elle offre, comment elle fonctionne, et ce que le futur membre devra faire pour gagner. Un membre trompé est un membre déçu — et cela nuit à toute la communauté.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">10. Suspension et résiliation</h2>
              <p>
                TRIXHUB se réserve le droit de <strong className="text-foreground">suspendre ou de supprimer définitivement</strong> tout compte en cas de violation des présentes conditions, et notamment en cas de recrutement frauduleux ou de tromperie envers d'autres membres.
              </p>
              <p className="mt-2">
                <strong className="text-foreground">⚠️ La présence d'un solde dans le compte ne protège pas contre la suspension.</strong> En cas de violation avérée, le compte peut être fermé immédiatement, sans préavis, et sans remboursement d'aucun solde (parrainage, activités, bonus ou autre). Les gains accumulés via des pratiques frauduleuses sont définitivement perdus.
              </p>
              <p className="mt-2">
                Les signalements de membres abusifs peuvent être effectués depuis la page de support de la plateforme. TRIXHUB s'engage à traiter chaque signalement sérieusement et à protéger ses membres contre les recruteurs malhonnêtes.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">11. Modifications</h2>
              <p>TRIXHUB se réserve le droit de modifier les présentes conditions à tout moment. Les modifications entrent en vigueur dès leur publication sur la plateforme. Il est de votre responsabilité de les consulter régulièrement.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">12. Contact</h2>
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
