import { useEffect, useState } from 'react'

// Invito a mettere l'app sulla schermata Home. Nessun sito può installarsi
// da solo: su Android/Chrome il browser ci dà l'evento beforeinstallprompt
// e possiamo offrire un pulsante "Installa" (un tocco); su iPhone/Safari
// Apple non lo permette, quindi mostriamo la guida in due passi. Il banner
// sparisce se l'app è già installata (display-mode standalone) o se il
// cliente lo chiude (ricordato in localStorage, best effort).

const CHIAVE_CHIUSO = 'hc_installa_chiuso'

function giaInstallata() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
  } catch { return false }
}
function chiusoDiRecente() {
  try {
    const t = Number(window.localStorage.getItem(CHIAVE_CHIUSO) || 0)
    return t && Date.now() - t < 7 * 24 * 60 * 60 * 1000
  } catch { return false }
}
function isIos() {
  const ua = window.navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}
function isSafari() {
  const ua = window.navigator.userAgent
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

export default function BannerInstalla() {
  const [promptEvento, setPromptEvento] = useState(null)
  const [visibile, setVisibile] = useState(false)
  const [modo, setModo] = useState(null) // 'android' | 'ios' | 'ios-altro-browser'

  useEffect(() => {
    if (giaInstallata() || chiusoDiRecente()) return

    function onPrompt(e) {
      e.preventDefault()
      setPromptEvento(e)
      setModo('android')
      setVisibile(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', () => setVisibile(false))

    if (isIos()) {
      setModo(isSafari() ? 'ios' : 'ios-altro-browser')
      setVisibile(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function chiudi() {
    setVisibile(false)
    try { window.localStorage.setItem(CHIAVE_CHIUSO, String(Date.now())) } catch { /* pazienza */ }
  }

  async function installa() {
    if (!promptEvento) return
    promptEvento.prompt()
    const { outcome } = await promptEvento.userChoice
    if (outcome === 'accepted') setVisibile(false)
    setPromptEvento(null)
  }

  if (!visibile || !modo) return null

  return (
    <div className="card banner-installa">
      <div className="banner-installa-testo">
        <img src="/icone/icona-192.png" alt="" width={44} height={44} />
        <div>
          <strong>Metti la tessera sulla Home</strong>
          {modo === 'android' && (
            <p>Si apre come un'app, senza cercarla nel browser.</p>
          )}
          {modo === 'ios' && (
            <p>
              Tocca <span className="ios-icona" aria-label="Condividi">⎙</span> <strong>Condividi</strong> in basso, poi{' '}
              <strong>"Aggiungi alla schermata Home"</strong>.
            </p>
          )}
          {modo === 'ios-altro-browser' && (
            <p>Apri questo indirizzo in <strong>Safari</strong>, poi Condividi → "Aggiungi alla schermata Home".</p>
          )}
        </div>
      </div>
      <div className="banner-installa-azioni">
        {modo === 'android' && (
          <button className="btn btn-primario" onClick={installa}>Installa</button>
        )}
        <button className="btn btn-secondario" onClick={chiudi}>{modo === 'android' ? 'Più tardi' : 'Ho capito'}</button>
      </div>
    </div>
  )
}
