import { Metadata } from "next";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { constructMetadata } from "@/lib/utils";

export const metadata: Metadata = constructMetadata({
  title: "Inbox Actions — Transformez vos emails en actions concrètes",
  description:
    "Inbox Actions extrait automatiquement les tâches de vos emails Gmail, Outlook et IMAP. Détection déterministe, RGPD, lecture seule. Gratuit, sans carte bancaire.",
});

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Quels services email sont supportés ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Inbox Actions supporte Microsoft Outlook, Hotmail et Microsoft 365 via l'API Graph (connexion OAuth en un clic), ainsi que Gmail, Yahoo, iCloud, Fastmail et ProtonMail via IMAP avec App Password.",
      },
    },
    {
      "@type": "Question",
      name: "Le contenu de mes emails est-il stocké ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non. Le corps des emails est analysé une seule fois pour détecter les actions, puis immédiatement oublié. Seules les métadonnées minimales sont conservées : expéditeur, sujet, et un extrait de 200 caractères maximum. Inbox Actions est conforme au RGPD.",
      },
    },
    {
      "@type": "Question",
      name: "Inbox Actions utilise-t-il de l'intelligence artificielle ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Non. Inbox Actions utilise des règles déterministes simples et explicables pour détecter les actions. Si une phrase est ambiguë, aucune action n'est créée. Vous savez toujours pourquoi une action a été détectée ou ignorée.",
      },
    },
    {
      "@type": "Question",
      name: "Quels types d'actions sont détectés ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Cinq types d'actions sont détectés dans les emails en français : Envoyer (SEND), Appeler (CALL), Relancer (FOLLOW_UP), Payer (PAY) et Valider (VALIDATE).",
      },
    },
    {
      "@type": "Question",
      name: "Inbox Actions est-il gratuit ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, Inbox Actions est gratuit. Aucune carte bancaire n'est requise pour commencer.",
      },
    },
    {
      "@type": "Question",
      name: "Est-ce conforme au RGPD ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui. Inbox Actions est conforme au RGPD : accès en lecture seule, aucun contenu d'email stocké, chiffrement AES-256 des credentials IMAP, et vous pouvez supprimer toutes vos données à tout moment.",
      },
    },
  ],
};
import Link from "next/link";
import { ArrowRight, Mail, Eye, AlertCircle, ShieldCheck, CheckCircle2, Clock, XCircle, Bell, Github, LogIn, UserPlus, Server, Zap, Filter, CalendarClock } from "lucide-react";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { Button } from "@/components/ui/button";
import { HeaderSection } from "@/components/shared/header-section";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import packageJson from "@/package.json";

export default async function HomePage() {
  const session = await auth();

  // Si l'utilisateur est déjà authentifié, rediriger vers le dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Header / Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <MaxWidthWrapper>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <InboxActionsIcon size="md" />
              <span className="text-xl font-bold">Inbox Actions</span>
            </div>
            <nav className="flex items-center gap-1 sm:gap-4">
              <Link href="/login">
                <Button variant="ghost" size="icon" className="size-8 sm:hidden">
                  <LogIn className="size-4" />
                  <span className="sr-only">Connexion</span>
                </Button>
                <Button variant="ghost" className="hidden h-9 px-4 text-sm sm:inline-flex">
                  Connexion
                </Button>
              </Link>
              <Link href="/register">
                <Button size="icon" className="size-8 sm:hidden">
                  <UserPlus className="size-4" />
                  <span className="sr-only">Commencer</span>
                </Button>
                <Button className="hidden h-9 px-4 text-sm sm:inline-flex">
                  Commencer gratuitement
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </Link>
            </nav>
          </div>
        </MaxWidthWrapper>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b py-12 lg:py-20">
        <MaxWidthWrapper>
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
                v{packageJson.version} MVP
              </span>
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                Emails en français uniquement
              </span>
            </div>
            <div className="mb-6 inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
              <Eye className="mr-2 size-4 text-blue-500" />
              Zéro stress • Zéro doute • Toujours explicable
            </div>

            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Vos emails transformés en{" "}
              <span className="text-gradient_indigo-purple">actions claires</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              Inbox Actions détecte les tâches explicites dans vos emails et vous les présente clairement.
              Vous savez toujours ce qui a été analysé, ce qui a été ignoré, et pourquoi.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  <Mail className="mr-2 size-5" />
                  Commencer gratuitement
                </Button>
              </Link>
              <Link href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Comment ça marche ?
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                  <Zap className="size-4 text-blue-500" />
                  <span>Microsoft Outlook (Graph API)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="size-4 text-purple-500" />
                  <span>Gmail, Yahoo, iCloud, Fastmail (IMAP)</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="size-4 text-green-500" />
                <span>Plusieurs boîtes mail simultanées — Microsoft et IMAP au choix</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-green-600" />
                <span>Lecture seule • RGPD • Chiffrement AES-256</span>
              </div>
              <p className="text-xs">
                Préfère manquer une action que vous stresser avec un doute
              </p>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Transparency Promise Section */}
      <section className="border-b bg-muted/30 py-16">
        <MaxWidthWrapper>
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal variant="fade-up">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                Notre promesse : Zéro zone grise
              </h2>
              <p className="mt-4 text-muted-foreground">
                Inbox Actions ne vous cache jamais rien. Vous voyez toujours :
              </p>
            </ScrollReveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <ScrollReveal variant="fade-up" delay={0}>
                <div className="rounded-lg border bg-card p-4">
                  <CheckCircle2 className="mx-auto size-8 text-green-600" />
                  <p className="mt-2 font-medium">Quand le dernier scan a eu lieu</p>
                </div>
              </ScrollReveal>
              <ScrollReveal variant="fade-up" delay={100}>
                <div className="rounded-lg border bg-card p-4">
                  <CheckCircle2 className="mx-auto size-8 text-green-600" />
                  <p className="mt-2 font-medium">Combien d&apos;emails ont été analysés</p>
                </div>
              </ScrollReveal>
              <ScrollReveal variant="fade-up" delay={200}>
                <div className="rounded-lg border bg-card p-4">
                  <CheckCircle2 className="mx-auto size-8 text-green-600" />
                  <p className="mt-2 font-medium">Pourquoi certains ont été ignorés</p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Features Section */}
      <section id="features" className="border-b py-20">
        <MaxWidthWrapper>
          <HeaderSection
            label="Fonctionnalités"
            title="Simplicité et transparence avant tout"
            subtitle="Inbox Actions fait exactement ce qu'il dit, ni plus ni moins."
          />

          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Eye className="size-6 text-blue-500" />, bg: "bg-blue-500/10", title: "Détection déterministe", body: <>Règles simples et explicables. Le système détecte 5 types d&apos;actions : envoyer, appeler, suivre, payer, valider.<strong className="mt-2 block">Si c&apos;est ambigu, on ne devine pas.</strong></> },
              { icon: <AlertCircle className="size-6 text-purple-500" />, bg: "bg-purple-500/10", title: "Corrigez immédiatement", body: <>Le système a manqué une action ? Un bouton <strong>&ldquo;Il manque une action&rdquo;</strong> accessible partout. Créez manuellement en 3 clics, sans justification.</> },
              { icon: <CheckCircle2 className="size-6 text-green-500" />, bg: "bg-green-500/10", title: "Phrase source visible", body: <>Chaque action affiche la phrase exacte de l&apos;email d&apos;origine. Vous comprenez toujours pourquoi le système a détecté cette action.</> },
              { icon: <Clock className="size-6 text-orange-500" />, bg: "bg-orange-500/10", title: "Synchronisation à la demande", body: <>Bouton de synchronisation manuelle directement sur le tableau de bord. Pas besoin d&apos;attendre le scan automatique.<strong className="mt-2 block">Idéal pour tester ou forcer une mise à jour.</strong></> },
              { icon: <Bell className="size-6 text-red-500" />, bg: "bg-red-500/10", title: "Urgence visuelle immédiate", body: <>Actions en retard en <span className="rounded bg-red-100 px-1 text-red-800 dark:bg-red-900/30 dark:text-red-400">rouge</span>, urgentes (&lt;24h) en <span className="rounded bg-orange-100 px-1 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">orange</span>.<strong className="mt-2 block">Impossible de manquer une échéance.</strong></> },
              { icon: <Filter className="size-6 text-amber-500" />, bg: "bg-amber-500/10", title: "Exclusions personnalisées", body: <>Excluez un expéditeur ou domaine via <strong>···</strong> sur une carte d&apos;action. Ajoutez des mots-clés de sujet depuis les Paramètres. Les actions existantes liées sont supprimées automatiquement.<strong className="mt-2 block">Newsletters et robots : exclus automatiquement sans configuration.</strong></> },
              { icon: <Zap className="size-6 text-blue-500" />, bg: "bg-blue-500/10", title: "Microsoft Outlook sans friction", body: <>Connectez un ou plusieurs comptes Microsoft en quelques clics.<strong className="mt-2 block">Microsoft Graph API : aucune configuration IMAP requise.</strong></> },
              { icon: <Server className="size-6 text-purple-500" />, bg: "bg-purple-500/10", title: "IMAP universel, multi-boîtes", body: <>Gmail, Yahoo, iCloud, Fastmail, ProtonMail... Ajoutez autant de boîtes que nécessaire.<br />Connexion via <strong>IMAP avec App Password</strong> : simple, universel, sécurisé.<strong className="mt-2 block">Vos mots de passe sont chiffrés AES-256.</strong></> },
              { icon: <CalendarClock className="size-6 text-sky-500" />, bg: "bg-sky-500/10", title: "Planification intégrée", body: <>Planifiez une action en un clic depuis la carte. Les actions planifiées pour aujourd'hui restent visibles dans <strong>Aujourd'hui</strong> ; celles pour plus tard apparaissent dans <strong>À venir</strong> — sans cron, sans configuration.<strong className="mt-2 block">La bascule est automatique à minuit.</strong></> },
              { icon: <ShieldCheck className="size-6 text-indigo-500" />, bg: "bg-indigo-500/10", title: "Email = référence optionnelle", body: <>Toutes vos actions sont gérables ici. Votre boîte mail n&apos;est qu&apos;une option pour vérifier le contexte. Vous ne retournez jamais dans votre boîte mail pour travailler.</> },
            ].map(({ icon, bg, title, body }, i) => (
              <ScrollReveal key={title} variant="fade-up" delay={(i % 3) * 80}>
                <div className="flex h-full flex-col rounded-lg border bg-card p-6 shadow-sm">
                  <div className={`mb-4 flex size-12 items-center justify-center rounded-lg ${bg}`}>
                    {icon}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      {/* How It Works Section */}
      <section className="border-b bg-muted/30 py-20">
        <MaxWidthWrapper>
          <HeaderSection
            label="Processus"
            title="Comment ça marche en détail"
            subtitle="Pas de magie. Juste des règles claires et du bon sens."
          />

          <div className="mt-16 space-y-8">
            {[
              { n: 1, title: "Connectez vos boîtes mail", body: <><p className="text-muted-foreground">Ajoutez une ou plusieurs boîtes depuis les Paramètres — Microsoft et IMAP peuvent coexister.</p><p className="mt-2 text-muted-foreground"><strong>Microsoft (Outlook, Hotmail, M365) :</strong> connexion OAuth en un clic, aucune configuration.<br /><strong>Autres providers (Gmail, Yahoo, iCloud…) :</strong> configurez IMAP avec un <strong>App Password</strong>.</p><p className="mt-2 text-xs text-muted-foreground">Nous ne stockons jamais le contenu complet des emails. Seulement : expéditeur, sujet, extrait court (200 caractères max).</p></> },
              { n: 2, title: "Scan automatique ou manuel", body: <p className="text-muted-foreground">Scan quotidien automatique à 8h00, ou lancez une synchronisation manuelle à tout moment depuis le tableau de bord.<strong className="mt-2 block">Sont automatiquement exclus :</strong>newsletters, notifications automatiques, emails no-reply, footers de désinscription.<strong className="mt-2 block">Exclusions personnalisées :</strong>Excluez un expéditeur ou domaine via <strong>···</strong> sur une carte d&apos;action, ou ajoutez un mot-clé de sujet depuis les Paramètres. Les actions existantes liées sont supprimées immédiatement.</p> },
              { n: 3, title: "Détection par règles simples", body: <p className="text-muted-foreground">Le système cherche des phrases comme : &ldquo;peux-tu envoyer...&rdquo;, &ldquo;merci de rappeler...&rdquo;, &ldquo;n&apos;oublie pas de...&rdquo;.<strong className="mt-2 block">Règle d&apos;or :</strong> Si c&apos;est conditionnel (&ldquo;si tu peux&rdquo;, &ldquo;éventuellement&rdquo;), aucune action n&apos;est créée.</p> },
              { n: 4, title: "Vous gérez, corrigez, complétez", body: <p className="text-muted-foreground">Marquez comme <strong>Fait</strong>, <strong>Ignorer</strong>, ou cliquez <strong>Il manque une action</strong> pour ajouter manuellement. Le système apprend de rien, il reste simple et prévisible.</p> },
            ].map(({ n, title, body }, i) => (
              <ScrollReveal key={n} variant="fade-up" delay={i * 80}>
                <div className="flex gap-6 rounded-lg border bg-card p-6 shadow-sm">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {n}
                  </div>
                  <div><h3 className="mb-2 text-xl font-semibold">{title}</h3>{body}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Examples Section */}
      <section className="border-b py-20">
        <MaxWidthWrapper>
          <HeaderSection
            label="Exemples"
            title="Ce que le système détecte (et ne détecte pas)"
            subtitle="Transparence totale sur les capacités et limites."
          />

          <div className="mt-16 space-y-8">
            <ScrollReveal variant="fade-up" delay={0}>
              <div className="rounded-lg border-2 border-green-500/20 bg-green-50/50 p-6 dark:bg-green-950/20">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle2 className="size-4" />
                  DÉTECTÉ (Type : SEND)
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Email reçu :</span>
                  <p className="mt-2 italic text-muted-foreground">
                    &ldquo;Bonjour David, <span className="rounded bg-yellow-100 px-1 font-semibold dark:bg-yellow-900/30">peux-tu m&apos;envoyer le rapport financier de Q4</span> avant vendredi ? Merci !&rdquo;
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Action créée :</span>
                  <div className="mt-2 rounded-lg border border-orange-300 bg-orange-50/50 p-4 dark:border-orange-700 dark:bg-orange-950/30">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">📤 Envoyer le rapport financier de Q4</p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Envoyer</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded bg-orange-100 px-2 py-1 text-sm font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                      <Clock className="size-4" />
                      ⏰ Urgent : Vendredi
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">De : client@example.com</p>
                    <p className="mt-1 text-xs text-muted-foreground">Phrase source : &ldquo;peux-tu m&apos;envoyer le rapport financier de Q4&rdquo;</p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-green-700 dark:text-green-400">
                  ✅ <strong>Pourquoi détecté :</strong> Demande explicite (&ldquo;peux-tu envoyer&rdquo;) + objet clair + échéance précise.
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0}>
              <div className="rounded-lg border-2 border-orange-500/20 bg-orange-50/50 p-6 dark:bg-orange-950/20">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <XCircle className="size-4" />
                  NON DÉTECTÉ (Conditionnel)
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Email reçu :</span>
                  <p className="mt-2 italic text-muted-foreground">
                    &ldquo;Salut, <span className="rounded bg-orange-100 px-1 dark:bg-orange-900/30">si tu as le temps, tu pourrais m&apos;envoyer le document</span> ? Pas urgent.&rdquo;
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Résultat :</span>
                  <div className="mt-2 rounded-lg border border-orange-200 bg-card p-4 dark:border-orange-800">
                    <p className="font-medium text-orange-700 dark:text-orange-400">Aucune action créée</p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-orange-700 dark:text-orange-400">
                  ⚠️ <strong>Pourquoi ignoré :</strong> Phrase conditionnelle (&ldquo;si tu as le temps&rdquo;). Le système ne devine pas si c&apos;est vraiment important.
                  <br /><strong>Solution :</strong> Cliquez &ldquo;Il manque une action&rdquo; si vous voulez la suivre.
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0}>
              <div className="rounded-lg border-2 border-green-500/20 bg-green-50/50 p-6 dark:bg-green-950/20">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <CheckCircle2 className="size-4" />
                  DÉTECTÉ (Type : CALL)
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Email reçu :</span>
                  <p className="mt-2 italic text-muted-foreground">
                    &ldquo;Suite à notre échange, <span className="rounded bg-yellow-100 px-1 font-semibold dark:bg-yellow-900/30">merci de me rappeler demain matin</span> pour finaliser.&rdquo;
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Action créée :</span>
                  <div className="mt-2 rounded-lg border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">📞 Rappeler pour finaliser</p>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">Appeler</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      <Clock className="size-4" />
                      Échéance : Demain matin
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">De : partenaire@example.com</p>
                    <p className="mt-1 text-xs text-muted-foreground">Phrase source : &ldquo;merci de me rappeler demain matin&rdquo;</p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-green-700 dark:text-green-400">
                  ✅ <strong>Pourquoi détecté :</strong> Demande explicite (&ldquo;merci de rappeler&rdquo;) + échéance claire (&ldquo;demain matin&rdquo;).
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0}>
              <div className="rounded-lg border-2 border-red-500/20 bg-red-50/50 p-6 dark:bg-red-950/20">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  <XCircle className="size-4" />
                  EXCLU AUTOMATIQUEMENT (Newsletter)
                </div>
                <div className="mb-4">
                  <span className="font-semibold">Email reçu :</span>
                  <p className="mt-2 italic text-muted-foreground">
                    De : newsletter@example.com<br />
                    &ldquo;Découvrez nos nouvelles fonctionnalités ! Cliquez ici pour en savoir plus.&rdquo;
                  </p>
                </div>
                <div>
                  <span className="font-semibold">Résultat :</span>
                  <div className="mt-2 rounded-lg border border-red-200 bg-card p-4 dark:border-red-800">
                    <p className="font-medium text-red-700 dark:text-red-400">Email ignoré, non analysé</p>
                  </div>
                </div>
                <div className="mt-4 text-sm text-red-700 dark:text-red-400">
                  🚫 <strong>Pourquoi exclu :</strong> Expéditeur = newsletter@. Les emails marketing sont automatiquement exclus.
                  <br /><strong>Exclusions manuelles :</strong> Cliquez <strong>···</strong> sur une action card pour exclure un expéditeur, un domaine entier ou un mot-clé de sujet. Les actions existantes sont supprimées instantanément.
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal variant="fade-up" delay={0}>
            <div className="mt-12 rounded-lg border border-blue-200 bg-blue-50/50 p-6 dark:border-blue-800 dark:bg-blue-950/20">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-100">
                <AlertCircle className="size-5" />
                Notre philosophie
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Mieux vaut manquer une action que vous stresser avec un faux positif.</strong><br />
                Si le système hésite, il ne crée rien. Vous cliquez simplement &ldquo;Il manque une action&rdquo; en 3 secondes.
              </p>
            </div>
          </ScrollReveal>
        </MaxWidthWrapper>
      </section>

      {/* What We Don't Do Section */}
      <section className="border-b bg-muted/30 py-20">
        <MaxWidthWrapper>
          <HeaderSection
            label="Transparence"
            title="Ce que nous NE faisons PAS"
            subtitle="Aussi important que ce que nous faisons."
          />

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {[
              { title: "Pas d'IA « intelligente »", body: "Nous n'utilisons pas d'intelligence artificielle opaque pour « deviner » vos intentions. Règles simples, résultats prévisibles." },
              { title: "Pas de prioritisation automatique", body: "Nous ne décidons pas pour vous ce qui est « important ». Vous voyez tout, vous décidez." },
              { title: "Pas de stockage du contenu des emails", body: "Le corps de l'email est lu une seule fois pour l'analyse, puis oublié. Seules les métadonnées minimales sont conservées (200 caractères max)." },
              { title: "Pas de « synchronisation parfaite »", body: "Nous ne prétendons pas que tout est synchronisé en temps réel. Vous voyez clairement quand le dernier scan a eu lieu." },
            ].map(({ title, body }, i) => (
              <ScrollReveal key={title} variant="fade-up" delay={i * 80}>
                <div className="rounded-lg border-2 border-red-500/20 bg-card p-6">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-red-500/10">
                    <XCircle className="size-6 text-red-500" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      {/* CTA Section */}
      <section className="border-b py-20">
        <MaxWidthWrapper>
          <ScrollReveal variant="zoom-in">
          <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-purple-500/10 to-blue-500/10 p-12 text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl md:text-5xl">
              Réduisez votre stress email dès aujourd&apos;hui
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Gratuit. Sans carte bancaire. Microsoft : connexion instantanée. Autres : configuration IMAP simple.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  <Mail className="mr-2 size-5" />
                  Commencer maintenant
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  J&apos;ai déjà un compte
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Vous saurez toujours exactement ce que fait le système. Promis.
            </p>
          </div>
          </ScrollReveal>
        </MaxWidthWrapper>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <MaxWidthWrapper>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <InboxActionsIcon size="sm" />
              <span className="font-semibold">Inbox Actions</span>
              <span className="text-xs text-muted-foreground">v{packageJson.version}</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="https://github.com/bullder30/inbox-actions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Github className="size-4" />
                AGPL-3.0
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
              <Link href="/terms" className="hover:text-foreground">
                CGU
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Confidentialité
              </Link>
            </div>
          </div>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Inbox Actions. Système de réduction du stress email.
          </div>
        </MaxWidthWrapper>
      </footer>
    </div>
  );
}
