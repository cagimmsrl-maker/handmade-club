import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Riquadro con l'offerta di benvenuto, mostrato PRIMA della registrazione
// (/installa e "Crea la tua tessera"): chi arriva da una pubblicità o da un
// QR fuori dal locale deve vedere subito cosa ottiene. Testo dal server
// (/auth/offerta ← .env OFFERTA_BENVENUTO_*); se vuoto non compare nulla.
export default function OffertaBenvenuto({ compatto = false }) {
  const [offerta, setOfferta] = useState(null)
  useEffect(() => {
    let vivo = true
    api.get('/auth/offerta').then((o) => { if (vivo) setOfferta(o) }).catch(() => {})
    return () => { vivo = false }
  }, [])
  if (!offerta || (!offerta.titolo && !offerta.testo)) return null
  return (
    <div className={`offerta-benvenuto${compatto ? ' offerta-benvenuto-compatta' : ''}`}>
      <span className="offerta-etichetta">Con la tessera</span>
      {offerta.titolo && <strong className="offerta-titolo">{offerta.titolo}</strong>}
      {offerta.testo && <p>{offerta.testo}</p>}
    </div>
  )
}
