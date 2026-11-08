/* eslint-disable no-undef */
// Service worker dell'app (vite-plugin-pwa, strategia injectManifest).
// Fa due cose: la cache dei file dell'app (come prima, con Workbox) e la
// ricezione delle notifiche push (migrazione 014).
import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Le pagine dell'app rispondono con index.html; API e foto no (sono del server).
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/api\//, /^\/uploads\//],
}))

// Aggiornamento senza attese: la nuova versione prende il posto della vecchia
// appena pronta (equivale a registerType: 'autoUpdate').
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// Notifica push ricevuta: il server manda { titolo, testo, url, tag }.
self.addEventListener('push', (event) => {
  let dati = {}
  try { dati = event.data ? event.data.json() : {} } catch { dati = { testo: event.data?.text() } }
  const titolo = dati.titolo || 'Handmade Club'
  const opzioni = {
    body: dati.testo || '',
    icon: '/icone/icona-192.png',
    badge: '/icone/icona-192.png',
    tag: dati.tag || 'handmade-club',
    renotify: true,
    data: { url: dati.url || '/promozioni' },
  }
  event.waitUntil(self.registration.showNotification(titolo, opzioni))
})

// Tocco sulla notifica: porta alla pagina indicata, riusando l'app se è aperta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/promozioni', self.location.origin).href
  event.waitUntil((async () => {
    const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const f of finestre) {
      if (new URL(f.url).origin === self.location.origin) {
        await f.focus()
        if ('navigate' in f) await f.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})

// Il browser ha rinnovato l'iscrizione da solo: l'app la rimanda al server
// alla prossima apertura (lib/push.js sincronizza), qui basta non perderla.
self.addEventListener('pushsubscriptionchange', () => {})
