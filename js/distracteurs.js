/**
 * Fabrique des propositions fausses mais plausibles, pour le repli en choix multiple
 * proposé après deux échecs de suite sur le même item (on évite le blocage devant
 * un clavier vide, sans transformer toute l'appli en QCM).
 */
import { normaliser } from './diff.js';

const TERMINAISONS = [
  [/ais$/, ['ait', 'aient', 'ai']],
  [/ait$/, ['ais', 'aient', 'ai']],
  [/aient$/, ['ait', 'ais', 'aie']],
  [/ions$/, ['ons', 'ion', 'iions']],
  [/iez$/, ['ez', 'iiez']],
  [/ons$/, ['ions', 'on']],
  [/ez$/, ['iez', 'er']],
  [/é$/, ['er', 'ée', 'ai']],
  [/er$/, ['é', 'ais']]
];

function variantesConjugaison(forme) {
  const out = [];
  for (const [motif, remplacements] of TERMINAISONS) {
    if (!motif.test(forme)) continue;
    for (const r of remplacements) out.push(forme.replace(motif, r));
    break;
  }
  return out;
}

function variantesOrthographe(mot) {
  const out = [];
  const sansAccent = mot.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (sansAccent !== mot) out.push(sansAccent);

  // Doubler une consonne simple (l'erreur la plus fréquente).
  const doublable = mot.search(/[^aeiouàâéèêîïôùûy\s'-]/i);
  const m = mot.match(/([bcdfglmnprst])(?=[aeiouàâéèêîïôùûy])/i);
  if (m && m.index > 0) out.push(mot.slice(0, m.index) + m[1] + mot.slice(m.index));
  else if (doublable > 0) out.push(mot.slice(0, doublable) + mot[doublable] + mot.slice(doublable));

  // Simplifier une consonne doublée.
  const dbl = mot.match(/([bcdfglmnprst])\1/i);
  if (dbl) out.push(mot.replace(dbl[0], dbl[1]));

  // Confusions de finale.
  if (/ent$/.test(mot)) out.push(mot.replace(/ent$/, 'ant'));
  else if (/ant$/.test(mot)) out.push(mot.replace(/ant$/, 'ent'));
  if (/s$/.test(mot)) out.push(mot.slice(0, -1)); else out.push(mot + 's');

  return out;
}

/**
 * Renvoie une liste d'options mélangées contenant la bonne réponse.
 * @param {string} bonne - la forme attendue
 * @param {'conjugaison'|'mot'} genre
 * @param {number} nb - nombre total d'options souhaité
 */
export function options(bonne, genre = 'mot', nb = 3) {
  const brutes = genre === 'conjugaison'
    ? [...variantesConjugaison(bonne), ...variantesOrthographe(bonne)]
    : [...variantesOrthographe(bonne), ...variantesConjugaison(bonne)];

  const vues = new Set([normaliser(bonne)]);
  const fausses = [];
  for (const v of brutes) {
    const cle = normaliser(v);
    if (!v || vues.has(cle) || v === bonne) continue;
    vues.add(cle);
    fausses.push(v);
    if (fausses.length >= nb - 1) break;
  }

  const liste = [bonne, ...fausses];
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}
