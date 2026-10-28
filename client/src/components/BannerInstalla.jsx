import { useEffect, useState } from 'react'
import { osservaInstallazione, mostraPromptInstallazione, giaInstallata, isIos, isSafari, meglioInChrome, urlApriInChrome } from '../lib/installa.js'

// Invito a mettere l'app sulla schermata Home. Nessun sito può installarsi
// da solo: su Android/Chrome il browser ci dà l'evento beforeinstallprompt
// (catturato in lib/installa.js) e possiamo offrire un pulsante "Installa"
// (un tocco); su iPhone/Safari Apple non lo permette, quindi mostriamo la
// guida in due passi. Il banner sparisce se l'app è già installata
// (display-mode standalone) o se il cliente lo chiude (ricordato in
// localStorage, best effort).

const CHIAVE_CHIUSO = 'hc_installa_chiuso'

function chiusoDiRecente() {
  try {
    const t = Number(window.localStorage.getItem(CHIAVE_CHIUSO) || 0)
    return t && Date.now() - t < 7 * 24 * 60 * 60 * 1000
  } catch { return false }
}

export default function BannerInstalla() {
  const [haPrompt, setHaPrompt] = useState(false)
  const [visibile, setVisibile] = useState(false)
  const [modo, setModo] = useState(null) // 'android' | 'chrome' | 'ios' | 'ios-altro-browser'

  useEffect(() => {
    if (giaInstallata() || chiusoDiRecente()) return
    if (meglioInChrome()) {
      // Samsung Internet & co.: l'installazione da qui non funziona bene,
      // si propone di continuare in Chrome (nessun salto automatico dentro
      // l'app, solo su /installa).
      setModo('chrome'); setVisibile(true)
      return
    }
    const stop = osservaInstallazione((p, installata) => {
      if (installata) { setVisibile(false); return }
      setHaPrompt(true); setModo('android'); setVisibile(true)
    })
    if (isIos()) {
      setModo(isSafari() ? 'ios' : 'ios-altro-browser')
      setVisibile(true)
    }
    return stop
  }, [])

  function chiudi() {
    setVisibile(false)
    try { window.localStorage.setItem(CHIAVE_CHIUSO, String(Date.now())) } catch { /* pazienza */ }
  }

  async function installa() {
    if (!haPrompt) return
    const esito = await mostraPromptInstallazione()
    if (esito === 'accepted') setVisibile(false)
    setHaPrompt(false)
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
          {modo === 'chrome' && (
            <p>Continua in Chrome: si apre da solo e la installi con un tocco.</p>
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
        {modo === 'chrome' && (
          <a className="btn btn-primario" href={urlApriInChrome('/installa')}>Continua con Chrome</a>
        )}
        <button className="btn btn-secondario" onClick={chiudi}>{modo === 'android' || modo === 'chrome' ? 'Più tardi' : 'Ho capito'}</button>
      </div>
    </div>
  )
}
