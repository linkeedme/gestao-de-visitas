// A versão sobe junto com qualquer coisa que esteja no CASCO. O ícone mudou de
// desenho, e sem trocar a chave quem já instalou o app continuaria vendo o
// antigo: o activate abaixo só descarta cache de chave diferente desta.
const CACHE = 'casco-v2'
const CASCO = ['/', '/manifest.webmanifest', '/icone-192.png', '/icone-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CASCO)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Dados de card nunca entram no cache: kanban desatualizado exibido como
// atual é pior do que kanban que não carrega.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then((r) => r || Response.error()))
  )
})
