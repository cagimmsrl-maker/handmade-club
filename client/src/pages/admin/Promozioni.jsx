import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { etichettaTipo, etichettaValidita } from '../../lib/promo.js'

const TIPI = [
  { valore: 'sconto_percentuale', etichetta: 'Sconto % sullo scontrino' },
  { valore: 'prezzo_fisso', etichetta: 'Prezzo fisso su un prodotto' },
  { valore: 'omaggio', etichetta: 'Prodotto in omaggio / 2x1' },
  { valore: 'messaggio', etichetta: 'Solo messaggio (nessuno sconto)' },
]
const GIORNI = [
  { v: 1, n: 'Lun' }, { v: 2, n: 'Mar' }, { v: 3, n: 'Mer' }, { v: 4, n: 'Gio' },
  { v: 5, n: 'Ven' }, { v: 6, n: 'Sab' }, { v: 0, n: 'Dom' },
]
const STATO = { bozza: 'Bozza', pubblicata: 'Pubblicata', archiviata: 'Archiviata' }

function oggi() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const VUOTO = {
  titolo: '', descrizione: '', tipo: 'sconto_percentuale', valore: '', prodotto: '',
  validoDal: oggi(), validoAl: oggi(), oraInizio: '', oraFine: '',
  giorniSettimana: [], targetLivelloId: '', targetSedeId: '', usiPerCliente: 1, usiIllimitati: false,
}

export default function Promozioni() {
  const [lista, setLista] = useState([])
  const [livelli, setLivelli] = useState([])
  const [sedi, setSedi] = useState([])
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(VUOTO)
  const [errore, setErrore] = useState('')
  const [ok, setOk] = useState('')

  function carica() {
    api.get('/admin/promozioni').then(setLista).catch((e) => setErrore(e.message))
  }
  useEffect(() => {
    carica()
    api.get('/admin/livelli').then(setLivelli).catch(() => {})
    api.get('/admin/sedi').then(setSedi).catch(() => {})
  }, [])

  function apriNuova() {
    setForm(VUOTO); setEditId('nuova'); setErrore(''); setOk('')
  }
  function apriModifica(p) {
    setForm({
      titolo: p.titolo, descrizione: p.descrizione ?? '', tipo: p.tipo,
      valore: p.valore ?? '', prodotto: p.prodotto ?? '',
      validoDal: p.validoDal, validoAl: p.validoAl,
      oraInizio: p.oraInizio ?? '', oraFine: p.oraFine ?? '',
      giorniSettimana: p.giorniSettimana ?? [],
      targetLivelloId: p.targetLivelloId ?? '', targetSedeId: p.targetSedeId ?? '',
      usiPerCliente: p.usiPerCliente ?? 1, usiIllimitati: p.usiPerCliente == null,
    })
    setEditId(p.id); setErrore(''); setOk('')
  }

  function payload() {
    return {
      titolo: form.titolo,
      descrizione: form.descrizione || null,
      tipo: form.tipo,
      valore: form.tipo === 'sconto_percentuale' || form.tipo === 'prezzo_fisso' ? Number(form.valore) : null,
      prodotto: form.tipo === 'prezzo_fisso' || form.tipo === 'omaggio' ? form.prodotto : null,
      validoDal: form.validoDal,
      validoAl: form.validoAl,
      oraInizio: form.oraInizio || null,
      oraFine: form.oraFine || null,
      giorniSettimana: form.giorniSettimana.length > 0 && form.giorniSettimana.length < 7 ? form.giorniSettimana : null,
      targetLivelloId: form.targetLivelloId ? Number(form.targetLivelloId) : null,
      targetSedeId: form.targetSedeId ? Number(form.targetSedeId) : null,
      usiPerCliente: form.usiIllimitati ? null : Number(form.usiPerCliente || 1),
    }
  }

  async function salva(e, poiPubblica = false) {
    e.preventDefault()
    setErrore(''); setOk('')
    try {
      let id = editId
      if (editId === 'nuova') ({ id } = await api.post('/admin/promozioni', payload()))
      else await api.put(`/admin/promozioni/${editId}`, payload())
      if (poiPubblica) await api.post(`/admin/promozioni/${id}/pubblica`)
      setEditId(null)
      setOk(poiPubblica ? 'Promozione pubblicata: da ora è in bacheca.' : 'Salvata come bozza.')
      carica()
    } catch (err) {
      setErrore(err.dettagli?.length ? `${err.message} ${err.dettagli.map((d) => d.messaggio).join('; ')}` : err.message)
    }
  }

  async function azione(p, cosa) {
    const msg = { pubblica: 'Pubblicare la promozione? Sarà visibile ai clienti.', archivia: 'Archiviare? Non sarà più visibile né utilizzabile.', elimina: 'Eliminare la bozza?' }[cosa]
    if (!window.confirm(msg)) return
    setErrore(''); setOk('')
    try {
      if (cosa === 'elimina') await api.delete(`/admin/promozioni/${p.id}`)
      else await api.post(`/admin/promozioni/${p.id}/${cosa}`)
      carica()
    } catch (err) {
      setErrore(err.message)
    }
  }

  function toggleGiorno(v) {
    setForm((f) => ({
      ...f,
      giorniSettimana: f.giorniSettimana.includes(v) ? f.giorniSettimana.filter((g) => g !== v) : [...f.giorniSettimana, v],
    }))
  }

  const mostraValore = form.tipo === 'sconto_percentuale' || form.tipo === 'prezzo_fisso'
  const mostraProdotto = form.tipo === 'prezzo_fisso' || form.tipo === 'omaggio'

  return (
    <div className="card">
      <h2>Promozioni</h2>
      <p className="testo-secondario">
        Il cliente vede la promo in bacheca e la <strong>carica</strong> sulla tessera; alla cassa l'operatore vede solo le promo caricate e le segna usate.
      </p>
      {ok && <p className="messaggio-successo">{ok}</p>}
      {errore && <p className="messaggio-errore">{errore}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="tabella-admin">
          <thead>
            <tr><th>Titolo</th><th>Cosa</th><th>Validità</th><th>Destinatari</th><th>Stato</th><th>Caricata</th><th>Usata</th><th></th></tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} style={{ opacity: p.stato === 'archiviata' ? 0.55 : 1 }}>
                <td><strong>{p.titolo}</strong></td>
                <td>{etichettaTipo(p) ?? 'Messaggio'}</td>
                <td>{etichettaValidita(p)}</td>
                <td>{[p.livelloNome && `livello ${p.livelloNome}`, p.sedeNome].filter(Boolean).join(', ') || 'tutti'}</td>
                <td>{STATO[p.stato]}</td>
                <td>{p.caricamenti}</td>
                <td>{p.utilizzi}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {p.stato !== 'archiviata' && <button className="link-testo" onClick={() => apriModifica(p)}>Modifica</button>}
                  {p.stato === 'bozza' && <> · <button className="link-testo" onClick={() => azione(p, 'pubblica')}>Pubblica</button></>}
                  {p.stato === 'pubblicata' && <> · <button className="link-testo" onClick={() => azione(p, 'archivia')}>Archivia</button></>}
                  {p.stato === 'bozza' && !p.pubblicataIl && <> · <button className="link-testo" onClick={() => azione(p, 'elimina')}>Elimina</button></>}
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan={8} className="testo-secondario">Nessuna promozione ancora.</td></tr>}
          </tbody>
        </table>
      </div>

      {editId === null && (
        <button className="btn btn-secondario" style={{ marginTop: 14 }} onClick={apriNuova}>+ Nuova promozione</button>
      )}

      {editId !== null && (
        <form onSubmit={(e) => salva(e, false)} style={{ marginTop: 16, maxWidth: 640 }}>
          <div className="campo">
            <label htmlFor="titolo">Titolo</label>
            <input id="titolo" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} required maxLength={120} placeholder="es. Merenda d'autunno" />
          </div>
          <div className="campo">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPI.map((t) => <option key={t.valore} value={t.valore}>{t.etichetta}</option>)}
            </select>
          </div>
          {mostraProdotto && (
            <div className="campo">
              <label htmlFor="prodotto">Prodotto</label>
              <input id="prodotto" value={form.prodotto} onChange={(e) => setForm({ ...form, prodotto: e.target.value })} required placeholder="es. Cornetto alla crema" />
            </div>
          )}
          {mostraValore && (
            <div className="campo">
              <label htmlFor="valore">{form.tipo === 'sconto_percentuale' ? 'Sconto %' : 'Prezzo €'}</label>
              <input id="valore" type="number" step="any" min="0" value={form.valore} onChange={(e) => setForm({ ...form, valore: e.target.value })} required />
            </div>
          )}
          <div className="campo">
            <label htmlFor="descrizione">Descrizione (facoltativa, la legge il cliente)</label>
            <input id="descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} maxLength={1000} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="campo" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="dal">Valida dal</label>
              <input id="dal" type="date" value={form.validoDal} onChange={(e) => setForm({ ...form, validoDal: e.target.value })} required />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="al">al</label>
              <input id="al" type="date" value={form.validoAl} min={form.validoDal} onChange={(e) => setForm({ ...form, validoAl: e.target.value })} required />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="campo" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="oi">Solo dalle (facoltativo)</label>
              <input id="oi" type="time" value={form.oraInizio} onChange={(e) => setForm({ ...form, oraInizio: e.target.value })} />
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 140 }}>
              <label htmlFor="of">alle</label>
              <input id="of" type="time" value={form.oraFine} onChange={(e) => setForm({ ...form, oraFine: e.target.value })} />
            </div>
          </div>
          <div className="campo">
            <label>Giorni (nessuno selezionato = tutti)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {GIORNI.map((g) => (
                <label key={g.v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--colore-bordo)', borderRadius: 999, cursor: 'pointer', fontWeight: form.giorniSettimana.includes(g.v) ? 700 : 400 }}>
                  <input type="checkbox" checked={form.giorniSettimana.includes(g.v)} onChange={() => toggleGiorno(g.v)} style={{ margin: 0 }} />
                  {g.n}
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="campo" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="liv">Solo per il livello</label>
              <select id="liv" value={form.targetLivelloId} onChange={(e) => setForm({ ...form, targetLivelloId: e.target.value })}>
                <option value="">Tutti i livelli</option>
                {livelli.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div className="campo" style={{ flex: 1, minWidth: 160 }}>
              <label htmlFor="sede">Solo nella sede</label>
              <select id="sede" value={form.targetSedeId} onChange={(e) => setForm({ ...form, targetSedeId: e.target.value })}>
                <option value="">Tutte le sedi</option>
                {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>

          {form.tipo !== 'messaggio' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="campo" style={{ minWidth: 160 }}>
                <label htmlFor="usi">Usi per cliente</label>
                <input id="usi" type="number" min="1" value={form.usiPerCliente} disabled={form.usiIllimitati} onChange={(e) => setForm({ ...form, usiPerCliente: e.target.value })} />
              </div>
              <div className="campo-checkbox">
                <input id="illim" type="checkbox" checked={form.usiIllimitati} onChange={(e) => setForm({ ...form, usiIllimitati: e.target.checked })} />
                <label htmlFor="illim">Illimitati nel periodo</label>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            <button className="btn btn-primario" type="button" onClick={(e) => salva(e, true)}>
              {editId === 'nuova' ? 'Salva e pubblica' : 'Salva e pubblica'}
            </button>
            <button className="btn btn-secondario" type="submit">Salva come bozza</button>
            <button className="btn btn-secondario" type="button" onClick={() => setEditId(null)}>Annulla</button>
          </div>
        </form>
      )}
    </div>
  )
}
