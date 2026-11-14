import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { supportaPush, statoPermesso, iscrizioneLocale, attivaNotifiche, isIosNonInstallata } from '../lib/push.js'

// Invito a schermo intero ad attivare le notifiche (15/11/2026). Compare
// appena si apre la Home — cioè quando il cliente tira fuori la tessera al
// banco — a chi non le ha attive, con il messaggio deciso dal titolare
// (testo dal server: /cliente/me → invitoNotifiche, modificabile dal .env).
// "Non ora" lo rimanda a domani (localStorage, best effort), così non è
// una persecuzione ma torna finché non si decide. Sparisce da solo quando
// le notifiche sono attive, se il telefono non le supporta o se il
// permesso è stato negato dal sistema (lì non possiamo fare nulla).
// Il banner piccolo in Home resta per chi lo ha chiuso.

const CHIAVE_RINVIO = 'hc_invito_notifiche_rinvio'
const UN_GIORNO = 24 * 60 * 60 * 1000

function rinviatoOggi() {
  try {
    const t = Number(window.localStorage.getItem(CHIAVE_RINVIO) || 0)
    return t && Date.now() - t < UN_GIORNO
  } catch { return false }
}

export default function InvitoNotifiche({ invito, consensoMarketing, onAttivate }) {
  const [visibile, setVisibile] = useState(false)
  const [iosGuida, setIosGuida] = useState(false)
  const [stato, setStato] = useState('idle') // idle | lavoro | fatto | negato | errore
  const [messaggio, setMessaggio] = useState('')

  useEffect(() => {
    if (!invito) return
    let vivo = true
    ;(async () => {
      if (rinviatoOggi()) return
      if (isIosNonInstallata()) { if (vivo) { setIosGuida(true); setVisibile(true) }; return }
      if (!supportaPush() || statoPermesso() === 'denied') return
      const sub = await iscrizioneLocale().catch(() => null)
      if (sub && statoPermesso() === 'granted') return
      const { attivo } = await api.get('/cliente/push/chiave').catch(() => ({ attivo: false }))
      if (vivo && attivo) setVisibile(true)
    })()
    return () => { vivo = false }
  }, [invito])

  async function attiva() {
    setStato('lavoro'); setMessaggio('')
    try {
      if (!consensoMarketing) await api.post('/cliente/consenso-marketing')
      const esito = await attivaNotifiche()
      if (esito === 'ok') {
        setStato('fatto'); setMessaggio('Fatto! Ti avviseremo noi delle promozioni.')
        onAttivate?.()
        setTimeout(() => setVisibile(false), 1800)
      } else if (esito === 'negato') {
        setStato('negato'); setMessaggio('Hai negato il permesso: puoi riattivarlo dalle impostazioni del telefono.')
      } else {
        setStato('errore'); setMessaggio('Al momento non è possibile attivare le notifiche su questo telefono.')
      }
    } catch (err) {
      setStato('errore'); setMessaggio(err.message || 'Errore, riprova più tardi.')
    }
  }

  function rinvia() {
    try { window.localStorage.setItem(CHIAVE_RINVIO, String(Date.now())) } catch { /* pazienza */ }
    setVisibile(false)
  }

  if (!visibile) return null

  return (
    <div className="invito-sfondo" role="dialog" aria-modal="true" aria-labelledby="invito-titolo">
      <div className="invito-scheda">
        <div className="invito-icona" aria-hidden="true">🔔</div>
        <h2 id="invito-titolo">{invito.titolo}</h2>
        {iosGuida ? (
          <p>Su iPhone le notifiche arrivano solo con l'app sulla schermata Home: tocca Condividi <span className="ios-icona">⎙</span> → "Aggiungi alla schermata Home", poi apri l'app da lì e attivale.</p>
        ) : (
          <p>{invito.testo}</p>
        )}
        {!iosGuida && !consensoMarketing && (
          <p className="testo-secondario invito-nota">Attivandole acconsenti a ricevere comunicazioni promozionali (revocabile dal profilo).</p>
        )}
        {messaggio && <p className={stato === 'fatto' ? 'messaggio-successo' : 'messaggio-errore'}>{messaggio}</p>}
        {!iosGuida && stato !== 'fatto' && stato !== 'negato' && (
          <button className="btn btn-primario" onClick={attiva} disabled={stato === 'lavoro'}>
            {stato === 'lavoro' ? 'Attivo…' : 'Attiva le notifiche'}
          </button>
        )}
        {stato !== 'fatto' && (
          <button className="link-testo invito-rinvia" onClick={rinvia}>{iosGuida ? 'Ho capito' : 'Non ora'}</button>
        )}
      </div>
    </div>
  )
}
