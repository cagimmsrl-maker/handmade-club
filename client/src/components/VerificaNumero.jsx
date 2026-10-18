import { useState } from 'react'
import { api } from '../api.js'

// Verifica differita del numero: usata dal Profilo e dalla bacheca Promo
// quando il cliente prova a caricare una promo senza numero verificato.
// Due passi: invia il codice al numero già registrato, poi conferma.
export default function VerificaNumero({ telefono, motivo, onVerificato, onAnnulla }) {
  const [inviato, setInviato] = useState(false)
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function invia() {
    setErrore('')
    setCaricamento(true)
    try {
      const r = await api.post('/cliente/verifica/richiedi')
      if (r.giaVerificato) { onVerificato?.(); return }
      setInviato(true)
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  async function conferma(e) {
    e.preventDefault()
    setErrore('')
    setCaricamento(true)
    try {
      await api.post('/cliente/verifica/conferma', { codice })
      onVerificato?.()
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--colore-primario)' }}>
      <h3 style={{ marginTop: 0 }}>Verifica il tuo numero</h3>
      {motivo && <p style={{ marginTop: 0 }}>{motivo}</p>}
      {!inviato ? (
        <>
          <p className="testo-secondario">Ti inviamo un codice via SMS a <strong>{telefono}</strong>. Si fa una volta sola.</p>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primario" onClick={invia} disabled={caricamento}>
              {caricamento ? 'Invio...' : 'Inviami il codice'}
            </button>
            {onAnnulla && <button className="btn btn-secondario" onClick={onAnnulla} disabled={caricamento}>Più tardi</button>}
          </div>
        </>
      ) : (
        <form onSubmit={conferma}>
          <p className="testo-secondario">Inserisci il codice a 6 cifre ricevuto via SMS.</p>
          <div className="campo">
            <label htmlFor="codice-verifica">Codice SMS</label>
            <input
              id="codice-verifica"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={codice}
              onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
              required
              autoComplete="one-time-code"
              autoFocus
            />
          </div>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primario" type="submit" disabled={caricamento || codice.length !== 6}>
              {caricamento ? 'Verifica...' : 'Conferma'}
            </button>
            <button className="btn btn-secondario" type="button" onClick={invia} disabled={caricamento}>Rinvia codice</button>
          </div>
        </form>
      )}
    </div>
  )
}
