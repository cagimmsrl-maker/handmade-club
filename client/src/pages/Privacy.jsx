import { useNavigate } from 'react-router-dom'
import { SEZIONI, TITOLARE, VERSIONE, informativaTesto } from '../lib/informativa.js'

// Informativa privacy, pubblica (raggiungibile prima della registrazione).
export default function Privacy() {
  const navigate = useNavigate()

  function scarica() {
    const blob = new Blob([informativaTesto()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informativa-privacy-handmade-club-${VERSIONE}.txt`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="schermo privacy">
      <button type="button" className="link-testo" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
        ‹ Indietro
      </button>
      <div className="onboarding-hero" style={{ paddingTop: 6 }}>
        <img src="/brand/logo.png" alt="Handmade Café" />
      </div>
      <h1>Informativa privacy</h1>
      <p className="testo-secondario" style={{ marginTop: 0 }}>
        Handmade Club · versione del {VERSIONE}
      </p>
      <p>
        Qui trovi, in parole semplici, quali dati usiamo per la tessera fedeltà, perché, per quanto tempo e come puoi gestirli. È l'informativa prevista dall'art. 13 del Regolamento (UE) 2016/679 (GDPR).
      </p>

      {SEZIONI.map((s) => (
        <section key={s.titolo} className="card">
          <h2>{s.titolo}</h2>
          {s.testo.map((t, i) => <p key={i}>{t}</p>)}
        </section>
      ))}

      <p className="testo-secondario">
        {TITOLARE.ragioneSociale} · P. IVA {TITOLARE.partitaIva} · <a href={`mailto:${TITOLARE.email}`}>{TITOLARE.email}</a>
      </p>
      <button className="btn btn-secondario" onClick={scarica}>Scarica l'informativa (testo)</button>
    </div>
  )
}
