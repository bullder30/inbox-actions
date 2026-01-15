# Configuration OAuth Gmail - Inbox Actions

Guide complet pour configurer l'authentification OAuth 2.0 avec Gmail API.

---

## 🎯 Objectif

Permettre à l'application de lire les emails Gmail des utilisateurs avec leur consentement explicite, en respectant les normes de sécurité et le RGPD.

---

## 📋 Prérequis

- Compte Google Cloud Platform
- Projet Inbox Actions créé
- Accès à la Google Cloud Console

---

## 🔧 Configuration Google Cloud Platform

### Étape 1 : Créer un projet Google Cloud

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquez sur le sélecteur de projet en haut
3. Cliquez sur "Nouveau projet"
4. Nom du projet : `inbox-actions`
5. Cliquez sur "Créer"

### Étape 2 : Activer Gmail API

1. Dans le menu, allez dans **APIs & Services > Library**
2. Recherchez "Gmail API"
3. Cliquez sur "Gmail API"
4. Cliquez sur "Enable" (Activer)

### Étape 3 : Configurer l'écran de consentement OAuth

1. Allez dans **APIs & Services > OAuth consent screen**
2. Sélectionnez "External" (car l'app sera accessible publiquement)
3. Cliquez sur "Create"

**Configuration de l'écran de consentement :**

| Champ | Valeur |
|-------|--------|
| App name | Inbox Actions |
| User support email | Votre email |
| App logo | (Optionnel) |
| Application home page | https://votre-domaine.com |
| Privacy policy | https://votre-domaine.com/privacy |
| Terms of service | https://votre-domaine.com/terms |
| Authorized domains | votre-domaine.com |
| Developer contact | Votre email |

4. Cliquez sur "Save and Continue"

**Scopes (Permissions) :**

Ajoutez les scopes suivants :
- `https://www.googleapis.com/auth/gmail.readonly` - Lecture seule des emails
- `https://www.googleapis.com/auth/userinfo.email` - Email de l'utilisateur
- `https://www.googleapis.com/auth/userinfo.profile` - Profil de l'utilisateur

**Important :** N'ajoutez QUE les permissions nécessaires. Plus vous demandez de permissions, plus Google scrutera votre application.

5. Cliquez sur "Save and Continue"

**Test users :**

En mode "Testing", ajoutez les emails des utilisateurs autorisés à tester l'application.

6. Cliquez sur "Save and Continue"
7. Vérifiez le résumé et cliquez sur "Back to Dashboard"

### Étape 4 : Créer les credentials OAuth 2.0

1. Allez dans **APIs & Services > Credentials**
2. Cliquez sur "Create Credentials" > "OAuth client ID"
3. Type d'application : **Web application**

**Configuration :**

| Champ | Valeur |
|-------|--------|
| Name | Inbox Actions Web Client |
| Authorized JavaScript origins | http://localhost:3000 (dev)<br>https://votre-domaine.com (prod) |
| Authorized redirect URIs | http://localhost:3000/api/auth/callback/google (dev)<br>https://votre-domaine.com/api/auth/callback/google (prod) |

4. Cliquez sur "Create"
5. **Téléchargez le JSON** ou copiez :
   - Client ID
   - Client Secret

### Étape 5 : Passer en production (optionnel)

Pour que tous les utilisateurs puissent utiliser l'app (pas seulement les testeurs) :

1. Allez dans **OAuth consent screen**
2. Cliquez sur "Publish App"
3. Google examinera votre application (peut prendre plusieurs jours/semaines)
4. Vous devrez peut-être fournir :
   - Vidéo de démonstration
   - Lien vers l'app en production
   - Justification de l'utilisation des scopes
   - Politique de confidentialité
   - Conditions d'utilisation

**Note :** En mode "Testing", vous pouvez avoir jusqu'à 100 utilisateurs testeurs.

---

## 🔐 Configuration de l'application

### Étape 1 : Variables d'environnement

Ajoutez dans `.env.local` :

```bash
# Google OAuth
GOOGLE_CLIENT_ID=votre-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre-client-secret

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=votre-secret-aleatoire-tres-long

# Gmail API
GMAIL_SCOPES=https://www.googleapis.com/auth/gmail.readonly
```

### Étape 2 : Générer NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

Ou en Node.js :

```javascript
require('crypto').randomBytes(32).toString('base64')
```

---

## 📊 Scopes Gmail expliqués

### `gmail.readonly` - Lecture seule (RECOMMANDÉ)

**Accès :**
- Lire les emails
- Lire les labels
- Lire l'historique
- Lister les threads

**N'autorise PAS :**
- Modifier les emails
- Supprimer les emails
- Envoyer des emails
- Créer/modifier des labels

**Justification RGPD :**
- Minimisation des données : accès lecture seule uniquement
- Principe de nécessité : on ne peut que lire ce qui est nécessaire
- Limitation du risque : aucune modification possible

### Scopes alternatifs (NON utilisés)

| Scope | Description | Pourquoi on ne l'utilise PAS |
|-------|-------------|------------------------------|
| `gmail.modify` | Lecture + modification | Trop permissif |
| `gmail.send` | Envoyer des emails | Non nécessaire |
| `gmail.labels` | Gérer les labels | Non nécessaire |
| `gmail.compose` | Créer des brouillons | Non nécessaire |

---

## 🔄 Flux OAuth 2.0

### 1. Utilisateur clique "Connecter Gmail"

```
User (Browser) → App Server → Google OAuth
```

### 2. Redirection vers Google

```
Google affiche :
┌─────────────────────────────────────┐
│ Inbox Actions souhaite accéder à :  │
│ ☑ Lire vos emails Gmail             │
│ ☑ Voir votre adresse email          │
│                                     │
│ [Annuler]  [Autoriser]              │
└─────────────────────────────────────┘
```

### 3. Utilisateur accepte

```
Google → Redirect to: /api/auth/callback/google?code=xxx
```

### 4. Échange du code contre des tokens

```javascript
{
  access_token: "ya29.a0AfH6...",      // Valide 1h
  refresh_token: "1//0gKh...",         // Valide indéfiniment
  scope: "gmail.readonly",
  token_type: "Bearer",
  expires_in: 3600
}
```

### 5. Stockage sécurisé

Les tokens sont stockés dans la base de données (table `Account` via NextAuth).

---

## 🔒 Sécurité

### Tokens stockés de manière sécurisée

✅ **Base de données :**
- Tokens chiffrés si possible (voir NextAuth configuration)
- Accès restreint par userId
- Refresh token utilisé pour renouveler access token

❌ **JAMAIS :**
- Dans localStorage
- Dans cookies non sécurisés
- Dans code source
- Dans logs

### Rotation des tokens

```javascript
// Access token expire après 1h
// Refresh token utilisé automatiquement par NextAuth
// Si refresh échoue → Demander nouvelle autorisation
```

### Révocation

L'utilisateur peut révoquer l'accès à tout moment :
1. Via https://myaccount.google.com/permissions
2. Via l'interface Inbox Actions (bouton "Déconnecter Gmail")

---

## 🧪 Test de la configuration

### 1. Vérifier les credentials

```bash
# Vérifier que les variables sont définies
echo $GOOGLE_CLIENT_ID
echo $GOOGLE_CLIENT_SECRET
```

### 2. Tester l'authentification

1. Lancez l'application : `pnpm dev`
2. Allez sur http://localhost:3000
3. Cliquez sur "Connecter avec Google"
4. Autorisez l'application
5. Vérifiez que vous êtes redirigé vers l'app

### 3. Vérifier les tokens

```javascript
// Dans la console NextAuth
const session = await auth();
console.log(session.accessToken); // Devrait exister
```

---

## 🚨 Résolution des problèmes

### Erreur : "redirect_uri_mismatch"

**Cause :** L'URL de redirection ne correspond pas à celle configurée dans Google Cloud.

**Solution :**
1. Vérifiez que `NEXTAUTH_URL` est correct
2. Vérifiez que l'URL de callback est identique dans :
   - Google Cloud Console
   - NextAuth configuration

### Erreur : "access_denied"

**Cause :** L'utilisateur a refusé l'autorisation OU n'est pas dans la liste des testeurs.

**Solution :**
1. Si en mode "Testing", ajoutez l'email dans les test users
2. Vérifiez que l'utilisateur a bien cliqué sur "Autoriser"

### Erreur : "invalid_grant"

**Cause :** Le refresh token est invalide ou révoqué.

**Solution :**
1. Supprimez les tokens de la base de données
2. Demandez à l'utilisateur de se reconnecter

### Tokens non stockés

**Cause :** NextAuth n'a pas accès au refresh token.

**Solution :**
Ajoutez `access_type: "offline"` dans la configuration Google Provider :

```typescript
GoogleProvider({
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  authorization: {
    params: {
      access_type: "offline",
      prompt: "consent",
      scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly"
    }
  }
})
```

---

## 📚 Ressources

### Documentation officielle

- [Gmail API Overview](https://developers.google.com/gmail/api/guides)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Gmail API Scopes](https://developers.google.com/gmail/api/auth/scopes)
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)

### Limites et quotas

| Opération | Quota par jour | Quota par seconde |
|-----------|----------------|-------------------|
| Requêtes API | 1,000,000,000 | 250 |
| Envois | 10,000 | - |

**Note :** Pour une app en lecture seule, ces quotas sont largement suffisants.

### Conformité RGPD

- ✅ Consentement explicite (écran OAuth)
- ✅ Droit d'accès (utilisateur peut voir ses données)
- ✅ Droit à l'effacement (déconnexion = suppression tokens)
- ✅ Minimisation des données (lecture seule uniquement)
- ✅ Limitation de la conservation (emails non stockés)
- ✅ Sécurité (tokens chiffrés, HTTPS uniquement)

---

## ✅ Checklist finale

Avant de passer en production :

- [ ] Client ID et Client Secret configurés
- [ ] NEXTAUTH_SECRET généré de manière sécurisée
- [ ] Scopes minimaux configurés (gmail.readonly uniquement)
- [ ] Écran de consentement complété
- [ ] Politique de confidentialité publiée
- [ ] Conditions d'utilisation publiées
- [ ] Domaine autorisé ajouté
- [ ] URLs de redirection en HTTPS
- [ ] Test users ajoutés (mode Testing)
- [ ] Demande de vérification Google soumise (si publication)
- [ ] Gestion de la révocation implémentée
- [ ] Logs de sécurité configurés
- [ ] Rotation automatique des tokens testée

---

## 🎯 Résumé

L'authentification OAuth Gmail pour Inbox Actions :

✅ **Sécurisé** - Tokens stockés en base, HTTPS uniquement
✅ **Conforme RGPD** - Consentement explicite, minimisation des données
✅ **Lecture seule** - Scope `gmail.readonly` uniquement
✅ **Transparent** - Utilisateur voit exactement ce qui est autorisé
✅ **Révocable** - L'utilisateur garde le contrôle

L'utilisateur reste propriétaire de ses données à tout moment.
