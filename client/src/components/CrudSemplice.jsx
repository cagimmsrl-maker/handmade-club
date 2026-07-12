import { useEffect, useState } from 'react'

// Componente generico per le sezioni CRUD del pannello admin (livelli,
// convenzioni, sedi): tabella + form di creazione/modifica basati su una
// lista di campi dichiarativa. Evita di ripetere la stessa struttura
// tre volte per risorse che hanno la stessa forma (elenco + form + elimina).
export default function CrudSemplice({ titolo, campi, api, valoriIniziali }) {
  const [lista, setLista] = useState([])
  const [editId, setEditId] = useState(null) // null = nessun form, 'nuovo' | id
  const [form, setForm] = useState(valoriIniziali)
  const [errore, setErrore] = useState('')

  function carica() {
    api.lista().then(setLista).catch((err) => setErrore(err.message))
  }

  useEffect(carica, [])

  function apriNuovo() {
    setForm(valoriIniziali)
    setEditId('nuovo')
    setErrore('')
  }

  function apriModifica(riga) {
    const valori = {}
    campi.forEach((c) => { valori[c.chiave] = riga[c.colonnaDb ?? c.chiave] })
    setForm(valori)
    setEditId(riga.id)
    setErrore('')
  }

  async function salva(e) {
    e.preventDefault()
    setErrore('')
    try {
      if (editId === 'nuovo') {
        await api.crea(form)
      } else {
        await api.aggiorna(editId, form)
      }
      setEditId(null)
      carica()
    } catch (err) {
      setErrore(err.message)
    }
  }

  async function elimina(id) {
    if (!window.confirm('Confermi l’eliminazione?')) return
    try {
      await api.elimina(id)
      carica()
    } catch (err) {
      setErrore(err.message)
    }
  }

  return (
    <div className="card">
      <h2>{titolo}</h2>

      <div style={{ overflowX: 'auto' }}>
        <table className="tabella-admin">
          <thead>
            <tr>
              {campi.map((c) => <th key={c.chiave}>{c.etichetta}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((riga) => (
              <tr key={riga.id}>
                {campi.map((c) => (
                  <td key={c.chiave}>
                    {c.tipo === 'checkbox'
                      ? (riga[c.colonnaDb ?? c.chiave] ? 'Sì' : 'No')
                      : String(riga[c.colonnaDb ?? c.chiave] ?? '')}
                  </td>
                ))}
                <td>
                  <button className="link-testo" onClick={() => apriModifica(riga)}>Modifica</button>
                  {' · '}
                  <button className="link-testo" onClick={() => elimina(riga.id)}>Elimina</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editId === null && (
        <button className="btn btn-secondario" style={{ marginTop: 14 }} onClick={apriNuovo}>
          + Aggiungi
        </button>
      )}

      {editId !== null && (
        <form onSubmit={salva} style={{ marginTop: 16 }}>
          {campi.map((c) => (
            <div className={c.tipo === 'checkbox' ? 'campo-checkbox' : 'campo'} key={c.chiave}>
              {c.tipo === 'checkbox' ? (
                <>
                  <input
                    id={c.chiave}
                    type="checkbox"
                    checked={!!form[c.chiave]}
                    onChange={(e) => setForm({ ...form, [c.chiave]: e.target.checked })}
                  />
                  <label htmlFor={c.chiave}>{c.etichetta}</label>
                </>
              ) : (
                <>
                  <label htmlFor={c.chiave}>{c.etichetta}</label>
                  <input
                    id={c.chiave}
                    type={c.tipo === 'numero' ? 'number' : 'text'}
                    step={c.tipo === 'numero' ? 'any' : undefined}
                    value={form[c.chiave] ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [c.chiave]: c.tipo === 'numero' ? Number(e.target.value) : e.target.value,
                      })
                    }
                    required={c.obbligatorio}
                  />
                </>
              )}
            </div>
          ))}
          {errore && <p className="messaggio-errore">{errore}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primario" type="submit">Salva</button>
            <button className="btn btn-secondario" type="button" onClick={() => setEditId(null)}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  )
}
