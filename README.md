# TchoProVip

Application de gestion de restaurant haut de gamme, pensée pour la tablette et pour le Cameroun : plan de salle, prise de commande, écran cuisine et bar. **Elle fonctionne sans internet** : tout est enregistré sur l'appareil, puis synchronisé quand le réseau revient.

> Version 0.1.0 · Étape 1 sur 4 (fondations). Encaissement, stock, clients VIP et serveur central arrivent aux étapes suivantes.

## Ce que fait cette version

- **Connexion par code à 4 chiffres**, avec quatre rôles : gérant, serveur, cuisine, bar. Chacun ne voit que ce qui le concerne.
- **Plan de salle** par zones (Salle, Terrasse, Lounge…) : chaque table affiche son état (libre, occupée, addition demandée, réservée), le temps écoulé, le nombre de couverts, les plats prêts et les allergies.
- **Ouverture de table** avec nombre de couverts et allergies signalées.
- **Prise de commande** : carte par catégories, recherche, plats signature en premier, note par plat (cuisson, sans piment…).
- **Alerte allergie** : si un plat contient un allergène signalé pour la table, le serveur doit confirmer avant l'envoi, et son nom est enregistré.
- **Écran cuisine et bar** : bons groupés par table, les plus anciens en premier, alerte au-delà d'un temps d'attente réglable, passage « Prêt » puis « Servi ».
- **Annulation d'un plat** avec motif. Un plat déjà servi ne peut être annulé que par le gérant.
- **Changement de table**, reprise de commande, libération de la table.
- **Réglages du gérant** : carte (catégories, articles, prix en FCFA, allergènes, poste, disponibilité), zones et tables, équipe et codes, nom de l'établissement.
- **Indicateur de connexion** : « Hors ligne », « Mode local » ou « Synchronisé », avec le nombre de modifications en attente.

## L'essayer

### Sur un ordinateur

Il faut [Node.js](https://nodejs.org) version 20 ou plus récente. Aucune autre installation n'est nécessaire.

```bash
npm start
```

Puis ouvrez **http://localhost:8080** dans Google Chrome.

### Codes de démonstration

| Rôle | Code |
| --- | --- |
| Gérant | 1234 |
| Serveur | 1111 |
| Cuisine | 2222 |
| Bar | 3333 |

Astuce : ouvrez deux onglets sur le même appareil, connectez-vous en **Serveur** dans l'un et en **Cuisine** dans l'autre. Une commande envoyée en salle apparaît aussitôt en cuisine.

Pour repartir de zéro : **Réglages › Cet appareil › Réinitialiser la démonstration** (code gérant).

### Sur une tablette

Une fois l'application mise en ligne en HTTPS (voir plus bas), ouvrez l'adresse dans Chrome, puis menu (trois points) › **Installer l'application**. Elle s'ouvre ensuite comme une application, même sans internet.

## Mise en ligne

L'application est un site statique : n'importe quel hébergeur HTTPS convient (Netlify, Cloudflare Pages, Vercel…). Il suffit de publier le contenu du dépôt tel quel, sans étape de construction.

À chaque nouvelle version, augmentez `CACHE_VERSION` dans `sw.js` pour que les tablettes récupèrent la mise à jour.

## Tests

```bash
npm test
```

Les tests vérifient les règles métier : totaux en FCFA, statuts des tables, détection des allergènes, bons de cuisine, droits par rôle, validation des saisies.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page unique de l'application |
| `css/app.css` | Apparence (couleurs, mise en page tablette et téléphone) |
| `js/app.js` | Démarrage, session, navigation, actions |
| `js/domain.js` | Règles métier pures, testées |
| `js/db.js` | Base de données locale (IndexedDB) |
| `js/store.js` | Données en mémoire, enregistrement, file de synchronisation, synchronisation entre onglets |
| `js/sync.js` | État de la connexion et de la synchronisation |
| `js/seed.js` | Restaurant de démonstration |
| `js/views/` | Écrans : connexion, salle, commande, cuisine, réglages |
| `sw.js` | Service worker : fonctionnement hors ligne |
| `tests/` | Tests automatiques |

Aucune dépendance externe : pas de `npm install`, pas d'étape de construction.

## Comment les données sont protégées

- Tout est écrit d'abord sur l'appareil, en une seule opération (tout ou rien).
- Chaque modification est ajoutée à une **file de synchronisation** avec un identifiant unique, l'heure et l'appareil. À l'étape 2, cette file sera envoyée au serveur central.
- Les identifiants sont générés sur l'appareil (UUID) : deux tablettes hors ligne ne créent jamais le même numéro.
- Les montants sont des entiers en FCFA, jamais des nombres à virgule.
- Le nom et le prix d'un plat sont copiés au moment de l'envoi : modifier la carte ne change pas les commandes passées.
- Les annulations gardent le motif, l'heure et la personne.
- Les codes PIN sont enregistrés chiffrés (SHA-256), jamais en clair.

## Feuille de route

1. **Fondations** (cette version) : salle, commandes, cuisine, réglages, hors ligne sur un appareil.
2. **Service complet** : serveur central et synchronisation entre tablettes, addition et partage, encaissement espèces, MTN MoMo, Orange Money et carte, impression des tickets, stock, clôture de caisse.
3. **Pilote** : clients VIP, réservations, messages WhatsApp, rapports, tests en restaurant.
4. **Lancement** : console du propriétaire, abonnements, sauvegardes, publication.

## Limites connues de cette version

- Pas encore de serveur : la synchronisation entre plusieurs tablettes arrive à l'étape 2. Sur un même appareil, plusieurs onglets restent synchronisés.
- La connexion par code PIN protège l'usage au quotidien, pas contre une personne qui aurait accès aux réglages du navigateur. La vraie authentification arrive avec le serveur.
- Pas encore d'encaissement : « Libérer la table » clôt la commande avec son total.
