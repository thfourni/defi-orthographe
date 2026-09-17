# Défi Orthographe — 3e

Application web d'entraînement à l'orthographe et aux dictées, conçue pour une élève de 3e.
Priorité pédagogique : **les accords sujet-verbe**, puis l'orthographe lexicale, l'imparfait et
le participe présent / adjectif verbal. Le contenu part de dictées réellement corrigées sur le
texte de Chateaubriand, *Mémoires d'outre-tombe* (« À Combourg »).

- HTML / CSS / JavaScript purs (modules ES natifs) — **aucune étape de compilation**
- Installable comme une application (PWA) et **utilisable hors ligne**
- **Aucun compte, aucun serveur, aucune donnée envoyée** : toute la progression reste dans le
  navigateur du téléphone (`localStorage`)

## Héberger l'application

Copier **tout le dossier** tel quel sur l'hébergement statique, par exemple dans
`public_html/ortho/`. L'appli est alors disponible sur `https://mon-site.fr/ortho/`.

```
index.html  manifest.webmanifest  sw.js  css/  js/  data/  icons/
```

Deux seules conditions :

1. **Servir en HTTP(S)**, pas en ouvrant `index.html` depuis le disque : le chargement des
   données JSON par `fetch()` est bloqué sur `file://`.
2. **HTTPS** (ou `localhost`) pour que le mode hors ligne fonctionne : les service workers ne
   s'enregistrent pas en HTTP simple.

Aucune configuration serveur particulière n'est nécessaire. Si l'hébergeur ne sert pas les
`.webmanifest`, ajouter dans `.htaccess` :

```apache
AddType application/manifest+json .webmanifest
```

### Installer sur le téléphone

- **iPhone** : ouvrir le site dans Safari → Partager → « Sur l'écran d'accueil ».
- **Android** : Chrome propose « Installer l'application », ou menu → « Ajouter à l'écran d'accueil ».

Après la première ouverture, tout est mis en cache : l'appli se lance et fonctionne sans réseau.

### Tester en local

```bash
python3 -m http.server 8000     # puis ouvrir http://localhost:8000
```

## Mettre à jour le contenu (sans toucher au code)

Tout le contenu pédagogique est dans `data/` :

| Fichier | Contenu |
| --- | --- |
| `data/exercices.json` | catégories, exercices, dictées |
| `data/regles.json` | explications de règles, affichées en cas d'erreur |
| `data/SCHEMA.md` | **le mode d'emploi du format**, avec un exemple par type d'exercice |

Pour ajouter des exercices : ouvrir `data/exercices.json`, copier un bloc existant du même type,
changer les valeurs, **donner un `id` unique**. C'est tout — aucun code à modifier.

Points de vigilance :

- Un `id` déjà utilisé, ou une catégorie inconnue, fait apparaître un avertissement dans la
  console du navigateur (l'appli continue de fonctionner). Vérifier la validité du fichier avec
  `python3 -m json.tool data/exercices.json > /dev/null`.
- Les `id` servent de clé de progression : **renommer un `id` remet cet exercice à zéro**.
- La fréquence d'une catégorie se règle par son champ `poids` (`3` pour les accords sujet-verbe,
  ils sortent donc environ trois fois plus souvent).

### Après une mise à jour

Le service worker sert les fichiers depuis le cache. Pour que les téléphones déjà installés
prennent la nouvelle version, **incrémenter `VERSION` en haut de `sw.js`** :

```js
const VERSION = 'defi-ortho-v2';
```

Les fichiers de `data/` font exception : ils sont rechargés depuis le réseau quand il est
disponible, donc un simple ajout d'exercices est visible sans changer la version.

## Fonctionnement

### Choix des exercices

Trois forces se combinent dans `js/scheduler.js` :

- **répétition espacée** (système de Leitner, 5 boîtes, intervalles 0/1/3/7/14 jours) — un item
  raté retourne en boîte 1 et ressort tout de suite, un item maîtrisé s'espace ;
- **poids de la catégorie** — les accords sujet-verbe sortent plus souvent ;
- **points faibles** — les items ratés récemment remontent en tête.

Après **deux échecs de suite** sur un même item, la saisie au clavier est remplacée par un choix
multiple (avec des propositions fausses mais plausibles, générées dans `js/distracteurs.js`),
pour éviter le blocage devant un clavier vide. L'XP y est alors réduit de moitié.

### Correction

Chaque erreur est classée par **nature**, et les deux peuvent tomber en même temps :

- **faute d'orthographe** (lexicale) — le radical du mot, ses accents, ses doubles consonnes ;
- **faute de grammaire** (grammaticale) — la terminaison, donc l'accord avec le sujet, la
  personne, le temps.

Une réponse comme « eclairaient » pour « éclairait » affiche donc deux blocs distincts : l'accent
manquant d'un côté, et de l'autre l'explication de l'accord — « Le sujet est « la lumière » :
3e personne du singulier (il / elle). À l'imparfait, on écrit donc -ait. Tu as écrit -aient, la
terminaison de la 3e personne du pluriel. » Le diagnostic vit dans `js/analyse.js` : il découpe la
forme en radical + terminaison, compare les deux séparément, et reconnaît au passage les
terminaisons empruntées à un autre temps (« éclairai » = passé simple) et la règle du double i
des verbes en -ier / -yer.

- Mots isolés : comparaison **lettre à lettre** (distance d'édition), avec la lettre fautive
  pointée et un message distinct quand seuls les accents sont faux.
- Dictée : comparaison **mot à mot** (plus longue sous-séquence commune), chaque écart étant
  rattaché à sa catégorie grâce aux `pieges` déclarés dans les données — c'est ce qui alimente
  les statistiques par catégorie.
- La casse et la ponctuation sont tolérées ; **les accents comptent**.

### Audio

La lecture utilise `SpeechSynthesis`, la voix française du téléphone : rien à héberger, et ça
marche hors ligne. Trois débits (lent / normal / rapide). Si l'appareil n'a aucune voix
française, l'appli bascule automatiquement sur l'affichage du texte à recopier.

## Structure

```
index.html              coquille de l'application (5 écrans)
sw.js                   service worker (mode hors ligne)
manifest.webmanifest    métadonnées PWA
css/base.css            variables de thème, fondations
css/components.css      boutons, cartes, jauges, badges, diff
css/screens.css         mise en page des écrans
js/app.js               démarrage, navigation, service worker
js/ui.js                utilitaires DOM
js/store.js             persistance locale, Leitner, série quotidienne, statistiques
js/data.js              chargement et validation des données
js/scheduler.js         composition d'une session
js/gamification.js      XP, niveaux, badges
js/speech.js            synthèse vocale
js/diff.js              comparaisons lettre à lettre et mot à mot
js/distracteurs.js      propositions fausses pour le repli en choix multiple
js/screens/*.js         un module par écran
data/*.json             contenu pédagogique
icons/                  icônes PWA (remplaçables : garder les noms et les tailles)
```

## Confidentialité

Aucune requête réseau vers un tiers, aucun compte, aucune analyse d'audience. La progression
vit dans le `localStorage` du navigateur et peut être effacée depuis l'écran Statistiques.
Conséquence : effacer les données du navigateur, ou changer de téléphone, remet la progression
à zéro.

## Remarques sur le texte de la dictée

Les dictées de `data/exercices.json` reprennent le passage des soirées à Combourg. La
transcription mérite d'être **vérifiée sur une édition papier** avant usage en contrôle :
les segments ont été écrits pour l'exercice et la seconde dictée est adaptée (« d'après »).

## Navigateurs

Safari iOS 15+, Chrome Android récent, Firefox, Edge. Les fonctions optionnelles
(synthèse vocale, vibration, installation PWA) se désactivent proprement quand le navigateur
ne les propose pas.
