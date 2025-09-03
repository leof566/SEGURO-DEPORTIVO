// Basic offline cache
const CACHE = "asegurados-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./data.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.url.endsWith("data.json")) {
    event.respondWith(
      fetch(req).then(r => { caches.open(CACHE).then(c => c.put(req, r.clone())); return r; })
      .catch(() => caches.match(req))
    );
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req)));
});
