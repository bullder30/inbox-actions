# API Actions - Documentation

API complète pour gérer les actions extraites des emails dans Inbox Actions.

---

## 🔒 Sécurité

### Authentification obligatoire

**Tous les endpoints requièrent une authentification via NextAuth.**

- Chaque requête vérifie la session avec `await auth()`
- Si non authentifié : `401 Unauthorized`
- Les actions sont **isolées par utilisateur** : un user ne peut accéder qu'à SES actions

### Protection des données utilisateur

**Isolation stricte par userId** :
```typescript
// ✅ BON - Filtre par userId
const actions = await prisma.action.findMany({
  where: { userId: session.user.id }
});

// ❌ MAUVAIS - Expose toutes les actions
const actions = await prisma.action.findMany();
```

**Vérification de propriété avant modification** :
```typescript
// Vérifier que l'action appartient à l'utilisateur
if (action.userId !== session.user.id) {
  return NextResponse.json(
    { error: "Accès non autorisé" },
    { status: 403 }
  );
}
```

### Codes de statut HTTP

| Code | Signification                          |
|------|----------------------------------------|
| 200  | Succès                                 |
| 201  | Ressource créée avec succès            |
| 400  | Requête invalide (validation échouée)  |
| 401  | Non authentifié                        |
| 403  | Accès non autorisé (pas votre action)  |
| 404  | Ressource non trouvée                  |
| 500  | Erreur serveur                         |

---

## 📋 Endpoints

### 1. GET /api/actions

**Récupère la liste des actions de l'utilisateur connecté**

#### Query Parameters (optionnels)

| Paramètre | Type         | Description                                    |
|-----------|--------------|------------------------------------------------|
| `status`  | ActionStatus | Filtrer par statut (TODO, DONE, IGNORED)      |
| `type`    | ActionType   | Filtrer par type (SEND, CALL, FOLLOW_UP, etc.)|

#### Réponse réussie (200)

```json
{
  "actions": [
    {
      "id": "clx1234567890",
      "userId": "user123",
      "title": "Appeler le client ABC",
      "type": "CALL",
      "status": "TODO",
      "dueDate": "2024-01-20T16:00:00.000Z",
      "sourceSentence": "Il faudrait appeler le client ABC pour faire le point.",
      "emailFrom": "sales@company.com",
      "emailReceivedAt": "2024-01-16T14:20:00.000Z",
      "createdAt": "2024-01-16T14:25:00.000Z",
      "updatedAt": "2024-01-16T14:25:00.000Z",
      "user": {
        "id": "user123",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "count": 1
}
```

#### Exemples de requêtes

**Toutes les actions :**
```bash
curl -X GET http://localhost:3000/api/actions \
  -H "Cookie: next-auth.session-token=..."
```

**Actions TODO uniquement :**
```bash
curl -X GET "http://localhost:3000/api/actions?status=TODO" \
  -H "Cookie: next-auth.session-token=..."
```

**Actions de type CALL :**
```bash
curl -X GET "http://localhost:3000/api/actions?type=CALL" \
  -H "Cookie: next-auth.session-token=..."
```

**Combinaison de filtres :**
```bash
curl -X GET "http://localhost:3000/api/actions?status=TODO&type=PAY" \
  -H "Cookie: next-auth.session-token=..."
```

#### Avec fetch (Frontend)

```typescript
// Toutes les actions
const response = await fetch('/api/actions');
const { actions, count } = await response.json();

// Actions TODO uniquement
const response = await fetch('/api/actions?status=TODO');
const { actions } = await response.json();
```

---

### 2. POST /api/actions

**Crée une nouvelle action**

#### Body (JSON)

| Champ             | Type         | Requis | Description                              |
|-------------------|--------------|--------|------------------------------------------|
| `title`           | string       | ✅     | Titre de l'action                        |
| `type`            | ActionType   | ✅     | SEND, CALL, FOLLOW_UP, PAY, VALIDATE     |
| `sourceSentence`  | string       | ✅     | Phrase extraite de l'email               |
| `emailFrom`       | string       | ✅     | Email de l'expéditeur                    |
| `emailReceivedAt` | Date (ISO)   | ✅     | Date de réception de l'email             |
| `dueDate`         | Date (ISO)   | ❌     | Date d'échéance (optionnel)              |
| `status`          | ActionStatus | ❌     | TODO (défaut), DONE, IGNORED             |

#### Réponse réussie (201)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Envoyer le rapport Q4",
    "type": "SEND",
    "status": "TODO",
    "dueDate": "2024-01-25T17:00:00.000Z",
    "sourceSentence": "Pourrais-tu m'envoyer le rapport du Q4 ?",
    "emailFrom": "boss@company.com",
    "emailReceivedAt": "2024-01-15T09:30:00.000Z",
    "createdAt": "2024-01-16T10:00:00.000Z",
    "updatedAt": "2024-01-16T10:00:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action créée avec succès"
}
```

#### Erreurs de validation (400)

```json
{ "error": "Le titre est requis" }
{ "error": "Type d'action invalide (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)" }
{ "error": "La phrase source est requise" }
{ "error": "L'email de l'expéditeur est requis" }
{ "error": "La date de réception de l'email est requise" }
{ "error": "Statut invalide (TODO, DONE, IGNORED)" }
```

#### Exemple de requête

```bash
curl -X POST http://localhost:3000/api/actions \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "title": "Payer la facture #12345",
    "type": "PAY",
    "sourceSentence": "Merci de procéder au paiement de la facture #12345.",
    "emailFrom": "invoices@supplier.com",
    "emailReceivedAt": "2024-01-17T08:45:00.000Z",
    "dueDate": "2024-01-25T23:59:00.000Z"
  }'
```

#### Avec fetch (Frontend)

```typescript
const newAction = {
  title: "Appeler le client ABC",
  type: "CALL",
  sourceSentence: "Il faudrait appeler le client ABC.",
  emailFrom: "sales@company.com",
  emailReceivedAt: new Date().toISOString(),
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

const response = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(newAction),
});

const { action, message } = await response.json();
```

---

### 3. PATCH /api/actions/:id

**Modifie une action existante**

#### URL Parameters

| Paramètre | Type   | Description                |
|-----------|--------|----------------------------|
| `id`      | string | ID de l'action à modifier  |

#### Body (JSON) - Tous les champs sont optionnels

| Champ             | Type         | Description                      |
|-------------------|--------------|----------------------------------|
| `title`           | string       | Nouveau titre                    |
| `type`            | ActionType   | Nouveau type                     |
| `status`          | ActionStatus | Nouveau statut                   |
| `dueDate`         | Date / null  | Nouvelle date (ou null)          |
| `sourceSentence`  | string       | Nouvelle phrase source           |
| `emailFrom`       | string       | Nouvel expéditeur                |

#### Réponse réussie (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Appeler URGENT le client ABC",
    "type": "CALL",
    "status": "TODO",
    "dueDate": "2024-01-18T10:00:00.000Z",
    "sourceSentence": "URGENT : appeler le client ABC.",
    "emailFrom": "sales@company.com",
    "emailReceivedAt": "2024-01-16T14:20:00.000Z",
    "createdAt": "2024-01-16T14:25:00.000Z",
    "updatedAt": "2024-01-17T09:15:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action mise à jour avec succès"
}
```

#### Erreurs possibles

- `401` : Non authentifié
- `403` : Cette action ne vous appartient pas
- `404` : Action non trouvée
- `400` : Validation échouée

#### Exemple de requête

```bash
curl -X PATCH http://localhost:3000/api/actions/clx1234567890 \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "title": "Appeler URGENT le client ABC",
    "dueDate": "2024-01-18T10:00:00.000Z"
  }'
```

#### Avec fetch (Frontend)

```typescript
const actionId = "clx1234567890";
const updates = {
  title: "Appeler URGENT le client ABC",
  dueDate: new Date("2024-01-18T10:00:00.000Z").toISOString(),
};

const response = await fetch(`/api/actions/${actionId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updates),
});

const { action, message } = await response.json();
```

---

### 4. POST /api/actions/:id/done

**Marque une action comme terminée (DONE)**

#### URL Parameters

| Paramètre | Type   | Description                     |
|-----------|--------|---------------------------------|
| `id`      | string | ID de l'action à marquer DONE   |

#### Body

Aucun body requis.

#### Réponse réussie (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Appeler le client ABC",
    "type": "CALL",
    "status": "DONE",
    "dueDate": "2024-01-20T16:00:00.000Z",
    "sourceSentence": "Il faudrait appeler le client ABC.",
    "emailFrom": "sales@company.com",
    "emailReceivedAt": "2024-01-16T14:20:00.000Z",
    "createdAt": "2024-01-16T14:25:00.000Z",
    "updatedAt": "2024-01-18T11:30:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action marquée comme terminée"
}
```

#### Exemple de requête

```bash
curl -X POST http://localhost:3000/api/actions/clx1234567890/done \
  -H "Cookie: next-auth.session-token=..."
```

#### Avec fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}/done`, {
  method: 'POST',
});

const { action, message } = await response.json();
console.log(message); // "Action marquée comme terminée"
```

---

### 5. POST /api/actions/:id/ignore

**Marque une action comme ignorée (IGNORED)**

#### URL Parameters

| Paramètre | Type   | Description                        |
|-----------|--------|------------------------------------|
| `id`      | string | ID de l'action à marquer IGNORED   |

#### Body

Aucun body requis.

#### Réponse réussie (200)

```json
{
  "action": {
    "id": "clx1234567890",
    "userId": "user123",
    "title": "Envoyer les documents signés",
    "type": "SEND",
    "status": "IGNORED",
    "dueDate": null,
    "sourceSentence": "N'oublie pas de m'envoyer les documents signés.",
    "emailFrom": "legal@partner.com",
    "emailReceivedAt": "2024-01-12T13:00:00.000Z",
    "createdAt": "2024-01-12T13:05:00.000Z",
    "updatedAt": "2024-01-18T14:00:00.000Z",
    "user": {
      "id": "user123",
      "name": "John Doe",
      "email": "john@example.com"
    }
  },
  "message": "Action marquée comme ignorée"
}
```

#### Exemple de requête

```bash
curl -X POST http://localhost:3000/api/actions/clx1234567890/ignore \
  -H "Cookie: next-auth.session-token=..."
```

#### Avec fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}/ignore`, {
  method: 'POST',
});

const { action, message } = await response.json();
console.log(message); // "Action marquée comme ignorée"
```

---

### 6. DELETE /api/actions/:id

**Supprime une action**

#### URL Parameters

| Paramètre | Type   | Description                 |
|-----------|--------|-----------------------------|
| `id`      | string | ID de l'action à supprimer  |

#### Réponse réussie (200)

```json
{
  "message": "Action supprimée avec succès"
}
```

#### Exemple de requête

```bash
curl -X DELETE http://localhost:3000/api/actions/clx1234567890 \
  -H "Cookie: next-auth.session-token=..."
```

#### Avec fetch (Frontend)

```typescript
const actionId = "clx1234567890";

const response = await fetch(`/api/actions/${actionId}`, {
  method: 'DELETE',
});

const { message } = await response.json();
```

---

## 🔐 Détails de sécurité

### 1. Authentification NextAuth

Chaque endpoint commence par :
```typescript
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json(
    { error: "Non authentifié" },
    { status: 401 }
  );
}
```

### 2. Isolation des données par utilisateur

**GET /api/actions** :
```typescript
const actions = await prisma.action.findMany({
  where: {
    userId: session.user.id, // ✅ Seulement les actions de l'utilisateur
  },
});
```

**POST /api/actions** :
```typescript
const action = await prisma.action.create({
  data: {
    userId: session.user.id, // ✅ Attribué à l'utilisateur connecté
    // ... autres champs
  },
});
```

### 3. Vérification de propriété (Modification/Suppression)

Avant toute modification, on vérifie que l'action appartient à l'utilisateur :

```typescript
// 1. Récupérer l'action
const existingAction = await prisma.action.findUnique({
  where: { id },
});

// 2. Vérifier qu'elle existe
if (!existingAction) {
  return NextResponse.json(
    { error: "Action non trouvée" },
    { status: 404 }
  );
}

// 3. Vérifier la propriété
if (existingAction.userId !== session.user.id) {
  return NextResponse.json(
    { error: "Accès non autorisé" },
    { status: 403 }
  );
}

// 4. OK, on peut modifier/supprimer
```

### 4. Validation des données

**Validation simple sans Zod** :

```typescript
// Vérifier les champs requis
if (!title || typeof title !== "string" || title.trim().length === 0) {
  return NextResponse.json(
    { error: "Le titre est requis" },
    { status: 400 }
  );
}

// Vérifier les enums
if (!["SEND", "CALL", "FOLLOW_UP", "PAY", "VALIDATE"].includes(type)) {
  return NextResponse.json(
    { error: "Type d'action invalide" },
    { status: 400 }
  );
}
```

### 5. Protection contre les attaques

| Attaque                | Protection                                    |
|------------------------|-----------------------------------------------|
| **Accès non autorisé** | Vérification `userId` à chaque requête        |
| **Injection SQL**      | Prisma ORM (requêtes paramétrées)             |
| **XSS**                | Pas de rendu HTML côté serveur                |
| **CSRF**               | NextAuth CSRF protection intégré              |
| **Énumération d'IDs**  | Vérification de propriété avant chaque action |

---

## 📝 Exemples d'utilisation complets

### Créer une action, la marquer comme done, puis la supprimer

```typescript
// 1. Créer
const createResponse = await fetch('/api/actions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: "Appeler le client ABC",
    type: "CALL",
    sourceSentence: "Il faudrait appeler le client ABC.",
    emailFrom: "sales@company.com",
    emailReceivedAt: new Date().toISOString(),
  }),
});
const { action } = await createResponse.json();
console.log("Action créée:", action.id);

// 2. Marquer comme DONE
const doneResponse = await fetch(`/api/actions/${action.id}/done`, {
  method: 'POST',
});
const { message } = await doneResponse.json();
console.log(message); // "Action marquée comme terminée"

// 3. Supprimer
const deleteResponse = await fetch(`/api/actions/${action.id}`, {
  method: 'DELETE',
});
const { message: deleteMessage } = await deleteResponse.json();
console.log(deleteMessage); // "Action supprimée avec succès"
```

### Récupérer et filtrer les actions

```typescript
// Toutes les actions TODO
const todoResponse = await fetch('/api/actions?status=TODO');
const { actions: todoActions } = await todoResponse.json();

// Actions de type PAY avec échéance
const payActions = todoActions.filter(
  action => action.type === 'PAY' && action.dueDate
);

console.log(`${payActions.length} paiements à effectuer`);
```

---

## 🧪 Tests avec curl

**Créer un utilisateur de test et récupérer son token** :
```bash
# Se connecter et récupérer le cookie de session
# (dépend de votre configuration NextAuth)
```

**Tester tous les endpoints** :
```bash
# Liste
curl -X GET http://localhost:3000/api/actions

# Créer
curl -X POST http://localhost:3000/api/actions \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","type":"SEND","sourceSentence":"Test","emailFrom":"test@test.com","emailReceivedAt":"2024-01-01T00:00:00Z"}'

# Modifier
curl -X PATCH http://localhost:3000/api/actions/ACTION_ID \
  -H "Content-Type: application/json" \
  -d '{"title":"Nouveau titre"}'

# Marquer done
curl -X POST http://localhost:3000/api/actions/ACTION_ID/done

# Marquer ignoré
curl -X POST http://localhost:3000/api/actions/ACTION_ID/ignore

# Supprimer
curl -X DELETE http://localhost:3000/api/actions/ACTION_ID
```

---

## 📚 Résumé des endpoints

| Méthode | Endpoint                      | Description                  | Auth |
|---------|-------------------------------|------------------------------|------|
| GET     | `/api/actions`                | Liste des actions            | ✅   |
| POST    | `/api/actions`                | Créer une action             | ✅   |
| PATCH   | `/api/actions/:id`            | Modifier une action          | ✅   |
| DELETE  | `/api/actions/:id`            | Supprimer une action         | ✅   |
| POST    | `/api/actions/:id/done`       | Marquer comme terminée       | ✅   |
| POST    | `/api/actions/:id/ignore`     | Marquer comme ignorée        | ✅   |
