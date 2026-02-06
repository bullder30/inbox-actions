# Extraction d'Actions par Regex - Documentation

Guide complet du système d'extraction d'actions déterministe basé sur des regex.

---

## Vue d'ensemble

### Objectif

Détecter automatiquement des actions explicites dans les emails professionnels en français, de manière **déterministe et transparente**.

### Méthode

- **Regex uniquement** : Aucune IA opaque, patterns explicites
- **Règle d'or** : Si ambigu → aucune action détectée
- **RGPD-compliant** : Le corps des emails n'est JAMAIS stocké

### Actions détectées

| Type | Description | Exemples |
|------|-------------|----------|
| `SEND` | Envoyer quelque chose | "peux-tu m'envoyer le rapport" |
| `CALL` | Appeler/Rappeler quelqu'un | "rappelle le client demain" |
| `FOLLOW_UP` | Relancer quelqu'un | "merci de relancer l'équipe" |
| `PAY` | Payer une facture | "peux-tu régler la facture" |
| `VALIDATE` | Valider un document | "il faut valider le contrat" |

---

## Architecture du système

### Fichiers

```
lib/actions/
├── extract-actions-regex.ts      # Moteur d'extraction
└── extract-actions-examples.ts   # Tests et exemples

app/api/email/analyze/route.ts    # API endpoint
```

### Flux de traitement

```
Email reçu
    ↓
Vérification exclusions (newsletters, no-reply)
    ↓
Découpage en phrases
    ↓
Pour chaque phrase:
    - Détection de conditionnels → Skip si trouvé
    - Application des regex par type
    - Extraction de l'objet de l'action
    - Extraction de la date d'échéance
    - Création de l'action
    ↓
Déduplication
    ↓
Retour des actions
```

---

## Patterns Regex détaillés

### 1. SEND (Envoyer)

**Objectif** : Détecter les demandes d'envoi de documents, fichiers, rapports.

**Patterns** :

```typescript
// Pattern 1 : Formes polies
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu m'envoyer le rapport Q4"
// ✅ "Merci de m'envoyer la présentation"
// ✅ "Pourriez-vous envoyer le fichier Excel"

// Pattern 2 : Impératif
/(?:envoie|envoyez)(?:-moi)?\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Envoie-moi le document"
// ✅ "Envoyez la facture"

// Pattern 3 : "Il faut"
/il (?:faut|faudrait)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Il faut m'envoyer le contrat"
// ✅ "Il faudrait envoyer la proposition"

// Pattern 4 : Transmettre
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?(?:transmettre|faire parvenir)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu me transmettre le dossier"
// ✅ "Merci de faire parvenir les documents"

// Pattern 5 : Envoyer par email
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:m[''])?envoyer\s+(?:par\s+)?(?:email|mail)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu m'envoyer par email le fichier"
// ✅ "Merci de m'envoyer par mail la présentation"

// Pattern 6 : Partager
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?partager\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu me partager le lien"
// ✅ "Merci de partager le document"
```

**Capture** : Le groupe de capture `(.{1,100}?)` extrait l'objet à envoyer (ex: "le rapport Q4", "la présentation", "le fichier Excel").

---

### 2. CALL (Appeler/Rappeler)

**Objectif** : Détecter les demandes d'appel téléphonique ou visio.

**Patterns** :

```typescript
// Pattern 1 : Rappeler (formes polies)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?rappeler\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour|demain|lundi|mardi)/i

// Exemples :
// ✅ "Peux-tu me rappeler demain"
// ✅ "Merci de rappeler le client"
// ✅ "Pourriez-vous me rappeler avant vendredi"

// Pattern 2 : Impératif rappeler
/(?:rappelle|rappelez)(?:-moi)?\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour|demain|lundi|mardi)/i

// Exemples :
// ✅ "Rappelle-moi demain"
// ✅ "Rappelez le fournisseur"

// Pattern 3 : Il faut rappeler
/il (?:faut|faudrait)\s+rappeler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Il faut rappeler Marie"
// ✅ "Il faudrait rappeler le client"

// Pattern 4 : Appeler
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+appeler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu appeler Jean"
// ✅ "Merci d'appeler le fournisseur"

// Pattern 5 : Contacter
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+contacter\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu contacter le client"
// ✅ "Merci de contacter Marie"
```

**Capture** : Le groupe de capture extrait la personne à appeler ou un complément de temps.

---

### 3. FOLLOW_UP (Relancer)

**Objectif** : Détecter les demandes de relance ou suivi.

**Patterns** :

```typescript
// Pattern 1 : Relancer (formes polies)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+relancer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu relancer l'équipe technique"
// ✅ "Merci de relancer le fournisseur"

// Pattern 2 : Impératif relancer
/(?:relance|relancez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Relance le client"
// ✅ "Relancez l'équipe"

// Pattern 3 : Il faut relancer
/il (?:faut|faudrait)\s+relancer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Il faut relancer le prestataire"
// ✅ "Il faudrait relancer Marie"

// Pattern 4 : Faire un suivi
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+(?:un\s+)?(?:suivi|le suivi)\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu faire un suivi du dossier"
// ✅ "Merci de faire le suivi"

// Pattern 5 : Faire un rappel
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+un\s+rappel\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu faire un rappel au client"
// ✅ "Merci de faire un rappel"
```

---

### 4. PAY (Payer)

**Objectif** : Détecter les demandes de paiement de factures.

**Patterns** :

```typescript
// Pattern 1 : Régler (formes polies)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+régler\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu régler la facture"
// ✅ "Merci de régler le prestataire"

// Pattern 2 : Impératif régler
/(?:règle|réglez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Règle la facture avant vendredi"
// ✅ "Réglez le fournisseur"

// Pattern 3 : Il faut régler/payer
/il (?:faut|faudrait)\s+(?:régler|payer)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Il faut régler la facture"
// ✅ "Il faudrait payer le prestataire"

// Pattern 4 : Payer
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+payer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu payer la facture"
// ✅ "Merci de payer le consultant"

// Pattern 5 : Faire un virement
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+faire\s+(?:un\s+)?virement\s*(.{0,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu faire un virement au fournisseur"
// ✅ "Merci de faire un virement"
```

---

### 5. VALIDATE (Valider)

**Objectif** : Détecter les demandes de validation de documents.

**Patterns** :

```typescript
// Pattern 1 : Valider (formes polies)
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+valider\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu valider le contrat"
// ✅ "Merci de valider la proposition"

// Pattern 2 : Impératif valider
/(?:valide|validez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Valide le document"
// ✅ "Validez le devis"

// Pattern 3 : Il faut valider
/il (?:faut|faudrait)\s+valider\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Il faut valider le budget"
// ✅ "Il faudrait valider le planning"

// Pattern 4 : Approuver
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+approuver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu approuver la demande"
// ✅ "Merci d'approuver le projet"

// Pattern 5 : Confirmer
/(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+confirmer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i

// Exemples :
// ✅ "Peux-tu confirmer la réservation"
// ✅ "Merci de confirmer le rendez-vous"
```

---

## Règles d'exclusion

### Expéditeurs exclus

Emails automatiques ou marketing à ignorer :

```typescript
const FROM_EXCLUSIONS = [
  /no-?reply@/i,
  /noreply@/i,
  /newsletter@/i,
  /notifications?@/i,
  /automated?@/i,
  /do-not-reply@/i,
];
```

**Exemples exclus** :
- ❌ `no-reply@service.com`
- ❌ `noreply@bank.com`
- ❌ `newsletter@company.com`
- ❌ `notifications@app.com`

---

### Sujets exclus

Sujets typiques d'emails marketing ou automatiques :

```typescript
const SUBJECT_EXCLUSIONS = [
  /newsletter/i,
  /unsubscribe/i,
  /désabonnement/i,
  /confirmation\s+de\s+commande/i,
  /votre\s+facture/i,
  /reçu\s+de\s+paiement/i,
  /ticket\s+#?\d+/i,
];
```

**Exemples exclus** :
- ❌ "Newsletter Janvier 2026"
- ❌ "Confirmation de commande"
- ❌ "Votre facture du mois"
- ❌ "Ticket #12345"

---

### Corps d'email exclus

Phrases typiques d'emails marketing :

```typescript
const BODY_EXCLUSIONS = [
  /cliquez\s+ici\s+pour\s+vous\s+désabonner/i,
  /ne\s+pas\s+répondre\s+à\s+cet\s+email/i,
  /do\s+not\s+reply/i,
  /this\s+is\s+an\s+automated\s+message/i,
  /pour\s+vous\s+désinscrire/i,
];
```

**Exemples exclus** :
- ❌ Email contenant "Cliquez ici pour vous désabonner"
- ❌ Email contenant "Ne pas répondre à cet email"

---

### Conditionnels (ambiguïté)

**Principe** : Si une phrase contient un conditionnel, elle est **ignorée** car ambiguë.

```typescript
const CONDITIONAL_PATTERNS = [
  /si\s+(?:tu\s+)?(?:peux|as le temps|c['']est possible)/i,
  /(?:quand|lorsque)\s+tu\s+(?:auras|as)\s+(?:le\s+)?temps/i,
  /si\s+jamais/i,
  /éventuellement/i,
  /si\s+(?:cela|ça)\s+(?:te|vous)\s+(?:convient|arrange)/i,
];
```

**Exemples exclus** :
- ❌ "**Si tu peux**, envoie-moi le rapport" → Pas d'action détectée
- ❌ "**Quand tu auras le temps**, rappelle le client" → Pas d'action
- ❌ "**Éventuellement**, valide le document" → Pas d'action
- ❌ "**Si ça te convient**, envoie le fichier" → Pas d'action

---

## Extraction de dates d'échéance

### Dates relatives (jours de la semaine)

```typescript
// Pattern : "avant lundi", "d'ici vendredi"
/avant\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i
/d['']ici\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i

// Logique :
// Si le jour mentionné est dans le futur cette semaine → cette semaine
// Sinon → semaine prochaine
```

**Exemples** (reçu le lundi 6 janvier 2026) :
- "avant vendredi" → Vendredi 10 janvier 2026
- "d'ici lundi" → Lundi 13 janvier 2026 (semaine suivante)

---

### Dates absolues (jour + mois)

```typescript
// Pattern : "avant le 15 janvier", "pour le 30 décembre"
/avant\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i
/pour\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i

// Logique :
// Si le mois est dans le futur cette année → cette année
// Sinon → année prochaine
```

**Exemples** (reçu le 6 janvier 2026) :
- "avant le 15 janvier" → 15 janvier 2026
- "avant le 30 décembre" → 30 décembre 2026

---

### Dates relatives (jours)

```typescript
// Pattern : "dans 3 jours", "d'ici 5 jours"
/(?:d['']ici|dans)\s+(\d+)\s+jours?/i

// Logique :
// Ajouter N jours à la date de réception
```

**Exemples** (reçu le 6 janvier 2026) :
- "dans 3 jours" → 9 janvier 2026
- "d'ici 5 jours" → 11 janvier 2026

---

### Dates spéciales

```typescript
// "demain"
/demain/i
// → Date de réception + 1 jour

// "cette semaine" / "fin de semaine"
/(?:cette\s+semaine|fin\s+de\s+(?:la\s+)?semaine)/i
// → Vendredi de la semaine en cours

// "fin de mois"
/fin\s+de\s+mois/i
// → Dernier jour du mois en cours
```

**Exemples** (reçu le lundi 6 janvier 2026) :
- "demain" → 7 janvier 2026
- "cette semaine" → Vendredi 10 janvier 2026
- "fin de mois" → 31 janvier 2026

---

### Heures spécifiques pour les deadlines

**Nouveau** : Toutes les deadlines incluent maintenant des heures spécifiques pour une meilleure gestion des urgences.

| Expression | Heure assignée | Exemple |
|------------|---------------|---------|
| **"avant midi"** / **"ce matin"** | 12h00 | Email reçu 10h → deadline 12h le jour même |
| **"cet après-midi"** | 18h00 | Email reçu 10h → deadline 18h le jour même |
| **"ce soir"** | 20h00 | Email reçu 10h → deadline 20h le jour même |
| **"en fin de journée"** | 18h00 | Email reçu 10h → deadline 18h le jour même |
| **"aujourd'hui"** | 18h00 | Email reçu 10h → deadline 18h le jour même |
| **"demain"** | 18h00 | Email reçu 10h → deadline 18h le lendemain |
| **"cette semaine"** / **"fin de semaine"** | Vendredi 18h00 | Email reçu lundi → deadline vendredi 18h |
| **"dans X jours"** | 18h00 | "dans 3 jours" → deadline à 18h dans 3 jours |
| **Dates absolues** (ex: "15 mars") | 18h00 | "avant le 15 mars" → 15 mars à 18h |

**Avantages** :
- ✅ Détection précise des actions urgentes (aujourd'hui avant 18h)
- ✅ Meilleure priorisation dans l'interface
- ✅ Heures cohérentes et prévisibles

---

### Nettoyage et normalisation des phrases

Le système nettoie automatiquement les phrases avant l'analyse pour supporter différents formats :

```typescript
function cleanSentence(sentence: string): string {
  return sentence
    .trim()
    // Enlever les tirets au début (listes)
    .replace(/^[-•*]\s*/, "")
    // Enlever les guillemets au début et à la fin
    .replace(/^["'"«»]\s*/, "")
    .replace(/\s*["'"«»]$/, "")
    .trim();
}
```

**Formats supportés** :
```
✅ - "peux-tu m'envoyer le rapport"
✅ • "envoie-moi la présentation"
✅ * merci de transmettre le document
✅ "pourriez-vous faire parvenir le fichier"
✅ peux-tu valider le devis ?
```

**Découpage amélioré** :
- Split par retours à la ligne (`\n`)
- ET par ponctuation (`.!?`)
- Permet de traiter les listes à puces et emails formatés

---

## Processus de traitement

### 1. Découpage en phrases

Le corps de l'email est découpé en phrases en utilisant **retours à la ligne** ET **ponctuation** :

```typescript
// Découper en phrases : par ponctuation ET par retours à la ligne
const lines = context.body.split(/\n/);
const sentences: string[] = [];

for (const line of lines) {
  // Splitter chaque ligne par ponctuation aussi
  const lineSentences = line.split(/[.!?]\s+/);
  sentences.push(...lineSentences);
}

// Nettoyer chaque phrase
for (let sentence of sentences) {
  sentence = cleanSentence(sentence); // Enlève tirets et guillemets

  // Ignorer les phrases trop courtes ou trop longues
  if (sentence.length < 10 || sentence.length > 500) continue;

  // Traiter la phrase...
}
```

**Améliorations** :
- ✅ Support des listes à puces (tirets `-`, `•`, `*`)
- ✅ Support des guillemets (`"`, `'`, `«`, `»`)
- ✅ Découpage par lignes pour emails formatés
- ✅ Phrases de 10 à 500 caractères

---

### 2. Vérification de conditionnels

Pour chaque phrase, on vérifie si elle contient un conditionnel :

```typescript
function hasConditional(sentence: string): boolean {
  return CONDITIONAL_PATTERNS.some(pattern => pattern.test(sentence));
}
```

**Si conditionnel détecté** → La phrase est ignorée (règle d'or : si ambigu → pas d'action).

---

### 3. Application des regex

Pour chaque type d'action, on applique tous les patterns à la phrase :

```typescript
for (const pattern of SEND_PATTERNS) {
  const match = sentence.match(pattern);
  if (match) {
    // Extraire l'objet de l'action
    const actionObject = match[1]?.trim() || "";

    // Créer un titre
    const title = `Envoyer ${actionObject}`.substring(0, 100);

    // Créer l'action
    actions.push({
      title,
      type: "SEND",
      sourceSentence: sentence.substring(0, 200),
      dueDate: extractDeadline(sentence, context.receivedAt),
    });

    break; // Une seule action par phrase
  }
}
```

---

### 4. Déduplication

Après extraction, on déduplique les actions identiques :

```typescript
function deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
  const seen = new Set<string>();
  return actions.filter(action => {
    const key = `${action.type}:${action.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## Tests et exemples

### Fichier de tests

Voir `lib/actions/extract-actions-examples.ts` pour 11 exemples complets.

### Lancer les tests

```typescript
import { runExamples } from "@/lib/actions/extract-actions-examples";

runExamples();
```

**Sortie attendue** :
```
========================================
TESTS D'EXTRACTION D'ACTIONS PAR REGEX
========================================

✅ Exemple 1 : SEND simple
   Expéditeur: boss@company.com
   Sujet: Rapport Q4
   Actions détectées: 1 (attendu: 1)
   1. [SEND] Envoyer le rapport Q4
      Source: "Peux-tu m'envoyer le rapport Q4 avant vendredi ?"
      Échéance: 10/01/2026

...

========================================
Résultats: 11 réussis, 0 échoués
========================================
```

---

## Exemples concrets

### ✅ Exemple positif 1 : SEND simple

**Email** :
```
De: boss@company.com
Sujet: Rapport Q4
Corps:
Bonjour,

Peux-tu m'envoyer le rapport Q4 avant vendredi ?

Merci,
Jean
```

**Action extraite** :
```json
{
  "title": "Envoyer le rapport Q4",
  "type": "SEND",
  "sourceSentence": "Peux-tu m'envoyer le rapport Q4 avant vendredi ?",
  "dueDate": "2026-01-10T00:00:00.000Z"
}
```

---

### ✅ Exemple positif 2 : CALL rappel

**Email** :
```
De: client@example.com
Sujet: Devis urgent
Corps:
Bonjour,

J'ai bien reçu votre devis.

Pourriez-vous me rappeler demain pour discuter des détails ?

Cordialement,
Marie Dupont
```

**Action extraite** :
```json
{
  "title": "Rappeler demain pour discuter des détails",
  "type": "CALL",
  "sourceSentence": "Pourriez-vous me rappeler demain pour discuter des détails ?",
  "dueDate": "2026-01-07T00:00:00.000Z"
}
```

---

### ✅ Exemple positif 3 : Actions multiples

**Email** :
```
De: director@company.com
Sujet: Préparation réunion client
Corps:
Bonjour,

Pour préparer la réunion client de jeudi :

1. Peux-tu m'envoyer la présentation PowerPoint avant mercredi ?
2. Merci de rappeler le client pour confirmer l'heure.
3. Il faudrait aussi valider le budget avec la compta.

Merci,
Directeur
```

**Actions extraites** :
```json
[
  {
    "title": "Envoyer la présentation PowerPoint",
    "type": "SEND",
    "sourceSentence": "Peux-tu m'envoyer la présentation PowerPoint avant mercredi ?",
    "dueDate": "2026-01-08T00:00:00.000Z"
  },
  {
    "title": "Rappeler le client pour confirmer l'heure",
    "type": "CALL",
    "sourceSentence": "Merci de rappeler le client pour confirmer l'heure",
    "dueDate": null
  },
  {
    "title": "Valider le budget avec la compta",
    "type": "VALIDATE",
    "sourceSentence": "Il faudrait aussi valider le budget avec la compta",
    "dueDate": null
  }
]
```

---

### ❌ Exemple négatif 1 : Newsletter (exclu)

**Email** :
```
De: newsletter@techcompany.com
Sujet: Newsletter Janvier 2026
Corps:
Bonjour,

Découvrez nos nouveautés ce mois-ci !

Pour vous désinscrire, cliquez ici.
```

**Actions extraites** : `[]` (aucune)

**Raison** : Expéditeur `newsletter@` exclu.

---

### ❌ Exemple négatif 2 : Conditionnel (ambigu)

**Email** :
```
De: colleague@company.com
Sujet: Question rapide
Corps:
Salut,

Si tu as le temps, tu pourrais m'envoyer le fichier Excel ?

Pas urgent.
```

**Actions extraites** : `[]` (aucune)

**Raison** : Phrase contient "**Si tu as le temps**" → conditionnel détecté → ambiguïté → pas d'action.

---

### ❌ Exemple négatif 3 : Action par expéditeur (pas une demande)

**Email** :
```
De: sender@company.com
Sujet: Compte-rendu réunion
Corps:
Bonjour,

Je vais envoyer le compte-rendu à l'équipe.
Je rappellerai le client demain.

Bonne journée,
Paul
```

**Actions extraites** : `[]` (aucune)

**Raison** : L'expéditeur dit ce qu'**il va faire**, pas ce qu'il **demande au destinataire** de faire.

---

## Ajout de nouveaux patterns

### Procédure

1. **Identifier le besoin** : Quel type d'action n'est pas détecté ?
2. **Créer le pattern** : Utiliser les formes impératives françaises
3. **Tester** : Ajouter un exemple dans `extract-actions-examples.ts`
4. **Valider** : Lancer `runExamples()`

### Exemple : Ajouter "BOOK" (Réserver)

```typescript
// 1. Ajouter le type dans Prisma schema
enum ActionType {
  SEND
  CALL
  FOLLOW_UP
  PAY
  VALIDATE
  BOOK  // Nouveau
}

// 2. Créer les patterns
const BOOK_PATTERNS = [
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+réserver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /(?:réserve|réservez)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /il (?:faut|faudrait)\s+réserver\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
];

// 3. Ajouter dans extractActionsFromEmail
actions.push(...extractActionsByType("BOOK", BOOK_PATTERNS, context));

// 4. Ajouter un test
const exampleBook: EmailContext = {
  from: "manager@company.com",
  subject: "Réunion client",
  body: "Peux-tu réserver la salle de réunion pour jeudi ?",
  receivedAt: new Date("2026-01-06T10:00:00"),
};
```

---

## Limitations connues

### 1. Emails complexes

Les emails très longs (> 500 caractères par phrase) peuvent ne pas être analysés correctement.

**Solution** : Améliorer le découpage en phrases pour gérer les listes numérotées et les paragraphes.

---

### 2. Négations

Le système ne détecte pas bien les négations :

❌ "**Ne pas** envoyer le document avant validation" → Détecté comme SEND (erreur)

**Solution future** : Ajouter un pattern de négation :
```typescript
const NEGATION_PATTERNS = [
  /ne\s+(?:pas|jamais|plus)\s+(?:envoyer|rappeler|valider|payer|relancer)/i,
];
```

---

### 3. Actions implicites

Le système ne détecte QUE les actions explicites :

❌ "Le client attend ta réponse" → Pas d'action détectée (implicite : répondre au client)

**Décision** : C'est voulu. La règle d'or est "si ambigu → pas d'action". Les actions implicites sont ambiguës.

---

### 4. Contexte multi-emails

Le système traite chaque email isolément, sans contexte de thread.

❌ Email 1 : "Peux-tu envoyer le rapport ?"
   Email 2 (réponse) : "Oui, je m'en occupe" → Pas de détection que l'action a été prise

**Décision** : Hors scope pour le MVP. L'utilisateur marque manuellement les actions comme "DONE".

---

## Performance

### Métriques

- **Temps moyen** : ~1-5ms par email
- **Pas d'appel réseau** : Traitement 100% local
- **Pas de quota** : Contrairement à l'IA
- **Déterministe** : Même email → toujours mêmes actions

### Scalabilité

Le système peut traiter des milliers d'emails par seconde. La limite est la base de données, pas l'extraction.

---

## Conformité RGPD

### Principe

- ✅ Le corps des emails est analysé **en mémoire uniquement**
- ✅ JAMAIS stocké en base de données
- ✅ Seules les métadonnées sont conservées :
  - Expéditeur (`from`)
  - Sujet (`subject`)
  - Date de réception (`receivedAt`)
  - Phrase source de l'action (`sourceSentence` - max 200 caractères)

### Code de l'API

```typescript
// app/api/email/analyze/route.ts

const body = await emailProvider.getEmailBodyForAnalysis(messageId);
// ⚠️ Utilisé UNIQUEMENT en mémoire

const extractedActions = extractActionsFromEmail({
  from: emailMetadata.from,
  subject: emailMetadata.subject,
  body, // En mémoire seulement
  receivedAt: emailMetadata.receivedAt,
});

// ✅ Seules les actions (sans le corps) sont stockées
await prisma.action.create({
  data: {
    title: action.title,
    type: action.type,
    sourceSentence: action.sourceSentence, // Max 200 chars
    // Le corps complet n'est JAMAIS stocké
  },
});
```

---

## Comparaison Regex vs IA

| Critère | Regex (actuel) | IA (Claude) |
|---------|----------------|-------------|
| **Transparence** | ✅ 100% déterministe | ❌ Boîte noire |
| **Coût** | ✅ Gratuit | ❌ ~$0.003/email |
| **Latence** | ✅ 1-5ms | ❌ 200-500ms |
| **Quota** | ✅ Illimité | ❌ Limited (rate limits) |
| **Précision** | ⚠️ 80-85% | ✅ 90-95% |
| **Faux positifs** | ⚠️ Quelques-uns | ✅ Très peu |
| **Langage** | ⚠️ FR uniquement | ✅ Multilingue |
| **Maintenance** | ⚠️ Ajout manuel | ✅ Apprend seul |
| **RGPD** | ✅ Clair | ⚠️ Complexe |

**Décision pour le MVP** : Regex (déterministe, gratuit, rapide).

**Future évolution** : Hybrid (regex pour 80% + IA pour cas complexes).

---

## FAQ

### Pourquoi pas d'IA pour le MVP ?

1. **Coût** : ~$0.003 par email avec Claude = $30 pour 10,000 emails
2. **Latence** : 200-500ms par email vs 1-5ms avec regex
3. **Transparence** : Regex est 100% explicite et auditable
4. **RGPD** : Plus simple de justifier le traitement par regex

---

### Comment ajouter un nouveau verbe d'action ?

Ajoutez un pattern dans le type d'action correspondant :

```typescript
// Exemple : ajouter "transférer" à SEND
const SEND_PATTERNS = [
  // ... patterns existants
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de)\s+(?:me\s+)?transférer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
];
```

---

### Comment gérer plusieurs langues ?

Pour ajouter l'anglais :

```typescript
// Créer des patterns EN
const SEND_PATTERNS_EN = [
  /(?:can you|could you|please)\s+send\s+(.{1,100}?)(?:\.|$|before|by)/i,
  /send\s+(?:me\s+)?(.{1,100}?)(?:\.|$|before|by)/i,
];

// Détecter la langue de l'email
const lang = detectLanguage(context.body); // "fr" ou "en"

// Utiliser les bons patterns
const patterns = lang === "en" ? SEND_PATTERNS_EN : SEND_PATTERNS;
```

---

### Que faire si trop de faux positifs ?

1. Ajouter des exclusions plus strictes
2. Rendre les patterns plus spécifiques
3. Augmenter le seuil de longueur minimum des phrases

---

### Peut-on combiner regex + IA ?

Oui, approche hybride possible :

```typescript
// 1. Essayer regex d'abord (rapide, gratuit)
const regexActions = extractActionsFromEmail(context);

// 2. Si aucune action ET email important → utiliser IA
if (regexActions.length === 0 && isImportantSender(context.from)) {
  const aiActions = await extractActionsWithAI(context);
  return aiActions;
}

return regexActions;
```

---

## Lien vers le mail source

Chaque action extraite conserve l'URL vers l'email source (webmail) pour permettre un accès direct.

### Stockage de l'URL webmail

```typescript
// Lors de la création de l'action
await prisma.action.create({
  data: {
    userId: session.user.id,
    title: action.title,
    type: action.type,
    sourceSentence: action.sourceSentence,
    emailFrom: emailMetadata.from,
    emailReceivedAt: emailMetadata.receivedAt,
    emailWebUrl: emailMetadata.webUrl, // ← URL vers le webmail
    dueDate: action.dueDate,
    status: "TODO",
  },
});
```

### URLs par provider

| Provider | URL générée |
|----------|-------------|
| Microsoft Graph | `https://outlook.office365.com/...` (webLink fourni par l'API) |
| IMAP Gmail | `https://mail.google.com/mail/u/0/#search/...` (recherche par Message-ID) |
| IMAP autres | Non disponible |

```typescript
// Dans l'interface utilisateur
{action.emailWebUrl && (
  <a
    href={action.emailWebUrl}
    target="_blank"
    rel="noopener noreferrer"
  >
    <Button variant="ghost" size="sm">
      <MailOpen className="h-4 w-4" />
      Voir email
    </Button>
  </a>
)}
```

### Avantages

- ✅ Accès direct au contexte complet de l'email
- ✅ Vérification facile de l'interprétation de l'action
- ✅ Consultation des pièces jointes et du fil de discussion
- ✅ Compatible avec Microsoft Graph et Gmail IMAP

---

## Ressources

- **Code source** : `lib/actions/extract-actions-regex.ts`
- **Tests** : `lib/actions/extract-actions-examples.ts`
- **API** : `app/api/email/analyze/route.ts`
- **Regex tester** : https://regex101.com/

---

## Contribution

Pour améliorer le système d'extraction :

1. Identifier un cas non couvert
2. Créer un test dans `extract-actions-examples.ts`
3. Ajouter le pattern approprié
4. Vérifier que tous les tests passent
5. Documenter le nouveau pattern ici

---

Dernière mise à jour : 9 janvier 2026
