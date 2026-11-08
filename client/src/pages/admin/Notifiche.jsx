import { useEffect, useState } from 'react'
import { api } from '../../api.js'

// Notifiche push (migrazione 014): invio a tutti i clienti con consenso
// marketing e telefono iscritto, con anteprima del numero di destinatari e
// storico degli invii. Il server ricontrolla il consenso al momento dell'invio.

export default function Notifiche() {
  const [riepilogo, setRiepilogo] = useState(null)
  const [storico, setStorico] = useState([])
  const [livelli, setLivelli] = useState([])
  const [sedi, setSedi] = useState([])
  const [form, setForm] = useState({ titolo: '', testo: '', url: '/promozioni', livelloId: '', sedeId: '' })
  const [conteggio, setConteggio] = useState(null)
  const [invio, setInvio] = useState(false)
  const [esito, setEsito] = useState('')
  const [errore, setErrore] = useState('')

  function carica() {
    api.get('/admin/notifiche').then((d) => { setRiepilogo(d.riepilogo); setStorico(d.storico) }).catch((e) => setErrore(e.message))
  }
  useEffect(() => {
    carica()
    api.get('/admin/livelli').then(setLivelli).catch(() => {})
    api.get('/admin/sedi').then(setSedi).catch(() => {})
  }, [])

  // Anteprima destinatari quando cambia il filtro.
  useEffect(() => {
    const q = new URLSearchParams()
    if (form.livelloId) q.set('livelloId', form.livelloId)
    if (form.sedeId) q.set('sedeId', form.sedeId)
    api.get(`/admin/notifiche/destinatari?${q}`).then(setConteggio).catch(() => setConteggio(null))
  }, [form.livelloId, form.sedeId])

  async function invia(e) {
    e.preventDefault()
    setErrore(''); setEsito('')
    if (!conteggio || conteggio.telefoni === 0) { setErrore('Nessun telefono iscritto per questi destinatari: la notifica non raggiungerebbe nessuno.'); return }
    if (!window.confirm(`Inviare la notifica a ${conteggio.clienti} clienti (${conteggio.telefoni} telefoni)?`)) return
    setInvio(true)
    try {
      const r = await api.post('/admin/notifiche', {
        titolo: form.titolo.trim(),
        testo: form.testo.trim(),
        url: form.url.trim() || null,
        livelloId: form.livelloId ? Number(form.livelloId) : null,
        sedeId: form.sedeId ? Number(form.sedeId) : null,
      })
      setEsito(`Inviata: ${r.consegnate} consegnate su ${r.inviate} telefoni (${r.destinatari} clienti)${r.fallite ? `, ${r.fallite} fallite` : ''}${r.rimosse ? `, ${r.rimosse} telefoni non più raggiungibili rimossi` : ''}.`)
      setForm((f) => ({ ...f, titolo: '', testo: '' }))
      carica()
    } catch (err) {
      setErrore(err.message)
    }
    setInvio(false)
  }

  const spente = riepilogo && !riepilogo.attivo

  return (
    <>
      <div className="card">
        <h2>Notifiche push</h2>
        {spente && <p className="messaggio-errore">Le notifiche non sono configurate sul server (chiavi VAPID mancanti nel .env).</p>}
        {riepilogo && (
          <p className="testo-secondario">
            Telefoni iscritti: <strong>{riepilogo.telefoni}</strong> ({riepilogo.clientiIscritti} clienti) ·
            raggiungibili con consenso marketing: <strong>{riepilogo.raggiungibili.clienti}</strong> clienti, {riepilogo.raggiungibili.telefoni} telefoni.
            I clienti attivano le notifiche dall'app (banner in Home o dal Profilo).
          </p>
        )}
        <form onSubmit={invia}>
          <div className="campo">
            <label>Titolo <span className="testo-secondario">(max 60)</span></label>
            <input value={form.titolo} maxLength={60} required onChange={(e) => setForm({ ...form, titolo: e.target.value })} placeholder="Es. La −15% continua fino al 30 novembre" />
          </div>
          <div className="campo">
            <label>Testo <span className="testo-secondario">(max 200)</span></label>
            <textarea value={form.testo} maxLength={200} required rows={3} onChange={(e) => setForm({ ...form, testo: e.target.value })} placeholder="Es. Mostra la tessera in cassa a Fiano Romano: 15% di sconto su tutto fino a fine mese." />
          </div>
          <div className="campo">
            <label>Apre la pagina</label>
            <select value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}>
              <option value="/promozioni">Promozioni</option>
              <option value="/">Tessera</option>
              <option value="/profilo">Profilo</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div className="campo" style={{ flex: 1 }}>
              <label>Solo livello</label>
              <select value={form.livelloId} onChange={(e) => setForm({ ...form, livelloId: e.target.value })}>
                <option value="">Tutti</option>
                {livelli.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </div>
            <div className="campo" style={{ flex: 1 }}>
              <label>Solo clienti della sede</label>
              <select value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })}>
                <option value="">Tutte</option>
                {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
          </div>
          <p className="testo-secondario">
            {conteggio ? <>Destinatari: <strong>{conteggio.clienti}</strong> clienti, <strong>{conteggio.telefoni}</strong> telefoni (solo con consenso marketing).</> : 'Calcolo destinatari…'}
          </p>
          {errore && <p className="messaggio-errore">{errore}</p>}
          {esito && <p className="messaggio-successo">{esito}</p>}
          <button className="btn btn-primario" type="submit" disabled={invio || spente}>{invio ? 'Invio in corso…' : 'Invia notifica'}</button>
        </form>
      </div>

      <div className="card">
        <h2>Contatti per WhatsApp / SMS</h2>
        <p className="testo-secondario">
          Elenco dei clienti che hanno dato il <strong>consenso marketing</strong> (nome, cognome, telefono), in CSV. Solo loro si possono contattare;
          nel messaggio ricorda sempre come smettere di riceverli (es. "rispondi STOP").
        </p>
        <a className="btn btn-secondario" href="/api/admin/clienti/export-marketing.csv" download>Scarica elenco (CSV)</a>
      </div>

      <div className="card">
        <h2>Invii</h2>
        {storico.length === 0 ? <p className="testo-secondario">Nessuna notifica inviata finora.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tabella-admin">
              <thead><tr><th>Quando</th><th>Titolo</th><th>Testo</th><th>Clienti</th><th>Consegnate</th><th>Fallite</th></tr></thead>
              <tbody>
                {storico.map((n) => (
                  <tr key={n.id}>
                    <td>{new Date(n.createdAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{n.titolo}</td>
                    <td className="testo-secondario">{n.testo}</td>
                    <td>{n.destinatari}</td>
                    <td>{n.consegnate} / {n.inviate}</td>
                    <td>{n.fallite}{n.rimosse ? ` (+${n.rimosse} rimossi)` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
