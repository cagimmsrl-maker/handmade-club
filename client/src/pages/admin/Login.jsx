import { useState } from 'react'
import { api } from '../../api.js'

export default function Login({ onAutenticato }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState('')
  const [caricamento, setCaricamento] = useState(false)

  async function accedi(e) {
    e.preventDefault()
    setErrore('')
    setCaricamento(true)
    try {
      const dati = await api.post('/admin/login', { username, password })
      onAutenticato(dati)
    } catch (err) {
      setErrore(err.message)
    } finally {
      setCaricamento(false)
    }
  }

  return (
    <div className="schermo">
      <h1>Handmade Club — Admin</h1>
      <form className="card" onSubmit={accedi}>
        <div className="campo">
          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
