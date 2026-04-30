/**
 * Service Worker — 정적 자산 캐싱.
 * 캐시 이름은 배포할 때마다 자동 갱신을 위해 버전 포함.
 */

const CACHE = "aura-v0.1.0";
const ASSETS = [
  "./",
  "./index.html",
  "./generate.html",
  "./play.html",
  "./manifest.json",
  "./css/style.css",
  "./js/feature-extractor.js",
  "./js/music-engine.js",
  "./js/visual-engine.js",
  "./js/card-renderer.js",
  "./js/card-storage.js",
  "./js/generate.js",
  "./js/play.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // CDN 자산은 항상 네트워크 (Tone.js, Three.js)
  if (url.origin !== location.origin) return;
  // 같은 출처 자산: cache-first, 실패 시 네트워크
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request))
  );
});
