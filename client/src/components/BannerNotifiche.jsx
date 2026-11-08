import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { supportaPush, statoPermesso, iscrizioneLocale, attivaNotifiche, isIosNonInstallata } from '../lib/push.js'

// Invito ad attivare le notifiche push (migrazione 014). Compare in Home a
// chi non le ha ancora attivate; sparisce quando sono attive, se il
// telefono non le supporta, se il permesso è stato negato, o se il cliente
// lo chiude (ricordato 7 giorni in localStorage, best effort).
// Richiede il consenso marketing: senza, attivandolo si presta anche quello
// (la casella lo dice chiaramente), revocabile dal profilo.

const CHIAVE_CHIUSO = 'hc_notifiche_chiuso'

function chiusoDiRecente() {
  try {
    const t = Number(window.localStorage.getItem(CHIAVE_CHIUSO) || 0)
    return t && Date.now() - t < 7 * 24 * 60 * 60 * 1000
  } catch { return false }
}

export default function BannerNotifiche({ consensoMarketing, onAttivate }) {
  const [visibile, setVisibile] = useState(false)
  const [iosGuida, setIosGuida] = useState(false)
  const [stato, setStato] = useState('idle') // idle | lavoro | fatto | negato | errore
  const [messaggio, setMessaggio] = useState('')

  useEffect(() => {
    let vivo = true
    ;(async () => {
      if (chiusoDiRecente()) return
      if (isIosNonInstallata()) { if (vivo) { setIosGuida(true); setVisibile(true) }; return }
      if (!supportaPush() || statoPermesso() === 'denied') return
      const sub = await iscrizioneLocale().catch(() => null)
      if (sub && statoPermesso() === 'granted') return // già attive
      const { attivo } = await api.get('/cliente/push/chiave').catch(() => ({ attivo: false }))
      if (vivo && attivo) setVisibile(true)
    })()
    return () => { vivo = false }
  }, [])

  async function attiva() {
    setStato('lavoro'); setMessaggio('')
    try {
      if (!consensoMarketing) await api.post('/cliente/consenso-marketing')
      const esito = await attivaNotifiche()
      if (esito === 'ok') { setStato('fatto'); setMessaggio('Fatto! Ti avviseremo delle nuove promo.'); onAttivate?.() ; setTimeout(() => setVisibile(false), 2500) }
      else if (esito === 'negato') { setStato('negato'); setMessaggio('Hai negato il permesso: puoi riattivarlo dalle impostazioni del telefono.') }
      else { setStato('errore'); setMessaggio('Al momento non è possibile attivare le notifiche su questo telefono.') }
    } catch (err) {
      setStato('errore'); setMessaggio(err.message || 'Errore, riprova più tardi.')
    }
  }

  function chiudi() {
    try { window.localStorage.setItem(CHIAVE_CHIUSO, String(Date.now())) } catch { /* pazienza */ }
    setVisibile(false)
  }

  if (!visibile) return null

  return (
    <div className="card banner-installa">
      <div className="banner-installa-testo">
        <strong>🔔 Attiva le notifiche</strong>
        {iosGuida ? (
          <p>Per ricevere gli avvisi delle promo su iPhone, prima aggiungi l'app alla schermata Home (Condividi → "Aggiungi alla schermata Home"), poi aprila da lì.</p>
        ) : (
          <p>Ti avvisiamo quando c'è una promo nuova o una scadenza. {consensoMarketing ? '' : 'Attivandole acconsenti a ricevere comunicazioni promozionali (revocabile dal profilo).'}</p>
        )}
        {messaggio && <p className={stato === 'fatto' ? 'messaggio-successo' : 'messaggio-errore'} style={{ margin: '6px 0 0' }}>{messaggio}</p>}
      </div>
      <div className="banner-installa-azioni">
        {!iosGuida && stato !== 'fatto' && (
          <button className="btn btn-primario" onClick={attiva} disabled={stato === 'lavoro'}>
            {stato === 'lavoro' ? 'Attivo…' : 'Attiva'}
          </button>
        )}
        <button className="link-testo" onClick={chiudi}>{iosGuida ? 'Ho capito' : 'Più tardi'}</button>
      </div>
    </div>
  )
}
