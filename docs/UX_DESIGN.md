# Documentation UX - Interface Inbox → Actions

Documentation complète de l'interface utilisateur pour la gestion des actions.

---

## 🎨 Philosophie UX

L'interface Inbox → Actions suit ces principes fondamentaux :

1. **Clarté avant tout** - Chaque action possible est clairement visible et accessible
2. **Phrase source toujours visible** - Le contexte de l'action est toujours affiché
3. **Actions rapides** - Maximum 2 clics pour accomplir une tâche courante
4. **Feedback immédiat** - Toute action génère une notification (toast)
5. **Cohérence** - Utilisation exclusive de shadcn/ui pour un design uniforme

---

## 📱 Pages

### 1. `/actions` - Liste des actions

**Objectif** : Vue d'ensemble de toutes les actions avec filtrage par statut

**Structure** :
```
┌─────────────────────────────────────────────┐
│ Actions                    [Nouvelle action]│
│ Gérez vos actions...                        │
├─────────────────────────────────────────────┤
│ [À faire (4)] [Terminées (1)] [Ignorées (1)]│
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ActionCard                          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ActionCard                          │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

**Fonctionnalités** :
- Header avec bouton "Nouvelle action"
- Onglets pour filtrer : TODO, DONE, IGNORED
- Compteurs d'actions par statut
- État de chargement (spinner)
- État vide personnalisé par onglet
- Rafraîchissement automatique après création/modification

**Flux utilisateur** :
1. Arrivée sur la page → Affichage des actions TODO
2. Clic sur "Nouvelle action" → Dialog de création
3. Clic sur un onglet → Chargement et affichage des actions filtrées
4. Actions sur les cartes → Mise à jour et rafraîchissement

### 2. `/actions/[id]` - Détail d'une action

**Objectif** : Vue détaillée d'une action avec toutes les métadonnées

**Structure** :
```
┌─────────────────────────────────────────────┐
│ [← Retour aux actions]          [✎] [🗑]    │
├─────────────────────────────────────────────┤
│                                             │
│  Titre de l'action                          │
│  📧 from@example.com • ⏰ Reçu il y a 2h   │
│  [Type badge] [Status badge]                │
│                                             │
│  Phrase source                              │
│  ┌─────────────────────────────────────┐    │
│  │ "Pourrais-tu m'envoyer..."          │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Échéance                                   │
│  ┌─────────────────────────────────────┐    │
│  │ Urgent : 5 janvier 2026, 14:00      |    |
│  └─────────────────────────────────────┘    │
│                                             │
│  Créée le │ Modifiée le                     │
│                                             │
│  [V Marquer comme fait] [X Ignorer]         |
│                                             │
└─────────────────────────────────────────────┘
```

**Fonctionnalités** :
- Bouton retour vers /actions
- Boutons rapides : Modifier (dialog), Supprimer (confirmation)
- Affichage complet de toutes les informations
- Indicateurs visuels d'urgence (couleurs)
- Actions disponibles selon le statut
- Dialog de confirmation pour suppression
- Redirection automatique après suppression
- Gestion des erreurs (404, 403)

**Flux utilisateur** :
1. Clic sur "Voir les détails" ou "Modifier" sur une carte
2. Consultation des informations complètes
3. Actions possibles :
   - Modifier → Dialog d'édition
   - Supprimer → Confirmation → Retour à /actions
   - Marquer fait/ignorer → Mise à jour du statut
   - Retour → Retour à /actions

---

## 🧩 Composants

### 1. `ActionCard` - Carte d'action

**Responsabilité** : Afficher une action de manière concise avec actions rapides

**Variantes** :
- `default` : Carte complète avec tous les détails
- `compact` : Version condensée pour listes denses

**Informations affichées** :
- Titre (gras, prominent)
- Email expéditeur
- Date de réception (relative, en français)
- Type d'action (badge coloré)
- Statut (badge)
- Phrase source (toujours visible, en italique, fond grisé)
- Date d'échéance si présente (avec indicateurs d'urgence)

**Actions disponibles (si TODO)** :
- ✓ Fait - Marque l'action comme terminée
- ✎ Modifier - Ouvre la page de détail
- ✗ Ignorer - Marque l'action comme ignorée

**Actions (si DONE/IGNORED)** :
- 🔗 Voir les détails - Ouvre la page de détail

**Indicateurs visuels** :
- ⚠️ En retard : Bordure rouge, fond rouge léger
- ⏰ Urgent (< 24h) : Bordure orange, fond orange léger
- Normal : Bordure par défaut

**Props** :
```typescript
interface ActionCardProps {
  action: ActionWithUser;
  onUpdate?: () => void;
  variant?: "default" | "compact";
}
```

### 2. `ActionList` - Liste d'actions

**Responsabilité** : Wrapper pour afficher plusieurs ActionCard

**Fonctionnalités** :
- Affichage en grille verticale (space-y-4)
- Gestion de l'état vide
- Messages personnalisables pour l'état vide
- Propagation du callback onUpdate

**Props** :
```typescript
interface ActionListProps {
  actions: ActionWithUser[];
  onUpdate?: () => void;
  variant?: "default" | "compact";
  emptyMessage?: string;
  emptyDescription?: string;
}
```

### 3. `ActionDialog` - Dialog de création/édition

**Responsabilité** : Formulaire modal pour créer ou modifier une action

**Modes** :
- **Création** : Tous les champs vides + champ "Date de réception"
- **Édition** : Champs pré-remplis, pas de "Date de réception"

**Champs** :
- Titre * (texte, requis)
- Type * (select, requis) : SEND, CALL, FOLLOW_UP, PAY, VALIDATE
- Phrase source * (textarea, requis)
- Email expéditeur * (email, requis)
- Date de réception * (datetime-local, requis, création uniquement)
- Date d'échéance (datetime-local, optionnel)

**Validation** :
- Champs requis vérifiés par HTML5
- Type email validé
- Messages d'erreur affichés via toast

**Actions** :
- Annuler - Ferme le dialog
- Créer/Modifier - Submit avec loading state

**Props** :
```typescript
interface ActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: ActionWithUser;
  onSuccess?: () => void;
}
```

### 4. `EmptyState` - État vide

**Responsabilité** : Affichage quand aucune action n'est disponible

**Éléments** :
- Icône (Inbox par défaut, personnalisable)
- Message principal
- Description secondaire

**Props** :
```typescript
interface EmptyStateProps {
  message?: string;
  description?: string;
  icon?: React.ReactNode;
}
```

### 5. `ActionsHeader` - En-tête de page

**Responsabilité** : Titre de page + bouton de création

**Éléments** :
- Titre "Actions"
- Description "Gérez vos actions..."
- Bouton "Nouvelle action" (avec icône Plus)
- Dialog de création intégré

**Props** :
```typescript
interface ActionsHeaderProps {
  onActionCreated?: () => void;
}
```

---

## 🎨 Design System

### Couleurs des types d'action

| Type | Label | Couleur |
|------|-------|---------|
| SEND | Envoyer | Bleu (bg-blue-100 text-blue-800) |
| CALL | Appeler | Vert (bg-green-100 text-green-800) |
| FOLLOW_UP | Relancer | Jaune (bg-yellow-100 text-yellow-800) |
| PAY | Payer | Violet (bg-purple-100 text-purple-800) |
| VALIDATE | Valider | Orange (bg-orange-100 text-orange-800) |

### Couleurs des statuts

| Statut | Label | Couleur |
|--------|-------|---------|
| TODO | À faire | Gris (bg-slate-100 text-slate-800) |
| DONE | Terminé | Vert (bg-green-100 text-green-800) |
| IGNORED | Ignoré | Gris (bg-gray-100 text-gray-800) |

### États d'urgence

| État | Condition | Style |
|------|-----------|-------|
| En retard | dueDate < maintenant & status=TODO | border-red-300 bg-red-50/50 |
| Urgent | dueDate < maintenant+24h & status=TODO | border-orange-300 bg-orange-50/50 |
| Normal | Autre | Style par défaut |

---

## 🔄 Flux utilisateur complets

### Flux 1 : Créer une action

1. L'utilisateur clique sur "Nouvelle action" dans le header
2. Le dialog s'ouvre avec tous les champs vides
3. L'utilisateur remplit le formulaire
4. L'utilisateur clique sur "Créer"
5. Loading state affiché sur le bouton
6. Requête API POST /api/actions
7. Si succès :
   - Toast "Action créée avec succès"
   - Dialog se ferme
   - Liste se rafraîchit
   - Formulaire se réinitialise
8. Si erreur :
   - Toast avec message d'erreur
   - Dialog reste ouvert
   - L'utilisateur peut corriger

### Flux 2 : Marquer une action comme faite

#### Depuis la liste
1. L'utilisateur clique sur "Fait" sur une ActionCard
2. Loading state sur tous les boutons de la carte
3. Requête API POST /api/actions/:id/done
4. Si succès :
   - Toast "Action marquée comme terminée"
   - Liste se rafraîchit
   - L'action disparaît de l'onglet TODO
5. Si erreur :
   - Toast avec message d'erreur
   - Aucun changement

#### Depuis la page de détail
1. L'utilisateur clique sur "Marquer comme fait"
2. Loading state sur tous les boutons
3. Requête API POST /api/actions/:id/done
4. Si succès :
   - Toast "Action marquée comme terminée"
   - Page se rafraîchit
   - Boutons d'action changent (plus de "Fait/Ignorer")
5. Si erreur :
   - Toast avec message d'erreur
   - Aucun changement

### Flux 3 : Modifier une action

1. L'utilisateur clique sur "Modifier" (liste ou détail)
2. Si depuis liste : Navigation vers /actions/:id
3. L'utilisateur clique sur l'icône Edit (✎)
4. Dialog d'édition s'ouvre avec données pré-remplies
5. L'utilisateur modifie les champs
6. L'utilisateur clique sur "Modifier"
7. Loading state affiché
8. Requête API PATCH /api/actions/:id
9. Si succès :
   - Toast "Action modifiée avec succès"
   - Dialog se ferme
   - Données se rafraîchissent
10. Si erreur :
    - Toast avec message d'erreur
    - Dialog reste ouvert

### Flux 4 : Supprimer une action

1. L'utilisateur va sur /actions/:id
2. L'utilisateur clique sur l'icône Supprimer (🗑)
3. Dialog de confirmation s'ouvre
4. L'utilisateur clique sur "Supprimer"
5. Loading state affiché
6. Requête API DELETE /api/actions/:id
7. Si succès :
   - Toast "Action supprimée"
   - Redirection vers /actions
8. Si erreur :
   - Toast avec message d'erreur
   - Dialog se ferme
   - L'utilisateur reste sur la page

### Flux 5 : Filtrer les actions

1. L'utilisateur arrive sur /actions
2. Onglet "À faire" sélectionné par défaut
3. Actions TODO affichées
4. L'utilisateur clique sur "Terminées"
5. Loading state affiché
6. Requête API GET /api/actions?status=DONE
7. Actions DONE affichées
8. Compteur mis à jour

---

## ✅ Bonnes pratiques respectées

### 1. Accessibilité
- Utilisation de composants shadcn/ui accessibles
- Labels sur tous les inputs
- Messages d'erreur clairs
- États de loading visibles

### 2. UX Mobile
- Design responsive (grid, flex)
- Boutons de taille adéquate
- Dialog adaptés mobile

### 3. Performance
- Chargement séparé par onglet
- Pas de rechargement global inutile
- Optimistic UI où possible
- Loading states pour feedback immédiat

### 4. Feedback utilisateur
- Toast pour toutes les actions
- Loading states partout
- Erreurs explicites
- Confirmations pour actions destructives

### 5. Sécurité
- Validation côté client ET serveur
- Confirmation avant suppression
- Messages d'erreur sans fuite d'info

### 6. Cohérence
- Même design system partout
- Même disposition d'informations
- Même flow d'actions
- Terminologie française cohérente

---

## 🚀 Évolutions possibles

### Court terme
- [ ] Tri des actions (par date, urgence)
- [ ] Recherche full-text
- [ ] Filtres combinés (type + statut)
- [ ] Pagination si > 50 actions

### Moyen terme
- [ ] Actions en masse (sélection multiple)
- [ ] Export CSV/PDF
- [ ] Raccourcis clavier
- [ ] Glisser-déposer pour réordonner

### Long terme
- [ ] Vue calendrier
- [ ] Notifications push
- [ ] Intégration email directe
- [ ] Intelligence artificielle pour catégorisation

---

## 📊 Métriques UX à suivre

### Engagement
- Nombre d'actions créées/jour
- Taux de complétion (DONE / TOTAL)
- Temps moyen pour marquer une action comme faite

### Usabilité
- Taux d'abandon dans le formulaire de création
- Nombre de clics moyen pour accomplir une tâche
- Taux d'erreur dans les formulaires

### Performance
- Temps de chargement de /actions
- Temps de réponse des actions (Fait/Ignorer)

---

## 🎯 Résumé

L'interface Inbox → Actions est conçue pour être :

✅ **Simple** - Pas de courbe d'apprentissage
✅ **Rapide** - Actions en 1-2 clics
✅ **Claire** - Phrase source toujours visible
✅ **Cohérente** - shadcn/ui partout
✅ **Accessible** - Standards respectés
✅ **Feedback** - Toast et loading states

L'utilisateur peut créer, consulter, modifier, supprimer et filtrer ses actions en toute simplicité.
