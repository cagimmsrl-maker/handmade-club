import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  osservaInstallazione, mostraPromptInstallazione, giaInstallata, isIos, isSafari, isAndroid,
  meglioInChrome, urlApriInChrome, provaSaltoAChrome,
} from '../../lib/installa.js'

// Pagina di atterraggio del QR al banco: prima di tutto mette l'app sulla
// Home, poi manda alla registrazione. Su iPhone l'ordine conta: l'app
// aggiunta alla Home non condivide la sessione con Safari, quindi è meglio
// che il cliente crei la tessera DENTRO l'app appena installata.

export default function Installa() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState(null)
  const [esito, setEsito] = useState(null) // 'installata' | 'rifiutata'
  const [attesa, setAttesa] = useState(true)
  const chrome = meglioInChrome() // Samsung Internet, Firefox, webview: si continua in Chrome

  useEffect(() => {
    if (giaInstallata()) { navigate('/', { replace: true }); return }
    if (chrome) {
      // Tentativo senza tocco; se il browser lo blocca, dopo un attimo
      // compare il pulsante "Continua con Chrome".
      provaSaltoAChrome()
      const t = setTimeout(() => setAttesa(false), 1200)
      return () => clearTimeout(t)
    }
    const stop = osservaInstallazione((p, installata) => {
      if (installata) setEsito('installata')
      else setPrompt(p)
      setAttesa(false)
    })
    // Su Android l'evento arriva entro un paio di secondi; passato quel
    // tempo si mostra la guida manuale.
    const t = setTimeout(() => setAttesa(false), 2500)
    return () => { stop(); clearTimeout(t) }
  }, [navigate, chrome])

  async function installa() {
    const esito = await mostraPromptInstallazione()
    if (esito === 'accepted') setEsito('installata')
    else { setEsito('rifiutata'); setPrompt(null) }
  }

  const ios = isIos()
  const android = isAndroid()

  let contenuto
  if (esito === 'installata') {
    contenuto = (
      <>
        <h1>Fatto!</h1>
        <p className="installa-testo">
          Trova l'icona <strong>Handmade Club</strong> nella schermata Home e aprila da lì: crei la tessera in 10 secondi.
        </p>
        <button className="btn btn-secondario" onClick={() => navigate('/')}>Oppure continua qui</button>
      </>
    )
  } else if (chrome) {
    contenuto = (
      <>
        <h1>Metti la tessera sulla Home</h1>
        <p className="installa-testo">
          {attesa ? 'Un momento, apro Chrome…' : 'Per installare Handmade Club con un tocco, continua in Chrome: si apre da solo su questa pagina.'}
        </p>
        {!attesa && (
          <a className="btn btn-primario installa-grande" href={urlApriInChrome()}>Continua con Chrome</a>
        )}
        <button className="link-testo" onClick={() => navigate('/')}>Continua qui senza installare</button>
      </>
    )
  } else if (prompt) {
    contenuto = (
      <>
        <h1>Metti la tessera sulla Home</h1>
        <p className="installa-testo">Un tocco e Handmade Club si apre come un'app, senza cercarla nel browser.</p>
        <button className="btn btn-primario installa-grande" onClick={installa}>Installa</button>
        <button className="link-testo" onClick={() => navigate('/')}>Continua senza installare</button>
      </>
    )
  } else if (ios && isSafari()) {
    contenuto = (
      <>
        <h1>Metti la tessera sulla Home</h1>
        <ol className="installa-passi">
          <li>
            <span className="installa-numero">1</span>
            <span>Tocca <span className="ios-icona" aria-label="Condividi">⎙</span> <strong>Condividi</strong> in basso al centro</span>
          </li>
          <li>
            <span className="installa-numero">2</span>
            <span>Scorri e tocca <strong>"Aggiungi alla schermata Home"</strong>, poi <strong>Aggiungi</strong></span>
          </li>
          <li>
            <span className="installa-numero">3</span>
            <span>Apri <strong>Handmade Club</strong> dalla Home e crea la tessera</span>
          </li>
        </ol>
        <button className="link-testo" onClick={() => navigate('/')}>Continua senza installare</button>
      </>
    )
  } else if (ios) {
    contenuto = (
      <>
        <h1>Apri questa pagina in Safari</h1>
        <p className="installa-testo">
          Su iPhone solo Safari può aggiungere l'app alla Home. Tocca e tieni premuto il link qui sotto e scegli "Apri in Safari", oppure copia l'indirizzo.
        </p>
        <a className="btn btn-primario installa-grande" href="https://club.handmadecafe.it/installa">club.handmadecafe.it/installa</a>
        <button className="link-testo" onClick={() => navigate('/')}>Continua qui senza installare</button>
      </>
    )
  } else if (attesa) {
    contenuto = <p className="testo-secondario">Un momento…</p>
  } else {
    contenuto = (
      <>
        <h1>Metti la tessera sulla Home</h1>
        <ol className="installa-passi">
          <li>
            <span className="installa-numero">1</span>
            <span>Apri il menu del browser (<strong>⋮</strong> in alto a destra{android ? '' : ' o in basso'})</span>
          </li>
          <li>
            <span className="installa-numero">2</span>
            <span>Tocca <strong>"Aggiungi alla schermata Home"</strong> o <strong>"Installa app"</strong></span>
          </li>
          <li>
            <span className="installa-numero">3</span>
            <span>Apri <strong>Handmade Club</strong> dalla Home e crea la tessera</span>
          </li>
        </ol>
        {esito === 'rifiutata' && <p className="testo-secondario">Puoi installarla anche più tardi dal banner nella tessera.</p>}
        <button className="link-testo" onClick={() => navigate('/')}>Continua senza installare</button>
      </>
    )
  }

  return (
    <div className="schermo installa">
      <div className="onboarding-hero">
        <img src="/brand/logo.png" alt="Handmade Café" />
      </div>
      <div className="installa-icona">
        <img src="/icone/icona-192.png" alt="" width={84} height={84} />
        <span>Handmade Club</span>
      </div>
      {contenuto}
    </div>
  )
}
