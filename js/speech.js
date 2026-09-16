/**
 * Synthèse vocale française, via l'API SpeechSynthesis du navigateur.
 * Aucun fichier audio à héberger : tout est lu par le téléphone, donc ça marche hors ligne.
 */
let voixFr = null;
let pret = false;

export const DEBITS = [
  { id: 'lent',   libelle: 'Lent',   valeur: 0.6 },
  { id: 'normal', libelle: 'Normal', valeur: 0.8 },
  { id: 'vite',   libelle: 'Rapide', valeur: 1.0 }
];

export function disponible() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function choisirVoix() {
  if (!disponible()) return null;
  const voix = speechSynthesis.getVoices();
  if (!voix.length) return null;
  const fr = voix.filter(v => v.lang && v.lang.toLowerCase().startsWith('fr'));
  // On préfère une voix fr-FR locale (meilleure qualité hors ligne).
  return fr.find(v => v.lang === 'fr-FR' && v.localService) || fr.find(v => v.lang === 'fr-FR') || fr[0] || null;
}

export function initialiser() {
  if (!disponible() || pret) return;
  voixFr = choisirVoix();
  speechSynthesis.addEventListener('voiceschanged', () => { voixFr = choisirVoix(); });
  pret = true;
}

export function stop() {
  if (disponible()) speechSynthesis.cancel();
}

/**
 * Lit un texte. Renvoie une promesse résolue à la fin de la lecture.
 * @param {string} texte
 * @param {object} options { debit, onDebut, onFin }
 */
export function lire(texte, { debit = 0.8, onDebut, onFin } = {}) {
  return new Promise((resolve) => {
    if (!disponible() || !texte) { onFin?.(); resolve(false); return; }
    stop();
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-FR';
    u.rate = debit;
    u.pitch = 1;
    if (!voixFr) voixFr = choisirVoix();
    if (voixFr) u.voice = voixFr;
    let termine = false;
    const fin = () => { if (termine) return; termine = true; onFin?.(); resolve(true); };
    u.onstart = () => onDebut?.();
    u.onend = fin;
    u.onerror = fin;
    speechSynthesis.speak(u);
    // Garde-fou : certains navigateurs mobiles n'émettent jamais « onend ».
    setTimeout(fin, Math.max(4000, texte.length * 120));
  });
}

/** Épelle un mot lettre par lettre (utile pour vérifier une correction). */
export function epeler(mot, { debit = 0.7 } = {}) {
  return lire([...mot].join(', '), { debit });
}
