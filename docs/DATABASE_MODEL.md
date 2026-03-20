# Modèle de données Prisma - Inbox Actions

Documentation complète du modèle de données pour le système "Inbox → Actions".

---

## 📋 Modèle Action

Le modèle `Action` représente une action extraite d'un email utilisateur.

### Code Prisma

```prisma
enum ActionType {
  SEND
  CALL
  FOLLOW_UP
  PAY
  VALIDATE
}

enum ActionStatus {
  TODO
  DONE
  IGNORED
}

model Action {
  id               String       @id @default(cuid())
  userId           String
  title            String
  type             ActionType
  status           ActionStatus @default(TODO)
  isScheduled      Boolean      @default(false)
  dueDate          DateTime?
  sourceSentence   String       @db.Text
  emailFrom        String
  emailReceivedAt  DateTime
  gmailMessageId   String?      @map(name: "gmail_message_id")
  createdAt        DateTime     @default(now()) @map(name: "created_at")
  updatedAt        DateTime     @default(now()) @updatedAt @map(name: "updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
  @@index([type])
  @@index([dueDate])
  @@map(name: "actions")
}
```

---

## 📝 Description des champs

| Champ            | Type           | Description                                                              | Requis |
| ---------------- | -------------- | ------------------------------------------------------------------------ | ------ |
| `id`             | String (cuid)  | Identifiant unique de l'action                                           | ✅     |
| `userId`         | String         | Identifiant de l'utilisateur propriétaire                                | ✅     |
| `title`          | String         | Titre court de l'action (ex: "Appeler le client ABC")                   | ✅     |
| `type`           | ActionType     | Type d'action: SEND, CALL, FOLLOW_UP, PAY, VALIDATE                     | ✅     |
| `status`         | ActionStatus   | Statut réel en base: TODO (défaut), DONE, IGNORED                        | ✅     |
| `isScheduled`    | Boolean        | `true` si planifié manuellement pour une date future (> fin du jour)     | ✅     |
| `dueDate`        | DateTime       | Date limite pour réaliser l'action (optionnelle)                         | ❌     |
| `sourceSentence` | Text           | Phrase extraite de l'email qui a généré l'action                         | ✅     |
| `emailFrom`      | String         | Adresse email de l'expéditeur                                            | ✅     |
| `emailReceivedAt`| DateTime       | Date/heure de réception de l'email                                       | ✅     |
| `gmailMessageId` | String         | ID du message Gmail pour créer un lien direct vers le mail              | ❌     |
| `createdAt`      | DateTime       | Date de création de l'action dans le système                             | ✅     |
| `updatedAt`      | DateTime       | Date de dernière modification (mise à jour automatique)                  | ✅     |

> **Note :** Le filtre "À venir" (SCHEDULED) est **virtuel** — il n'existe pas comme valeur d'enum. Il correspond aux actions avec `status=TODO`, `isScheduled=true` et `dueDate` strictement après la fin du jour courant. Cela permet une bascule automatique sans cron : une action planifiée pour aujourd'hui reste dans "Aujourd'hui", et passe dans "À venir" dès le lendemain.

---

## 🔗 Relations avec le modèle User

### Schéma de relation

```
User (1) ──────< (N) Action
```

**Un utilisateur peut avoir plusieurs actions** (relation 1:N)

### Côté User

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  // ... autres champs

  actions  Action[]  // ← Relation vers les actions

  @@map(name: "users")
}
```

### Côté Action

```prisma
model Action {
  id      String @id @default(cuid())
  userId  String
  // ... autres champs

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ↑ Relation vers l'utilisateur avec suppression en cascade

  @@map(name: "actions")
}
```

### Comportement de suppression

- **`onDelete: Cascade`** : Si un utilisateur est supprimé, toutes ses actions sont automatiquement supprimées
- Cela garantit qu'il n'y a jamais d'actions orphelines dans la base de données

---

## 🗂️ Index pour les performances

Le modèle `Action` possède 4 index pour optimiser les requêtes courantes :

```prisma
@@index([userId])    // Rechercher toutes les actions d'un utilisateur
@@index([status])    // Filtrer par statut (TODO, DONE, IGNORED)
@@index([type])      // Filtrer par type (SEND, CALL, etc.)
@@index([dueDate])   // Trier par date d'échéance
```

### Exemples de requêtes optimisées

```typescript
// Récupérer toutes les actions TODO d'un utilisateur
const todoActions = await prisma.action.findMany({
  where: {
    userId: "user123",
    status: "TODO"
  }
});

// Récupérer les actions avec échéance dans les 7 prochains jours
const upcomingActions = await prisma.action.findMany({
  where: {
    userId: "user123",
    status: "TODO",
    dueDate: {
      gte: new Date(),
      lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { dueDate: 'asc' }
});

// Récupérer toutes les actions "CALL" terminées
const completedCalls = await prisma.action.findMany({
  where: {
    userId: "user123",
    type: "CALL",
    status: "DONE"
  }
});
```

---

## 📊 Types d'actions (ActionType)

| Type         | Description                                     | Exemple                                |
| ------------ | ----------------------------------------------- | -------------------------------------- |
| `SEND`       | Envoyer un document, email, fichier             | "Envoyer le rapport Q4"                |
| `CALL`       | Passer un appel téléphonique                    | "Appeler le client ABC"                |
| `FOLLOW_UP`  | Faire un suivi, relancer                        | "Relancer le fournisseur XYZ"          |
| `PAY`        | Effectuer un paiement                           | "Payer la facture #12345"              |
| `VALIDATE`   | Valider, approuver, donner un feedback          | "Valider le design"                    |

---

## ✅ Statuts d'actions (ActionStatus)

| Statut    | Description                                        | Couleur suggérée |
| --------- | -------------------------------------------------- | ---------------- |
| `TODO`    | Action à faire (statut par défaut)                | 🔵 Bleu          |
| `DONE`    | Action terminée                                    | 🟢 Vert          |
| `IGNORED` | Action ignorée/non pertinente                      | ⚫ Gris           |

### Filtres virtuels de l'interface

| Filtre UI   | Logique en base                                                            |
| ----------- | -------------------------------------------------------------------------- |
| Aujourd'hui | `status=TODO` ET (`isScheduled=false` OU `dueDate≤endOfToday`)            |
| À venir     | `status=TODO` ET `isScheduled=true` ET `dueDate>endOfToday`               |
| Terminées   | `status=DONE`                                                              |
| Ignorées    | `status=IGNORED`                                                           |

---

## 🚀 Migration et déploiement

### Appliquer le schéma à la base de données

```bash
# En développement (sans shadow database)
npx prisma db push

# En production (avec migrations)
npx prisma migrate deploy
```

### Générer le client Prisma

```bash
npx prisma generate
```

---

## 🌱 Seed (données de test)

Un fichier seed a été créé pour initialiser la base de données avec des données de test.

### Exécuter le seed

```bash
pnpm db:seed
```

### Contenu du seed

Le seed crée automatiquement :
- ✅ 1 utilisateur de test : `test@inbox-actions.com`
- ✅ 6 actions de test avec différents types et statuts :
  - 1 × SEND (TODO)
  - 1 × CALL (TODO)
  - 1 × FOLLOW_UP (DONE)
  - 1 × PAY (TODO)
  - 1 × VALIDATE (TODO)
  - 1 × SEND (IGNORED)

### Code du seed

```typescript
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Créer un utilisateur de test
  const testUser = await prisma.user.upsert({
    where: { email: "test@inbox-actions.com" },
    update: {},
    create: {
      email: "test@inbox-actions.com",
      name: "Test User",
      role: "USER",
    },
  });

  // Créer des actions de test
  await prisma.action.create({
    data: {
      userId: testUser.id,
      title: "Envoyer le rapport Q4",
      type: "SEND",
      status: "TODO",
      sourceSentence: "Pourrais-tu m'envoyer le rapport du Q4...",
      emailFrom: "boss@company.com",
      emailReceivedAt: new Date("2024-01-15T09:30:00Z"),
      dueDate: new Date("2024-01-19T17:00:00Z"),
    },
  });

  // ... autres actions
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
```

---

## 🔍 Vérifier les données en base

### Se connecter à PostgreSQL

```bash
psql -U inbox_admin -d inbox_actions
```

### Requêtes SQL utiles

```sql
-- Voir tous les utilisateurs
SELECT * FROM users;

-- Voir toutes les actions
SELECT * FROM actions;

-- Actions groupées par statut
SELECT status, COUNT(*) as count
FROM actions
GROUP BY status;

-- Actions groupées par type
SELECT type, COUNT(*) as count
FROM actions
GROUP BY type;

-- Actions avec leurs utilisateurs
SELECT
  a.title,
  a.type,
  a.status,
  u.name as user_name,
  u.email as user_email
FROM actions a
JOIN users u ON a.user_id = u.id;

-- Actions TODO avec échéance proche
SELECT
  title,
  type,
  due_date,
  email_from
FROM actions
WHERE status = 'TODO'
  AND due_date IS NOT NULL
  AND due_date <= NOW() + INTERVAL '7 days'
ORDER BY due_date ASC;
```

---

## 📐 Diagramme de la base de données

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ id (PK)             │
│ email               │
│ name                │
│ role                │
│ createdAt           │
│ updatedAt           │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────┐
│      Action         │
├─────────────────────┤
│ id (PK)             │
│ userId (FK)         │◄─── Référence User.id
│ title               │
│ type                │
│ status              │
│ isScheduled         │
│ dueDate             │
│ sourceSentence      │
│ emailFrom           │
│ emailReceivedAt     │
│ gmailMessageId      │
│ createdAt           │
│ updatedAt           │
└─────────────────────┘
```

---

## 🎯 Prochaines étapes

Maintenant que le modèle de données est en place, vous pouvez :

1. ✅ Créer des API routes pour manipuler les actions
2. ✅ Créer des composants React pour afficher les actions
3. ✅ Implémenter un système de parsing d'emails
4. ✅ Ajouter des filtres et des recherches
5. ✅ Créer un dashboard avec statistiques

---

## 📚 Ressources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Relations Guide](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
