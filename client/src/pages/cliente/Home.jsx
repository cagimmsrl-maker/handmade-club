import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api.js'
import Testata from '../../components/Testata.jsx'
import Tessera from '../../components/Tessera.jsx'
import BannerInstalla from '../../components/BannerInstalla.jsx'

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
  const prossimo = progresso?.prossimoLivello
  const percentuale = prossimo && prossimo.sogliaVisite > 0
    ? Math.min(100, Math.round((progresso.visite / prossimo.sogliaVisite) * 100))
    : 100

  return (
    <div className="schermo">
      <Testata saluto="Ciao," nome={dati.nome} />

      <Tessera
        nome={`${dati.nome}${dati.cognome ? ' ' + dati.cognome : ''}`}
        codiceQr={dati.tessera.codiceQr}
        codiceTessera={dati.tessera.codice}
        livello={livello}
        visite={progresso?.visite}
      />

      <BannerInstalla />

      <Link to="/promozioni" className="card card-link">
        <span className="icona" aria-hidden="true">%</span>
        <span>
          <strong>Promozioni</strong>
          <span className="testo-secondario" style={{ display: 'block', marginTop: 2 }}>
            {dati.promoCaricate > 0 ? 'Le tue promo sono sulla tessera' : 'Scopri le promo per te'}
          </span>
        </span>
        {dati.promoCaricate > 0 && <span className="contatore">{dati.promoCaricate}</span>}
        <span className="freccia" aria-hidden="true">›</span>
      </Link>

      {prossimo && (
        <div className="card">
          <strong>Verso il livello {prossimo.nome}</strong>
          <div className="progresso"><div style={{ width: `${percentuale}%` }} /></div>
          <p className="testo-secondario" style={{ margin: 0 }}>
            {progresso.visite} {progresso.visite === 1 ? 'visita' : 'visite'} su {prossimo.sogliaVisite} · te ne {progresso.visiteMancanti === 1 ? 'manca una' : `mancano ${progresso.visiteMancanti}`}
          </p>
        </div>
      )}

      {convenzione && (
        <div className="card">
          <strong>Convenzione {convenzione.nome}</strong>
          <p className="testo-secondario" style={{ margin: '4px 0 0' }}>Sconto {convenzione.scontoPercentuale}% riservato</p>
        </div>
      )}
    </div>
  )
}
