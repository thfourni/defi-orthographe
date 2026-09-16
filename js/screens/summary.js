/** Écran de fin de session : XP gagné, erreurs à retravailler, correction de dictée. */
import { ajouter, el } from '../ui.js';
import { libelleItem, regle as infoRegle, categorie as infoCategorie } from '../data.js';
import { rendreDiff } from './exercise.js';

function encouragement(justes, total) {
  const taux = total ? justes / total : 0;
  if (taux === 1) return { emoji: '🏆', texte: 'Sans faute, impressionnant !' };
  if (taux >= 0.8) return { emoji: '🎉', texte: 'Très bonne session !' };
  if (taux >= 0.5) return { emoji: '💪', texte: 'Ça progresse, continue !' };
  return { emoji: '🌱', texte: 'Les erreurs d\'aujourd\'hui sont les points forts de demain.' };
}

export function rendre(root, ctx, resultat) {
  const { xp, justes, total, erreurs = [], badges = [], meilleureSerie, type, corrections, scoreDictee } = resultat;
  const bravo = type === 'dictee'
    ? encouragement(scoreDictee, 100)
    : encouragement(justes, total);

  // Une même règle ratée plusieurs fois n'est listée qu'une fois.
  const parSolution = new Map();
  for (const e of erreurs) {
    const cle = `${e.id}|${e.solution}`;
    if (!parSolution.has(cle)) parSolution.set(cle, { ...e, nb: 1 });
    else parSolution.get(cle).nb += 1;
  }

  ajouter(root, el('div', { class: 'fin-session' }, [
    el('div', { class: 'emoji-fin', text: bravo.emoji }),
    el('div', { class: 'xp-gagne', text: `+${xp} XP` }),
    el('div', { class: 'sous', text: bravo.texte }),

    el('div', { class: 'tuiles' }, [
      el('div', { class: 'tuile' }, [
        el('div', { class: 'chiffre', text: type === 'dictee' ? `${scoreDictee} %` : `${justes}/${total}` }),
        el('div', { class: 'libelle', text: type === 'dictee' ? 'mots justes' : 'réussites' })
      ]),
      el('div', { class: 'tuile' }, [
        el('div', { class: 'chiffre', text: `🔥 ${meilleureSerie}` }),
        el('div', { class: 'libelle', text: 'meilleure série' })
      ]),
      el('div', { class: 'tuile' }, [
        el('div', { class: 'chiffre', text: `${parSolution.size}` }),
        el('div', { class: 'libelle', text: 'à retravailler' })
      ])
    ]),

    badges.length > 0 && el('div', { style: { marginTop: '18px' } }, [
      el('div', { class: 'section-titre', text: badges.length > 1 ? 'Nouveaux badges !' : 'Nouveau badge !' }),
      ...badges.map(b => el('div', { class: 'badge-nouveau' }, [
        el('span', { class: 'emoji', text: b.emoji }),
        el('span', {}, [el('b', { text: b.nom }), el('div', { style: { fontSize: '.85rem', opacity: .95 }, text: b.description })])
      ]))
    ]),

    parSolution.size > 0 && el('div', { style: { marginTop: '18px' } }, [
      el('div', { class: 'section-titre', text: 'À retravailler' }),
      el('div', { class: 'carte' }, [...parSolution.values()].slice(0, 12).map(e => {
        const r = e.regleId ? infoRegle(e.regleId) : null;
        const cat = infoCategorie(e.categorie);
        return el('div', { class: 'fragile', dataset: { cat: e.categorie } }, [
          el('span', { class: 'emoji', text: cat.icone }),
          el('span', { class: 'texte' }, [
            el('b', { text: e.solution }),
            el('small', { text: r ? r.titre : cat.nom })
          ]),
          e.nb > 1 && el('span', { class: 'score', text: `×${e.nb}` })
        ]);
      }))
    ]),

    type === 'dictee' && corrections && el('div', { style: { marginTop: '18px' } }, [
      el('div', { class: 'section-titre', text: 'Correction phrase par phrase' }),
      el('div', { class: 'carte' }, corrections.map((c, i) => el('div', { class: 'correction-segment' }, [
        el('div', { class: 'ligne-titre' }, [
          el('span', { class: 'dictee-segment', text: `Phrase ${i + 1}` }),
          el('span', { class: 'pastille', text: `${c.resultat.justes}/${c.resultat.total}` })
        ]),
        rendreDiff(c.resultat)
      ])))
    ]),

    el('div', { style: { marginTop: '22px', display: 'grid', gap: '10px' } }, [
      el('button', {
        class: 'btn btn--primaire btn--bloc btn--grand',
        text: '🔁 Une autre session',
        onClick: () => ctx.aller('exercice', resultat.config || {})
      }),
      parSolution.size > 0 && el('button', {
        class: 'btn btn--fantome btn--bloc',
        text: '🎯 Rejouer seulement mes erreurs',
        onClick: () => ctx.aller('exercice', { ids: [...new Set([...parSolution.values()].map(e => e.id))] })
      }),
      el('button', { class: 'btn btn--fantome btn--bloc', text: '🏠 Retour à l\'accueil', onClick: () => ctx.aller('accueil') })
    ])
  ]));
}
