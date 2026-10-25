// 田間巡查離線快取：網頁本身先用快取、背景更新；航照與地籍圖磚看過的會留著，沒訊號時仍可顯示。
const APP = "patrol-app-v2";
const TILES = "patrol-tiles-v1";
const TILE_MAX = 4000;
const APP_FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  if (url.hostname === "wmts.nlsc.gov.tw") {
    e.respondWith(
      caches.open(TILES).then(async (c) => {
        const hit = await c.match(e.request);
        if (hit) return hit;
        try {
          const res = await fetch(e.request);
          if (res.ok || res.type === "opaque") { c.put(e.request, res.clone()); trimTiles(); }
          return res;
        } catch (err) {
          return Response.error();
        }
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(APP).then(async (c) => {
        const hit = await c.match(e.request, { ignoreSearch: true });
        const net = fetch(e.request).then((res) => { if (res.ok) c.put(e.request, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
