import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import Testata from '../../components/Testata.jsx'
import CardPromo from '../../components/CardPromo.jsx'
import VerificaNumero from '../../components/VerificaNumero.jsx'

// Bacheca promozioni del cliente: quelle caricate (valgono in cassa) e
// quelle disponibili da caricare. Una promo non caricata non vale.
export default function Promozioni() {
  const [dati, setDati] = useState(null)
  const [me, setMe] = useState(null)
  const [errore, setErrore] = useState('')
  const [inCorso, setInCorso] = useState(null)
  // Promo che il cliente voleva caricare quando è scattata la verifica:
  // appena verifica, la carichiamo senza fargli premere di nuovo.
  const [verificaPer, setVerificaPer] = useState(null)

  function carica() {
    api.get('/cliente/promozioni').then(setDati).catch((err) => setErrore(err.message))
    api.get('/cliente/me').then(setMe).catch(() => {})
  }

  useEffect(carica, [])

  async function caricaPromo(id) {
    if (me && !me.telefonoVerificato) { setVerificaPer(id); return }
    setInCorso(id)
    setErrore('')
    try {
      await api.post(`/cliente/promozioni/${id}/carica`)
      carica()
    } catch (err) {
      if (err.status === 403) setVerificaPer(id)
      else setErrore(err.message)
    }
    setInCorso(null)
  }

  async function dopoVerifica() {
    const id = verificaPer
    setVerificaPer(null)
    setMe((m) => (m ? { ...m, telefonoVerificato: true } : m))
    if (id) {
      try { await api.post(`/cliente/promozioni/${id}/carica`) } catch (err) { setErrore(err.message) }
    }
    carica()
  }

  if (errore && !dati) return <div className="schermo"><p className="messaggio-errore">{errore}</p></div>
  if (!dati) return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>

  const { caricate, disponibili } = dati

  return (
    <div className="schermo">
      <Testata saluto="Promozioni" />
      {errore && <p className="messaggio-errore">{errore}</p>}

      {verificaPer !== null && me && (
        <VerificaNumero
          telefono={me.telefono}
          motivo="Per caricare le promozioni sulla tessera serve il numero verificato."
          onVerificato={dopoVerifica}
          onAnnulla={() => setVerificaPer(null)}
        />
      )}
      {verificaPer === null && me && !me.telefonoVerificato && disponibili.length > 0 && (
        <p className="testo-secondario" style={{ fontSize: '0.85rem' }}>
          Per caricare una promo ti chiederemo di verificare il numero (una volta sola).
        </p>
      )}

      <h2 style={{ fontSize: '1rem', marginTop: 8 }}>Le tue promo</h2>
      {caricate.length === 0 ? (
        <p className="testo-secondario">Nessuna promo caricata. Scegline una qui sotto.</p>
      ) : (
        caricate.map((p) => <CardPromo key={p.id} promo={p} />)
      )}

      <h2 style={{ fontSize: '1rem', marginTop: 20 }}>Per te</h2>
      {disponibili.length === 0 ? (
        <p className="testo-secondario">Al momento non ci sono nuove promozioni. Torna a trovarci!</p>
      ) : (
        disponibili.map((p) => (
          <CardPromo
            key={p.id}
            promo={p}
            azione={() => caricaPromo(p.id)}
            azioneTesto="Carica sulla tessera"
            inCorso={inCorso === p.id}
          />
        ))
      )}
      <p className="testo-secondario" style={{ fontSize: '0.8rem', marginTop: 16 }}>
        Le promo caricate vengono applicate alla cassa mostrando il QR della tessera.
      </p>
    </div>
  )
}
