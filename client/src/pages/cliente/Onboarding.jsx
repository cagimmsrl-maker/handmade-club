import { useState } from 'react'
import { api } from '../../api.js'

// Ingresso: "entri subito, verifichi dopo". La tessera si crea con nome e
// telefono, senza codice. L'OTP serve solo a chi ha già la tessera e deve
// rientrare (nuovo telefono, sessione scaduta) e, più avanti, per caricare
// le promo (vedi VerificaNumero).
const MODO_REGISTRA = 'registra'
const MODO_ACCEDI = 'accedi'
const STEP_OTP = 'otp'
const STEP_PROFILO = 'profilo'

export default function Onboarding({ onCompletato }) {
  const [modo, setModo] = useState(MODO_REGISTRA)
  const [step, setStep] = useState(null) // per il modo "accedi": null | otp | profilo
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

  function profiloPayload() {
    return {
      nome,
      cognome: cognome || undefined,
      email: email || undefined,
      dataNascita: dataNascita || undefined,
      consensoMarketing,
    }
  }

  // ── Registrazione immediata ──
  async function registra(e) {
    e.preventDefault()
    setErrore('')
    if (!accettaInformativa) {
      setErrore('Devi accettare l’informativa privacy per continuare.')
      return
    }
    setCaricamento(true)
    try {
      await api.post('/auth/registra', { telefono, ...profiloPayload() })
      onCompletato()
    } catch (err) {
      if (err.status === 409) {
        setErrore('Questo numero ha già una tessera: accedi con il codice SMS.')
        setModo(MODO_ACCEDI)
        setStep(null)
      } else {
        setErrore(err.message)
      }
    } finally {
      setCaricamento(false)
    }
  }

  // ── Accesso con codice (tessera esistente) ──
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
      await api.post('/auth/completa-profilo', { tokenRegistrazione, ...profiloPayload() })
      onCompletato()
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  const campiProfilo = (
    <>
      <div className="campo">
        <label htmlFor="nome">Nome *</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required autoComplete="given-name" />
      </div>
      <div className="campo">
        <label htmlFor="cognome">Cognome</label>
        <input id="cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} autoComplete="family-name" />
      </div>
      <div className="campo">
        <label htmlFor="email">Email (facoltativa)</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="campo">
        <label htmlFor="dataNascita">Data di nascita (facoltativa)</label>
        <input id="dataNascita" type="date" value={dataNascita} onChange={(e) => setDataNascita(e.target.value)} />
      </div>
      <div className="campo-checkbox">
        <input id="informativa" type="checkbox" checked={accettaInformativa} onChange={(e) => setAccettaInformativa(e.target.checked)} required />
        <label htmlFor="informativa">Ho letto e accetto l’informativa privacy sul trattamento dei miei dati. *</label>
      </div>
      <div className="campo-checkbox">
        <input id="marketing" type="checkbox" checked={consensoMarketing} onChange={(e) => setConsensoMarketing(e.target.checked)} />
        <label htmlFor="marketing">Voglio ricevere promozioni e novità (facoltativo).</label>
      </div>
    </>
  )

  return (
    <div className="schermo">
      <div className="onboarding-hero">
        <img src="/brand/logo.png" alt="Handmade Café" />
        <p>La tessera fedeltà di Handmade Café: visite, livelli e promozioni, sul tuo telefono.</p>
      </div>

      {modo === MODO_REGISTRA && (
        <form className="card" onSubmit={registra}>
          <h2>Crea la tua tessera</h2>
          <p className="testo-secondario">Bastano nome e numero di telefono. Nessun codice, nessuna password.</p>
          <div className="campo">
            <label htmlFor="telefono">Numero di telefono *</label>
            <input
              id="telefono"
              type="tel"
              placeholder="+39 333 1234567"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              required
              autoComplete="tel"
            />
          </div>
          {campiProfilo}
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Creazione in corso...' : 'Crea la mia tessera'}
          </button>
          <button type="button" className="link-testo" style={{ marginTop: 14 }} onClick={() => { setModo(MODO_ACCEDI); setStep(null); setErrore('') }}>
            Ho già la tessera: accedi con il codice SMS
          </button>
        </form>
      )}

      {modo === MODO_ACCEDI && step === null && (
        <form className="card" onSubmit={inviaTelefono}>
          <h2>Accedi alla tua tessera</h2>
          <p className="testo-secondario">Ti inviamo un codice via SMS al numero con cui ti sei registrato.</p>
          <div className="campo">
            <label htmlFor="telefono">Numero di telefono</label>
            <input id="telefono" type="tel" placeholder="+39 333 1234567" value={telefono} onChange={(e) => setTelefono(e.target.value)} required autoComplete="tel" />
          </div>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Invio in corso...' : 'Invia codice'}
          </button>
          <button type="button" className="link-testo" style={{ marginTop: 14 }} onClick={() => { setModo(MODO_REGISTRA); setErrore('') }}>
            Non ho ancora la tessera
          </button>
        </form>
      )}

      {modo === MODO_ACCEDI && step === STEP_OTP && (
        <form className="card" onSubmit={verificaCodice}>
          <h2>Inserisci il codice</h2>
          <p className="testo-secondario">Abbiamo inviato un codice a 6 cifre a {telefono}.</p>
          <div className="campo">
            <label htmlFor="codice">Codice SMS</label>
            <input id="codice" type="text" inputMode="numeric" maxLength={6} placeholder="123456" value={codice} onChange={(e) => setCodice(e.target.value.replace(/\D/g, ''))} required autoComplete="one-time-code" />
          </div>
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Verifica in corso...' : 'Entra'}
          </button>
          <button type="button" className="link-testo" style={{ marginTop: 12 }} onClick={() => setStep(null)}>
            Cambia numero
          </button>
        </form>
      )}

      {modo === MODO_ACCEDI && step === STEP_PROFILO && (
        <form className="card" onSubmit={completaProfilo}>
          <h2>Completa il profilo</h2>
          <p className="testo-secondario">Numero verificato. Dicci come ti chiami e la tessera è pronta.</p>
          {campiProfilo}
          {errore && <p className="messaggio-errore">{errore}</p>}
          <button className="btn btn-primario" disabled={caricamento} type="submit">
            {caricamento ? 'Creazione in corso...' : 'Crea la mia tessera'}
          </button>
        </form>
      )}
    </div>
  )
}
