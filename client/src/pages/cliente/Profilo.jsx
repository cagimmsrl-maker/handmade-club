import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import Testata from '../../components/Testata.jsx'
import VerificaNumero from '../../components/VerificaNumero.jsx'

export default function Profilo({ onAccountCancellato }) {
  const [dati, setDati] = useState(null)
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [dataNascita, setDataNascita] = useState('')
  const [codiceConvenzione, setCodiceConvenzione] = useState('')

  const [messaggioProfilo, setMessaggioProfilo] = useState('')
  const [messaggioConvenzione, setMessaggioConvenzione] = useState('')
  const [erroreProfilo, setErroreProfilo] = useState('')
  const [erroreConvenzione, setErroreConvenzione] = useState('')
  const [verificaAperta, setVerificaAperta] = useState(false)

  function carica() {
    api.get('/cliente/me').then((d) => {
      setDati(d)
      setNome(d.nome || '')
      setCognome(d.cognome || '')
      setEmail(d.email || '')
      setDataNascita(d.dataNascita ? d.dataNascita.substring(0, 10) : '')
    })
  }

  useEffect(carica, [])

  async function salvaProfilo(e) {
    e.preventDefault()
    setErroreProfilo('')
    setMessaggioProfilo('')
    try {
      await api.put('/cliente/profilo', {
        nome,
        cognome: cognome || undefined,
        email: email || undefined,
        dataNascita: dataNascita || undefined,
      })
      setMessaggioProfilo('Profilo aggiornato.')
    } catch (err) {
      setErroreProfilo(err.message)
    }
  }

  async function attivaConvenzione(e) {
    e.preventDefault()
    setErroreConvenzione('')
    setMessaggioConvenzione('')
    try {
      await api.post('/cliente/convenzione', { codice: codiceConvenzione })
      setMessaggioConvenzione('Convenzione attivata.')
      setCodiceConvenzione('')
      carica()
    } catch (err) {
      setErroreConvenzione(err.message)
    }
  }

  async function revocaMarketing() {
    await api.delete('/cliente/consenso-marketing')
    carica()
  }

  async function cancellaAccount() {
    const conferma = window.confirm(
      'Sei sicuro di voler cancellare il tuo account? I tuoi dati personali verranno anonimizzati e non potrai più accedere alla tessera.'
    )
    if (!conferma) return
    await api.post('/cliente/cancella-account')
    onAccountCancellato()
  }

  if (!dati) return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>

  return (
    <div className="schermo">
      <Testata saluto="Profilo" />

      <div className="card">
        <p style={{ margin: 0 }}>
          Numero <strong>{dati.telefono}</strong>{' '}
          {dati.telefonoVerificato
            ? <span className="badge" style={{ background: 'var(--colore-primario)' }}>verificato ✓</span>
            : <span className="badge" style={{ background: '#999' }}>da verificare</span>}
        </p>
        {!dati.telefonoVerificato && !verificaAperta && (
          <>
            <p className="testo-secondario" style={{ marginBottom: 8 }}>
              Verificalo per caricare le promozioni e ricevere le novità. Si fa una volta sola.
            </p>
            <button className="btn btn-secondario" onClick={() => setVerificaAperta(true)}>Verifica ora</button>
          </>
        )}
      </div>
      {!dati.telefonoVerificato && verificaAperta && (
        <VerificaNumero telefono={dati.telefono} onVerificato={() => { setVerificaAperta(false); carica() }} onAnnulla={() => setVerificaAperta(false)} />
      )}

      <form className="card" onSubmit={salvaProfilo}>
        <h2>I tuoi dati</h2>
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
        {erroreProfilo && <p className="messaggio-errore">{erroreProfilo}</p>}
        {messaggioProfilo && <p className="messaggio-successo">{messaggioProfilo}</p>}
        <button className="btn btn-primario" type="submit">Salva</button>
      </form>

      <form className="card" onSubmit={attivaConvenzione}>
        <h2>Codice convenzione</h2>
        <div className="campo">
          <label htmlFor="codiceConvenzione">Codice</label>
          <input
            id="codiceConvenzione"
            value={codiceConvenzione}
            onChange={(e) => setCodiceConvenzione(e.target.value)}
          />
        </div>
        {erroreConvenzione && <p className="messaggio-errore">{erroreConvenzione}</p>}
        {messaggioConvenzione && <p className="messaggio-successo">{messaggioConvenzione}</p>}
        <button className="btn btn-secondario" type="submit">Attiva convenzione</button>
      </form>

      <div className="card">
        <h2>Privacy</h2>
        <p className="testo-secondario">
          Consenso marketing: {dati.consensoMarketing ? 'prestato' : 'non prestato'}
        </p>
        {dati.consensoMarketing && (
          <button className="btn btn-secondario" onClick={revocaMarketing}>
            Revoca consenso marketing
          </button>
        )}
      </div>

      <div className="card">
        <h2>Cancella account</h2>
        <p className="testo-secondario">
          I tuoi dati personali (telefono, email, nome) verranno anonimizzati in modo permanente.
        </p>
        <button className="btn btn-pericolo" onClick={cancellaAccount}>
          Cancella il mio account
        </button>
      </div>
    </div>
  )
}
