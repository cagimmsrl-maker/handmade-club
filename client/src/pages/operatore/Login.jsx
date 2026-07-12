import { useEffect, useState } from 'react'
import { api } from '../../api.js'

export default function Login({ onAutenticato }) {
  const [sedi, setSedi] = useState([])
  const [sedeId, setSedeId] = useState('')
  const [pin, setPin] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  useEffect(() => {
    api.get('/operatore/sedi').then((rows) => {
      setSedi(rows)
      if (rows.length > 0) setSedeId(String(rows[0].id))
    })
  }, [])

  async function accedi(e) {
    e.preventDefault()
    setErrore('')
    setCaricamento(true)
    try {
      const dati = await api.post('/operatore/login', { sedeId: Number(sedeId), pin })
      onAutenticato(dati.sede)
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="schermo">
      <h1>Handmade Club — Operatore</h1>
      <form className="card" onSubmit={accedi}>
        <div className="campo">
          <label htmlFor="sede">Sede</label>
          <select id="sede" value={sedeId} onChange={(e) => setSedeId(e.target.value)} required>
            {sedi.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="pin">PIN sede</label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        {errore && <p className="messaggio-errore">{errore}</p>}
        <button className="btn btn-primario" disabled={caricamento} type="submit">
          {caricamento ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>
    </div>
  )
}
