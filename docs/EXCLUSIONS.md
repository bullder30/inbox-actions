# Exclusions utilisateur

Guide du système d'exclusion permettant aux utilisateurs de filtrer des expéditeurs, domaines ou sujets de l'analyse d'actions.

---

## Vue d'ensemble

Les exclusions permettent de silencer définitivement certains emails lors de l'analyse. Elles s'appliquent **au moment de l'extraction des actions**, pas de la synchronisation.

```
Email reçu → Sync (métadonnées stockées)
                    ↓
              Analyze (corps lu temporairement)
                    ↓
         shouldExcludeByUserRules() ?
              ↓ oui          ↓ non
         Aucune action   Extraction regex
         créée           → Actions sauvegardées
```

---

## Types d'exclusion

| Type | Portée | Exemple |
|------|--------|---------|
| `SENDER` | Adresse email exacte | `spam@example.com` |
| `DOMAIN` | Tout email du domaine | `newsletter.com` → bloque `*@newsletter.com` |
| `SUBJECT` | Sujet contenant la valeur | `offre promotionnelle` |

---

## Modèle de données

```prisma
enum ExclusionType {
  SENDER
  DOMAIN
  SUBJECT
}

model UserExclusion {
  id        String        @id @default(cuid())
  userId    String
  type      ExclusionType
  value     String                          // normalisé en minuscules
  label     String?                         // affichage lisible optionnel
  createdAt DateTime      @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, value])           // pas de doublon
  @@index([userId])
  @@map("user_exclusions")
}
```

---

## API

### `GET /api/exclusions`

Retourne toutes les exclusions de l'utilisateur connecté, triées par date de création décroissante.

**Réponse :**
```json
{
  "exclusions": [
    {
      "id": "clx...",
      "type": "SENDER",
      "value": "spam@example.com",
      "label": "spam@example.com",
      "createdAt": "2026-03-15T10:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/exclusions`

Crée une nouvelle exclusion. Supprime automatiquement les actions existantes correspondantes.

**Corps :**
```json
{
  "type": "SENDER" | "DOMAIN" | "SUBJECT",
  "value": "spam@example.com",
  "label": "spam@example.com"   // optionnel
}
```

**Comportement :**
- La `value` est normalisée en minuscules
- Pour `SENDER` : supprime les actions dont `emailFrom = value`
- Pour `DOMAIN` : supprime les actions dont `emailFrom` se termine par `@value`
- Pour `SUBJECT` : aucune suppression d'actions existantes

**Codes de retour :**
| Code | Cas |
|------|-----|
| `201` | Exclusion créée |
| `400` | Type invalide ou valeur manquante |
| `401` | Non authentifié |
| `409` | Exclusion déjà existante |
| `500` | Erreur serveur |

**Réponse (201) :**
```json
{
  "exclusion": { "id": "clx...", "type": "SENDER", ... },
  "deletedActions": 3
}
```

---

### `DELETE /api/exclusions/[id]`

Supprime une exclusion. L'exclusion doit appartenir à l'utilisateur connecté.

**Codes de retour :**
| Code | Cas |
|------|-----|
| `200` | `{ "success": true }` |
| `401` | Non authentifié |
| `404` | Exclusion introuvable ou appartenant à un autre utilisateur |
| `500` | Erreur serveur |

---

## Logique d'exclusion

**Fichier :** `lib/actions/extract-actions-regex.ts`

```typescript
export type UserExclusionData = {
  type: "SENDER" | "DOMAIN" | "SUBJECT";
  value: string;
};

function shouldExcludeByUserRules(
  context: EmailContext,
  exclusions: UserExclusionData[]
): boolean {
  // Extrait l'adresse brute depuis "Name <email@domain.com>"
  const angleMatch = context.from.match(/<([^>]+)>/);
  const emailLower = (angleMatch ? angleMatch[1] : context.from).trim().toLowerCase();
  const subjectLower = context.subject?.toLowerCase() ?? "";

  for (const exclusion of exclusions) {
    const val = exclusion.value.toLowerCase();
    if (exclusion.type === "SENDER" && emailLower === val) return true;
    if (exclusion.type === "DOMAIN" && emailLower.endsWith(`@${val}`)) return true;
    if (exclusion.type === "SUBJECT" && subjectLower.includes(val)) return true;
  }
  return false;
}
```

**Points clés :**
- Supporte le format `"Name <email@domain.com>"` et `"email@domain.com"` — l'adresse est extraite avant comparaison
- Insensible à la casse
- Le matching domaine utilise `endsWith(@domain)` pour éviter les faux positifs (ex : `myexample.com` ne matche pas `example.com`)
- Les exclusions utilisateur sont vérifiées **avant** les exclusions système

---

## Intégration dans les jobs

### Daily sync (`lib/cron/daily-sync-job.ts`)

Les exclusions sont chargées **une fois par mailbox** (pas par email) pour limiter les requêtes BDD :

```typescript
const userExclusions = await prisma.userExclusion.findMany({
  where: { userId: credential.userId },
  select: { type: true, value: true },
});

const result = await syncAndAnalyzeMailbox(
  provider, userId, mailboxLabel, userExclusions
);
```

### Analyze manuel (`app/api/email/analyze/route.ts`)

Les exclusions sont chargées **une fois pour toute la session** d'analyse :

```typescript
const userExclusions = await prisma.userExclusion.findMany({
  where: { userId: session.user.id },
  select: { type: true, value: true },
});
```

---

## Interface utilisateur

### Ajout depuis une carte d'action

Le menu `···` sur chaque carte (variant `default`) propose :
- **Exclure cet expéditeur** → crée une exclusion `SENDER` avec l'adresse extraite
- **Exclure ce domaine** → crée une exclusion `DOMAIN` avec le domaine extrait

> **Limitation :** Le sujet de l'email n'est pas stocké sur le modèle `Action`. L'exclusion par sujet n'est donc **pas disponible** depuis les cartes d'action.

Le toast affiche le nombre d'actions supprimées et la liste est rafraîchie automatiquement.

### Gestion dans les paramètres

`/settings` → section **Exclusions** :
- Formulaire d'ajout en haut : sélecteur de type (Expéditeur / Domaine / Sujet) + champ valeur + bouton `+` (ou Enter)
- Liste toutes les exclusions avec leur type (badge coloré) et leur valeur
- Bouton de suppression avec confirmation via `AlertDialog`

Le formulaire des paramètres permet d'ajouter **n'importe quel type** d'exclusion manuellement, notamment des mots-clés de sujet.

---

## Tests

```bash
# Tests unitaires (logique d'exclusion + API)
pnpm test tests/lib/exclusions.test.ts
pnpm test tests/api/exclusions.test.ts
```

Les tests couvrent :
- Exclusion exacte SENDER (adresses simples et format `Name <email>`)
- Exclusion DOMAIN (correspondance `@domain`, pas de faux positifs)
- Exclusion SUBJECT (contains, insensible à la casse, sujet null)
- Exclusions multiples
- API GET / POST / DELETE (auth, validation, codes d'erreur, scoping `userId`)
- Normalisation en minuscules pour les 3 types (SENDER, DOMAIN, SUBJECT)
- Validation : valeur vide ou uniquement des espaces → 400

---

**Dernière mise à jour :** 16 mars 2026
