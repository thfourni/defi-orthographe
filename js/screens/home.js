/** Écran d'accueil : série du jour, XP, bouton de session, accès par catégorie. */
import { ajouter, el, jauge, vibrer, pluriel, JOURS_COURTS } from '../ui.js';
import { lire, aujourdhui, ajouteJours } from '../store.js';
import { infosNiveau, titreNiveau } from '../gamification.js';
import { progressionCategories, nombreDus, TAILLE_SESSION } from '../scheduler.js';
import { fragiles } from '../store.js';

function calendrierSerie(etat) {
  const jours = [];
  const jour = aujourdhui();
  const actifs = new Set();
  // On reconstitue les 7 derniers jours à partir de l'historique agrégé.
  const dates = new Set(etat.historique.map(h => h.date));
  for (let i = 6; i >= 0; i--) {
    const d = ajouteJours(jour, -i);
    if (dates.has(d)) actifs.add(d);
    const [a, m, j] = d.split('-').map(Number);
    const indexJour = (new Date(a, m - 1, j).getDay() + 6) % 7;
    jours.push({ date: d, libelle: JOURS_COURTS[indexJour], actif: dates.has(d), aujourdhui: d === jour });
  }
  return el('div', { class: 'calendrier' }, jours.map(j =>
    el('div', {
      class: 'jour', text: j.libelle, title: j.date,
      dataset: { actif: j.actif ? 'oui' : 'non', aujourdhui: j.aujourdhui ? 'oui' : 'non' }
    })
  ));
}

export function rendre(root, ctx) {
  const etat = lire();
  const niveau = infosNiveau(etat.xp);
  const dus = nombreDus(ctx.banque);
  const nbFragiles = fragiles().length;
  const cats = progressionCategories(ctx.banque);

  ajouter(root, 
    el('div', { class: 'banniere' }, [
      el('div', { class: 'salut', text: `Niveau ${niveau.niveau}` }),
      el('div', { class: 'niveau', text: titreNiveau(niveau.niveau) }),
      el('div', { class: 'compteurs' }, [
        el('div', { class: 'compteur' }, [
          el('div', { class: 'chiffre', text: `🔥 ${etat.streak.actuel}` }),
          el('div', { class: 'libelle', text: 'jours de suite' })
        ]),
        el('div', { class: 'compteur' }, [
          el('div', { class: 'chiffre', text: `${etat.xp}` }),
          el('div', { class: 'libelle', text: 'XP au total' })
        ]),
        el('div', { class: 'compteur' }, [
          el('div', { class: 'chiffre', text: `${dus}` }),
          el('div', { class: 'libelle', text: 'à revoir' })
        ])
      ]),
      jauge(niveau.pourcent),
      el('div', { class: 'xp-restant', text: `Encore ${niveau.haut - etat.xp} XP avant le niveau ${niveau.niveau + 1}` })
    ]),

    el('div', { class: 'section-titre', text: 'Ta semaine' }),
    el('div', { class: 'carte' }, [calendrierSerie(etat)]),

    el('div', { class: 'section-titre', text: 'Entraînement' }),
    el('button', {
      class: 'btn btn--primaire btn--bloc btn--grand',
      onClick: () => { vibrer(10); ctx.aller('exercice', { taille: TAILLE_SESSION }); }
    }, ['🚀 Commencer une session']),

    nbFragiles > 0 && el('button', {
      class: 'btn btn--fantome btn--bloc',
      style: { marginTop: '10px' },
      onClick: () => ctx.aller('exercice', { seulementFragiles: true, taille: Math.min(10, nbFragiles) })
    }, [`🎯 Réviser ${pluriel(nbFragiles, 'point faible', 'points faibles')}`]),

    el('div', { class: 'section-titre', text: 'Par thème' }),
    el('div', { class: 'modes' }, [
      ...cats.map(c => el('button', {
        class: 'mode', dataset: { cat: c.id },
        onClick: () => ctx.aller('exercice', { categorie: c.id })
      }, [
        el('span', { class: 'emoji', text: c.icone }),
        el('span', { class: 'texte' }, [
          el('b', { text: c.nom }),
          el('small', { text: `${c.acquis}/${c.total} acquis` })
        ]),
        el('span', { class: 'fleche', text: '›' })
      ])),
      ...(ctx.banque.dictees || []).map(d => el('button', {
        class: 'mode', dataset: { cat: 'dictee' },
        onClick: () => ctx.aller('exercice', { dicteeId: d.id })
      }, [
        el('span', { class: 'emoji', text: '📜' }),
        el('span', { class: 'texte' }, [
          el('b', { text: `Dictée : ${d.titre}` }),
          el('small', { text: `${d.segments.length} phrases — ${d.auteur}` })
        ]),
        el('span', { class: 'fleche', text: '›' })
      ]))
    ]),

    el('div', { class: 'section-titre', text: 'Progression par catégorie' }),
    el('div', { class: 'carte' }, cats.map(c =>
      el('div', { class: 'progression-ligne', dataset: { cat: c.id } }, [
        el('header', {}, [
          el('strong', { text: `${c.icone} ${c.nomCourt || c.nom}` }),
          el('span', { class: 'valeur', text: `${c.pourcent} %` })
        ]),
        jauge(c.pourcent)
      ])
    ))
  );
}
