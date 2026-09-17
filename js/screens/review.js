/** Écran « mes mots à réviser » : ce qui reste fragile, avec relance ciblée. */
import { ajouter, el, entete, vide, pluriel } from '../ui.js';
import { fragiles } from '../store.js';
import { libelleItem, categorie as infoCategorie, regle as infoRegle } from '../data.js';

/** Rappelle la nature de la dernière faute commise sur cet item. */
function natureLisible(derniereErreur) {
  const n = derniereErreur?.natures;
  if (!n || !n.length) return null;
  if (n.length > 1) return 'Dernière fois : orthographe + grammaire';
  return n[0] === 'grammaticale' ? 'Dernière fois : faute de grammaire' : 'Dernière fois : faute d\'orthographe';
}

export function rendre(root, ctx) {
  const liste = fragiles();

  ajouter(root, entete('Mes mots à réviser'));

  if (!liste.length) {
    ajouter(root, vide('✨', 'Rien de fragile pour le moment. Fais une session : les mots ratés apparaîtront ici.'));
    ajouter(root, el('button', { class: 'btn btn--primaire btn--bloc btn--grand', text: '🚀 Commencer une session', onClick: () => ctx.aller('exercice', {}) }));
    return;
  }

  ajouter(root, 
    el('p', { style: { color: 'var(--encre-douce)', fontSize: '.92rem', marginBottom: '14px' },
      text: liste.length > 1
        ? `${liste.length} éléments reviennent plus souvent que les autres tant qu'ils ne sont pas acquis.`
        : 'Cet élément reviendra plus souvent que les autres tant qu\'il ne sera pas acquis.' }),
    el('button', {
      class: 'btn btn--primaire btn--bloc btn--grand',
      text: `🎯 Session ciblée (${pluriel(Math.min(10, liste.length), 'item')})`,
      onClick: () => ctx.aller('exercice', { ids: liste.slice(0, 10).map(f => f.id) })
    }),
    el('div', { class: 'section-titre', text: 'Liste complète' }),
    el('div', { class: 'carte' }, liste.map(f => {
      const info = libelleItem(f.id);
      const cat = infoCategorie(f.categorie || info.categorie);
      const r = infoRegle(f.regleId);
      return el('div', { class: 'fragile', dataset: { cat: cat.id } }, [
        el('span', { class: 'emoji', text: cat.icone }),
        el('span', { class: 'texte' }, [
          el('b', { text: info.titre }),
          el('small', { text: natureLisible(f.derniereErreur) || info.sous })
        ]),
        el('span', { class: 'score', text: `${f.echecsTotal} ❌ / ${f.vus}` })
      ]);
    }))
  );
}
