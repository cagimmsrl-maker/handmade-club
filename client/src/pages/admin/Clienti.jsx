import { useEffect, useState } from 'react'
import { api } from '../../api.js'

export default function Clienti() {
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState([])
  const [errore, setErrore] = useState('')

  function cerca() {
    api
      .get(`/admin/clienti?search=${encodeURIComponent(ricerca)}`)
      .then(setRisultati)
      .catch((err) => setErrore(err.message))
  }

  useEffect(cerca, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function bloccaTessera(id) {
    if (!window.confirm('Confermi il blocco della tessera di questo cliente?')) return
    try {
      await api.post(`/admin/clienti/${id}/blocca-tessera`)
      cerca()
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

      <div style={{ overflowX: 'auto' }}>
        <table className="tabella-admin">
          <thead>
            <tr>
              <th>Nome</th><th>Telefono</th><th>Livello</th><th>Tessera</th><th></th>
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
