# Success Criteria — Actions personnalisées utilisateur

Les critères sont organisés par dimension : adoption, qualité de détection, expérience utilisateur, et technique.

---

## Adoption

- [ ] Au moins 30% des utilisateurs actifs (ayant syncé au moins un email) créent au moins 1 type custom dans les 7 premiers jours suivant le déploiement.
- [ ] Au moins 50% des types custom créés depuis Settings sont encore actifs 30 jours après leur création (mesure de la rétention des règles — indicateur que les patterns créés sont pertinents et non supprimés après déception).
- [ ] Le nombre de créations manuelles d'actions dans `/missing-action` diminue d'au moins 20% dans les 30 jours suivant le déploiement (mesure indirecte : les règles custom remplacent la création ponctuelle répétée).
- [ ] Au moins 20% des utilisateurs qui ont créé un type custom le modifient (rename ou ajout/suppression de mots-clés) au moins une fois dans le premier mois — indicateur d'expérimentation active et non d'abandon immédiat. Ce seuil n'est pas un critère de succès bloquant : un taux inférieur signifie que les types créés sont pertinents dès la première saisie, ce qui est aussi acceptable.
- [ ] Au moins 40% des utilisateurs ayant créé un type custom choisissent une couleur différente de la couleur assignée par défaut — proxy d'engagement avec la personnalisation. Un taux inférieur indique que le color picker est ignoré ou mal visible ; action corrective : revoir le placement dans le formulaire ou rendre le picker plus saillant.
- [ ] Le taux de suppression de types custom dans les 7 premiers jours suivant leur création est inférieur à 25% (proxy pour détecter une UX de création trop permissive générant des regrets immédiats — si ce taux est élevé, revoir la validation ou l'aide contextuelle à la création).

## Qualité de détection

- [ ] Le taux de faux positifs des types custom (actions créées mais marquées IGNORED par l'utilisateur dans les 24h) est inférieur à 15% — mesuré par userId sur les 30 premiers jours.
- [ ] 0 incident de ReDoS ou d'erreur de compilation regex en production lié à un mot-clé utilisateur dans les 60 premiers jours.
- [ ] Les types custom déclenchent au moins 1 action détectée automatiquement (sans intervention manuelle) pour 70% des utilisateurs qui ont créé une règle (mesure que les mots-clés définis matchent effectivement des emails réels).

## Expérience utilisateur

- [ ] Le temps médian pour créer un type custom depuis Settings (de l'ouverture du formulaire à la confirmation) est inférieur à 60 secondes (mesuré par instrumentation si disponible, ou par test utilisateur qualitatif sur 3 personas).
- [ ] Le temps médian pour créer un type custom depuis le flux missing-action (dialog ouvert → action créée + règle persistée) est inférieur à 90 secondes.
- [ ] Sur une session de test utilisateur avec 3 participants (personas Sophie, Thomas, Camille), chacun est capable de créer un type custom pertinent et de vérifier qu'il s'applique au prochain email — sans aide de la documentation.

## Technique

- [ ] La migration Prisma (ajout de la valeur `CUSTOM` à l'enum + nouvelle table + nouveaux champs) s'applique sans erreur sur la base de données Neon en production et sans downtime observé côté utilisateur.
- [ ] Le temps d'extraction d'un email ne dépasse pas 150% du temps mesuré avant la feature pour un utilisateur avec 10 types custom actifs (pas de régression de performance mesurable en conditions normales).
- [ ] Tous les call sites de `extractActionsFromEmail` sont mis à jour avec le nouveau paramètre `customTypes` — vérifiable par le build TypeScript sans erreurs de type.
- [ ] Les tests unitaires existants dans `tests/` passent sans modification (les 5 types natifs ne sont pas affectés par le refactoring).
- [ ] Un test unitaire couvre le cas "mot-clé contenant un métacaractère regex" (`+`, `?`, `(`, etc.) et vérifie que l'extraction ne lève pas d'erreur et ne produit pas de faux positifs.

---

## Gate de lancement (Go / No-Go)

Avant de déployer en production, les critères suivants doivent tous être verts :

- [ ] Migration Prisma testée sur un environnement staging identique à production
- [ ] Aucune régression sur les tests unitaires du pipeline d'extraction
- [ ] Le flux missing-action complet (ponctuel + règle) fonctionne de bout en bout sur staging
- [ ] L'API CRUD valide la limite de 10 types par user et bloque les mots-clés trop courts (< 4 chars)
- [ ] L'échappement des métacaractères regex est couvert par un test
