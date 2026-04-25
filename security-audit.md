# Rapport d'audit de sécurité — Inbox Actions

**Date initiale :** 2026-03-24
**Dernière revue :** 2026-04-25 (cf. statut par item ci-dessous)
**Version app :** `next@14.2.35`
**Méthode :** Analyse statique du code source + `pnpm audit`
**Scope :** Auth/autorisation, validation inputs, credentials IMAP, rate limiting, headers HTTP, CAPTCHA, dépendances

---

## Statut global (2026-04-25)

| ID | Gravité | Statut | Note |
|---|---|---|---|
| **C-1** | CRITIQUE | ✅ **RÉSOLU** (avant 2026-04-25) | Headers HSTS/CSP/X-Frame-Options/X-Content-Type-Options/Referrer-Policy/Permissions-Policy en place dans `next.config.js` |
| **M-1** | MOYEN | ✅ **RÉSOLU** (2026-04-25) | Tokens MS Graph chiffrés AES-256-CBC via `lib/microsoft-graph/graph-token-crypto.ts` (pattern IMAP) + migration auto encrypt-on-read pour les tokens legacy. Nouvelle env var `GRAPH_MASTER_KEY` |
| **M-2** | MOYEN | ✅ **RÉSOLU** (2026-04-25) | Rate limit in-memory (`lib/rate-limit.ts` Map sliding window) sur register (5/10min), forgot-password (3/15min), imap/connect (10/10min), contact (3/15min). Réponse 429 avec `Retry-After`. Upgrade Upstash Redis recommandé pour multi-instances |
| **M-3** | MOYEN | ✅ **RÉSOLU** (2026-04-25) | Honey-pot anti-bot (`lib/honeypot.ts` + `components/shared/honeypot-input.tsx`) sur register, forgot-password, contact. Champ `_hp_website` invisible visuellement et A11y. Upgrade Cloudflare Turnstile recommandé contre bots avancés |
| M-4 | MOYEN | ℹ️ Info | Vulns transitives, app principale (`next@14.2.35`) non affectée |
| F-1 | FAIBLE | ⏳ Pending | `allowDangerousEmailAccountLinking: true` |
| F-2 | FAIBLE | ⏳ Pending | URL reset construite sans validation stricte |
| F-3 | FAIBLE | ⏳ Pending | Tokens JWT non révocables |

---

## Vue d'ensemble (initiale)

| Gravité  | Nb | Points concernés                                      |
|----------|----|-------------------------------------------------------|
| CRITIQUE | 1  | Absence totale de headers de sécurité HTTP            |
| MOYEN    | 4  | Tokens MS Graph en clair, rate limiting, captcha, dépendances |
| FAIBLE   | 3  | Account linking, URL reset, tokens JWT non révocables |

---

## CRITIQUE

---

### C-1 — Absence totale de headers de sécurité HTTP — ✅ RÉSOLU

> **Statut au 2026-04-25** : RÉSOLU. `next.config.js` (70 lignes) définit désormais un bloc `securityHeaders` complet appliqué via `async headers()` :
> - `X-Content-Type-Options: nosniff`
> - `X-Frame-Options: SAMEORIGIN`
> - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
> - `Referrer-Policy: strict-origin-when-cross-origin`
> - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
> - `Content-Security-Policy` complète avec `default-src 'self'`, whitelist Stripe + Google + GitHub avatars, `frame-ancestors 'self'`
>
> **À surveiller** : la CSP autorise `'unsafe-inline'` et `'unsafe-eval'` sur `script-src` (requis par Next.js App Router pour l'hydratation). Migration vers nonce-based CSP à envisager en V2 quand Next.js stabilisera l'API `unstable_after`/headers SSR.
>
> Section originale conservée ci-dessous pour historique.

---

**Fichier :** `next.config.js` (29 lignes, aucun bloc `headers()`)

`next.config.js` ne définit aucun header de sécurité. Tous les navigateurs reçoivent des réponses sans protection.

**Headers absents et risques :**

| Header | Risque si absent |
|---|---|
| `Content-Security-Policy` | XSS : injection de scripts depuis des domaines tiers |
| `Strict-Transport-Security` | Downgrade HTTPS→HTTP, attaques MITM |
| `X-Frame-Options` | Clickjacking : l'app peut être embarquée dans une iframe |
| `X-Content-Type-Options: nosniff` | MIME sniffing : le navigateur réinterprète le type des fichiers |
| `Referrer-Policy` | Fuite de l'URL courante (dont tokens) dans les logs tiers |
| `Permissions-Policy` | Accès caméra, micro, géolocalisation non restreints |

**Correction recommandée — ajouter dans `next.config.js` :**

```js
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Content-Security-Policy',
          // À affiner selon les domaines effectivement utilisés
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
            "connect-src 'self' https://api.stripe.com",
            "frame-src https://challenges.cloudflare.com https://js.stripe.com",
          ].join('; '),
        },
      ],
    },
  ];
},
```

> **Priorité : à faire en premier.** Effort estimé : ~30 minutes. Aucun risque de régression.

---

## MOYEN

---

### M-1 — Tokens Microsoft Graph stockés en clair en base de données

**Fichier :** `prisma/schema.prisma` — modèle `MicrosoftGraphMailbox`

```prisma
model MicrosoftGraphMailbox {
  accessToken   String?  @db.Text @map(name: "access_token")   // ← clair
  refreshToken  String?  @db.Text @map(name: "refresh_token")  // ← clair
  ...
}
```

Les mots de passe IMAP sont chiffrés en AES-256-CBC (`lib/imap/imap-credentials.ts`), mais les tokens OAuth Microsoft sont stockés en clair. En cas de compromission de la base de données (dump SQL, backup exposé, faille future), ces tokens permettent d'accéder directement aux boîtes mail Microsoft des utilisateurs sans autre authentification.

**Correction :** Appliquer le même schéma que `lib/imap/imap-credentials.ts` — chiffrer avec `IMAP_MASTER_KEY` (ou une clé dédiée `GRAPH_MASTER_KEY`) au moment de l'écriture dans `lib/microsoft-graph/graph-service.ts`, déchiffrer au moment de l'utilisation. Une migration est nécessaire pour les tokens existants.

---

### M-2 — Absence de rate limiting sur les endpoints d'authentification

**Fichiers :** `app/api/auth/register/route.ts`, `app/api/auth/forgot-password/route.ts`, `app/api/imap/connect/route.ts`, `app/api/contact/route.ts`

Aucun rate limiter global n'est configuré. Le seul mécanisme présent est un cooldown applicatif de 60 secondes dans `forgot-password` (lignes 33–38), basé sur `passwordResetExpiry` — contournable avec des adresses email différentes, et absent sur toutes les autres routes.

**Risques concrets :**

| Endpoint | Risque |
|---|---|
| `POST /api/auth/register` | Création de comptes en masse, pollution de la base de données |
| `POST /api/auth/forgot-password` | Envoi massif d'emails via le compte Resend (coûts + réputation domaine) |
| `POST /api/imap/connect` | Bruteforce de credentials IMAP en utilisant l'app comme proxy |
| `POST /api/contact` | Spam sortant via le domaine d'envoi |

**Correction recommandée :** Pour Vercel, `@upstash/ratelimit` avec Redis Upstash (plan gratuit suffisant). Exemple sur `/api/auth/register` :

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "10 m"), // 5 tentatives / 10 min par IP
});

const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
const { success } = await ratelimit.limit(ip);
if (!success) {
  return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
}
```

Alternative sans infrastructure externe : `next-rate-limit` (en mémoire, suffisant pour un seul serveur).

---

### M-3 — Absence de CAPTCHA sur les formulaires publics

**Fichiers :** `app/(auth)/register/`, `app/(auth)/forgot-password/`, `app/api/contact/route.ts`

Aucune protection bot (Turnstile, hCaptcha, reCAPTCHA) n'est implémentée. Combiné à l'absence de rate limiting (M-2), les formulaires publics sont exploitables par des bots sans friction.

**Point critique sur l'implémentation correcte :** Le token CAPTCHA doit être **vérifié côté serveur** — la vérification côté client seule ne protège pas. Le flux correct est :

1. Le client résout le challenge → reçoit un token opaque
2. Le client envoie ce token dans la requête API
3. Le serveur appelle l'API de vérification (ex. Turnstile : `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`) avec le token + la clé secrète
4. Si la réponse contient `"success": true`, la requête est acceptée — sinon rejetée avec HTTP 400

**Correction recommandée :** Cloudflare Turnstile (gratuit, conforme RGPD, sans fingerprinting utilisateur). La vérification serveur doit être la première instruction de chaque handler API concerné.

---

### M-4 — Dépendances vulnérables (`pnpm audit`)

**Résultat :** `49 vulnérabilités — 1 critique, 25 high, 17 moderate, 6 low`

#### Vulnérabilité critique (transitive — risque pratique faible)

| Champ | Valeur |
|---|---|
| Advisory | GHSA-f82v-jwr5-mffw — Authorization Bypass in Next.js Middleware |
| Package vulnérable | `next@14.1.4` |
| Chemin | `react-email@2.1.5 > next@14.1.4` |
| App principale | `next@14.2.35` ✅ **non affectée** |

La vulnérabilité critique est dans une dépendance transitive de `react-email`, pas dans l'app elle-même. `react-email` est utilisé uniquement côté serveur pour rendre des templates d'email — il n'est pas exposé au middleware d'authentification. Risque d'exploitation directe : très faible. L'advisory est quand même remonté car le package est présent dans le lockfile.

**Correction :** Override dans `package.json` en attendant une mise à jour de `react-email` :

```json
{
  "pnpm": {
    "overrides": {
      "react-email>next": ">=14.2.35"
    }
  }
}
```

#### Vulnérabilités high/moderate dans les dépendances directes

| Package | Advisory | Vecteur d'exploitation | Correction |
|---|---|---|---|
| `mailparser@3.9.1` | GHSA-7gmj-h9xc-mcxc — XSS | Faible : HTML parsé jamais rendu dans le DOM | `pnpm update mailparser` → ≥3.9.3 |
| `qs@6.14.1` (via stripe) | GHSA-w7fw-mjwx-w883 — DoS arrayLimit bypass | Très faible : requêtes Stripe sortantes uniquement | Attendre mise à jour du SDK Stripe |
| `minimatch` (build tools) | ReDoS multiples | Uniquement en dev/build, non exposé en prod | Mise à jour lockfile |

**Action immédiate prioritaire :** `pnpm update mailparser` — une commande, aucun risque de régression.

---

## FAIBLE

---

### F-1 — `allowDangerousEmailAccountLinking: true`

**Fichier :** `auth.config.ts`

Permet de lier automatiquement un compte Google/Microsoft OAuth à un compte credentials existant si les adresses email correspondent. Risque théorique : si un provider OAuth tiers peut être amené à émettre un token avec l'email d'une victime. En pratique, avec Google et Microsoft comme seuls providers, le risque est très faible. À documenter explicitement comme choix conscient.

---

### F-2 — URL de reset construite sans validation stricte de `NEXT_PUBLIC_APP_URL`

**Fichier :** `app/api/auth/forgot-password/route.ts:53`

```ts
const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
```

Si `NEXT_PUBLIC_APP_URL` est mal configurée (trailing slash, URL malformée), le lien de reset sera cassé ou inattendu. Pas exploitable directement mais source de bugs en production.

**Correction :** Ajouter `.url()` sur la validation Zod de `NEXT_PUBLIC_APP_URL` dans `env.mjs`.

---

### F-3 — Tokens JWT non révocables à la déconnexion

**Fichier :** `auth.ts` — `session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 }`

Comportement standard JWT : un token émis n'est pas invalidé lors d'un `signOut()`. Si un token est volé (via XSS, log serveur), il reste valide jusqu'à son expiration (7 jours). Atténuation présente : `updateAge: 24h` force un refresh quotidien. Acceptable pour une app de ce type, mais à documenter comme risque accepté.

---

## Ce qui est correctement implémenté

| Mécanisme | Fichier | Détail |
|---|---|---|
| Chiffrement IMAP | `lib/imap/imap-credentials.ts` | AES-256-CBC, IV aléatoire 16 bytes, clé 256-bit |
| Hachage mots de passe | `auth.config.ts`, `app/api/auth/register/route.ts` | bcryptjs cost=12 |
| Reset token sécurisé | `app/api/auth/reset-password/route.ts` | SHA-256 + expiry vérifié côté serveur (ligne 33) |
| Validation inputs | Toutes les routes API | Zod `.safeParse()` systématique |
| Scoping userId (anti-IDOR) | Tous les handlers Prisma | `where: { userId: session.user.id }` systématique |
| Anti-énumération email | `app/api/auth/forgot-password/route.ts:28-30` | Retourne toujours `{ success: true }` |
| Protection open redirect | `auth.ts:124-143` | `new URL(url).origin === baseUrl` |
| Vérification webhook Stripe | `app/api/webhooks/stripe/route.ts` | `stripe.webhooks.constructEvent()` |
| Prévention injection SQL | Tout le codebase | Prisma ORM, aucune requête raw SQL |
| Cascade delete (RGPD) | `prisma/schema.prisma` | `onDelete: Cascade` sur toutes les relations user |
| Validation variables d'env | `env.mjs` | t3-oss/env-nextjs + Zod au démarrage |
| Vérification cron secret | `app/api/cron/*/route.ts` | `Authorization: Bearer {CRON_SECRET}` |

---

## Plan d'action priorisé

```
Semaine 1 — faible effort, impact maximal
  [1] C-1  Ajouter les security headers dans next.config.js             ~30 min
  [2] M-4  pnpm update mailparser                                        ~5 min
  [3] M-4  Override react-email>next dans pnpm.overrides                ~5 min

Semaine 2
  [4] M-2  Rate limiting IP sur /auth/register, /forgot-password, /imap/connect
  [5] M-3  Cloudflare Turnstile sur register + forgot-password (vérification serveur)

Semaine 3
  [6] M-1  Chiffrement des tokens Microsoft Graph (migration DB requise)

Backlog
  [7] F-2  Ajouter .url() sur NEXT_PUBLIC_APP_URL dans env.mjs
  [8] F-1  Documenter allowDangerousEmailAccountLinking comme choix conscient
```

---

*Rapport généré le 2026-03-24 — analyse statique manuelle + `pnpm audit`*
