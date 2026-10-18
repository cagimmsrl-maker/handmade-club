import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api.js'
import QrStatico from '../../components/QrStatico.jsx'

export default function Home() {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    api
      .get('/cliente/me')
      .then(setDati)
      .catch((err) => setErrore(err.message))
  }, [])

  if (errore) return <div className="schermo"><p className="messaggio-errore">{errore}</p></div>
  if (!dati) return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>

  const { livello, convenzione, progresso } = dati

  return (
    <div className="schermo">
      <h1>Ciao, {dati.nome}</h1>

      <div className="card" style={{ textAlign: 'center' }}>
        {livello && (
          <span className="badge" style={{ background: livello.colore, marginBottom: 10 }}>
            Livello {livello.nome} · sconto {livello.scontoPercentuale}%
          </span>
        )}
        <QrStatico codiceQr={dati.tessera.codiceQr} codiceTessera={dati.tessera.codice} />
      </div>

      <Link to="/promozioni" className="card" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
        <strong>Promozioni</strong>
        <p className="testo-secondario" style={{ margin: '4px 0 0' }}>
          {dati.promoCaricate > 0
            ? `${dati.promoCaricate} promo ${dati.promoCaricate === 1 ? 'caricata' : 'caricate'} sulla tessera · vedi tutte →`
            : 'Scopri le promo per te e caricale sulla tessera →'}
        </p>
      </Link>

      {progresso?.prossimoLivello && (
        <div className="card">
          <p>
            Ti mancano <strong>{progresso.visiteMancanti}</strong> visite per diventare{' '}
            <strong>{progresso.prossimoLivello.nome}</strong>.
          </p>
        </div>
      )}

      {convenzione && (
        <div className="card">
          <h3>Convenzione attiva</h3>
          <p>
            {convenzione.nome} · sconto {convenzione.scontoPercentuale}%
          </p>
        </div>
      )}
    </div>
  )
}
