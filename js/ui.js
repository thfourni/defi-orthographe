/** Petits utilitaires DOM partagés par les écrans (pas de framework). */

/** Crée un élément. `props` accepte class, text, html, dataset, onclick, attributs… */
export function el(tag, props = {}, enfants = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k === 'style') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of [].concat(enfants)) {
    if (e === null || e === undefined || e === false) continue;
    n.append(e instanceof Node ? e : document.createTextNode(e));
  }
  return n;
}

/**
 * Ajoute des enfants en ignorant null/false : permet d'écrire
 * `ajouter(root, condition && el(...))` sans faire apparaître « false » à l'écran.
 */
export function ajouter(parent, ...enfants) {
  for (const e of enfants.flat()) {
    if (e === null || e === undefined || e === false || e === '') continue;
    parent.append(e instanceof Node ? e : document.createTextNode(e));
  }
  return parent;
}

export function vider(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

export function jauge(pourcent, couleur) {
  return el('div', { class: 'jauge' }, [el('i', { style: { width: `${Math.max(0, Math.min(100, pourcent))}%`, background: couleur } })]);
}

export function entete(titre, surRetour) {
  return el('header', { class: 'entete' }, [
    surRetour && el('button', { class: 'btn-icone', 'aria-label': 'Retour', onClick: surRetour, text: '←' }),
    el('h2', { text: titre })
  ]);
}

export function vide(emoji, texte) {
  return el('div', { class: 'vide' }, [el('span', { class: 'emoji', text: emoji }), el('p', { text: texte })]);
}

/** Petite vibration de retour tactile, quand le téléphone le permet. */
export function vibrer(motif) {
  try { navigator.vibrate?.(motif); } catch (e) { /* non supporté */ }
}

/** Accord en nombre : pluriel(1, 'élément') → « 1 élément ». */
export function pluriel(n, singulier, pluriel = null) {
  return `${n} ${n > 1 ? (pluriel || singulier + 's') : singulier}`;
}

export const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const JOURS_LONGS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « jeudi 17 septembre », à partir d'une date AAAA-MM-JJ. */
export function dateLisible(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  const indexJour = (new Date(a, m - 1, j).getDay() + 6) % 7;
  return `${JOURS_LONGS[indexJour]} ${j} ${MOIS[m - 1]}`;
}
