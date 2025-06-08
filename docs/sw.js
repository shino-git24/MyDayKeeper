// Service Workerをインストールするだけの最小限のコード
self.addEventListener('install', (event) => {
  // インストール処理
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});ｄ
