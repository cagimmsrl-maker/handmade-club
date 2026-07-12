import { useEffect, useState } from 'react'
import { api } from '../../api.js'

export default function Parametri() {
  const [finestra, setFinestra] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [errore, setErrore] = useState('')

  useEffect(() => {
    api.get('/admin/parametri').then((d) => setFinestra(String(d.finestraVisiteGiorni)))
  }, [])

  async function salva(e) {
    e.preventDefault()
    setErrore('')
    setMessaggio('')
    try {
      await api.put('/admin/parametri', { finestraVisiteGiorni: Number(finestra) })
      setMessaggio('Parametro aggiornato.')
    } catch (err) {
      setErrore(err.message)
    }
  }

  return (
    <div className="card">
      <h2>Parametri</h2>
      <form onSubmit={salva}>
        <div className="campo">
          <label htmlFor="finestra">Finestra mobile visite (giorni)</label>
          <input
            id="finestra"
            type="number"
            min="1"
            value={finestra}
            onChange={(e) => setFinestra(e.target.value)}
            required
          />
        </div>
        {errore && <p className="messaggio-errore">{errore}</p>}
        {messaggio && <p className="messaggio-successo">{messaggio}</p>}
        <button className="btn btn-primario" type="submit">Salva</button>
      </form>
    </div>
  )
}
