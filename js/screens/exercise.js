/**
 * Écran d'exercice : une question à la fois, correction immédiate.
 * Gère les quatre types d'exercices (trou, mot dicté, qcm, tri) et le mode dictée complète.
 */
import { el, vider, jauge, vibrer } from '../ui.js';
import { lire as lireEtat, fiche, enregistrerReponse, reglage, pointerJour } from '../store.js';
import { xpReponse, cloturerSession } from '../gamification.js';
import { construireSession } from '../scheduler.js';
import { categorie as infoCategorie, regle as infoRegle } from '../data.js';
import * as voix from '../speech.js';
import * as distracteurs from '../distracteurs.js';
import { memeMot, proche, diffLettres, diffMots } from '../diff.js';
import { analyserForme, analyserMot, GENRES } from '../analyse.js';

const SEUIL_QCM = 2; // après 2 échecs de suite sur un item, on propose un choix multiple

let session = null;

export function demarrer(root, ctx, config = {}) {
  pointerJour();
  if (config.dicteeId) return demarrerDictee(root, ctx, config.dicteeId);

  const items = construireSession(ctx.banque, config);
  if (!items.length) {
    root.append(el('div', { class: 'vide' }, [el('span', { class: 'emoji', text: '🤷' }), el('p', { text: 'Aucun exercice disponible pour ce thème.' })]));
    return;
  }
  session = {
    type: 'exercices', items, index: 0, serie: 0, meilleureSerie: 0,
    xpTotal: 0, justes: 0, erreurs: [], fragilesRattrapes: 0, ctx, root, config
  };
  afficherQuestion();
}

/* --------------------------------------------------------------- cadre */

function cadre(contenuQuestion, boutons) {
  const { root, index, items } = session;
  vider(root);
  const exo = items[index];
  const cat = exo.categorie ? infoCategorie(exo.categorie) : { id: 'dictee', nom: 'Dictée', icone: '📜' };

  root.append(
    el('div', { class: 'barre-session', dataset: { cat: cat.id } }, [
      el('button', { class: 'btn-icone', 'aria-label': 'Quitter la session', text: '✕', onClick: quitter }),
      jauge(Math.round((index / items.length) * 100), 'var(--cat)'),
      el('span', { class: 'compte', text: `${index + 1}/${items.length}` })
    ]),
    el('div', { dataset: { cat: cat.id } }, [
      el('span', { class: 'pastille', text: `${cat.icone} ${cat.nomCourt || cat.nom}` }),
      contenuQuestion
    ]),
    el('div', { class: 'barre-bas' }, [el('div', { class: 'app' }, boutons)])
  );
}

function quitter() {
  voix.stop();
  const s = session;
  session = null;
  s.ctx.aller('accueil');
}

function boutonValider(libelle, action, actif = true) {
  const b = el('button', { class: 'btn btn--primaire btn--bloc btn--grand', text: libelle, onClick: action });
  b.disabled = !actif;
  return b;
}

/* ----------------------------------------------------- rendu des types */

function afficherQuestion() {
  const exo = session.items[session.index];
  session.reponseDonnee = false;
  const f = fiche(exo.id, exo.categorie);
  session.aideQcm = (exo.type === 'trou' || exo.type === 'mot') && f.echecsConsecutifs >= SEUIL_QCM;
  session.etaitFragile = f.echecsConsecutifs > 0 || f.echecsTotal >= 2;

  if (exo.type === 'trou') rendreTrou(exo);
  else if (exo.type === 'mot') rendreMot(exo);
  else if (exo.type === 'qcm') rendreQcm(exo);
  else if (exo.type === 'tri') rendreTri(exo);
  else if (exo.type === 'dictee-segment') rendreSegmentDictee(exo);
}

/** Phrase à trous : la phrase, puis un champ par trou (ou un choix multiple en repli). */
function rendreTrou(exo) {
  const morceaux = exo.phrase.split(/(\{\d\})/g);
  const phrase = el('p', { class: 'phrase' }, morceaux.map(m => {
    const t = m.match(/^\{(\d)\}$/);
    return t ? el('span', { class: 'trou-place', text: '\u00A0\u00A0\u00A0' }) : m;
  }));

  const champs = [];
  const zone = el('div', { class: 'saisie-groupe' });

  exo.trous.forEach((trou, i) => {
    const etiquette = el('div', { class: 'consigne' }, [
      `Trou ${exo.trous.length > 1 ? i + 1 : ''} — `,
      el('span', { class: 'infinitif', text: trou.infinitif }),
      ` (${trou.temps})`
    ]);
    if (session.aideQcm) {
      const opts = distracteurs.options(trou.reponses[0], 'conjugaison', 3);
      const groupe = el('div', {});
      const etat = { valeur: null };
      opts.forEach(o => groupe.append(el('button', {
        class: 'option', text: o,
        onClick: (ev) => {
          groupe.querySelectorAll('.option').forEach(b => b.dataset.choisi = 'non');
          ev.currentTarget.dataset.choisi = 'oui';
          etat.valeur = o;
          majValider();
        }
      })));
      champs.push({ lire: () => etat.valeur, noeud: groupe, trou });
      zone.append(etiquette, groupe);
    } else {
      const input = el('input', {
        class: 'champ', type: 'text', autocomplete: 'off', autocapitalize: 'off',
        autocorrect: 'off', spellcheck: 'false', inputmode: 'text',
        placeholder: 'ta réponse', 'aria-label': `Forme conjuguée de ${trou.infinitif}`,
        onInput: majValider,
        onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } }
      });
      champs.push({ lire: () => input.value, noeud: input, trou });
      zone.append(etiquette, input);
    }
  });

  const bouton = boutonValider('Vérifier', valider, false);
  function majValider() { bouton.disabled = !champs.every(c => (c.lire() || '').trim()); }

  function valider() {
    if (session.reponseDonnee) return;
    const resultats = champs.map(c => {
      const saisi = (c.lire() || '').trim();
      const juste = c.trou.reponses.some(r => memeMot(saisi, r));
      return {
        saisi, juste, attendu: c.trou.reponses[0],
        analyse: juste ? { juste: true, fautes: [] } : analyserForme(saisi, c.trou.reponses[0], {
          temps: c.trou.temps, personne: c.trou.personne, sujet: c.trou.sujet, infinitif: c.trou.infinitif
        })
      };
    });
    const juste = resultats.every(r => r.juste);
    champs.forEach((c, i) => {
      if (c.noeud.tagName === 'INPUT') c.noeud.dataset.etat = resultats[i].juste ? 'juste' : 'faux';
      else c.noeud.querySelectorAll('.option').forEach(b => {
        if (c.trou.reponses.includes(b.textContent)) b.dataset.etat = 'juste';
        else if (b.dataset.choisi === 'oui') b.dataset.etat = 'faux';
      });
    });
    const solution = resultats.map(r => r.attendu).join(', ');
    const fautes = resultats.flatMap(r => r.analyse.fautes);
    terminerQuestion({ juste, solution, fautes, indice: exo.trous[0].indice });
  }

  cadre(el('div', { class: 'question' }, [
    el('div', { class: 'consigne', text: 'Conjugue correctement le verbe.' }),
    phrase, zone,
    exo.trous[0].indice && el('p', { class: 'indice', text: `💡 ${exo.trous[0].indice}` })
  ]), [bouton]);
}

/** Dictée d'un mot isolé : écoute puis saisie, correction lettre à lettre. */
function rendreMot(exo) {
  const debit = reglage('debit') || 0.8;
  const bouton = boutonValider('Vérifier', valider, false);

  const boutonEcoute = el('button', {
    class: 'bouton-ecoute', 'aria-label': 'Écouter le mot', text: '🔊',
    onClick: () => dire()
  });
  function dire() {
    voix.lire(exo.prononce || exo.mot, {
      debit: reglage('debit') || 0.8,
      onDebut: () => boutonEcoute.dataset.parle = 'oui',
      onFin: () => boutonEcoute.dataset.parle = 'non'
    });
  }

  const choixDebit = el('div', { class: 'debit' }, voix.DEBITS.map(d => el('button', {
    text: d.libelle, dataset: { actif: (reglage('debit') === d.valeur) ? 'oui' : 'non' },
    onClick: (ev) => {
      reglage('debit', d.valeur);
      choixDebit.querySelectorAll('button').forEach(b => b.dataset.actif = 'non');
      ev.currentTarget.dataset.actif = 'oui';
      dire();
    }
  })));

  let saisie = { lire: () => '' };
  let zone;
  if (session.aideQcm) {
    const opts = distracteurs.options(exo.mot, 'mot', 3);
    const groupe = el('div', {});
    const etat = { valeur: null };
    opts.forEach(o => groupe.append(el('button', {
      class: 'option', text: o,
      onClick: (ev) => {
        groupe.querySelectorAll('.option').forEach(b => b.dataset.choisi = 'non');
        ev.currentTarget.dataset.choisi = 'oui';
        etat.valeur = o; bouton.disabled = false;
      }
    })));
    saisie = { lire: () => etat.valeur, noeud: groupe };
    zone = groupe;
  } else {
    const input = el('input', {
      class: 'champ', type: 'text', autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false', placeholder: 'écris le mot',
      'aria-label': 'Écris le mot entendu',
      onInput: (e) => bouton.disabled = !e.target.value.trim(),
      onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } }
    });
    saisie = { lire: () => input.value, noeud: input };
    zone = input;
  }

  function valider() {
    if (session.reponseDonnee) return;
    const texte = (saisie.lire() || '').trim();
    const juste = memeMot(texte, exo.mot);
    if (saisie.noeud.tagName === 'INPUT') saisie.noeud.dataset.etat = juste ? 'juste' : 'faux';
    else saisie.noeud.querySelectorAll('.option').forEach(b => {
      if (b.textContent === exo.mot) b.dataset.etat = 'juste';
      else if (b.dataset.choisi === 'oui') b.dataset.etat = 'faux';
    });
    const analyse = juste ? { fautes: [] } : analyserMot(texte, exo.mot, { piege: exo.piege });
    // La correction lettre à lettre n'a de sens que si le mot écrit ressemble au mot attendu.
    const details = !juste && saisie.noeud.tagName === 'INPUT' && proche(texte, exo.mot)
      ? rendreLettres(texte, exo.mot) : null;
    terminerQuestion({ juste, solution: exo.mot, fautes: analyse.fautes, extra: details, contexte: exo.phraseContexte });
  }

  if (!voix.disponible()) {
    // Repli quand la synthèse vocale n'existe pas : on montre la phrase, mot masqué.
    zone = el('div', {}, [el('p', { class: 'phrase', text: (exo.phraseContexte || '').replace('{mot}', '______') }), zone]);
  }

  cadre(el('div', { class: 'question' }, [
    el('div', { class: 'consigne', text: 'Écoute puis écris le mot.' }),
    el('div', { class: 'audio-bloc' }, [
      voix.disponible() ? boutonEcoute : el('p', { class: 'phrase', text: '🔇 Audio indisponible sur cet appareil' }),
      voix.disponible() && choixDebit
    ]),
    el('div', { class: 'saisie-groupe' }, [zone])
  ]), [bouton]);

  if (voix.disponible()) setTimeout(dire, 250);
}

function rendreLettres(saisi, attendu) {
  const d = diffLettres(saisi, attendu);
  return el('div', {}, [
    el('div', { class: 'consigne', text: 'Lettre par lettre :' }),
    el('div', { class: 'lettres' }, d.filter(x => x.type !== 'ajout').map(x =>
      el('span', {
        class: x.type === 'ok' ? 'l-ok' : x.type === 'faux' ? 'l-faux' : 'l-oubli',
        text: x.type === 'faux' ? x.attendue : x.lettre
      })
    ))
  ]);
}

/** Choix multiple simple. */
function rendreQcm(exo) {
  const bouton = boutonValider('Vérifier', valider, false);
  let choisi = null;
  const groupe = el('div', {});
  exo.options.forEach((o, i) => groupe.append(el('button', {
    class: 'option', text: o,
    onClick: (ev) => {
      groupe.querySelectorAll('.option').forEach(b => b.dataset.choisi = 'non');
      ev.currentTarget.dataset.choisi = 'oui';
      choisi = i; bouton.disabled = false;
    }
  })));

  function valider() {
    if (session.reponseDonnee || choisi === null) return;
    const juste = choisi === exo.bonneReponse;
    groupe.querySelectorAll('.option').forEach((b, i) => {
      if (i === exo.bonneReponse) b.dataset.etat = 'juste';
      else if (i === choisi) b.dataset.etat = 'faux';
    });
    terminerQuestion({ juste, solution: exo.options[exo.bonneReponse] });
  }

  cadre(el('div', { class: 'question' }, [
    el('div', { class: 'consigne', text: exo.consigne }),
    groupe
  ]), [bouton]);
}

/** Tri : chaque phrase doit être rangée dans l'une des deux étiquettes. */
function rendreTri(exo) {
  const bouton = boutonValider('Vérifier', valider, false);
  const reponses = new Array(exo.items.length).fill(null);
  const etiquettes = exo.etiquettes || [
    { id: 'participe-present', libelle: 'Participe présent', aide: 'invariable' },
    { id: 'adjectif-verbal', libelle: 'Adjectif verbal', aide: 'accordé' }
  ];

  const liste = el('div', {}, exo.items.map((item, i) => {
    const choix = el('div', { class: 'tri-choix' }, etiquettes.map(et => el('button', {
      class: 'option',
      onClick: (ev) => {
        choix.querySelectorAll('.option').forEach(b => b.dataset.choisi = 'non');
        ev.currentTarget.dataset.choisi = 'oui';
        reponses[i] = et.id;
        bouton.disabled = reponses.some(r => r === null);
      }
    }, [el('b', { text: et.libelle }), el('small', { text: et.aide || '' })])));
    return el('div', { class: 'tri-item' }, [el('p', { class: 'phrase-tri', text: `« ${item.phrase} »` }), choix]);
  }));

  function valider() {
    if (session.reponseDonnee) return;
    const justes = exo.items.map((item, i) => reponses[i] === item.reponse);
    liste.querySelectorAll('.tri-item').forEach((n, i) => {
      n.querySelectorAll('.option').forEach((b, k) => {
        if (etiquettes[k].id === exo.items[i].reponse) b.dataset.etat = 'juste';
        else if (b.dataset.choisi === 'oui') b.dataset.etat = 'faux';
      });
    });
    const juste = justes.every(Boolean);
    const rates = exo.items.filter((it, i) => !justes[i]).map(it => `« ${it.phrase} »`).join(', ');
    terminerQuestion({ juste, solution: juste ? 'Tout est bien classé !' : `À revoir : ${rates}` });
  }

  cadre(el('div', { class: 'question' }, [
    el('div', { class: 'consigne', text: exo.consigne }),
    liste
  ]), [bouton]);
}

/* -------------------------------------------------- fin d'une question */

/** Intitulé du retour : c'est là que se lit la distinction orthographe / grammaire. */
function titreRetour(juste, serie, xp, fautes) {
  if (juste) return serie >= 3 ? `🔥 Série de ${serie} ! +${xp} XP` : `✅ Bravo ! +${xp} XP`;
  const genres = new Set(fautes.map(f => f.genre));
  if (genres.size > 1) return '❌ Deux natures de faute : orthographe et grammaire';
  if (genres.has('lexicale')) return '❌ Faute d\'orthographe';
  if (genres.has('grammaticale')) return '❌ Faute de grammaire';
  return '❌ Presque…';
}

function rendreFautes(fautes) {
  if (!fautes.length) return null;
  return el('div', { class: 'fautes' }, fautes.map(f => {
    const g = GENRES[f.genre] || GENRES.lexicale;
    return el('div', { class: 'faute', dataset: { genre: f.genre } }, [
      el('span', { class: 'etiquette-faute', text: `${g.emoji} ${g.libelle}` }),
      el('p', {}, [el('b', { text: `${f.titre} — ` }), f.message])
    ]);
  }));
}

function terminerQuestion({ juste, solution, fautes = [], indice, extra, contexte }) {
  session.reponseDonnee = true;
  const exo = session.items[session.index];
  const premierEssai = !session.aideQcm;

  session.serie = juste ? session.serie + 1 : 0;
  session.meilleureSerie = Math.max(session.meilleureSerie, session.serie);
  if (juste) session.justes += 1;
  if (juste && session.etaitFragile) session.fragilesRattrapes += 1;

  const xp = xpReponse({ juste, serie: session.serie, difficulte: exo.difficulte || 1, premierEssai });
  session.xpTotal += xp;

  // Nature des fautes : orthographe (le mot) et/ou grammaire (l'accord). Conservée dans la
  // progression pour que l'écran « à réviser » rappelle sur quoi l'élève a buté.
  const natures = [...new Set(fautes.map(f => f.genre))];
  enregistrerReponse({
    id: exo.id, categorie: exo.categorie, juste, xp,
    detail: juste ? null : { solution, natures, quand: Date.now() }
  });
  if (!juste) session.erreurs.push({ id: exo.id, categorie: exo.categorie, solution, regleId: exo.regleId, natures });

  vibrer(juste ? 12 : [40, 60, 40]);

  const r = infoRegle(exo.regleId);
  const retour = el('div', { class: 'retour', dataset: { juste: juste ? 'oui' : 'non' }, role: 'status' }, [
    el('div', { class: 'titre', text: titreRetour(juste, session.serie, xp, fautes) }),
    !juste && el('div', {}, [el('span', { text: 'La bonne réponse : ' }), el('span', { class: 'solution', text: solution })]),
    !juste && rendreFautes(fautes),
    extra,
    contexte && !juste && el('div', { class: 'regle', text: contexte.replace('{mot}', solution) }),
    !juste && r && el('div', { class: 'regle' }, [el('b', { text: `La règle — ${r.titre} : ` }), r.explication]),
    !juste && !r && indice && el('div', { class: 'regle', text: indice })
  ]);

  const zone = session.root.querySelector('.question');
  (zone || session.root).append(retour);
  retour.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const barre = session.root.querySelector('.barre-bas .app');
  vider(barre).append(el('button', {
    class: `btn btn--bloc btn--grand ${juste ? 'btn--succes' : 'btn--primaire'}`,
    text: session.index + 1 >= session.items.length ? 'Voir le bilan' : 'Continuer',
    onClick: suivant
  }));
}

function suivant() {
  voix.stop();
  session.index += 1;
  if (session.index >= session.items.length) return terminerSession();
  afficherQuestion();
}

function terminerSession() {
  const s = session;
  const nouveauxBadges = cloturerSession({
    parfaite: s.erreurs.length === 0,
    meilleureSerie: s.meilleureSerie,
    fragilesRattrapes: s.fragilesRattrapes,
    dictee: s.type === 'dictee' ? { score: s.scoreDictee } : null
  });
  session = null;
  s.ctx.aller('fin', {
    type: s.type, xp: s.xpTotal, justes: s.justes, total: s.items.length,
    erreurs: s.erreurs, meilleureSerie: s.meilleureSerie, badges: nouveauxBadges,
    config: s.config, corrections: s.corrections || null, scoreDictee: s.scoreDictee
  });
}

/* ------------------------------------------------------- mode dictée */

function demarrerDictee(root, ctx, dicteeId) {
  const d = (ctx.banque.dictees || []).find(x => x.id === dicteeId);
  if (!d) return ctx.aller('accueil');
  session = {
    type: 'dictee', dictee: d, ctx, root,
    items: d.segments.map(s => ({ ...s, id: `dictee:${d.id}:${s.id}`, type: 'dictee-segment', categorie: null })),
    index: 0, serie: 0, meilleureSerie: 0, xpTotal: 0, justes: 0,
    erreurs: [], corrections: [], fragilesRattrapes: 0, config: { dicteeId }
  };
  afficherQuestion();
}

function rendreSegmentDictee(seg) {
  const bouton = boutonValider('Vérifier', valider, false);
  const boutonEcoute = el('button', {
    class: 'bouton-ecoute', 'aria-label': 'Écouter la phrase', text: '🔊', onClick: () => dire()
  });
  function dire() {
    voix.lire(seg.texte, {
      debit: reglage('debit') || 0.8,
      onDebut: () => boutonEcoute.dataset.parle = 'oui',
      onFin: () => boutonEcoute.dataset.parle = 'non'
    });
  }
  const choixDebit = el('div', { class: 'debit' }, voix.DEBITS.map(d => el('button', {
    text: d.libelle, dataset: { actif: (reglage('debit') === d.valeur) ? 'oui' : 'non' },
    onClick: (ev) => {
      reglage('debit', d.valeur);
      choixDebit.querySelectorAll('button').forEach(b => b.dataset.actif = 'non');
      ev.currentTarget.dataset.actif = 'oui';
      dire();
    }
  })));

  const zone = el('textarea', {
    class: 'champ zone-texte', rows: 3, autocapitalize: 'sentences', spellcheck: 'false',
    placeholder: 'écris la phrase entendue', 'aria-label': 'Écris la phrase entendue',
    onInput: (e) => bouton.disabled = !e.target.value.trim()
  });

  function valider() {
    if (session.reponseDonnee) return;
    session.reponseDonnee = true;
    const resultat = diffMots(zone.value, seg.texte);
    const juste = resultat.score === 100;
    const xp = juste ? 15 : Math.round(resultat.score / 10);
    session.xpTotal += xp;
    if (juste) session.justes += 1;
    session.serie = juste ? session.serie + 1 : 0;
    session.meilleureSerie = Math.max(session.meilleureSerie, session.serie);
    session.corrections.push({ segment: seg, resultat, saisi: zone.value });

    enregistrerReponse({ id: seg.id, categorie: categoriePrincipale(seg), juste, xp });

    // Chaque écart est rattaché à la catégorie du piège correspondant, pour alimenter les stats.
    for (const s of resultat.segments) {
      if (s.type === 'ok' || !s.attendu) continue;
      const piege = (seg.pieges || []).find(p => memeMot(p.mot, s.attendu));
      session.erreurs.push({
        id: seg.id, categorie: piege?.categorie || 'lexique',
        solution: s.attendu, regleId: piege?.regleId, typeEcart: s.type
      });
    }

    zone.dataset.etat = juste ? 'juste' : 'faux';
    const retour = el('div', { class: 'retour', dataset: { juste: juste ? 'oui' : 'non' }, role: 'status' }, [
      el('div', { class: 'titre', text: juste ? `✅ Phrase parfaite ! +${xp} XP` : `${resultat.justes}/${resultat.total} mots justes — +${xp} XP` }),
      rendreDiff(resultat)
    ]);
    session.root.querySelector('.question').append(retour);
    vibrer(juste ? 12 : [40, 60, 40]);

    const barre = session.root.querySelector('.barre-bas .app');
    vider(barre).append(el('button', {
      class: `btn btn--bloc btn--grand ${juste ? 'btn--succes' : 'btn--primaire'}`,
      text: session.index + 1 >= session.items.length ? 'Voir la correction' : 'Phrase suivante',
      onClick: () => { if (session.index + 1 >= session.items.length) finirDictee(); else suivant(); }
    }));
  }

  cadre(el('div', { class: 'question' }, [
    el('div', { class: 'dictee-segment', text: `${session.dictee.titre} — phrase ${session.index + 1}` }),
    el('div', { class: 'audio-bloc' }, [
      voix.disponible() ? boutonEcoute : el('p', { class: 'phrase', text: seg.texte }),
      voix.disponible() && choixDebit,
      !voix.disponible() && el('p', { class: 'indice', text: 'Audio indisponible : recopie la phrase affichée.' })
    ]),
    el('div', { class: 'saisie-groupe' }, [zone])
  ]), [bouton]);

  if (voix.disponible()) setTimeout(dire, 350);
}

function categoriePrincipale(seg) {
  const p = (seg.pieges || [])[0];
  return p?.categorie || 'lexique';
}

export function rendreDiff(resultat) {
  return el('p', { class: 'diff' }, resultat.segments.flatMap(s => {
    if (s.type === 'ok') return [el('mark', { class: 'ok', text: s.attendu }), ' '];
    if (s.type === 'faute') return [el('mark', { class: 'faux', text: s.saisi }), ' ', el('mark', { class: 'attendu', text: s.attendu }), ' '];
    if (s.type === 'manquant') return [el('mark', { class: 'manquant', text: s.attendu, title: 'mot oublié' }), ' '];
    return [el('mark', { class: 'faux', text: s.saisi, title: 'mot en trop' }), ' '];
  }));
}

function finirDictee() {
  const total = session.corrections.reduce((n, c) => n + c.resultat.total, 0);
  const justes = session.corrections.reduce((n, c) => n + c.resultat.justes, 0);
  session.scoreDictee = total ? Math.round((justes / total) * 100) : 0;
  terminerSession();
}
