# API Contracts — Custom Action Types

Tous les endpoints requièrent une session authentifiée (NextAuth). En l'absence : **401 Unauthorized**.
Toutes les opérations sont scopées au `session.user.id` (un user ne voit jamais les types d'un autre).

---

## `GET /api/custom-action-types`

Liste les types custom de l'utilisateur courant.

**Response 200**
```json
{
  "types": [
    {
      "id": "clx123abc",
      "name": "Review code",
      "slug": "review_code",
      "keywords": ["review", "PR", "merge request"],
      "color": "violet",
      "isActive": true,
      "createdAt": "2026-04-25T10:30:00Z"
    }
  ]
}
```

- Order by `createdAt desc`
- Inclut tous les types (actifs et inactifs)

---

## `POST /api/custom-action-types`

Crée un nouveau type custom.

**Body**
```json
{
  "name": "Review code",
  "keywords": ["review", "PR", "merge request"],
  "color": "violet"
}
```

**Validation Zod**
- `name` : string, 1-50 chars, trim, requis
- `keywords` : array, min 1, max 50 entrées ; chaque keyword 4-60 chars, trim, lowercase
- `color` : enum parmi les 8 valeurs admises (`slate | blue | indigo | violet | pink | rose | orange | amber`)

**Logique**
1. Compter `prisma.customActionType.count({ where: { userId } })` ≥ 10 → **400** `{ error: "Vous avez atteint la limite de 10 types personnalisés" }`
2. Générer le slug via `nameToSlug(name)`
3. Filtrer les keywords contre une stoplist FR (`le`, `la`, `de`, `du`, etc.) → **422** `{ error: "Mots-clés trop génériques", invalidKeywords: [...] }`
4. Créer le type. Si `Prisma.PrismaClientKnownRequestError` code `P2002` (unique constraint `[userId, slug]`) → **409** `{ error: "Un type avec un nom équivalent existe déjà" }`
5. Si `color` non fourni : `color = palette[count % 8]` (rotation)
6. Invalidation cache : `revalidateTag(dashboardTag(userId))`

**Response 201**
```json
{ "type": { "id": "...", "name": "...", "slug": "...", "keywords": [...], "color": "...", "isActive": true, "createdAt": "..." } }
```

---

## `PATCH /api/custom-action-types/[id]`

Modifie un type custom existant. **Pas de re-scan rétroactif** : les Actions historiques liées gardent leur snapshot label/color.

**Body partial** (au moins un champ requis)
```json
{
  "name": "Code review",
  "keywords": ["review", "PR"],
  "color": "indigo",
  "isActive": false
}
```

**Logique**
1. `findUnique({ where: { id } })` → **404** si introuvable
2. Vérifier `type.userId === session.user.id` → **403** sinon
3. Si `name` change → recalcul slug → check 409 sur conflit (mêmes règles que POST)
4. Si `keywords` change → mêmes validations que POST (4-60 chars, stoplist)
5. Si `color` change → vérifier appartenance à la palette
6. Update + invalidation `revalidateTag(dashboardTag(userId))`

**Response 200**
```json
{ "type": { ... } }
```

---

## `DELETE /api/custom-action-types/[id]`

Supprime un type custom. Les Actions liées gardent leur snapshot label/color (ADR-001).

**Logique**
1. `findUnique({ where: { id } })` → **404** si introuvable
2. Vérifier ownership → **403** sinon
3. Compter les Actions actives liées :
   ```ts
   const affectedActions = await prisma.action.count({
     where: { customTypeId: id, status: { in: ['TODO', 'SCHEDULED'] } }
   });
   ```
4. Suppression : `prisma.customActionType.delete({ where: { id } })` (le `onDelete: SetNull` nullifie automatiquement `customTypeId` sur les Actions, sans toucher `customTypeLabel/Color`)
5. Invalidation `revalidateTag(dashboardTag(userId))`

**Response 200**
```json
{
  "success": true,
  "affectedActions": 3,
  "message": "3 actions actives gardent ce label figé"
}
```

(Le client UI peut afficher cette info dans une toast d'avertissement quand `affectedActions > 0`.)

---

## `POST /api/actions/manual` — extension

Endpoint existant, étendu pour supporter la création d'Action de type CUSTOM (avec ou sans création de règle).

**Body — cas existant (inchangé)**
```json
{
  "title": "Envoyer le rapport",
  "type": "SEND",
  "sourceSentence": "...",
  "emailFrom": "...",
  "emailReceivedAt": "...",
  "gmailMessageId": "..."
}
```

**Body — cas A : utiliser un type custom existant**
```json
{
  "title": "Review PR #42",
  "type": "CUSTOM",
  "customTypeId": "clx123abc",
  "sourceSentence": "...",
  "emailFrom": "...",
  "emailReceivedAt": "..."
}
```

Logique cas A : récupérer le `CustomActionType` correspondant pour snapshotter `customTypeLabel` et `customTypeColor` sur l'Action créée.

**Body — cas B : créer un type custom à la volée (toggle "Créer une règle")**
```json
{
  "title": "Daily stand-up",
  "type": "CUSTOM",
  "customTypeName": "Daily stand-up",
  "customTypeColor": "blue",
  "persistAsRule": true,
  "keywords": ["stand-up", "daily", "morning sync"],
  "sourceSentence": "...",
  "emailFrom": "...",
  "emailReceivedAt": "..."
}
```

Logique cas B :
- Si `persistAsRule: true` → exécuter d'abord la même logique que `POST /api/custom-action-types` (limite 10, slug unique, stoplist), puis créer l'Action référençant le nouveau `customTypeId`
- Si `persistAsRule: false` → créer l'Action SANS `customTypeId` mais AVEC `customTypeLabel` et `customTypeColor` snapshots (cas "ponctuel" — l'action existe mais aucune règle de détection future)

**Response 201**
```json
{
  "action": { "id": "...", "type": "CUSTOM", "customTypeId": "...", "customTypeLabel": "...", "customTypeColor": "..." },
  "createdCustomType": { /* présent uniquement si persistAsRule: true */ }
}
```

**Erreurs cas B** : si `persistAsRule: true` et la création du type échoue (limite 10, slug conflict, etc.), rien n'est créé (transaction Prisma `$transaction`). Renvoyer le code d'erreur du type (400/409/422).

---

## Codes HTTP — récap

| Code | Sens | Cas |
|---|---|---|
| 200 | OK | GET, PATCH, DELETE |
| 201 | Created | POST |
| 400 | Bad Request | Limite 10 atteinte, body malformé |
| 401 | Unauthorized | Pas de session |
| 403 | Forbidden | Tentative d'accès au type d'un autre user |
| 404 | Not Found | id inconnu |
| 409 | Conflict | Slug unique violé |
| 422 | Unprocessable Entity | Keyword < 4 chars, stoplist, color invalide |
| 500 | Internal Error | Erreur serveur (logger côté backend) |
