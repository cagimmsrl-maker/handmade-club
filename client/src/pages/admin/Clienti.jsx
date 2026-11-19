import { useEffect, useState } from 'react'
import { api } from '../../api.js'

export default function Clienti() {
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState([])
  const [errore, setErrore] = useState('')
  const [origini, setOrigini] = useState([])

  function cerca() {
    api
      .get(`/admin/clienti?search=${encodeURIComponent(ricerca)}`)
      .then(setRisultati)
      .catch((err) => setErrore(err.message))
  }

  useEffect(cerca, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/admin/clienti/origini').then(setOrigini).catch(() => {}) }, [])

  async function bloccaTessera(id) {
    if (!window.confirm('Confermi il blocco della tessera di questo cliente?')) return
    try {
      await api.post(`/admin/clienti/${id}/blocca-tessera`)
      cerca()
    } catch (err) {
      setErrore(err.message)
    }
  }

  // Codice di accesso quando l'SMS non arriva (19/11/2026). Il cliente apre
  // l'app, tocca "Ho già la tessera", mette il numero e chiede il codice;
  // poi l'admin genera questo e glielo dice: va inserito al posto dell'SMS.
  async function codiceAccesso(c) {
    const ok = window.confirm(
      `Codice di accesso per ${c.nome} ${c.cognome || ''} (${c.telefono}).\n\n` +
      'Prima il cliente deve aprire l\'app, toccare "Ho già la tessera", inserire il numero e chiedere il codice. ' +
      'Solo dopo genera questo codice e diglielo: lo inserisce al posto di quello SMS.\n\n' +
      'Generare adesso?'
    )
    if (!ok) return
    try {
      const { codice, validoMinuti } = await api.post(`/admin/clienti/${c.id}/codice-accesso`)
      window.alert(`Codice per ${c.nome}: ${codice}\n\nValido ${validoMinuti} minuti, una sola volta. Se il cliente preme "rinvia" nell'app, va generato di nuovo.`)
    } catch (err) {
      setErrore(err.message)
    }
  }

  return (
    <div className="card">
      <h2>Clienti</h2>
      <div className="campo" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <input
          placeholder="Cerca per nome o telefono..."
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && cerca()}
        />
        <button className="btn btn-secondario" style={{ width: 'auto', marginLeft: 8 }} onClick={cerca}>
          Cerca
        </button>
      </div>
      {errore && <p className="messaggio-errore">{errore}</p>}

      {origini.length > 0 && (
        <p className="testo-secondario" style={{ margin: '4px 0 12px' }}>
          <strong>Da dove arrivano le tessere</strong> (ultimi 30 giorni / totale):{' '}
          {origini.map((o, i) => (
            <span key={o.origine}>{i > 0 ? ' · ' : ''}{o.origine} <strong>{o.ultimi_30_giorni}</strong>/{o.totale}</span>
          ))}
          <br />Link con canale: <code>club.handmadecafe.it/installa?da=instagram</code> (o sacchetto, vetrina, nome-azienda…); senza parametro = banco.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="tabella-admin">
          <thead>
            <tr>
              <th>Nome</th><th>Telefono</th><th>Livello</th><th>Tessera</th><th>Cassa (TGS)</th><th></th>
            </tr>
          </thead>
          <tbody>
            {risultati.map((c) => (
              <tr key={c.id}>
                <td>{c.nome} {c.cognome || ''}</td>
                <td>{c.telefono}</td>
                <td>{c.livello_nome || '—'}</td>
                <td>{c.tessera_stato || '—'}</td>
                <td>
                  {(!c.tgs || c.tgs.length === 0) && <span className="testo-secondario">in attesa</span>}
                  {(c.tgs || []).map((t) => (
                    <div key={t.sede} title={t.messaggio || ''} style={{ whiteSpace: 'nowrap' }}>
                      {t.sede}: {{ creato: 'creato ✓', gia_presente: 'già presente', errore: 'errore ✗' }[t.stato] || t.stato}
                      {t.card ? ` · ${t.card}` : ''}
                      {t.stato === 'errore' && t.messaggio ? <span className="testo-secondario"> — {t.messaggio}</span> : null}
                    </div>
                  ))}
                </td>
                <td>
                  {c.tessera_stato === 'attiva' && (
                    <button className="link-testo" onClick={() => codiceAccesso(c)} style={{ display: 'block', marginBottom: 4 }}>Codice di accesso</button>
                  )}
                  {c.tessera_stato === 'attiva' && (
                    <button className="link-testo" onClick={() => bloccaTessera(c.id)}>Blocca tessera</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
