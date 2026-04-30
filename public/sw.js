/**
 * Service Worker — 정적 자산 캐싱.
 * 버전 올리면 기존 캐시 자동 삭제.
 *
 * Safari 주의: navigate 모드(HTML 페이지) 요청은 SW를 바이패스.
 * SW가 리다이렉트 응답을 돌려주면 Safari가 즉시 오류를 던지므로
 * HTML 네비게이션은 항상 네트워크로 직접 보낸다.
 */

const CACHE = "aura-v0.2.2";
// HTML 파일은 캐시 대상에서 제외 — navigate 요청은 SW를 통하지 않으므로 의미 없음
const ASSETS = [
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

  // 다른 오리진(CDN) — 완전 바이패스
  if (url.origin !== location.origin) return;
  // GET 아닌 요청 — 바이패스
  if (e.request.method !== "GET") return;
  // HTML 네비게이션 — Safari 리다이렉션 오류 방지, 항상 네트워크로
  if (e.request.mode === "navigate") return;

  // JS/CSS/이미지: cache-first, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).catch(() =>
        new Response("오프라인 — 네트워크를 확인해주세요", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      );
    })
  );
});
