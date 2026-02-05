"use client";

import Link from "next/link";

import { BackButton } from "@/components/shared/back-button";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { SiteFooter } from "@/components/layout/site-footer";

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="container flex-1 py-10">
        <BackButton
          fallbackUrl="/"
          className="absolute left-4 top-4 md:left-8 md:top-8"
        />

        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center space-y-2 text-center">
            <InboxActionsIcon size="lg" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Conditions d&apos;utilisation
            </h1>
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : 6 février 2026
            </p>
          </div>

          {/* Content */}
          <div className="space-y-8 text-muted-foreground">
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
                Inbox Actions est un service qui analyse vos emails pour en extraire
                des actions à réaliser. Le service fonctionne de la manière suivante :
              </p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>Connexion à votre compte email via Microsoft Graph API ou IMAP (lecture seule)</li>
                <li>Analyse automatique des emails pour détecter les demandes d&apos;action</li>
                <li>Présentation des actions détectées dans une interface dédiée</li>
                <li>Possibilité de marquer les actions comme terminées ou ignorées</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                3. Accès aux emails et permissions
              </h2>
              <p className="mb-4">
                Inbox Actions propose deux méthodes d&apos;accès aux emails :
              </p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Microsoft Graph API</strong> (Outlook, Hotmail, Microsoft 365) :
                  Permission <code>Mail.Read</code> en lecture seule.
                  Nous ne pouvons pas envoyer, modifier ou supprimer vos emails.
                </li>
                <li>
                  <strong>IMAP</strong> (Gmail, Yahoo, iCloud, Fastmail...) :
                  Connexion avec un App Password. Accès en lecture seule au dossier INBOX.
                  Les mots de passe sont chiffrés avec AES-256.
                </li>
              </ul>
              <p className="mt-4">
                Vous pouvez révoquer cet accès à tout moment depuis les paramètres
                de l&apos;application ou depuis votre fournisseur email.
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
                <li>La révocation de l&apos;accès à vos emails (Microsoft Graph ou IMAP)</li>
                <li>La suppression de toutes vos données (actions, métadonnées, credentials)</li>
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
                vous pouvez nous contacter via la page{" "}
                <Link href="/contact" className="text-primary underline hover:no-underline">
                  Contact
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
