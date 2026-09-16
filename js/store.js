/**
 * Persistance locale. Tout reste dans le navigateur : aucune donnée n'est envoyée nulle part.
 * Clé unique, schéma versionné pour pouvoir migrer plus tard sans perdre la progression.
 */
const CLE = 'defi-ortho:v1';
const SCHEMA_VERSION = 1;

/** Intervalles de révision, en jours, pour chaque boîte Leitner (boîte 1 = à revoir tout de suite). */
export const INTERVALLES = [0, 1, 3, 7, 14];
export const BOITE_MAX = INTERVALLES.length;

const etatInitial = () => ({
  schemaVersion: SCHEMA_VERSION,
  xp: 0,
  badges: [],
  streak: { actuel: 0, record: 0, dernierJour: null },
  progression: {},   // exerciceId -> { vus, reussis, echecsConsecutifs, boite, prochaineRevision, categorie, derniereErreur }
  historique: [],    // { date, categorie, vus, reussis, xp }
  compteurs: {},     // cumuls de fin de session utilisés par les badges
  reglages: { debit: 0.8 }
});

let etat = etatInitial();

export function aujourdhui(d = new Date()) {
  // Date locale au format AAAA-MM-JJ (pas d'UTC : la « journée » est celle de l'élève).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ajouteJours(iso, n) {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j + n);
  return aujourdhui(d);
}

export function ecartJours(isoA, isoB) {
  const [a1, m1, j1] = isoA.split('-').map(Number);
  const [a2, m2, j2] = isoB.split('-').map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86400000);
}

export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const lu = JSON.parse(brut);
      if (lu && lu.schemaVersion === SCHEMA_VERSION) etat = { ...etatInitial(), ...lu };
    }
  } catch (e) {
    console.warn('Progression illisible, on repart de zéro.', e);
  }
  return etat;
}

export function lire() { return etat; }

export function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch (e) {
    console.warn('Impossible de sauvegarder la progression.', e);
  }
}

export function reglage(cle, valeur) {
  if (valeur !== undefined) { etat.reglages[cle] = valeur; sauver(); }
  return etat.reglages[cle];
}

/** Met à jour la série quotidienne. À appeler au début de chaque session. */
export function pointerJour() {
  const jour = aujourdhui();
  const s = etat.streak;
  if (s.dernierJour === jour) return s;
  s.actuel = s.dernierJour && ecartJours(s.dernierJour, jour) === 1 ? s.actuel + 1 : 1;
  s.dernierJour = jour;
  s.record = Math.max(s.record, s.actuel);
  sauver();
  return s;
}

/** Fiche de progression d'un exercice, créée à la volée. */
export function fiche(id, categorie) {
  if (!etat.progression[id]) {
    etat.progression[id] = {
      vus: 0, reussis: 0, echecsConsecutifs: 0, echecsTotal: 0,
      boite: 1, prochaineRevision: aujourdhui(), categorie, derniereErreur: null
    };
  }
  if (categorie) etat.progression[id].categorie = categorie;
  return etat.progression[id];
}

/**
 * Enregistre une réponse : Leitner (boîte + prochaine date), compteurs, XP et historique du jour.
 * Renvoie l'XP réellement accordé.
 */
export function enregistrerReponse({ id, categorie, juste, xp = 0, detail = null }) {
  const f = fiche(id, categorie);
  const jour = aujourdhui();
  f.vus += 1;
  if (juste) {
    f.reussis += 1;
    f.echecsConsecutifs = 0;
    f.boite = Math.min(f.boite + 1, BOITE_MAX);
  } else {
    f.echecsConsecutifs += 1;
    f.echecsTotal += 1;
    f.boite = 1;                // un échec renvoie l'item en tête de file
    f.derniereErreur = detail;
  }
  f.prochaineRevision = ajouteJours(jour, INTERVALLES[f.boite - 1]);

  let ligne = etat.historique.find(h => h.date === jour && h.categorie === categorie);
  if (!ligne) { ligne = { date: jour, categorie, vus: 0, reussis: 0, xp: 0 }; etat.historique.push(ligne); }
  ligne.vus += 1;
  if (juste) ligne.reussis += 1;
  ligne.xp += xp;

  etat.xp += xp;
  // On garde ~6 mois d'historique agrégé : largement assez pour les vues 7 et 30 jours.
  const limite = ajouteJours(jour, -190);
  etat.historique = etat.historique.filter(h => h.date >= limite);
  sauver();
  return xp;
}

export function ajouterBadge(id) {
  if (etat.badges.includes(id)) return false;
  etat.badges.push(id);
  sauver();
  return true;
}

/** Items « fragiles » : ratés au moins deux fois, ou dont le dernier passage a échoué. */
export function fragiles() {
  return Object.entries(etat.progression)
    .filter(([, f]) => f.echecsTotal >= 2 || f.echecsConsecutifs > 0)
    .map(([id, f]) => ({ id, ...f, tauxEchec: f.vus ? 1 - f.reussis / f.vus : 0 }))
    .sort((a, b) => (b.echecsConsecutifs - a.echecsConsecutifs) || (b.tauxEchec - a.tauxEchec) || (b.echecsTotal - a.echecsTotal));
}

/** Statistiques agrégées sur les N derniers jours, par catégorie. */
export function statistiques(nbJours) {
  const debut = ajouteJours(aujourdhui(), -(nbJours - 1));
  const lignes = etat.historique.filter(h => h.date >= debut);
  const parCategorie = {};
  const parJour = {};
  for (const h of lignes) {
    const c = parCategorie[h.categorie] || (parCategorie[h.categorie] = { vus: 0, reussis: 0, xp: 0 });
    c.vus += h.vus; c.reussis += h.reussis; c.xp += h.xp;
    const j = parJour[h.date] || (parJour[h.date] = { total: 0, categories: {} });
    j.total += h.vus;
    j.categories[h.categorie] = (j.categories[h.categorie] || 0) + h.vus;
  }
  const jours = [];
  for (let i = nbJours - 1; i >= 0; i--) {
    const date = ajouteJours(aujourdhui(), -i);
    jours.push({ date, ...(parJour[date] || { total: 0, categories: {} }) });
  }
  return { parCategorie, jours, total: lignes.reduce((n, h) => n + h.vus, 0) };
}

export function toutEffacer() {
  etat = etatInitial();
  try { localStorage.removeItem(CLE); } catch (e) { /* stockage indisponible */ }
}
