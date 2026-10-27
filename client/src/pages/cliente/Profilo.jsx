import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
  const [messaggioPrivacy, setMessaggioPrivacy] = useState('')
  const [esportazione, setEsportazione] = useState(false)

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
        cognome,
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

  async function cambiaMarketing(valore) {
    setMessaggioPrivacy('')
    try {
      if (valore) await api.post('/cliente/consenso-marketing')
      else await api.delete('/cliente/consenso-marketing')
      setMessaggioPrivacy(valore ? 'Consenso registrato.' : 'Consenso revocato: non riceverai più promozioni.')
      carica()
    } catch (err) {
      setMessaggioPrivacy(err.message)
    }
  }

  // Diritto di accesso/portabilità: il server risponde con un file JSON;
  // qui lo si scarica come farebbe un link, ma con il cookie di sessione.
  async function scaricaDati() {
    setEsportazione(true)
    setMessaggioPrivacy('')
    try {
      const r = await fetch('/api/cliente/esporta-dati', { credentials: 'include' })
      if (!r.ok) throw new Error('Esportazione non riuscita, riprova.')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `handmade-club-dati-${dati.tessera?.codice || 'tessera'}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setMessaggioPrivacy(err.message)
    } finally {
      setEsportazione(false)
    }
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
          <label htmlFor="cognome">Cognome *</label>
          <input id="cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} required />
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
        <label className="campo-interruttore">
          <input type="checkbox" checked={dati.consensoMarketing} onChange={(e) => cambiaMarketing(e.target.checked)} />
          <span>
            <strong>Promozioni e novità</strong>
            <span className="testo-secondario" style={{ display: 'block', fontSize: '0.85rem' }}>
              {dati.consensoMarketing ? 'Ricevi le promo via SMS, notifiche o email. Puoi toglierlo quando vuoi.' : 'Non ricevi comunicazioni. Attivalo per sapere delle promo.'}
            </span>
          </span>
        </label>
        <p className="testo-secondario" style={{ fontSize: '0.85rem' }}>
          Informativa accettata il {dati.consensoServizioIl ? new Date(dati.consensoServizioIl).toLocaleDateString('it-IT') : '—'}
          {dati.informativaVersione ? ` (versione ${dati.informativaVersione})` : ''}.{' '}
          <Link to="/privacy">Leggi l'informativa</Link>
          {dati.informativaVersione && dati.informativaCorrente && dati.informativaVersione !== dati.informativaCorrente ? ' — aggiornata dopo la tua iscrizione.' : ''}
        </p>
        <button className="btn btn-secondario" onClick={scaricaDati} disabled={esportazione}>
          {esportazione ? 'Preparo il file…' : 'Scarica i miei dati'}
        </button>
        {messaggioPrivacy && <p className="messaggio-successo" style={{ marginBottom: 0 }}>{messaggioPrivacy}</p>}
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
