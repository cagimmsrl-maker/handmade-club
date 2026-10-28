// Installazione dell'app sulla Home, in un posto solo (usato dal banner in
// Home e dalla pagina /installa raggiunta dal QR al banco).
//
// Android/Chrome: il browser lancia `beforeinstallprompt` quando la PWA è
// installabile; va catturato SUBITO (prima che React monti i componenti,
// vedi main.jsx) altrimenti si perde, e poi si può mostrare il prompt di
// sistema con un tocco. iPhone/Safari: Apple non offre nulla di simile,
// l'unica via è l'utente con Condividi → "Aggiungi alla schermata Home".

let promptCatturato = null
const ascoltatori = new Set()

export function avviaCatturaInstallazione() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    promptCatturato = e
    ascoltatori.forEach((fn) => fn(e))
  })
  window.addEventListener('appinstalled', () => {
    promptCatturato = null
    ascoltatori.forEach((fn) => fn(null, true))
  })
}

// fn(prompt, installata) — chiamata subito se il prompt c'è già.
export function osservaInstallazione(fn) {
  ascoltatori.add(fn)
  if (promptCatturato) fn(promptCatturato, false)
  return () => ascoltatori.delete(fn)
}

export async function mostraPromptInstallazione() {
  const p = promptCatturato
  if (!p) return null
  p.prompt()
  const { outcome } = await p.userChoice
  promptCatturato = null
  return outcome // 'accepted' | 'dismissed'
}

export function giaInstallata() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  } catch { return false }
}

export function isIos() {
  const ua = window.navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

export function isSafari() {
  const ua = window.navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export function isAndroid() {
  return /Android/.test(window.navigator.userAgent)
}

// --- Browser Android che non sanno installare (o installano male) ---------
//
// Samsung Internet: da inizio 2026 il pacchetto che crea con "Aggiungi alla
// Home" viene bloccato da Google Play Protect su Android 14/15 ("sviluppata
// per una versione precedente di Android"). È un difetto del browser, uguale
// per tutti i siti; la soluzione adottata nel settore è portare il cliente su
// Chrome, dove l'installazione passa dai server Google e funziona. Lo stesso
// vale per Firefox e per le webview di Instagram/Facebook/WhatsApp, che non
// offrono proprio l'installazione. Il salto si fa con un link `intent://`
// (Android lo legge come "apri questo indirizzo con Chrome"); se Chrome
// manca, Android apre la sua pagina sul Play Store (browser_fallback_url).

export function isSamsungInternet() {
  return /SamsungBrowser/i.test(window.navigator.userAgent)
}

export function isWebviewAndroid() {
  const ua = window.navigator.userAgent
  return /; wv\)/.test(ua) || /FBAN|FBAV|Instagram|Line\/|WhatsApp/i.test(ua)
}

// true se, su Android, conviene continuare in Chrome invece che qui.
export function meglioInChrome() {
  if (!isAndroid()) return false
  const ua = window.navigator.userAgent
  if (/Chrome\//.test(ua) && !isSamsungInternet() && !isWebviewAndroid() && !/EdgA|OPR|Brave|Vivaldi|YaBrowser|MiuiBrowser|HuaweiBrowser/.test(ua)) return false
  return true
}

export function urlApriInChrome(percorso = window.location.pathname + window.location.search) {
  const fallback = encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome')
  return `intent://${window.location.host}${percorso}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`
}

// Prova il salto a Chrome senza tocco. Alcuni browser lo permettono, altri
// lo bloccano finché l'utente non tocca qualcosa: in quel caso non succede
// nulla e la pagina mostra il pulsante "Continua con Chrome".
export function provaSaltoAChrome() {
  try { window.location.href = urlApriInChrome() } catch { /* resta qui */ }
}
