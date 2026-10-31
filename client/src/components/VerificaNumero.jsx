import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Secondi di attesa prima di poter richiedere un altro codice (il server
// applica lo stesso limite: INTERVALLO_MINIMO_SECONDI in otpService).
const ATTESA_RINVIO = 60

// Verifica differita del numero: usata dal Profilo e dalla bacheca Promo
// quando il cliente prova a caricare una promo senza numero verificato.
// Due passi: invia il codice al numero già registrato, poi conferma.
export default function VerificaNumero({ telefono, motivo, onVerificato, onAnnulla }) {
  const [inviato, setInviato] = useState(false)
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)
  const [invii, setInvii] = useState(0)
  const [attesa, setAttesa] = useState(0) // secondi prima di poter rinviare

  useEffect(() => {
    if (attesa <= 0) return
    const t = setTimeout(() => setAttesa((a) => a - 1), 1000)
    return () => clearTimeout(t)
  }, [attesa])

  async function invia() {
    setErrore('')
    setCaricamento(true)
    try {
      const r = await api.post('/cliente/verifica/richiedi')
      if (r.giaVerificato) { onVerificato?.(); return }
      setInviato(true)
      setInvii((n) => n + 1)
      setAttesa(ATTESA_RINVIO)
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
          {invii >= 2 && (
            <p className="testo-secondario">
              Non arriva? In questi giorni alcuni operatori consegnano i nostri SMS in ritardo o non li consegnano.
              Non perdi nulla: puoi continuare senza verifica e riprovare più avanti.
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primario" type="submit" disabled={caricamento || codice.length !== 6}>
              {caricamento ? 'Verifica...' : 'Conferma'}
            </button>
            <button className="btn btn-secondario" type="button" onClick={invia} disabled={caricamento || attesa > 0}>
              {attesa > 0 ? `Rinvia tra ${attesa} s` : 'Rinvia codice'}
            </button>
            {onAnnulla && invii >= 2 && (
              <button className="btn btn-secondario" type="button" onClick={onAnnulla} disabled={caricamento}>Più tardi</button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
