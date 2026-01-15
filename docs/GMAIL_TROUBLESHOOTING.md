# Dépannage Gmail - Inbox Actions

Guide de résolution des problèmes courants avec l'intégration Gmail.

---

## 🔴 Erreur : "Access token expired"

### Symptôme

```
Error: Access token expired. Please reconnect your Gmail account.
```

### Cause

Le token d'accès Gmail a expiré et le système n'a pas pu le rafraîchir automatiquement. Cela peut arriver si :

1. Vous vous êtes connecté **avant** que la configuration OAuth soit complète
2. Le refresh token n'a pas été sauvegardé lors de la première connexion
3. Le scope `gmail.readonly` n'était pas présent lors de la connexion initiale

### Solution

#### Option 1 : Déconnecter et reconnecter Gmail (RECOMMANDÉ)

1. Allez dans **Dashboard > Settings**
2. Cliquez sur **Déconnecter** dans la section Gmail
3. Confirmez la déconnexion
4. Cliquez sur **Connecter Gmail**
5. Autorisez tous les accès demandés (gmail.readonly inclus)

#### Option 2 : Vérifier la base de données

Vérifiez que le refresh token est bien présent :

```sql
SELECT
  provider,
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  scope
FROM accounts
WHERE provider = 'google';
```

Si `has_refresh_token` est `false`, vous devez vous reconnecter.

#### Option 3 : Révoquer et reconnecter

1. Allez sur https://myaccount.google.com/permissions
2. Trouvez "Inbox Actions" dans la liste
3. Cliquez sur "Supprimer l'accès"
4. Retournez sur Inbox Actions
5. Reconnectez-vous avec Google

---

## 🔴 Erreur : "Gmail n'est pas connecté"

### Symptôme

```json
{
  "error": "Gmail n'est pas connecté",
  "code": "GMAIL_NOT_CONNECTED"
}
```

### Cause

Aucun compte Google n'est associé à votre compte utilisateur.

### Solution

1. Allez dans **Dashboard > Settings**
2. Cliquez sur **Connecter Gmail**
3. Sélectionnez votre compte Google
4. Autorisez les accès demandés

---

## 🔴 Erreur : "redirect_uri_mismatch"

### Symptôme

Lors de la connexion Google, erreur :

```
Error 400: redirect_uri_mismatch
```

### Cause

L'URL de redirection configurée dans Google Cloud Console ne correspond pas à celle utilisée par l'application.

### Solution

1. Allez dans [Google Cloud Console](https://console.cloud.google.com/)
2. Sélectionnez votre projet
3. **APIs & Services > Credentials**
4. Cliquez sur votre OAuth 2.0 Client ID
5. Vérifiez que les URLs suivantes sont dans **Authorized redirect URIs** :
   - `http://localhost:3000/api/auth/callback/google` (dev)
   - `https://votre-domaine.com/api/auth/callback/google` (prod)
6. Assurez-vous que `NEXTAUTH_URL` dans `.env.local` correspond

---

## 🔴 Erreur : "invalid_grant"

### Symptôme

```
Error: invalid_grant
```

### Cause

Le refresh token est invalide ou a été révoqué.

### Solution

1. Déconnectez Gmail depuis **Dashboard > Settings**
2. Reconnectez-vous

Si le problème persiste :

1. Révoquez l'accès via https://myaccount.google.com/permissions
2. Reconnectez-vous

---

## 🔴 Pas de refresh token sauvegardé

### Symptôme

Le token expire après 1 heure et l'utilisateur doit se reconnecter à chaque fois.

### Cause

Le paramètre `access_type: "offline"` n'était pas présent lors de la première connexion.

### Solution

**Vérification de la configuration :**

`auth.config.ts` doit contenir :

```typescript
Google({
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      access_type: "offline",
      prompt: "consent",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
    },
  },
})
```

**Si la configuration est correcte mais le problème persiste :**

Google ne renvoie le refresh token QUE lors de la première autorisation. Pour forcer un nouveau refresh token :

1. Révoquez l'accès sur https://myaccount.google.com/permissions
2. OU supprimez le compte en base de données :
   ```sql
   DELETE FROM accounts WHERE provider = 'google' AND user_id = 'votre-user-id';
   ```
3. Reconnectez-vous

---

## 🔴 Erreur : "insufficientPermissions"

### Symptôme

```json
{
  "error": {
    "code": 403,
    "message": "Request had insufficient authentication scopes."
  }
}
```

### Cause

Le scope `gmail.readonly` n'a pas été accordé lors de la connexion.

### Solution

1. Vérifiez dans la base de données :
   ```sql
   SELECT scope FROM accounts WHERE provider = 'google';
   ```
2. Si `gmail.readonly` n'est pas présent :
   - Déconnectez Gmail
   - Reconnectez-vous
   - **IMPORTANT** : Cochez toutes les cases lors de l'écran de consentement Google

---

## 🔴 Erreur : "quotaExceeded"

### Symptôme

```json
{
  "error": {
    "code": 429,
    "message": "Quota exceeded for quota metric..."
  }
}
```

### Cause

Vous avez dépassé les quotas Gmail API (1 milliard de requêtes par jour, 250 par seconde).

### Solution

1. Attendez quelques minutes/heures
2. Réduisez `maxResults` lors de la synchronisation
3. Vérifiez les quotas dans [Google Cloud Console](https://console.cloud.google.com/apis/api/gmail.googleapis.com/quotas)

---

## 🔴 Synchronisation lente ou timeout

### Symptôme

La synchronisation prend beaucoup de temps ou timeout.

### Cause

Trop d'emails à récupérer en une seule fois.

### Solution

Réduisez le nombre d'emails par synchronisation :

```typescript
await syncGmail({ maxResults: 50 }); // Au lieu de 100
```

---

## 🟡 Warning : Token rafraîchi automatiquement

### Symptôme

Dans les logs :

```
Access token expired, refreshing...
Token refreshed successfully
```

### Cause

Le token a expiré (durée de vie : 1 heure) et a été rafraîchi automatiquement.

### Solution

**Aucune action nécessaire** - C'est le comportement normal. Le système rafraîchit automatiquement les tokens expirés.

Si vous voyez ce message trop souvent (plusieurs fois par heure), cela peut indiquer un problème :

1. Vérifiez que `expires_at` est correctement stocké en base
2. Vérifiez que l'horloge système est correcte

---

## 🔧 Commandes de diagnostic

### Vérifier le statut Gmail

```bash
curl http://localhost:3000/api/gmail/status \
  -H "Cookie: your-session-cookie"
```

### Vérifier les comptes en base

```sql
SELECT
  id,
  provider,
  provider_account_id,
  access_token IS NOT NULL as has_access_token,
  refresh_token IS NOT NULL as has_refresh_token,
  expires_at,
  scope,
  created_at
FROM accounts
WHERE provider = 'google';
```

### Vérifier les emails synchronisés

```sql
SELECT
  COUNT(*) as total_emails,
  COUNT(CASE WHEN processed = false THEN 1 END) as unprocessed
FROM email_metadata;
```

### Vérifier la dernière synchronisation

```sql
SELECT
  email,
  last_gmail_sync,
  gmail_history_id
FROM users
WHERE last_gmail_sync IS NOT NULL
ORDER BY last_gmail_sync DESC;
```

---

## 🛠️ Réinitialisation complète

Si rien ne fonctionne, réinitialisez complètement :

```sql
-- Supprimer toutes les métadonnées d'emails
DELETE FROM email_metadata;

-- Supprimer le compte Google
DELETE FROM accounts WHERE provider = 'google';

-- Réinitialiser les champs Gmail de l'utilisateur
UPDATE users SET
  last_gmail_sync = NULL,
  gmail_history_id = NULL;
```

Puis reconnectez-vous avec Google.

---

## 📞 Besoin d'aide ?

Si le problème persiste après avoir essayé ces solutions :

1. Consultez les logs serveur pour plus de détails
2. Vérifiez la [documentation Google OAuth](https://developers.google.com/identity/protocols/oauth2)
3. Vérifiez la [documentation Gmail API](https://developers.google.com/gmail/api/guides)
4. Ouvrez une issue sur GitHub avec :
   - Message d'erreur complet
   - Étapes pour reproduire
   - Configuration (sans les secrets!)

---

## ✅ Checklist de vérification

Avant de signaler un bug, vérifiez :

- [ ] Variables d'environnement définies (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)
- [ ] Configuration OAuth dans auth.config.ts correcte
- [ ] Google Cloud OAuth configuré (callback URLs)
- [ ] Compte Google connecté en base de données
- [ ] Refresh token présent en base
- [ ] Scope `gmail.readonly` autorisé
- [ ] Dernière version du code (avec rafraîchissement automatique)

---

## 🎯 Prévention

Pour éviter ces problèmes à l'avenir :

1. ✅ Toujours utiliser `access_type: "offline"` et `prompt: "consent"`
2. ✅ Ne jamais stocker les tokens en clair dans les logs
3. ✅ Implémenter le rafraîchissement automatique des tokens
4. ✅ Gérer les erreurs de manière explicite
5. ✅ Tester la révocation et reconnexion régulièrement
