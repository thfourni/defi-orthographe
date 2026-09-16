/**
 * Choix des exercices d'une session.
 * Trois forces se combinent : la répétition espacée (Leitner), le poids
 * pédagogique de la catégorie (les accords sujet-verbe passent en premier),
 * et les points faibles récents.
 */
import { lire, fiche, aujourdhui } from './store.js';

export const TAILLE_SESSION = 10;

/** Priorité d'un exercice : plus le score est haut, plus il mérite de sortir. */
function score(exo, etat) {
  const f = etat.progression[exo.id];
  const poidsCategorie = 1; // appliqué en amont par le tirage pondéré
  if (!f) return 60 * poidsCategorie;                      // jamais vu : bon candidat
  let s = 10;
  if (f.prochaineRevision <= aujourdhui()) s += 40;        // dû aujourd'hui
  s += Math.min(f.echecsConsecutifs, 3) * 30;              // raté récemment
  s += Math.min(f.echecsTotal, 5) * 6;                     // historiquement fragile
  s -= (f.boite - 1) * 8;                                  // bien maîtrisé : on espace
  const tauxReussite = f.vus ? f.reussis / f.vus : 0;
  s -= tauxReussite * 10;
  return Math.max(s, 1);
}

function melanger(liste) {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** Tirage sans remise, proportionnel au poids. */
function tirerPondere(candidats, n) {
  const restants = [...candidats];
  const choisis = [];
  while (choisis.length < n && restants.length) {
    const total = restants.reduce((s, c) => s + c.poids, 0);
    let seuil = Math.random() * total;
    let i = 0;
    while (i < restants.length - 1 && (seuil -= restants[i].poids) > 0) i++;
    choisis.push(restants.splice(i, 1)[0].exo);
  }
  return choisis;
}

/**
 * Construit une session.
 * @param {object} banque
 * @param {object} options { categorie: id|null, taille, seulementFragiles: bool }
 */
export function construireSession(banque, { categorie = null, taille = TAILLE_SESSION, seulementFragiles = false, ids = null } = {}) {
  const etat = lire();

  if (ids) {
    return ids.map(id => banque.parId[id]).filter(Boolean).slice(0, taille);
  }

  let pool = categorie ? (banque.parCategorie[categorie] || []) : banque.exercices;

  if (seulementFragiles) {
    pool = pool.filter(e => {
      const f = etat.progression[e.id];
      return f && (f.echecsTotal >= 2 || f.echecsConsecutifs > 0);
    });
    if (!pool.length) pool = categorie ? (banque.parCategorie[categorie] || []) : banque.exercices;
  }

  const candidats = pool.map(exo => ({
    exo,
    poids: score(exo, etat) * (categorie ? 1 : (banque.categorieParId[exo.categorie]?.poids || 1))
  }));

  const choisis = tirerPondere(candidats, Math.min(taille, candidats.length));
  return melanger(choisis);
}

/** Nombre d'items dus aujourd'hui, pour l'affichage d'accueil. */
export function nombreDus(banque) {
  const etat = lire();
  const jour = aujourdhui();
  return banque.exercices.filter(e => {
    const f = etat.progression[e.id];
    return !f || f.prochaineRevision <= jour;
  }).length;
}

/** Progression par catégorie : part d'items en boîte 4 ou 5 (considérés acquis). */
export function progressionCategories(banque) {
  const etat = lire();
  return banque.categories.map(c => {
    const exos = banque.parCategorie[c.id] || [];
    let acquis = 0, entames = 0;
    for (const e of exos) {
      const f = etat.progression[e.id];
      if (!f) continue;
      entames++;
      if (f.boite >= 4) acquis++;
    }
    return { ...c, total: exos.length, entames, acquis, pourcent: exos.length ? Math.round((acquis / exos.length) * 100) : 0 };
  });
}

export { fiche };
