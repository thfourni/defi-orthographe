/** Écran statistiques : activité des 7 ou 30 derniers jours, progression et badges. */
import { ajouter, el, jauge, entete } from '../ui.js';
import { lire, statistiques } from '../store.js';
import { infosNiveau, titreNiveau, badgesObtenus } from '../gamification.js';
import { progressionCategories } from '../scheduler.js';

let fenetre = 7;

function graphique(banque, stats) {
  const max = Math.max(1, ...stats.jours.map(j => j.total));
  const colonnes = stats.jours.map(j => {
    const parts = banque.categories
      .filter(c => j.categories[c.id])
      .map(c => el('div', {
        class: 'part',
        style: { height: `${(j.categories[c.id] / max) * 100}%`, background: c.couleur },
        title: `${j.date} — ${c.nom} : ${j.categories[c.id]}`
      }));
    return el('div', { class: 'colonne', title: `${j.date} : ${j.total} réponses` }, parts);
  });
  return el('div', {}, [
    el('div', { class: 'graphique' }, colonnes),
    el('div', { class: 'legende' }, banque.categories.map(c =>
      el('span', {}, [el('i', { style: { background: c.couleur } }), c.nomCourt || c.nom])
    ))
  ]);
}

export function rendre(root, ctx) {
  const etat = lire();
  const niveau = infosNiveau(etat.xp);
  const stats = statistiques(fenetre);
  const cats = progressionCategories(ctx.banque);
  const badges = badgesObtenus();
  const obtenus = badges.filter(b => b.obtenu).length;

  ajouter(root, 
    entete('Statistiques'),

    el('div', { class: 'tuiles' }, [
      el('div', { class: 'tuile' }, [el('div', { class: 'chiffre', text: `${etat.xp}` }), el('div', { class: 'libelle', text: 'XP' })]),
      el('div', { class: 'tuile' }, [el('div', { class: 'chiffre', text: `${niveau.niveau}` }), el('div', { class: 'libelle', text: titreNiveau(niveau.niveau) })]),
      el('div', { class: 'tuile' }, [el('div', { class: 'chiffre', text: `🔥 ${etat.streak.record}` }), el('div', { class: 'libelle', text: 'record' })])
    ]),

    el('div', { class: 'section-titre', text: 'Activité' }),
    el('div', { class: 'onglets' }, [7, 30].map(n => el('button', {
      text: `${n} jours`, dataset: { actif: fenetre === n ? 'oui' : 'non' },
      onClick: () => { fenetre = n; ctx.aller('stats'); }
    }))),
    el('div', { class: 'carte' }, [
      stats.total === 0
        ? el('p', { class: 'vide', text: 'Pas encore de données sur cette période.' })
        : graphique(ctx.banque, stats)
    ]),

    el('div', { class: 'section-titre', text: 'Réussite par catégorie' }),
    el('div', { class: 'carte' }, cats.map(c => {
      const s = stats.parCategorie[c.id];
      const taux = s && s.vus ? Math.round((s.reussis / s.vus) * 100) : null;
      return el('div', { class: 'progression-ligne', dataset: { cat: c.id } }, [
        el('header', {}, [
          el('strong', { text: `${c.icone} ${c.nomCourt || c.nom}` }),
          el('span', { class: 'valeur', text: taux === null ? '—' : `${taux} % sur ${s.vus} réponses` })
        ]),
        jauge(taux === null ? 0 : taux)
      ]);
    })),

    el('div', { class: 'section-titre', text: `Badges (${obtenus}/${badges.length})` }),
    el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' } },
      badges.map(b => el('div', { class: 'badge', dataset: { obtenu: b.obtenu ? 'oui' : 'non' }, title: b.description }, [
        el('span', { class: 'emoji', text: b.emoji }),
        el('span', { class: 'nom', text: b.nom })
      ]))
    ),

    el('div', { class: 'section-titre', text: 'Données' }),
    el('div', { class: 'carte' }, [
      el('p', { style: { fontSize: '.88rem', color: 'var(--encre-douce)' }, text: 'Toute ta progression reste dans ce téléphone. Rien n\'est envoyé sur Internet.' }),
      el('button', {
        class: 'btn btn--fantome btn--bloc', style: { marginTop: '12px' },
        text: '🗑️ Effacer ma progression',
        onClick: () => { if (confirm('Effacer toute la progression ? Cette action est définitive.')) { ctx.effacerTout(); } }
      })
    ])
  );
}
