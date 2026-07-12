import { useEffect, useState } from 'react'
import { api } from '../../api.js'

export default function Dashboard() {
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState('')

  useEffect(() => {
    api.get('/admin/dashboard').then(setDati).catch((err) => setErrore(err.message))
  }, [])

  if (errore) return <p className="messaggio-errore">{errore}</p>
  if (!dati) return <p className="testo-secondario">Caricamento...</p>

  return (
    <>
      <div className="card">
        <h2>Tessere attivate</h2>
        <div className="griglia-metriche">
          <div className="metrica">
            <div className="valore">{dati.tessereAttivateTotali}</div>
            <div className="testo-secondario">Totali</div>
          </div>
          {dati.tessereAttivatePerSettimana.slice(-4).map((s) => (
            <div className="metrica" key={s.settimana}>
              <div className="valore">{s.n}</div>
              <div className="testo-secondario">
                Sett. {new Date(s.settimana).toLocaleDateString('it-IT')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Scansioni per sede (ultimi 30 giorni)</h2>
        <table className="tabella-admin">
          <thead><tr><th>Sede</th><th>Scansioni</th></tr></thead>
          <tbody>
            {dati.scansioniPerSedeUltimi30Giorni.map((s) => (
              <tr key={s.id}><td>{s.nome}</td><td>{s.scansioni}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Distribuzione clienti per livello</h2>
        <table className="tabella-admin">
          <thead><tr><th>Livello</th><th>Clienti</th></tr></thead>
          <tbody>
            {dati.distribuzioneClientiPerLivello.map((l) => (
              <tr key={l.id}>
                <td><span className="badge" style={{ background: l.colore }}>{l.nome}</span></td>
                <td>{l.clienti}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
