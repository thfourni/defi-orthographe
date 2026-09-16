/** Point d'entrée : chargement des données, navigation entre écrans, service worker. */
import { el, vider } from './ui.js';
import { charger, toutEffacer } from './store.js';
import { chargerBanque } from './data.js';
import * as voix from './speech.js';
import * as accueil from './screens/home.js';
import * as exercice from './screens/exercise.js';
import * as bilan from './screens/summary.js';
import * as stats from './screens/stats.js';
import * as revision from './screens/review.js';

const vue = document.getElementById('vue');
const nav = document.getElementById('nav');

const ctx = {
  banque: null,
  aller,
  effacerTout: () => { toutEffacer(); aller('accueil'); }
};

const ONGLETS = [
  { id: 'accueil', emoji: '🏠', libelle: 'Accueil' },
  { id: 'revision', emoji: '📝', libelle: 'À réviser' },
  { id: 'stats', emoji: '📊', libelle: 'Stats' }
];

function majNav(ecran) {
  const visible = ['accueil', 'revision', 'stats'].includes(ecran);
  nav.hidden = !visible;
  nav.querySelectorAll('button').forEach(b => b.dataset.actif = b.dataset.ecran === ecran ? 'oui' : 'non');
}

function aller(ecran, params = {}) {
  vider(vue);
  window.scrollTo({ top: 0 });
  majNav(ecran);
  document.body.dataset.ecran = ecran;

  if (ecran === 'accueil') accueil.rendre(vue, ctx);
  else if (ecran === 'exercice') exercice.demarrer(vue, ctx, params);
  else if (ecran === 'fin') bilan.rendre(vue, ctx, params);
  else if (ecran === 'stats') stats.rendre(vue, ctx);
  else if (ecran === 'revision') revision.rendre(vue, ctx);

  // Un écran = une entrée d'historique, pour que le bouton « retour » du téléphone fonctionne.
  if (history.state?.ecran !== ecran || ecran === 'exercice') {
    history.pushState({ ecran }, '', ecran === 'accueil' ? '#' : `#${ecran}`);
  }
}

window.addEventListener('popstate', (e) => {
  const ecran = e.state?.ecran;
  if (!ecran || ecran === 'exercice' || ecran === 'fin') { voix.stop(); aller('accueil'); }
  else aller(ecran);
});

function construireNav() {
  nav.append(el('ul', {}, ONGLETS.map(o => el('li', {}, [
    el('button', { dataset: { ecran: o.id }, onClick: () => aller(o.id) }, [
      el('span', { class: 'emoji', text: o.emoji }),
      el('span', { text: o.libelle })
    ])
  ]))));
}

function erreurFatale(message) {
  vider(vue).append(
    el('div', { class: 'bandeau', dataset: { type: 'erreur' }, text: message }),
    el('p', { style: { color: 'var(--encre-douce)', fontSize: '.9rem' },
      text: 'L\'application doit être servie par un serveur web (http/https), pas ouverte directement depuis le disque.' })
  );
}

async function demarrer() {
  charger();
  voix.initialiser();
  construireNav();
  try {
    ctx.banque = await chargerBanque();
  } catch (e) {
    console.error(e);
    return erreurFatale('Impossible de charger la banque d\'exercices (data/exercices.json).');
  }
  aller('accueil');

  if ('serviceWorker' in navigator) {
    // « load » a pu être déclenché pendant le chargement des données : on teste readyState.
    const enregistrer = () => navigator.serviceWorker.register('sw.js')
      .catch(e => console.warn('Service worker non enregistré', e));
    if (document.readyState === 'complete') enregistrer();
    else window.addEventListener('load', enregistrer, { once: true });
  }
}

// iOS ne « débloque » la synthèse vocale qu'après une première interaction de l'utilisateur.
document.addEventListener('pointerdown', function amorcer() {
  if (voix.disponible()) { try { speechSynthesis.resume(); } catch (e) { /* ignore */ } }
  document.removeEventListener('pointerdown', amorcer);
}, { once: true });

demarrer();
