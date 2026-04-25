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
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Filter,
  LogIn,
  Mail,
  MailOpen,
  PlayCircle,
  Phone,
  Send,
  Server,
  ShieldCheck,
  UserPlus,
  XCircle,
  Zap,
} from "lucide-react";
import MaxWidthWrapper from "@/components/shared/max-width-wrapper";
import { Button } from "@/components/ui/button";
import { HeaderSection } from "@/components/shared/header-section";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { Reveal } from "@/components/landing/reveal";
import { StatsBar } from "@/components/landing/stats-bar";
import { DashboardMockup } from "@/components/landing/dashboard-mockup";
import { GitHubStars } from "@/components/landing/github-stars";
import { FeatureCard } from "@/components/landing/feature-card";
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
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <MaxWidthWrapper>
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <InboxActionsIcon size="md" />
              <span className="text-xl font-bold tracking-tight">Inbox Actions</span>
            </div>
            <nav className="flex items-center gap-1 sm:gap-3">
              <div className="hidden sm:block">
                <GitHubStars />
              </div>
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
        {/* Background subtil */}
        {/* eslint-disable-next-line tailwindcss/classnames-order */}
        <div aria-hidden className="absolute inset-0 bg-grid-subtle" />
        <div
          aria-hidden
          className="absolute left-1/2 top-0 -z-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent blur-3xl"
        />

        <MaxWidthWrapper className="relative">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            {/* Texte */}
            <div className="text-center lg:text-left">
              <div className="mb-5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Open source · RGPD · Lecture seule
                </span>
              </div>

              <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-[3.75rem] xl:text-7xl">
                Vos emails transformés en{" "}
                <span className="text-gradient_indigo-purple">actions claires</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg lg:mx-0">
                Inbox Actions détecte les tâches explicites dans vos emails. Vous savez toujours
                ce qui a été analysé, ignoré, et pourquoi.
              </p>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/register" className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    className="group w-full bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 sm:w-auto"
                  >
                    <Mail className="mr-2 size-5" />
                    Commencer gratuitement
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                  </Button>
                </Link>
                <Link href="#examples" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    <PlayCircle className="mr-2 size-5" />
                    Voir des exemples
                  </Button>
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground lg:justify-start">
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="size-3.5 text-blue-500" />
                  Microsoft Outlook
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Server className="size-3.5 text-purple-500" />
                  Gmail · Yahoo · iCloud · Fastmail
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  AES-256
                </span>
              </div>
            </div>

            {/* Mockup */}
            <div className="mx-auto w-full max-w-md lg:max-w-none">
              <DashboardMockup />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="mt-12 lg:mt-16">
            <StatsBar />
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Transparency Promise Section */}
      <section className="border-b bg-muted/30 py-16">
        <MaxWidthWrapper>
          <div className="mx-auto max-w-3xl text-center">
            <Reveal variant="fade-up">
              <h2 className="font-heading text-2xl font-bold sm:text-3xl">
                Notre promesse : Zéro zone grise
              </h2>
              <p className="mt-4 text-muted-foreground">
                Inbox Actions ne vous cache jamais rien. Vous voyez toujours :
              </p>
            </Reveal>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                "Quand le dernier scan a eu lieu",
                "Combien d'emails ont été analysés",
                "Pourquoi certains ont été ignorés",
              ].map((label, i) => (
                <Reveal key={label} variant="fade-up" delay={i * 100}>
                  <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-md">
                    <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                    <p className="mt-2 font-medium">{label}</p>
                  </div>
                </Reveal>
              ))}
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

          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Eye className="size-6 text-blue-500" />, bg: "bg-blue-500/10", title: "Détection déterministe", body: <>Règles simples et explicables. Le système détecte 5 types d&apos;actions : envoyer, appeler, suivre, payer, valider.<strong className="mt-2 block">Si c&apos;est ambigu, on ne devine pas.</strong></> },
              { icon: <AlertCircle className="size-6 text-purple-500" />, bg: "bg-purple-500/10", title: "Corrigez immédiatement", body: <>Le système a manqué une action ? Un bouton <strong>&ldquo;Il manque une action&rdquo;</strong> accessible partout. Créez manuellement en 3 clics, sans justification.</> },
              { icon: <CheckCircle2 className="size-6 text-emerald-500" />, bg: "bg-emerald-500/10", title: "Phrase source visible", body: <>Chaque action affiche la phrase exacte de l&apos;email d&apos;origine. Vous comprenez toujours pourquoi le système a détecté cette action.</> },
              { icon: <Clock className="size-6 text-orange-500" />, bg: "bg-orange-500/10", title: "Synchronisation à la demande", body: <>Bouton de synchronisation manuelle directement sur le tableau de bord. Pas besoin d&apos;attendre le scan automatique.<strong className="mt-2 block">Idéal pour tester ou forcer une mise à jour.</strong></> },
              { icon: <Bell className="size-6 text-red-500" />, bg: "bg-red-500/10", title: "Urgence visuelle immédiate", body: <>Actions en retard en <span className="rounded bg-red-100 px-1 text-red-800 dark:bg-red-900/30 dark:text-red-400">rouge</span>, urgentes (&lt;24h) en <span className="rounded bg-orange-100 px-1 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">orange</span>.<strong className="mt-2 block">Impossible de manquer une échéance.</strong></> },
              { icon: <Filter className="size-6 text-amber-500" />, bg: "bg-amber-500/10", title: "Exclusions personnalisées", body: <>Excluez un expéditeur ou domaine via <strong>···</strong> sur une carte d&apos;action. Ajoutez des mots-clés de sujet depuis les Paramètres. Les actions existantes liées sont supprimées automatiquement.<strong className="mt-2 block">Newsletters et robots : exclus automatiquement sans configuration.</strong></> },
              { icon: <Zap className="size-6 text-blue-500" />, bg: "bg-blue-500/10", title: "Microsoft Outlook sans friction", body: <>Connectez un ou plusieurs comptes Microsoft en quelques clics.<strong className="mt-2 block">Microsoft Graph API : aucune configuration IMAP requise.</strong></> },
              { icon: <Server className="size-6 text-purple-500" />, bg: "bg-purple-500/10", title: "IMAP universel, multi-boîtes", body: <>Gmail, Yahoo, iCloud, Fastmail, ProtonMail... Ajoutez autant de boîtes que nécessaire.<br />Connexion via <strong>IMAP avec App Password</strong> : simple, universel, sécurisé.<strong className="mt-2 block">Vos mots de passe sont chiffrés AES-256.</strong></> },
              { icon: <CalendarClock className="size-6 text-sky-500" />, bg: "bg-sky-500/10", title: "Planification intégrée", body: <>Planifiez une action en un clic depuis la carte. Les actions planifiées pour aujourd&apos;hui restent visibles dans <strong>Aujourd&apos;hui</strong> ; celles pour plus tard apparaissent dans <strong>À venir</strong> — sans cron, sans configuration.<strong className="mt-2 block">La bascule est automatique à minuit.</strong></> },
              { icon: <ShieldCheck className="size-6 text-indigo-500" />, bg: "bg-indigo-500/10", title: "Email = référence optionnelle", body: <>Toutes vos actions sont gérables ici. Votre boîte mail n&apos;est qu&apos;une option pour vérifier le contexte. Vous ne retournez jamais dans votre boîte mail pour travailler.</> },
            ].map(({ icon, bg, title, body }, i) => (
              <Reveal key={title} variant="fade-up" delay={(i % 3) * 80}>
                <FeatureCard icon={icon} iconBg={bg} title={title}>{body}</FeatureCard>
              </Reveal>
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
              <Reveal key={n} variant="fade-up" delay={i * 80}>
                <div className="flex gap-6 rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-lg font-bold text-white shadow-md shadow-indigo-500/25">
                    {n}
                  </div>
                  <div><h3 className="mb-2 text-xl font-semibold">{title}</h3>{body}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      {/* Examples Section */}
      <section id="examples" className="border-b py-20">
        <MaxWidthWrapper>
          <HeaderSection
            label="Exemples"
            title="Ce que le système détecte (et ne détecte pas)"
            subtitle="Transparence totale sur les capacités et limites."
          />

          <div className="mt-16 space-y-8">
            {/* Exemple détecté SEND */}
            <Reveal variant="fade-up">
              <div className="rounded-lg border-2 border-emerald-500/20 bg-emerald-50/50 p-6 dark:bg-emerald-950/20">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
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
                      <p className="flex items-center gap-2 font-medium">
                        <Send className="size-4 text-blue-600" />
                        Envoyer le rapport financier de Q4
                      </p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Envoyer</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-orange-100 px-2 py-1 text-sm font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                      <Clock className="size-4" />
                      Urgent · Vendredi
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">De : client@example.com</p>
                    <p className="mt-1 text-xs text-muted-foreground">Phrase source : &ldquo;peux-tu m&apos;envoyer le rapport financier de Q4&rdquo;</p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span><strong>Pourquoi détecté :</strong> Demande explicite (&ldquo;peux-tu envoyer&rdquo;) + objet clair + échéance précise.</span>
                </div>
              </div>
            </Reveal>

            {/* Exemple non détecté (conditionnel) */}
            <Reveal variant="fade-up">
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
                <div className="mt-4 flex items-start gap-2 text-sm text-orange-700 dark:text-orange-400">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>Pourquoi ignoré :</strong> Phrase conditionnelle (&ldquo;si tu as le temps&rdquo;). Le système ne devine pas si c&apos;est vraiment important.
                    <br /><strong>Solution :</strong> Cliquez &ldquo;Il manque une action&rdquo; si vous voulez la suivre.
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Exemple détecté CALL */}
            <Reveal variant="fade-up">
              <div className="rounded-lg border-2 border-emerald-500/20 bg-emerald-50/50 p-6 dark:bg-emerald-950/20">
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
                      <p className="flex items-center gap-2 font-medium">
                        <Phone className="size-4 text-emerald-600" />
                        Rappeler pour finaliser
                      </p>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Appeler</span>
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      <Clock className="size-4" />
                      Échéance · Demain matin
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">De : partenaire@example.com</p>
                    <p className="mt-1 text-xs text-muted-foreground">Phrase source : &ldquo;merci de me rappeler demain matin&rdquo;</p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <span><strong>Pourquoi détecté :</strong> Demande explicite (&ldquo;merci de rappeler&rdquo;) + échéance claire (&ldquo;demain matin&rdquo;).</span>
                </div>
              </div>
            </Reveal>

            {/* Exemple exclu newsletter */}
            <Reveal variant="fade-up">
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
                    <p className="flex items-center gap-2 font-medium text-red-700 dark:text-red-400">
                      <MailOpen className="size-4" />
                      Email ignoré, non analysé
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
                  <Ban className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <strong>Pourquoi exclu :</strong> Expéditeur = newsletter@. Les emails marketing sont automatiquement exclus.
                    <br /><strong>Exclusions manuelles :</strong> Cliquez <strong>···</strong> sur une action card pour exclure un expéditeur, un domaine entier ou un mot-clé de sujet.
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal variant="fade-up">
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
          </Reveal>
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
              <Reveal key={title} variant="fade-up" delay={i * 80}>
                <div className="h-full rounded-lg border-2 border-red-500/20 bg-card p-6 transition-shadow hover:shadow-md">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-red-500/10">
                    <XCircle className="size-6 text-red-500" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{title}</h3>
                  <p className="text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </MaxWidthWrapper>
      </section>

      {/* CTA Section */}
      <section className="border-b py-20">
        <MaxWidthWrapper>
          <Reveal variant="zoom-in">
            <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 p-10 text-center text-white shadow-2xl shadow-indigo-500/30 sm:p-14">
              {/* Décoration */}
              <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-3xl" />
              <div aria-hidden className="absolute -bottom-16 -left-16 size-64 rounded-full bg-purple-300/20 blur-3xl" />

              <div className="relative">
                <h2 className="font-heading text-3xl font-bold sm:text-4xl md:text-5xl">
                  Réduisez votre stress email dès aujourd&apos;hui
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">
                  Gratuit. Sans carte bancaire. Microsoft : connexion instantanée. Autres : configuration IMAP simple.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link href="/register" className="w-full sm:w-auto">
                    <Button size="lg" variant="secondary" className="w-full bg-white font-semibold text-indigo-700 hover:bg-white/90 sm:w-auto">
                      <Mail className="mr-2 size-5" />
                      Commencer maintenant
                      <ArrowRight className="ml-2 size-4" />
                    </Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">
                      J&apos;ai déjà un compte
                    </Button>
                  </Link>
                </div>
                <p className="mt-6 text-sm text-white/75">
                  Vous saurez toujours exactement ce que fait le système. Promis.
                </p>
              </div>
            </div>
          </Reveal>
        </MaxWidthWrapper>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <MaxWidthWrapper>
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <InboxActionsIcon size="sm" />
              <span className="font-semibold">Inbox Actions</span>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300">
                v{packageJson.version} · MVP · FR
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="sm:hidden">
                <GitHubStars />
              </div>
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
            © {new Date().getFullYear()} Inbox Actions · AGPL-3.0 · Système de réduction du stress email
          </div>
        </MaxWidthWrapper>
      </footer>
    </div>
  );
}
