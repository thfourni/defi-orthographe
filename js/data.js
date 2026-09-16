/** Chargement et indexation de la banque d'exercices (data/*.json). */
let banque = null;

function valider(d) {
  const erreurs = [];
  if (!Array.isArray(d.categories) || !d.categories.length) erreurs.push('categories manquantes');
  if (!Array.isArray(d.exercices) || !d.exercices.length) erreurs.push('exercices manquants');
  const ids = new Set();
  const cats = new Set((d.categories || []).map(c => c.id));
  for (const e of d.exercices || []) {
    if (!e.id) { erreurs.push('un exercice sans id'); continue; }
    if (ids.has(e.id)) erreurs.push(`id en double : ${e.id}`);
    ids.add(e.id);
    if (!cats.has(e.categorie)) erreurs.push(`${e.id} : catégorie inconnue « ${e.categorie} »`);
    if (e.type === 'trou' && !(e.phrase && Array.isArray(e.trous) && e.trous.length)) erreurs.push(`${e.id} : phrase ou trous manquants`);
    if (e.type === 'mot' && !e.mot) erreurs.push(`${e.id} : mot manquant`);
    if (e.type === 'qcm' && !(Array.isArray(e.options) && e.options.length >= 2)) erreurs.push(`${e.id} : options manquantes`);
    if (e.type === 'tri' && !(Array.isArray(e.items) && e.items.length)) erreurs.push(`${e.id} : items manquants`);
  }
  return erreurs;
}

export async function chargerBanque() {
  if (banque) return banque;
  const [exos, regles] = await Promise.all([
    fetch('data/exercices.json').then(r => { if (!r.ok) throw new Error('data/exercices.json introuvable'); return r.json(); }),
    fetch('data/regles.json').then(r => r.ok ? r.json() : { regles: {} }).catch(() => ({ regles: {} }))
  ]);
  const erreurs = valider(exos);
  if (erreurs.length) console.warn('Banque d\'exercices : anomalies détectées\n- ' + erreurs.join('\n- '));

  banque = {
    ...exos,
    regles: regles.regles || {},
    parId: Object.fromEntries(exos.exercices.map(e => [e.id, e])),
    parCategorie: Object.fromEntries(exos.categories.map(c => [c.id, exos.exercices.filter(e => e.categorie === c.id)])),
    categorieParId: Object.fromEntries(exos.categories.map(c => [c.id, c])),
    anomalies: erreurs
  };
  return banque;
}

export function banqueChargee() { return banque; }
export function exercice(id) { return banque?.parId[id] || null; }
export function categorie(id) { return banque?.categorieParId[id] || { id, nom: id, couleur: '#7C3AED', icone: '•' }; }
export function regle(id) { return banque?.regles[id] || null; }
export function dictee(id) { return (banque?.dictees || []).find(d => d.id === id) || null; }

/** Libellé lisible d'un item, pour l'écran « mes mots à réviser ». */
export function libelleItem(id) {
  const e = exercice(id);
  if (!e) {
    const d = (banque?.dictees || []).find(d => id.startsWith(`dictee:${d.id}:`));
    if (d) {
      const seg = d.segments.find(s => id.endsWith(`:${s.id}`));
      return { titre: seg ? seg.texte.slice(0, 60) + '…' : d.titre, sous: `Dictée — ${d.titre}`, categorie: 'lexique' };
    }
    return { titre: id, sous: '', categorie: 'lexique' };
  }
  if (e.type === 'mot') return { titre: e.mot, sous: e.piege || 'Orthographe', categorie: e.categorie };
  if (e.type === 'trou') return { titre: e.trous.map(t => t.reponses[0]).join(' / '), sous: e.phrase.replace(/\{\d\}/g, '…'), categorie: e.categorie };
  if (e.type === 'qcm') return { titre: e.options[e.bonneReponse], sous: e.consigne, categorie: e.categorie };
  return { titre: e.consigne, sous: `${e.items.length} phrases à classer`, categorie: e.categorie };
}
