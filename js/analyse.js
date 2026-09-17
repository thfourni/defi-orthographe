/**
 * Diagnostic d'une forme verbale : sépare ce qui relève de l'orthographe du mot
 * (le radical, les accents) de ce qui relève de la grammaire (la terminaison, donc
 * l'accord avec le sujet). Une réponse comme « eclairaient » pour « éclairait »
 * cumule les deux, et l'élève doit voir les deux.
 */
import { nettoyer, normaliser, premiereDifference, proche } from './diff.js';

/** Terminaisons possibles d'un temps, de la plus longue à la plus courte. */
const TERMINAISONS = {
  imparfait: { '1s': 'ais', '2s': 'ais', '3s': 'ait', '1p': 'ions', '2p': 'iez', '3p': 'aient' },
  'passé simple': { '1s': 'ai', '2s': 'as', '3s': 'a', '1p': 'âmes', '2p': 'âtes', '3p': 'èrent' },
  futur: { '1s': 'rai', '2s': 'ras', '3s': 'ra', '1p': 'rons', '2p': 'rez', '3p': 'ront' },
  // Au présent, une même personne a plusieurs terminaisons possibles selon le groupe du verbe.
  présent: { '1s': ['e', 's'], '2s': ['es', 's'], '3s': ['e', 't', 'd'], '1p': ['ons'], '2p': ['ez'], '3p': ['ent'] }
};

const finsDe = (temps) => [...new Set(Object.values(TERMINAISONS[temps] || {}).flat())];

/** Pour reconnaître une terminaison empruntée à un autre temps (« éclairai » au lieu de « éclairait »). */
const AUTRES_TEMPS = [
  { nom: 'du passé simple', fins: ['ai', 'as', 'a', 'âmes', 'âtes', 'èrent'] },
  { nom: 'du présent', fins: ['e', 'es', 'ent', 'ons', 'ez'] },
  { nom: 'du futur', fins: ['rai', 'ras', 'ra', 'rons', 'rez', 'ront'] },
  { nom: 'de l\'infinitif ou du participe passé', fins: ['er', 'é', 'ée', 'és', 'ées'] }
];

/** « à l'imparfait » / « au présent », « de l'imparfait » / « du présent » : petites élisions. */
const voyelle = (temps) => /^[aeiouâêîôûéèh]/i.test(temps);
const auTemps = (temps) => (voyelle(temps) ? `à l'${temps}` : `au ${temps}`);
const duTemps = (temps) => (voyelle(temps) ? `de l'${temps}` : `du ${temps}`);

const PERSONNES = {
  '1s': { libelle: '1re personne du singulier', pronom: 'je' },
  '2s': { libelle: '2e personne du singulier', pronom: 'tu' },
  '3s': { libelle: '3e personne du singulier', pronom: 'il / elle' },
  '1p': { libelle: '1re personne du pluriel', pronom: 'nous' },
  '2p': { libelle: '2e personne du pluriel', pronom: 'vous' },
  '3p': { libelle: '3e personne du pluriel', pronom: 'ils / elles' }
};

const sansAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Sépare les pronoms qui précèdent le verbe (« s'ébranlaient », « nous asseyions »). */
function separerPronom(forme) {
  const f = nettoyer(forme);
  const apostrophe = f.match(/^([a-zà-ÿ]{1,4}['’])(.+)$/i);
  if (apostrophe) return { pronom: apostrophe[1], verbe: apostrophe[2] };
  const espace = f.match(/^([a-zà-ÿ]{1,4})\s+(.+)$/i);
  if (espace) return { pronom: espace[1] + ' ', verbe: espace[2] };
  return { pronom: '', verbe: f };
}

/** Coupe une forme en radical + terminaison, d'après les terminaisons du temps. */
function decouper(verbe, temps) {
  const table = TERMINAISONS[temps];
  if (!table) return { radical: verbe, terminaison: '' };
  const fins = finsDe(temps).sort((a, b) => b.length - a.length);
  for (const fin of fins) {
    if (verbe.length > fin.length && verbe.toLowerCase().endsWith(fin)) {
      return { radical: verbe.slice(0, -fin.length), terminaison: verbe.slice(-fin.length) };
    }
  }
  return { radical: verbe, terminaison: '' };
}

/** Quelle personne correspond à une terminaison donnée ? (peut être ambiguë : -ais) */
function personnesDe(terminaison, temps) {
  const table = TERMINAISONS[temps] || {};
  const cherchee = terminaison.toLowerCase();
  return Object.entries(table).filter(([, fin]) => [].concat(fin).includes(cherchee)).map(([p]) => p);
}

/**
 * Analyse une réponse.
 * @returns {{juste: boolean, fautes: Array<{genre, titre, message}>}}
 *   genre vaut 'lexicale' (orthographe du mot) ou 'grammaticale' (accord, terminaison).
 */
export function analyserForme(saisi, attendu, { temps = 'imparfait', personne = null, sujet = null, infinitif = null } = {}) {
  const propre = nettoyer(saisi);
  if (normaliser(propre) === normaliser(attendu)) return { juste: true, fautes: [] };

  const fautes = [];
  const a = separerPronom(propre);
  const b = separerPronom(attendu);

  // Pronom réfléchi absent ou faux : c'est une question de construction, donc de grammaire.
  if (normaliser(a.pronom) !== normaliser(b.pronom)) {
    fautes.push({
      genre: 'grammaticale',
      titre: 'Le pronom',
      message: b.pronom
        ? `Ce verbe se construit avec « ${b.pronom.trim()} » : on écrit « ${attendu} ».`
        : `Il n'y a pas de pronom devant ce verbe : on écrit « ${attendu} ».`
    });
  }

  const att = decouper(b.verbe, temps);
  let dec = decouper(a.verbe, temps);

  // Réponse sans rapport avec la forme attendue : un seul message, sinon on noie l'élève.
  // Partager le radical (aux accents près) suffit à considérer la réponse comme « proche ».
  const memeRadical = sansAccents(dec.radical.toLowerCase()) === sansAccents(att.radical.toLowerCase());
  if (!memeRadical && !proche(a.verbe, b.verbe)) {
    const p0 = PERSONNES[personne];
    fautes.push({
      genre: 'grammaticale',
      titre: 'La forme attendue',
      message: `On écrit « ${attendu} »${sujet && p0 ? ` : le sujet est « ${sujet} », ${p0.libelle} (${p0.pronom})` : ''}.`
    });
    return { juste: false, fautes };
  }

  // Terminaison empruntée à un autre temps : c'est une erreur de conjugaison, pas d'orthographe.
  let tempsEmprunte = null;
  if (!dec.terminaison) {
    for (const { nom, fins } of AUTRES_TEMPS) {
      const fin = [...fins].sort((x, y) => y.length - x.length)
        .find(f => a.verbe.length > f.length && a.verbe.toLowerCase().endsWith(f));
      if (!fin) continue;
      const radical = a.verbe.slice(0, -fin.length);
      if (sansAccents(radical.toLowerCase()) !== sansAccents(att.radical.toLowerCase())) continue;
      dec = { radical, terminaison: fin };
      tempsEmprunte = nom;
      break;
    }
  }

  // --- Le radical : orthographe du mot ---
  const radicalJuste = dec.radical.toLowerCase() === att.radical.toLowerCase();
  const memeSansAccents = sansAccents(dec.radical.toLowerCase()) === sansAccents(att.radical.toLowerCase());
  // Cas particulier des verbes en -ier / -yer : « nous oublions » au lieu de « nous oubliions ».
  const iAvale = !radicalJuste && /[iy]$/.test(att.radical) && att.radical.slice(0, -1).toLowerCase() === dec.radical.toLowerCase();

  if (iAvale) {
    fautes.push({
      genre: 'grammaticale',
      titre: 'Les verbes en -ier, -yer, -gner',
      message: `Le radical se termine déjà par « ${att.radical.slice(-1)} », et la terminaison commence par « i » : on écrit les deux, « ${attendu} ».`
    });
  } else if (!radicalJuste && memeSansAccents) {
    const detail = premiereDifference(dec.radical, att.radical);
    fautes.push({
      genre: 'lexicale',
      titre: 'Les accents',
      message: `On écrit « ${attendu} »${detail ? ` : ${detail}` : ''}.`
    });
  } else if (!radicalJuste) {
    const detail = proche(dec.radical, att.radical) ? premiereDifference(dec.radical, att.radical) : null;
    fautes.push({
      genre: 'lexicale',
      titre: 'L\'orthographe du verbe',
      message: `On écrit « ${attendu} »${detail ? ` : ${detail}` : ''}${infinitif ? ` (verbe « ${infinitif} »)` : ''}.`
    });
  }

  // --- La terminaison : accord avec le sujet ---
  if (!iAvale && dec.terminaison.toLowerCase() !== att.terminaison.toLowerCase()) {
    const p = PERSONNES[personne];
    const autres = personnesDe(dec.terminaison, temps).filter(x => x !== personne);
    const debut = sujet && p
      ? `Le sujet est « ${sujet} » : ${p.libelle} (${p.pronom}).`
      : p ? `Ici, le verbe est à la ${p.libelle} (${p.pronom}).` : '';
    const attendue = att.terminaison ? `on écrit donc « -${att.terminaison} »` : `on écrit donc « ${attendu} »`;
    const cadre = auTemps(temps);
    const ecrite = tempsEmprunte
      ? ` « -${dec.terminaison} » est une terminaison ${tempsEmprunte}, pas ${duTemps(temps)}.`
      : dec.terminaison
      ? autres.length
        ? ` Tu as écrit « -${dec.terminaison} », la terminaison de la ${PERSONNES[autres[0]].libelle} (${PERSONNES[autres[0]].pronom}).`
        : ` « -${dec.terminaison} » n'est pas une terminaison ${duTemps(temps)}.`
      : '';
    fautes.push({
      genre: 'grammaticale',
      titre: 'L\'accord avec le sujet',
      message: `${debut} ${cadre.charAt(0).toUpperCase()}${cadre.slice(1)}, ${attendue}.${ecrite}`.trim()
    });
  }

  if (!fautes.length) {
    fautes.push({ genre: 'lexicale', titre: 'L\'orthographe', message: `On écrit « ${attendu} ».` });
  }
  return { juste: false, fautes };
}

/** Même diagnostic, pour un mot du lexique : tout y est orthographe. */
export function analyserMot(saisi, attendu, { piege = null } = {}) {
  const propre = nettoyer(saisi);
  if (normaliser(propre) === normaliser(attendu)) return { juste: true, fautes: [] };
  const accentsSeuls = sansAccents(normaliser(propre)) === sansAccents(normaliser(attendu));
  const detail = proche(propre, attendu) ? premiereDifference(propre, attendu) : null;
  return {
    juste: false,
    fautes: [{
      genre: 'lexicale',
      titre: accentsSeuls ? 'Les accents' : 'L\'orthographe du mot',
      message: accentsSeuls
        ? `Toutes les lettres sont bonnes, seuls les accents manquent : « ${attendu} ».`
        : `On écrit « ${attendu} »${detail ? ` : ${detail}` : ''}${piege ? ` — ${piege}` : ''}.`
    }]
  };
}

export const GENRES = {
  lexicale: { libelle: 'Orthographe', emoji: '🔤' },
  grammaticale: { libelle: 'Grammaire', emoji: '🎯' }
};
