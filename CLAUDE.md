# TchoProVip — instructions pour Claude

Application web installable (PWA) de gestion de restaurant haut de gamme, pour le Cameroun. Le propriétaire du projet n'est pas développeur : expliquez en français simple, et donnez-lui des étapes de test concrètes.

## Principes

- **Hors ligne d'abord** : toute action s'écrit dans IndexedDB (`js/db.js`) via `store.save()`, qui ajoute aussi une entrée dans la file `outbox`. Ne jamais faire dépendre une action du réseau.
- **Aucune dépendance** : pas de framework ni d'étape de construction. Modules ES natifs, HTML généré par chaînes, délégation d'événements (`data-act`, `data-form`). Si une dépendance devient indispensable, demander d'abord.
- **Règles métier pures** dans `js/domain.js`, testées dans `tests/` (`npm test`, runner natif de Node). Toute nouvelle règle (totaux, stock, droits) y va avec un test.
- **Argent** : entiers en FCFA uniquement (`parseFCFA`, `formatFCFA`). Jamais de nombres à virgule.
- **Lignes de commande** : une ligne par envoi, nom et prix copiés au moment de l'envoi.
- **Identifiants** : `uuid()` généré sur l'appareil.
- **Texte de l'interface** : en français, clair, sans jargon ; les erreurs disent quoi faire. Échapper toute donnée avec `esc()`.
- **Accessibilité** : vrais `<button>`, libellés sur les champs, zones tactiles d'au moins 44 px, état jamais indiqué par la seule couleur.
- **Mise à jour** : augmenter `CACHE_VERSION` dans `sw.js` et `VERSION` dans `js/app.js` à chaque version, et ajouter tout nouveau fichier à `APP_SHELL`.

## Étape suivante prévue (2)

Serveur Supabase + adaptateur de synchronisation dans `js/sync.js` (`push(entries)`, `pull(since)`), encaissement, stock par mouvements, impression ESC/POS, clôture de caisse.

## Commandes

- `npm start` : serveur local sur http://localhost:8080
- `npm test` : tests des règles métier
