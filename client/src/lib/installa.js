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
