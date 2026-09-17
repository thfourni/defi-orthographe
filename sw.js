/**
 * Service worker : l'appli fonctionne hors ligne après la première visite.
 * Change VERSION à chaque mise à jour du contenu pour forcer le rafraîchissement.
 */
const VERSION = 'defi-ortho-v4';
const FICHIERS = [
  '.', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/components.css', 'css/screens.css',
  'js/app.js', 'js/ui.js', 'js/store.js', 'js/data.js', 'js/scheduler.js',
  'js/gamification.js', 'js/speech.js', 'js/diff.js', 'js/analyse.js', 'js/distracteurs.js',
  'js/screens/home.js', 'js/screens/exercise.js', 'js/screens/summary.js',
  'js/screens/stats.js', 'js/screens/review.js',
  'data/exercices.json', 'data/regles.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Données : réseau d'abord (pour récupérer les nouveaux exercices), cache en secours.
  if (req.url.includes('/data/')) {
    e.respondWith(
      fetch(req)
        .then(rep => { const copie = rep.clone(); caches.open(VERSION).then(c => c.put(req, copie)); return rep; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Reste de l'appli : cache d'abord, c'est instantané et ça marche sans réseau.
  e.respondWith(
    caches.match(req).then(cache => cache || fetch(req).then(rep => {
      const copie = rep.clone();
      caches.open(VERSION).then(c => c.put(req, copie));
      return rep;
    }).catch(() => caches.match('index.html')))
  );
});
