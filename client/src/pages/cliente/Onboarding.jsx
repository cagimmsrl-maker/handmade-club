import { useState } from 'react'
import { api } from '../../api.js'

const STEP_TELEFONO = 'telefono'
const STEP_OTP = 'otp'
const STEP_PROFILO = 'profilo'

export default function Onboarding({ onCompletato }) {
  const [step, setStep] = useState(STEP_TELEFONO)
  const [telefono, setTelefono] = useState('')
  const [codice, setCodice] = useState('')
  const [tokenRegistrazione, setTokenRegistrazione] = useState(null)
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascita, setDataNascita] = useState('')
  const [accettaInformativa, setAccettaInformativa] = useState(false)
  const [consensoMarketing, setConsensoMarketing] = useState(false)

  async function inviaTelefono(e) {
    e.preventDefault()
    setErrore('')
    setCaricamento(true)
    try {
      await api.post('/auth/richiedi-otp', { telefono })
      setStep(STEP_OTP)
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  async function verificaCodice(e) {
    e.preventDefault()
    setErrore('')
    setCaricamento(true)
    try {
      const dati = await api.post('/auth/verifica-otp', { telefono, codice })
      if (dati.nuovoCliente) {
        setTokenRegistrazione(dati.tokenRegistrazione)
        setStep(STEP_PROFILO)
      } else {
        onCompletato()
      }
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  async function completaProfilo(e) {
    e.preventDefault()
    setErrore('')
    if (!accettaInformativa) {
      setErrore('Devi accettare l’informativa privacy per continuare.')
      return
    }
    setCaricamento(true)
    try {
      await api.post('/auth/completa-profilo', {
        tokenRegistrazione,
        nome,
        cognome: cognome || undefined,
        email: email || undefined,
        dataNascita: dataNascita || undefined,
        consensoMarketing,
      })
      onCompletato()
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="schermo">
      <h1>Handmade Club</h1>

      {step === STEP_TELEFONO && (
        <form className="card" onSubmit={inviaTelefono}>
          <h2>Accedi con il tuo numero</h2>
          <p className="testo-secondario">Ti invieremo un codice via SMS per verificarlo.</p>
          <div className="campo">
            <label htmlFor="telefono">Numero di telefono</label>
            <input
              id="telefono"
              type="tel"
              placeholder="+39 333 1234567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
            />
          </div>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Invio in corso...' : 'Invia codice'}
          </button>
        </form>
      )}

      {step === STEP_OTP && (
        <form className="card" onSubmit={verificaCodice}>
          <h2>Inserisci il codice</h2>
          <p className="testo-secondario">Abbiamo inviato un codice a 6 cifre a {telefono}.</p>
          <div className="campo">
            <label htmlFor="codice">Codice OTP</label>
            <input
              id="codice"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={codice}
              onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Verifica in corso...' : 'Verifica'}
          </button>
          <button
            type="button"
            className="link-testo"
            style={{ marginTop: 12 }}
            onClick={() => setStep(STEP_TELEFONO)}
          >
            Cambia numero
          </button>
        </form>
      )}

      {step === STEP_PROFILO && (
        <form className="card" onSubmit={completaProfilo}>
          <h2>Completa il profilo</h2>
          <div className="campo">
            <label htmlFor="nome">Nome *</label>
            <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="cognome">Cognome</label>
            <input id="cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="dataNascita">Data di nascita</label>
            <input
              id="dataNascita"
              type="date"
              value={dataNascita}
              onChange={(e) => setDataNascita(e.target.value)}
            />
          </div>

          <div className="campo-checkbox">
            <input
              id="informativa"
              type="checkbox"
              checked={accettaInformativa}
              onChange={(e) => setAccettaInformativa(e.target.checked)}
              required
            />
            <label htmlFor="informativa">
              Ho letto e accetto l’informativa privacy sul trattamento dei miei dati. *
            </label>
          </div>
          <div className="campo-checkbox">
            <input
              id="marketing"
              type="checkbox"
              checked={consensoMarketing}
              onChange={(e) => setConsensoMarketing(e.target.checked)}
            />
            <label htmlFor="marketing">
              Voglio ricevere comunicazioni promozionali (facoltativo).
            </label>
          </div>

          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Creazione in corso...' : 'Crea la mia tessera'}
          </button>
        </form>
      )}
    </div>
  )
}
