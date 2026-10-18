import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { api } from '../../api.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import Livelli from './Livelli.jsx'
import Convenzioni from './Convenzioni.jsx'
import Sedi from './Sedi.jsx'
import Parametri from './Parametri.jsx'
import Clienti from './Clienti.jsx'
import Promozioni from './Promozioni.jsx'

const VOCI_MENU = [
  { percorso: '/admin', etichetta: 'Dashboard' },
  { percorso: '/admin/livelli', etichetta: 'Livelli' },
  { percorso: '/admin/promozioni', etichetta: 'Promozioni' },
  { percorso: '/admin/convenzioni', etichetta: 'Convenzioni' },
  { percorso: '/admin/sedi', etichetta: 'Sedi' },
  { percorso: '/admin/parametri', etichetta: 'Parametri' },
  { percorso: '/admin/clienti', etichetta: 'Clienti' },
]

export default function AdminApp() {
  const [stato, setStato] = useState('caricamento') // caricamento | login | autenticato
  const [admin, setAdmin] = useState(null)
  const location = useLocation()

  useEffect(() => {
    api
      .get('/admin/sessione')
      .then((dati) => { setAdmin(dati); setStato('autenticato') })
      .catch(() => setStato('login'))
  }, [])

  async function esci() {
    await api.post('/admin/logout')
    setAdmin(null)
    setStato('login')
  }

  if (stato === 'caricamento') {
    return <div className="schermo schermo-larga"><p className="testo-secondario">Caricamento...</p></div>
  }

  if (stato === 'login') {
    return <Login onAutenticato={(dati) => { setAdmin(dati); setStato('autenticato') }} />
  }

  return (
    <div className="schermo schermo-larga">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Handmade Club — Admin</h1>
        <div>
          <span className="testo-secondario">{admin?.nome}</span>{' '}
          <button className="link-testo" onClick={esci}>Esci</button>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        {VOCI_MENU.map((v) => (
          <Link
            key={v.percorso}
            to={v.percorso}
            className={location.pathname === v.percorso ? 'attivo' : ''}
            style={{ fontWeight: location.pathname === v.percorso ? 700 : 400 }}
          >
            {v.etichetta}
          </Link>
        ))}
      </nav>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/livelli" element={<Livelli />} />
        <Route path="/promozioni" element={<Promozioni />} />
        <Route path="/convenzioni" element={<Convenzioni />} />
        <Route path="/sedi" element={<Sedi />} />
        <Route path="/parametri" element={<Parametri />} />
        <Route path="/clienti" element={<Clienti />} />
      </Routes>
    </div>
  )
}
