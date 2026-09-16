/**
 * Comparaison des réponses écrites : mot à mot pour les dictées,
 * lettre à lettre pour les mots isolés.
 */

/** Enlève espaces superflus et normalise les apostrophes/guillemets. */
export function nettoyer(s = '') {
  return s.replace(/[‘’ʼ]/g, "'")
          .replace(/[“”]/g, '"')
          .replace(/\s+/g, ' ')
          .trim();
}

/** Forme comparable : minuscules, sans ponctuation. Les accents, eux, comptent. */
export function normaliser(s = '') {
  return nettoyer(s).toLowerCase().replace(/[.,;:!?«»"()…]/g, '');
}

/** Identique à la réponse attendue, en tolérant casse et ponctuation. */
export function memeMot(saisi, attendu) {
  return normaliser(saisi) === normaliser(attendu);
}

/** Vraie seulement si l'écart tient aux accents : sert à afficher un message précis. */
export function seulementAccents(saisi, attendu) {
  const sansAccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return !memeMot(saisi, attendu) && sansAccent(normaliser(saisi)) === sansAccent(normaliser(attendu));
}

/**
 * Diff lettre à lettre (distance d'édition avec reconstitution du chemin).
 * Renvoie une liste de { type: 'ok'|'faux'|'oubli'|'ajout', lettre, attendue }.
 */
export function diffLettres(saisi, attendu) {
  const a = [...nettoyer(saisi)];
  const b = [...nettoyer(attendu)];
  const n = a.length, m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cout);
    }
  }
  const sortie = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      sortie.unshift(a[i - 1] === b[j - 1]
        ? { type: 'ok', lettre: b[j - 1] }
        : { type: 'faux', lettre: a[i - 1], attendue: b[j - 1] });
      i--; j--;
    } else if (j > 0 && d[i][j] === d[i][j - 1] + 1) {
      sortie.unshift({ type: 'oubli', lettre: b[j - 1] }); j--;   // lettre manquante
    } else {
      sortie.unshift({ type: 'ajout', lettre: a[i - 1] }); i--;   // lettre en trop
    }
  }
  return sortie;
}

/** Première différence lisible, pour le message de correction. */
export function premiereDifference(saisi, attendu) {
  const d = diffLettres(saisi, attendu);
  const i = d.findIndex(x => x.type !== 'ok');
  if (i < 0) return null;
  const x = d[i];
  if (x.type === 'faux')  return `tu as écrit « ${x.lettre} » à la place de « ${x.attendue} »`;
  if (x.type === 'oubli') return `il manque la lettre « ${x.lettre} »`;
  return `la lettre « ${x.lettre} » est en trop`;
}

/**
 * Diff mot à mot par plus longue sous-séquence commune.
 * Renvoie { segments: [{type, saisi, attendu}], justes, total, score }.
 * type : 'ok' | 'faute' (mot présent mais mal orthographié) | 'manquant' | 'ajout'
 */
export function diffMots(saisi, attendu) {
  const motsSaisis = nettoyer(saisi).split(' ').filter(Boolean);
  const motsAttendus = nettoyer(attendu).split(' ').filter(Boolean);
  const n = motsSaisis.length, m = motsAttendus.length;

  const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = normaliser(motsSaisis[i]) === normaliser(motsAttendus[j])
        ? L[i + 1][j + 1] + 1
        : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }

  const segments = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (normaliser(motsSaisis[i]) === normaliser(motsAttendus[j])) {
      segments.push({ type: 'ok', saisi: motsSaisis[i], attendu: motsAttendus[j] }); i++; j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) {
      // Mot en trop côté élève : s'il ressemble au mot attendu, c'est une faute d'orthographe.
      if (j < m && proche(motsSaisis[i], motsAttendus[j])) {
        segments.push({ type: 'faute', saisi: motsSaisis[i], attendu: motsAttendus[j] }); i++; j++;
      } else { segments.push({ type: 'ajout', saisi: motsSaisis[i], attendu: null }); i++; }
    } else {
      segments.push({ type: 'manquant', saisi: null, attendu: motsAttendus[j] }); j++;
    }
  }
  while (i < n) segments.push({ type: 'ajout', saisi: motsSaisis[i++], attendu: null });
  while (j < m) segments.push({ type: 'manquant', saisi: null, attendu: motsAttendus[j++] });

  const justes = segments.filter(s => s.type === 'ok').length;
  return { segments, justes, total: m, score: m ? Math.round((justes / m) * 100) : 100 };
}

/** Deux mots « se ressemblent » si leur distance d'édition reste petite. */
export function proche(a, b) {
  const x = normaliser(a), y = normaliser(b);
  if (!x || !y) return false;
  if (x[0] !== y[0] && Math.abs(x.length - y.length) > 2) return false;
  const distance = diffLettres(x, y).filter(d => d.type !== 'ok').length;
  return distance <= Math.max(2, Math.floor(Math.max(x.length, y.length) / 3));
}
