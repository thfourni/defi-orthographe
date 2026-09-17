/** XP, niveaux et badges. Rien d'en ligne : c'est un jeu solo contre soi-même. */
import { lire, sauver, ajouterBadge, statistiques } from './store.js';

export const XP_BASE = 10;
export const XP_BONUS_SERIE = 5;     // par palier de 3 bonnes réponses d'affilée
export const XP_DICTEE_SEGMENT = 15;

/** Palier d'XP à atteindre pour le niveau n (croissance douce, pas décourageante). */
export function xpPourNiveau(n) { return 50 * n * (n - 1) / 2 + 100 * (n - 1); }

export function niveauDepuisXp(xp) {
  let n = 1;
  while (xpPourNiveau(n + 1) <= xp) n++;
  return n;
}

export function infosNiveau(xp) {
  const niveau = niveauDepuisXp(xp);
  const bas = xpPourNiveau(niveau);
  const haut = xpPourNiveau(niveau + 1);
  return { niveau, bas, haut, dansNiveau: xp - bas, pourNiveau: haut - bas, pourcent: Math.round(((xp - bas) / (haut - bas)) * 100) };
}

export const TITRES = ['Apprentie', 'Copiste', 'Scribe', 'Plume agile', 'Calligraphe', 'Grammairienne', 'Maîtresse des mots', 'Académicienne'];
export function titreNiveau(niveau) { return TITRES[Math.min(niveau, TITRES.length) - 1]; }

/**
 * XP d'une réponse, bonus de série compris.
 * Un indice demandé divise le gain par deux et annule le bonus de série : l'aide reste
 * disponible sans jamais être gratuite.
 */
export function xpReponse({ juste, serie, difficulte = 1, premierEssai = true, avecIndice = false }) {
  if (!juste) return 0;
  let xp = XP_BASE + (difficulte - 1) * 3;
  if (!premierEssai) xp = Math.round(xp / 2);
  if (avecIndice) xp = Math.max(1, Math.round(xp / 2));
  if (!avecIndice && serie > 0 && serie % 3 === 0) xp += XP_BONUS_SERIE;
  return xp;
}

export const BADGES = [
  { id: 'premiers-pas',     emoji: '🌱', nom: 'Premiers pas',       description: 'Terminer une première session.',
    test: (e) => e.sessionsTerminees >= 1 },
  { id: 'maitre-accords',   emoji: '🎯', nom: 'Maîtresse des accords', description: '50 accords sujet-verbe réussis.',
    test: (e) => e.reussisParCategorie['accord-sujet-verbe'] >= 50 },
  { id: 'chasseuse-fautes', emoji: '🔍', nom: 'Chasseuse de fautes', description: 'Corriger 20 items qui étaient fragiles.',
    test: (e) => e.fragilesRattrapes >= 20 },
  { id: 'sans-faute',       emoji: '💎', nom: 'Sans faute',          description: 'Une session complète sans aucune erreur.',
    test: (e) => e.sessionsParfaites >= 1 },
  { id: 'serie-10',         emoji: '🔥', nom: 'En feu',              description: '10 bonnes réponses d\'affilée.',
    test: (e) => e.meilleureSerie >= 10 },
  { id: 'semaine',          emoji: '📅', nom: 'Semaine complète',    description: '7 jours consécutifs de révision.',
    test: (e) => e.streakRecord >= 7 },
  { id: 'dictee-1',         emoji: '📜', nom: 'Dictée bouclée',      description: 'Terminer une dictée complète.',
    test: (e) => e.dicteesTerminees >= 1 },
  { id: 'dictee-or',        emoji: '🏆', nom: 'Dictée en or',        description: 'Une dictée avec 90 % de mots justes.',
    test: (e) => e.meilleurScoreDictee >= 90 },
  { id: 'lexique-solide',   emoji: '🔤', nom: 'Lexique solide',      description: '40 mots écrits correctement.',
    test: (e) => e.reussisParCategorie['lexique'] >= 40 },
  { id: 'participes',       emoji: '🔀', nom: 'Reine des participes', description: '30 participes bien classés.',
    test: (e) => e.reussisParCategorie['participe-present'] >= 30 },
  { id: 'niveau-5',         emoji: '⭐', nom: 'Niveau 5',            description: 'Atteindre le niveau 5.',
    test: (e) => e.niveau >= 5 },
  { id: 'centurion',        emoji: '💯', nom: 'Cent réponses',       description: '100 bonnes réponses au total.',
    test: (e) => e.reussisTotal >= 100 }
];

/** Compteurs cumulés utilisés par les badges (recalculés depuis l'état, pas stockés en double). */
function compteurs(extras = {}) {
  const etat = lire();
  const reussisParCategorie = {};
  let reussisTotal = 0;
  for (const f of Object.values(etat.progression)) {
    reussisTotal += f.reussis;
    if (f.categorie) reussisParCategorie[f.categorie] = (reussisParCategorie[f.categorie] || 0) + f.reussis;
  }
  const compteursSession = etat.compteurs || {};
  return {
    reussisTotal,
    reussisParCategorie: new Proxy(reussisParCategorie, { get: (o, k) => o[k] || 0 }),
    niveau: niveauDepuisXp(etat.xp),
    streakRecord: etat.streak.record,
    sessionsTerminees: compteursSession.sessionsTerminees || 0,
    sessionsParfaites: compteursSession.sessionsParfaites || 0,
    meilleureSerie: compteursSession.meilleureSerie || 0,
    dicteesTerminees: compteursSession.dicteesTerminees || 0,
    meilleurScoreDictee: compteursSession.meilleurScoreDictee || 0,
    fragilesRattrapes: compteursSession.fragilesRattrapes || 0,
    ...extras
  };
}

/** Met à jour les compteurs de fin de session puis renvoie les badges nouvellement débloqués. */
export function cloturerSession({ parfaite, meilleureSerie, dictee = null, fragilesRattrapes = 0 }) {
  const etat = lire();
  const c = etat.compteurs || (etat.compteurs = {});
  c.sessionsTerminees = (c.sessionsTerminees || 0) + 1;
  if (parfaite) c.sessionsParfaites = (c.sessionsParfaites || 0) + 1;
  c.meilleureSerie = Math.max(c.meilleureSerie || 0, meilleureSerie || 0);
  c.fragilesRattrapes = (c.fragilesRattrapes || 0) + fragilesRattrapes;
  if (dictee) {
    c.dicteesTerminees = (c.dicteesTerminees || 0) + 1;
    c.meilleurScoreDictee = Math.max(c.meilleurScoreDictee || 0, dictee.score || 0);
  }
  sauver();
  const etatBadges = compteurs();
  const nouveaux = [];
  for (const b of BADGES) {
    if (!etat.badges.includes(b.id) && b.test(etatBadges) && ajouterBadge(b.id)) nouveaux.push(b);
  }
  return nouveaux;
}

export function badgesObtenus() {
  const etat = lire();
  return BADGES.map(b => ({ ...b, obtenu: etat.badges.includes(b.id) }));
}

export function resumeSemaine() { return statistiques(7); }
