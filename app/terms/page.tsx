import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Conditions d'utilisation - Inbox Actions",
  description: "Conditions d'utilisation du service Inbox Actions",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <MaxWidthWrapper>
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Mail className="size-6 text-primary" />
              <span className="text-xl font-bold">Inbox Actions</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="gap-2">
                <ArrowLeft className="size-4" />
                Retour
              </Button>
            </Link>
          </div>
        </MaxWidthWrapper>
      </header>

      {/* Content */}
      <main className="flex-1 py-12">
        <MaxWidthWrapper>
          <div className="mx-auto max-w-3xl">
            <h1 className="font-heading text-3xl font-bold sm:text-4xl">
              Conditions d&apos;utilisation
            </h1>
            <p className="mt-2 text-muted-foreground">
              Dernière mise à jour : 14 janvier 2026
            </p>

            <div className="mt-8 space-y-8 text-muted-foreground">
              {/* Section 1 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  1. Acceptation des conditions
                </h2>
                <p>
                  En utilisant Inbox Actions, vous acceptez les présentes conditions d&apos;utilisation.
                  Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser le service.
                </p>
              </section>

              {/* Section 2 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  2. Description du service
                </h2>
                <p className="mb-4">
                  Inbox Actions est un service qui analyse vos emails Gmail pour en extraire
                  des actions à réaliser. Le service fonctionne de la manière suivante :
                </p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>Connexion à votre compte Gmail via OAuth 2.0 (lecture seule)</li>
                  <li>Analyse automatique des emails pour détecter les demandes d&apos;action</li>
                  <li>Présentation des actions détectées dans une interface dédiée</li>
                  <li>Possibilité de marquer les actions comme terminées ou ignorées</li>
                </ul>
              </section>

              {/* Section 3 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  3. Accès Gmail et permissions
                </h2>
                <p className="mb-4">
                  Inbox Actions utilise l&apos;API Gmail avec les permissions suivantes :
                </p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>
                    <strong>gmail.readonly</strong> : Lecture seule de vos emails.
                    Nous ne pouvons pas envoyer, modifier ou supprimer vos emails.
                  </li>
                </ul>
                <p className="mt-4">
                  Vous pouvez révoquer cet accès à tout moment depuis les paramètres
                  de votre compte Google ou directement dans l&apos;application.
                </p>
              </section>

              {/* Section 4 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  4. Stockage des données
                </h2>
                <p className="mb-4">
                  Nous appliquons le principe de minimisation des données :
                </p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>Le contenu complet des emails n&apos;est <strong>jamais stocké</strong></li>
                  <li>Seules les métadonnées sont conservées : expéditeur, sujet, extrait court (200 caractères max)</li>
                  <li>Les métadonnées sont automatiquement supprimées après 3 jours</li>
                  <li>Les actions créées sont conservées jusqu&apos;à leur suppression par l&apos;utilisateur</li>
                </ul>
              </section>

              {/* Section 5 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  5. Responsabilités de l&apos;utilisateur
                </h2>
                <p className="mb-4">En utilisant Inbox Actions, vous vous engagez à :</p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>Fournir des informations exactes lors de l&apos;inscription</li>
                  <li>Maintenir la confidentialité de vos identifiants de connexion</li>
                  <li>Ne pas utiliser le service à des fins illégales</li>
                  <li>Ne pas tenter de contourner les mesures de sécurité</li>
                </ul>
              </section>

              {/* Section 6 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  6. Limitation de responsabilité
                </h2>
                <p className="mb-4">
                  Inbox Actions est fourni &ldquo;tel quel&rdquo;. Nous ne garantissons pas :
                </p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>Que toutes les actions de vos emails seront détectées</li>
                  <li>L&apos;exactitude des dates d&apos;échéance extraites</li>
                  <li>La disponibilité continue du service sans interruption</li>
                </ul>
                <p className="mt-4">
                  Notre philosophie est claire : <strong>&ldquo;Mieux vaut manquer une action que créer un faux positif.&rdquo;</strong>
                  Vous restez responsable de la vérification de vos actions importantes.
                </p>
              </section>

              {/* Section 7 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  7. Propriété intellectuelle
                </h2>
                <p>
                  Le service Inbox Actions, son interface, son code et son design sont protégés
                  par le droit d&apos;auteur. Vous n&apos;êtes pas autorisé à copier, modifier ou
                  distribuer tout ou partie du service sans autorisation préalable.
                </p>
              </section>

              {/* Section 8 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  8. Résiliation
                </h2>
                <p className="mb-4">
                  Vous pouvez supprimer votre compte à tout moment. La suppression entraîne :
                </p>
                <ul className="list-inside list-disc space-y-2 pl-4">
                  <li>La révocation de l&apos;accès Gmail</li>
                  <li>La suppression de toutes vos données (actions, métadonnées)</li>
                  <li>La suppression de votre compte utilisateur</li>
                </ul>
                <p className="mt-4">
                  Nous nous réservons le droit de suspendre ou résilier votre accès
                  en cas de violation des présentes conditions.
                </p>
              </section>

              {/* Section 9 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  9. Modifications des conditions
                </h2>
                <p>
                  Nous pouvons modifier ces conditions à tout moment. Les modifications
                  seront effectives dès leur publication sur cette page. Votre utilisation
                  continue du service après publication vaut acceptation des nouvelles conditions.
                </p>
              </section>

              {/* Section 10 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  10. Droit applicable
                </h2>
                <p>
                  Les présentes conditions sont régies par le droit français.
                  Tout litige sera soumis aux tribunaux compétents de Paris, France.
                </p>
              </section>

              {/* Section 11 */}
              <section>
                <h2 className="mb-4 text-xl font-semibold text-foreground">
                  11. Contact
                </h2>
                <p>
                  Pour toute question concernant ces conditions d&apos;utilisation,
                  vous pouvez nous contacter via l&apos;interface de l&apos;application
                  ou par email à l&apos;adresse indiquée dans les paramètres.
                </p>
              </section>
            </div>

            {/* Back link */}
            <div className="mt-12 border-t pt-8">
              <Link href="/">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="size-4" />
                  Retour à l&apos;accueil
                </Button>
              </Link>
            </div>
          </div>
        </MaxWidthWrapper>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <MaxWidthWrapper>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              <span className="font-semibold">Inbox Actions</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="text-foreground">Conditions d&apos;utilisation</span>
              <Link href="/privacy" className="hover:text-foreground">
                Confidentialité
              </Link>
            </div>
          </div>
        </MaxWidthWrapper>
      </footer>
    </div>
  );
}
