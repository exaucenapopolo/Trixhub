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
          <p className="text-muted-foreground text-sm mb-8">Dernière mise à jour : Mai 2026</p>

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
              <h2 className="text-lg font-semibold text-foreground mb-2">4b. Visibilité du contact dans la communauté TRIXHUB — choix libre</h2>
              <p>
                TRIXHUB propose un système de contacts communautaires optionnel : lors de votre inscription, et à tout moment depuis votre profil, vous pouvez choisir librement de rendre votre <strong className="text-foreground">numéro WhatsApp visible</strong> aux autres membres ayant un compte activé.
              </p>
              <p className="mt-3 bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-sm">
                <strong className="text-foreground">Totalement optionnel :</strong> Partager ou non votre numéro n'a aucune incidence sur votre compte, vos soldes, vos commissions ou l'accès aux fonctionnalités de la plateforme. Vous êtes entièrement libre de votre choix, et pouvez le modifier à tout moment.
              </p>
              <p className="mt-3 font-medium text-foreground">Pourquoi choisir de partager ?</p>
              <p className="mt-1">
                TRIXHUB réunit des personnes engagées dans l'entrepreneuriat, le développement personnel et la génération de revenus. Rendre votre numéro visible vous permet de bénéficier d'opportunités au sein de cette communauté qualifiée :
              </p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Des <strong className="text-foreground">chefs d'entreprise et entrepreneurs</strong> pourront vous contacter pour des partenariats ou collaborations</li>
                <li>Des <strong className="text-foreground">professionnels</strong> partageant vos centres d'intérêt pourront vous solliciter pour des projets communs</li>
                <li>Des <strong className="text-foreground">clients potentiels</strong> sensibles aux mêmes opportunités pourront vous découvrir</li>
                <li>Chaque contact est une porte ouverte — une opportunité inattendue peut changer votre trajectoire</li>
              </ul>
              <p className="mt-3 font-medium text-foreground">Garanties :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Vos données ne sont <strong className="text-foreground">jamais vendues à des tiers externes</strong> à la plateforme</li>
                <li>Vos coordonnées ne sont <strong className="text-foreground">jamais transmises à des entreprises commerciales</strong> hors de TRIXHUB</li>
                <li>L'accès reste limité aux <strong className="text-foreground">membres ayant activé leur compte</strong> — les inscrits non activés n'y ont pas accès</li>
                <li>Vous pouvez <strong className="text-foreground">désactiver cette visibilité à tout moment</strong> depuis votre profil</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5. Système de parrainage et commissions</h2>
              <p>TRIXHUB utilise un système de commissions à 3 niveaux :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Niveau 1 (filleuls directs) : <strong className="text-foreground">1 700 FCFA</strong> par activation</li>
                <li>Niveau 2 : <strong className="text-foreground">700 FCFA</strong> par activation</li>
                <li>Niveau 3 : <strong className="text-foreground">200 FCFA</strong> par activation</li>
              </ul>
              <p className="mt-2">Les commissions sont créditées sur votre solde uniquement lorsque votre filleul active son compte en payant ses propres frais d'activation. Il n'y a aucune commission automatique sans action réelle.</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-2">5b. Option d'activation gratuite — fonctionnement et obligations</h2>
              <p>
                TRIXHUB propose une option d'<strong className="text-foreground">activation gratuite</strong> permettant à un membre de rejoindre la plateforme sans payer immédiatement les frais d'activation de 3 600 FCFA. Cette option implique des règles spécifiques que tout membre choisissant cette voie s'engage à accepter.
              </p>

              <p className="mt-3 font-medium text-foreground">Comment fonctionne l'activation gratuite :</p>
              <ul className="list-disc list-inside space-y-1.5 mt-2">
                <li>Le membre inscrit avec l'option gratuite reçoit un <strong className="text-foreground">crédit d'activation</strong> en lieu et place de commissions directement retirables. Lorsque ses propres filleuls activent leur compte, les commissions N1, N2 ou N3 qu'il aurait perçues s'accumulent dans ce crédit.</li>
                <li>Dès que ce crédit atteint <strong className="text-foreground">3 400 FCFA</strong>, son compte est <strong className="text-foreground">activé automatiquement</strong> par la plateforme, sans aucune action supplémentaire de sa part.</li>
                <li>Le membre peut également choisir à tout moment de <strong className="text-foreground">payer directement les frais d'activation</strong> (3 600 FCFA) via mobile money ou depuis son solde dépôt, ce qui active son compte immédiatement.</li>
              </ul>

              <p className="mt-3 font-medium text-foreground">Obligation de remboursement envers le parrain :</p>
              <p className="mt-1">
                L'option gratuite crée une <strong className="text-foreground">dette de 1 700 FCFA</strong> envers le parrain direct (niveau 1) du membre ayant choisi cette option. Cette dette correspond à la commission N1 que le parrain aurait normalement perçue si son filleul avait activé son compte en payant directement.
              </p>
              <p className="mt-2">
                Cette dette est remboursée automatiquement par la plateforme de la manière suivante : après l'activation du compte gratuit, la <strong className="text-foreground">première commission perçue</strong> par le membre (en tant que parrain de ses propres filleuls) est redirigée en tout ou en partie vers son parrain N1, jusqu'à ce que les 1 700 FCFA soient intégralement soldés. Le membre verra sa commission réduite en conséquence jusqu'à remboursement complet.
              </p>

              <div className="mt-3 bg-amber-500/8 border border-amber-500/25 rounded-xl p-3 space-y-1.5">
                <p className="font-semibold text-foreground text-sm">Points importants à retenir :</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Le parrain d'un compte gratuit perçoit normalement ses commissions N2 (700 FCFA) et N3 (200 FCFA) à chaque activation sous le compte gratuit, pendant toute la phase de crédit.</li>
                  <li>La commission N1 (1 700 FCFA) est versée au parrain uniquement lors du remboursement de la dette, après activation du compte gratuit.</li>
                  <li>Si le membre choisissant l'option gratuite paie directement (3 600 FCFA), aucune dette n'est créée — les commissions sont distribuées normalement à l'ensemble de la chaîne.</li>
                  <li>Le parrain ne subit aucune perte définitive : sa commission N1 est garantie, elle est simplement versée plus tard.</li>
                </ul>
              </div>

              <p className="mt-3">
                <strong className="text-foreground">Aucune tromperie n'est admise sur cette option.</strong> Tout membre qui présente l'option gratuite à de futurs filleuls doit expliquer honnêtement que cette option implique de trouver des filleuls pour accumuler le crédit nécessaire, et que la première commission perçue sera utilisée pour rembourser le parrain. Présenter cette option comme un moyen de rejoindre TRIXHUB sans jamais rien payer ni fournir d'effort constitue une violation des conditions d'utilisation.
              </p>
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
              <p>Le retrait minimum depuis le solde parrainage est de <strong className="text-foreground">3 100 FCFA</strong>, et depuis le solde activités est de <strong className="text-foreground">3 500 FCFA</strong>. Les paiements sont traités automatiquement via notre partenaire de paiement (AccountPE) en temps réel.</p>
              <p className="mt-2">
                <strong className="text-foreground">Cas où un retrait peut être refusé ou suspendu :</strong> TRIXHUB se réserve le droit de bloquer ou de refuser un retrait <strong className="text-foreground">uniquement</strong> lorsqu'une fraude avérée ou une violation grave des présentes conditions est constatée (multi-comptes, manipulation du système, fausses informations, activité frauduleuse détectée). Aucun retrait n'est refusé automatiquement ou sans raison fondée.
              </p>
              <p className="mt-2">
                En dehors de ces cas, tout membre en règle peut retirer librement les fonds présents dans son solde dans la limite des minimums applicables.
              </p>
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
