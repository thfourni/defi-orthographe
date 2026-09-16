# Format du fichier `exercices.json`

Mode d'emploi pour ajouter du contenu sans toucher au code. Après modification, vérifier que le
fichier reste valide :

```bash
python3 -m json.tool data/exercices.json > /dev/null && echo OK
```

## Squelette

```jsonc
{
  "version": 1,
  "titre": "Défi Orthographe — 3e",
  "categories": [ … ],   // les 4 thèmes
  "exercices":  [ … ],   // les questions
  "dictees":    [ … ]    // les textes lus phrase par phrase
}
```

## Catégories

```jsonc
{
  "id": "accord-sujet-verbe",   // identifiant utilisé par les exercices
  "nom": "Accords sujet-verbe",
  "nomCourt": "Accords",        // utilisé dans les barres de progression
  "couleur": "#7C3AED",         // couleur du thème dans toute l'appli
  "icone": "🎯",
  "poids": 3                    // fréquence relative de tirage (1 = normal)
}
```

Augmenter `poids` fait sortir la catégorie plus souvent dans les sessions mixtes.
Ajouter une catégorie suffit à la faire apparaître à l'accueil et dans les statistiques.

## Champs communs à tous les exercices

| Champ | Obligatoire | Rôle |
| --- | --- | --- |
| `id` | oui | identifiant **unique et stable** ; c'est la clé de progression (le renommer remet l'exercice à zéro) |
| `type` | oui | `trou`, `mot`, `qcm` ou `tri` |
| `categorie` | oui | l'`id` d'une catégorie existante |
| `difficulte` | non | 1 à 3 ; augmente légèrement l'XP gagné |
| `regleId` | non | clé dans `regles.json` ; l'explication s'affiche en cas d'erreur |
| `explication` | non | phrase de secours si aucune règle n'est liée |
| `source` | non | libre, ex. `"dictee-combourg"` pour marquer une erreur réellement commise |

## Type `trou` — phrase à trous

```jsonc
{
  "id": "asv-031",
  "type": "trou",
  "categorie": "accord-sujet-verbe",
  "difficulte": 2,
  "regleId": "sujet-inverse",
  "phrase": "À peine {0}-je averti du danger que la nuit tomba.",
  "trous": [
    {
      "infinitif": "être",           // affiché sous la phrase
      "temps": "imparfait",          // affiché entre parenthèses
      "reponses": ["étais"],         // la 1re est LA solution montrée ; les autres sont acceptées
      "indice": "Le sujet « je » est placé après le verbe."
    }
  ]
}
```

- `{0}`, `{1}`… marquent l'emplacement des trous ; il en faut autant que d'entrées dans `trous`.
- Mettre plusieurs `reponses` quand deux formes sont correctes (« nous asseyions » / « nous assoyions »).
- La casse et la ponctuation sont tolérées à la correction ; **les accents comptent**.

## Type `mot` — dictée d'un mot isolé

```jsonc
{
  "id": "lex-023",
  "type": "mot",
  "categorie": "lexique",
  "mot": "apercevais",                              // la réponse attendue
  "prononce": "je n'apercevais plus rien",          // ce qui est lu à voix haute
  "phraseContexte": "Je n'{mot} plus les carreaux.", // montré après la réponse
  "piege": "un seul p",
  "explication": "« Apercevoir » ne prend qu'un seul p."
}
```

`prononce` est important : un mot isolé est mal prononcé par la synthèse vocale, et les
homophones deviennent indevinables. Toujours donner une courte phrase porteuse.
`{mot}` dans `phraseContexte` est remplacé par la bonne réponse.

## Type `qcm` — choix unique

```jsonc
{
  "id": "imp-016",
  "type": "qcm",
  "categorie": "imparfait",
  "consigne": "Choisis la forme correcte : « Les bougies ___ sur le guéridon. »",
  "options": ["brûlaient", "brûlait"],
  "bonneReponse": 0,                 // index dans "options", à partir de 0
  "explication": "« les bougies » est pluriel : -aient."
}
```

## Type `tri` — classer des phrases en deux familles

```jsonc
{
  "id": "pp-013",
  "type": "tri",
  "categorie": "participe-present",
  "consigne": "Participe présent (invariable) ou adjectif verbal (accordé) ?",
  "etiquettes": [
    { "id": "participe-present", "libelle": "Participe présent", "aide": "action, invariable" },
    { "id": "adjectif-verbal",   "libelle": "Adjectif verbal",   "aide": "qualité, accordé" }
  ],
  "items": [
    { "phrase": "des histoires amusant tout le monde", "reponse": "participe-present" },
    { "phrase": "des histoires amusantes",             "reponse": "adjectif-verbal" }
  ],
  "explication": "Un complément après le mot en -ant signale le participe présent."
}
```

`reponse` doit valoir l'`id` d'une des `etiquettes`. L'exercice n'est réussi que si **toutes**
les phrases sont bien classées. Deux à quatre phrases par exercice est un bon calibre.

## Dictées

```jsonc
{
  "id": "combourg-p3",
  "titre": "Le retour de la nuit",
  "auteur": "Chateaubriand, Mémoires d'outre-tombe",
  "niveau": "3e",
  "segments": [
    {
      "id": "s1",
      "texte": "Les fenêtres, ébranlées par le vent, s'ouvraient quelquefois.",
      "pieges": [
        { "mot": "ébranlées",  "categorie": "lexique" },
        { "mot": "s'ouvraient", "categorie": "accord-sujet-verbe", "regleId": "sujet-eloigne" }
      ]
    }
  ]
}
```

- Un segment = une phrase lue d'un coup. Viser 8 à 15 mots : au-delà, c'est trop long à retenir.
- `texte` est à la fois ce qui est lu et ce qui sert de correction : il doit être **parfaitement
  orthographié et ponctué**.
- `pieges` est facultatif mais précieux : c'est ce qui permet de ranger chaque faute dans la
  bonne catégorie (et donc de faire remonter la bonne règle et les bonnes statistiques). Le champ
  `mot` doit reprendre le mot **exactement comme dans `texte`**.

## Règles (`regles.json`)

```jsonc
{
  "version": 1,
  "regles": {
    "sujet-inverse": {
      "titre": "Le sujet inversé",
      "categorie": "accord-sujet-verbe",
      "explication": "Quand le sujet est placé après le verbe, il commande quand même l'accord.",
      "exemples": ["À peine étais-je averti…"]
    }
  }
}
```

La clé (`sujet-inverse`) est ce qu'on met dans `regleId`. Mutualiser les règles évite de recopier
la même explication dans vingt exercices : corriger la règle une fois la corrige partout.

## Conseils de rédaction

- Rester dans l'univers du texte étudié : le vocabulaire revu en contexte se retient mieux.
- Un exercice = **une** difficulté. Deux pièges dans la même phrase brouillent le diagnostic.
- Écrire les `indice` comme une question à se poser (« Qui est-ce qui … ? »), pas comme la réponse.
- Numéroter les `id` par préfixe de thème (`asv-`, `lex-`, `imp-`, `pp-`) : c'est plus simple à
  maintenir et à relire.
