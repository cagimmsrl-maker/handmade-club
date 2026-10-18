import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import CardPromo from '../../components/CardPromo.jsx'

// Bacheca promozioni del cliente: quelle caricate (valgono in cassa) e
// quelle disponibili da caricare. Una promo non caricata non vale.
export default function Promozioni() {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState('')
  const [inCorso, setInCorso] = useState(null)

  function carica() {
    api.get('/cliente/promozioni').then(setDati).catch((err) => setErrore(err.message))
  }

  useEffect(carica, [])

  async function caricaPromo(id) {
    setInCorso(id)
    setErrore('')
    try {
      await api.post(`/cliente/promozioni/${id}/carica`)
      carica()
    } catch (err) {
      setErrore(err.message)
    }
    setInCorso(null)
  }

  if (errore && !dati) return <div className="schermo"><p className="messaggio-errore">{errore}</p></div>
  if (!dati) return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>

  const { caricate, disponibili } = dati

  return (
    <div className="schermo">
      <h1>Promozioni</h1>
      {errore && <p className="messaggio-errore">{errore}</p>}

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
