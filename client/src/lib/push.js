import { api } from '../api.js'

// Notifiche push (migrazione 014). Il flusso: il server dà la chiave pubblica
// VAPID → il browser chiede il permesso → produce una "iscrizione" (endpoint
// + chiavi) → la salviamo sul server, legata al cliente loggato.
//
// Su iPhone funziona SOLO con l'app aggiunta alla Home (iOS 16.4+): da
// Safari il permesso non viene nemmeno chiesto.

export function supportaPush() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
}

export function isIosNonInstallata() {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const installata = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  return ios && !installata
}

export function statoPermesso() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission // default | granted | denied
}

function base64UrlToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function registrazione() {
  // Il SW è registrato da vite-plugin-pwa; qui aspettiamo che sia pronto.
  return navigator.serviceWorker.ready
}

// L'iscrizione già presente nel browser, se c'è.
export async function iscrizioneLocale() {
  if (!supportaPush()) return null
  const reg = await registrazione()
  return reg.pushManager.getSubscription()
}

// Attiva: chiede il permesso (se serve), crea l'iscrizione e la salva sul server.
// Ritorna 'ok' | 'negato' | 'non_supportato' | 'spento'.
export async function attivaNotifiche() {
  if (!supportaPush()) return 'non_supportato'
  const { attivo, chiavePubblica } = await api.get('/cliente/push/chiave')
  if (!attivo) return 'spento'
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') return 'negato'
  const reg = await registrazione()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(chiavePubblica),
    })
  }
  await api.post('/cliente/push/iscrivi', sub.toJSON())
  try { localStorage.setItem('hc_push_attive', '1') } catch { /* niente */ }
  return 'ok'
}

// Disattiva: toglie l'iscrizione dal browser e dal server.
export async function disattivaNotifiche() {
  const sub = await iscrizioneLocale()
  if (sub) {
    try { await api.post('/cliente/push/disiscrivi', { endpoint: sub.endpoint }) } catch { /* comunque */ }
    await sub.unsubscribe()
  }
  try { localStorage.removeItem('hc_push_attive') } catch { /* niente */ }
}

// All'apertura dell'app: se il browser ha un'iscrizione (anche rinnovata da
// solo), la rimandiamo al server così resta legata al cliente giusto.
export async function sincronizzaIscrizione() {
  try {
    const sub = await iscrizioneLocale()
    if (sub && Notification.permission === 'granted') await api.post('/cliente/push/iscrivi', sub.toJSON())
  } catch { /* fail-open */ }
}
