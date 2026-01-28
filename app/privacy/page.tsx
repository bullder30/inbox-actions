"use client";

import Link from "next/link";
import { ShieldCheck, Database, Trash2, Lock } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { SiteFooter } from "@/components/layout/site-footer";

export default function PrivacyPage() {
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
              Politique de confidentialité
            </h1>
            <p className="text-sm text-muted-foreground">
              Dernière mise à jour : 14 janvier 2026
            </p>
          </div>

          {/* Key points summary */}
          <div className="mb-12 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border bg-green-50/50 p-4 dark:bg-green-950/20">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-400">Gmail lecture seule</p>
                <p className="text-sm text-green-700 dark:text-green-500">Nous ne pouvons pas modifier vos emails</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-blue-50/50 p-4 dark:bg-blue-950/20">
              <Database className="mt-0.5 size-5 shrink-0 text-blue-600" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-400">Données minimales</p>
                <p className="text-sm text-blue-700 dark:text-blue-500">Contenu des emails jamais stocké</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-purple-50/50 p-4 dark:bg-purple-950/20">
              <Trash2 className="mt-0.5 size-5 shrink-0 text-purple-600" />
              <div>
                <p className="font-medium text-purple-800 dark:text-purple-400">Suppression auto</p>
                <p className="text-sm text-purple-700 dark:text-purple-500">Métadonnées supprimées chaque nuit</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border bg-orange-50/50 p-4 dark:bg-orange-950/20">
              <Lock className="mt-0.5 size-5 shrink-0 text-orange-600" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-400">Conforme RGPD</p>
                <p className="text-sm text-orange-700 dark:text-orange-500">Vos droits sont respectés</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8 text-muted-foreground">
            {/* Section 1 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                1. Responsable du traitement
              </h2>
              <p>
                Inbox Actions est édité et exploité en tant que projet personnel.
                Pour toute question relative à vos données personnelles, vous pouvez
                nous contacter via l&apos;interface de l&apos;application.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                2. Données collectées
              </h2>
              <p className="mb-4">Nous collectons les données suivantes :</p>

              <h3 className="mb-2 mt-4 font-medium text-foreground">2.1 Données de compte</h3>
              <ul className="list-inside list-disc space-y-1 pl-4">
                <li>Adresse email (via Google OAuth)</li>
                <li>Nom (si fourni par Google)</li>
                <li>Photo de profil (si fournie par Google)</li>
              </ul>

              <h3 className="mb-2 mt-4 font-medium text-foreground">2.2 Métadonnées d&apos;emails (temporaires)</h3>
              <ul className="list-inside list-disc space-y-1 pl-4">
                <li>Adresse de l&apos;expéditeur</li>
                <li>Sujet de l&apos;email</li>
                <li>Extrait court (200 caractères maximum)</li>
                <li>Date de réception</li>
                <li>Identifiant Gmail (pour lien vers l&apos;email original)</li>
              </ul>
              <p className="mt-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
                <strong>Important :</strong> Le contenu complet des emails n&apos;est JAMAIS stocké.
                Il est lu temporairement en mémoire pour l&apos;analyse, puis immédiatement oublié.
              </p>

              <h3 className="mb-2 mt-4 font-medium text-foreground">2.3 Actions créées</h3>
              <ul className="list-inside list-disc space-y-1 pl-4">
                <li>Titre de l&apos;action</li>
                <li>Type (envoyer, appeler, relancer, payer, valider)</li>
                <li>Statut (à faire, terminé, ignoré)</li>
                <li>Date d&apos;échéance (si détectée)</li>
                <li>Phrase source (extrait de l&apos;email)</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                3. Finalités du traitement
              </h2>
              <p className="mb-4">Vos données sont utilisées pour :</p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Fournir le service</strong> : Analyser vos emails et extraire les actions
                </li>
                <li>
                  <strong>Personnaliser l&apos;expérience</strong> : Afficher vos actions et préférences
                </li>
                <li>
                  <strong>Envoyer des notifications</strong> : Digest des actions en attente (si activé)
                </li>
                <li>
                  <strong>Améliorer le service</strong> : Statistiques anonymisées d&apos;utilisation
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                4. Base légale du traitement
              </h2>
              <p className="mb-4">Le traitement de vos données repose sur :</p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Votre consentement</strong> : Donné lors de la connexion OAuth Google
                </li>
                <li>
                  <strong>L&apos;exécution du contrat</strong> : Nécessaire pour fournir le service
                </li>
                <li>
                  <strong>Intérêt légitime</strong> : Amélioration et sécurité du service
                </li>
              </ul>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                5. Durée de conservation
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-4 text-left font-medium text-foreground">Type de données</th>
                      <th className="py-2 text-left font-medium text-foreground">Durée</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr>
                      <td className="py-2 pr-4">Compte utilisateur</td>
                      <td className="py-2">Jusqu&apos;à suppression du compte</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Métadonnées d&apos;emails</td>
                      <td className="py-2">24h max (suppression chaque nuit à 23h)</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Actions créées</td>
                      <td className="py-2">Jusqu&apos;à suppression par l&apos;utilisateur</td>
                    </tr>
                    <tr>
                      <td className="py-2 pr-4">Tokens OAuth</td>
                      <td className="py-2">Jusqu&apos;à déconnexion Gmail</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                6. Partage des données
              </h2>
              <p className="mb-4">
                Vos données ne sont <strong>jamais vendues</strong> à des tiers.
                Elles peuvent être partagées avec :
              </p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Google</strong> : Pour l&apos;authentification OAuth (leurs conditions s&apos;appliquent)
                </li>
                <li>
                  <strong>Hébergeur</strong> : Serveurs sécurisés pour le stockage des données
                </li>
                <li>
                  <strong>Autorités</strong> : Si requis par la loi
                </li>
              </ul>
              <p className="mt-4">
                Nous n&apos;utilisons pas vos données pour de la publicité ciblée.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                7. Sécurité des données
              </h2>
              <p className="mb-4">Nous mettons en place les mesures suivantes :</p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>Chiffrement des données en transit (HTTPS/TLS)</li>
                <li>Chiffrement des tokens OAuth stockés</li>
                <li>Accès restreint aux données (authentification requise)</li>
                <li>Isolation des données par utilisateur</li>
                <li>Suppression automatique des métadonnées anciennes</li>
              </ul>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                8. Vos droits (RGPD)
              </h2>
              <p className="mb-4">
                Conformément au Règlement Général sur la Protection des Données (RGPD),
                vous disposez des droits suivants :
              </p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Droit d&apos;accès</strong> : Obtenir une copie de vos données
                </li>
                <li>
                  <strong>Droit de rectification</strong> : Corriger vos données inexactes
                </li>
                <li>
                  <strong>Droit à l&apos;effacement</strong> : Supprimer votre compte et toutes vos données
                </li>
                <li>
                  <strong>Droit à la portabilité</strong> : Recevoir vos données dans un format standard
                </li>
                <li>
                  <strong>Droit d&apos;opposition</strong> : Vous opposer au traitement de vos données
                </li>
                <li>
                  <strong>Droit de retrait du consentement</strong> : Révoquer l&apos;accès Gmail à tout moment
                </li>
              </ul>
              <p className="mt-4">
                Pour exercer ces droits, utilisez les paramètres de l&apos;application
                ou contactez-nous directement.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                9. Cookies et traceurs
              </h2>
              <p className="mb-4">Inbox Actions utilise uniquement des cookies essentiels :</p>
              <ul className="list-inside list-disc space-y-2 pl-4">
                <li>
                  <strong>Cookie de session</strong> : Pour maintenir votre connexion
                </li>
                <li>
                  <strong>Cookie CSRF</strong> : Pour la sécurité des formulaires
                </li>
              </ul>
              <p className="mt-4">
                Nous n&apos;utilisons pas de cookies de suivi, de publicité ou d&apos;analyse tiers.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                10. Transferts internationaux
              </h2>
              <p>
                Vos données peuvent être traitées sur des serveurs situés dans l&apos;Union Européenne
                ou dans des pays offrant un niveau de protection adéquat.
                En cas de transfert vers des pays tiers, des garanties appropriées sont mises en place
                (clauses contractuelles types, etc.).
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                11. Modifications de la politique
              </h2>
              <p>
                Cette politique peut être modifiée à tout moment. La date de dernière mise à jour
                est indiquée en haut de cette page. En cas de modification substantielle,
                nous vous en informerons par email ou via l&apos;application.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="mb-4 text-xl font-semibold text-foreground">
                12. Contact et réclamations
              </h2>
              <p className="mb-4">
                Pour toute question concernant cette politique ou vos données personnelles,
                contactez-nous via la page{" "}
                <Link href="/contact" className="text-primary underline hover:no-underline">
                  Contact
                </Link>
                .
              </p>
              <p>
                Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer
                une réclamation auprès de la CNIL (Commission Nationale de l&apos;Informatique
                et des Libertés) : <a href="https://www.cnil.fr" className="text-primary underline hover:no-underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a>
              </p>
            </section>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
