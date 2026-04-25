# C4 Diagrams — Custom Action Types

Phase 2 architecture — feature "Actions personnalisées utilisateur".
Les diagrammes ci-dessous étendent le système existant. Tester le rendu sur https://mermaid.live.

---

## 1. Context Diagram

Pas de changement structurel : aucun nouvel acteur externe. La feature est entièrement interne.

```mermaid
C4Context
  title Context — Inbox Actions (avec custom action types)
  Person(user, "Utilisateur", "Définit ses propres types d'actions selon son métier")
  System(inbox, "Inbox Actions", "SaaS d'extraction d'actions depuis emails (5 types natifs + N types custom par user)")
  System_Ext(imap, "IMAP", "Gmail / Yahoo / iCloud / Fastmail / ProtonMail")
  System_Ext(graph, "Microsoft Graph", "Outlook / Hotmail / M365")
  System_Ext(resend, "Resend", "Envoi du digest email")

  Rel(user, inbox, "Connecte boîte mail, gère ses actions et types custom")
  Rel(inbox, imap, "Lit les emails (read-only, App Password)")
  Rel(inbox, graph, "Lit les emails (read-only, OAuth)")
  Rel(inbox, resend, "Envoie le digest quotidien")
```

---

## 2. Container Diagram

Ajout : la table `CustomActionType` est consommée par le pipeline d'extraction à chaque scan.

```mermaid
C4Container
  title Container — Inbox Actions
  Person(user, "Utilisateur")

  Container_Boundary(app, "Inbox Actions") {
    Container(spa, "Next.js App", "React + Server Components", "Pages /dashboard, /actions, /settings, /missing-action")
    Container(api, "API Routes", "Next.js Route Handlers", "CRUD actions + custom types + emails + cron")
    Container(extractor, "Action Extractor", "TypeScript pure functions", "Regex déterministe : 5 types natifs + N types custom par user")
    Container(cron, "Cron Service", "node-cron", "Daily sync 8h00 + cleanup 23h00")
    ContainerDb(db, "Postgres (Neon)", "Prisma ORM", "User, Action, EmailMetadata, UserExclusion, CustomActionType")
  }

  System_Ext(providers, "Email Providers", "IMAP + MS Graph")

  Rel(user, spa, "HTTPS")
  Rel(spa, api, "fetch (SWR + Server Actions)")
  Rel(api, db, "Prisma queries")
  Rel(api, extractor, "extractActionsFromEmail(ctx, exclusions, customTypes)")
  Rel(cron, api, "POST /api/cron/daily-sync")
  Rel(api, providers, "IMAP / Microsoft Graph SDK")
  Rel(extractor, db, "(via API caller) load CustomActionType per user")
```

---

## 3. Component Diagram — Pipeline d'extraction

Zoom sur le composant **Action Extractor**, où la modification est concentrée.

```mermaid
C4Component
  title Component — Action Extractor (lib/actions/)
  Container(api, "API / Cron caller", "daily-sync-job, /api/email/analyze")
  ContainerDb(db, "Postgres")

  Component_Boundary(extractor, "extract-actions-regex.ts") {
    Component(orchestrator, "extractActionsFromEmail()", "TypeScript", "Orchestre extraction native + custom + dedup")
    Component(native, "extractNativeActions()", "TypeScript", "5 patterns figés : SEND / CALL / FOLLOW_UP / PAY / VALIDATE")
    Component(custom, "extractCustomActionsFromEmail()", "TypeScript", "NEW — Compile keywords user en regex à la volée + applique gating anti-ambiguïté")
    Component(gating, "isConcreteEnough() + helpers anti-ambiguïté", "TypeScript", "Conditionnels faibles, marqueurs forts, deadline → réutilisé par natif ET custom")
    Component(dedup, "deduplicateActions()", "TypeScript", "Évite double-extraction si pattern natif + custom matchent")
  }

  Rel(api, orchestrator, "Appelle avec context, exclusions, customTypes[]")
  Rel(orchestrator, native, "Étape 1")
  Rel(orchestrator, custom, "Étape 2 si customTypes.length > 0")
  Rel(native, gating, "Filtre")
  Rel(custom, gating, "Filtre (réutilise les mêmes helpers)")
  Rel(orchestrator, dedup, "Merge des résultats")
  Rel(api, db, "SELECT CustomActionType WHERE userId=? AND isActive=true")
```

**Points clés du diagramme** :
- `extractCustomActionsFromEmail()` est un nouveau composant, mais **réutilise** les helpers de gating anti-ambiguïté (cohérence garantie).
- Les `customTypes` sont chargés par l'**API caller** (pas par l'extracteur lui-même → fonction pure, testable).
- Le dedup final évite les doublons quand un pattern custom correspond aussi à un natif.
