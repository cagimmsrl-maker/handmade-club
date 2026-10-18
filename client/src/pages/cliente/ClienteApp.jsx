import { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../../api.js'
import Onboarding from './Onboarding.jsx'
import Home from './Home.jsx'
import Profilo from './Profilo.jsx'
import Promozioni from './Promozioni.jsx'

export default function ClienteApp() {
  const [stato, setStato] = useState('caricamento') // caricamento | onboarding | autenticato
  const location = useLocation()
  const navigate = useNavigate()

  function verificaSessione() {
    api
      .get('/cliente/me')
      .then(() => setStato('autenticato'))
      .catch(() => setStato('onboarding'))
  }

  useEffect(verificaSessione, [])

  if (stato === 'caricamento') {
    return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>
  }

  if (stato === 'onboarding') {
    return <Onboarding onCompletato={() => { setStato('autenticato'); navigate('/') }} />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/promozioni" element={<Promozioni />} />
        <Route
          path="/profilo"
          element={<Profilo onAccountCancellato={() => { setStato('onboarding'); navigate('/') }} />}
        />
      </Routes>
      <nav className="tab-bar">
        <Link to="/" className={location.pathname === '/' ? 'attivo' : ''}>Tessera</Link>
        <Link to="/promozioni" className={location.pathname === '/promozioni' ? 'attivo' : ''}>Promo</Link>
        <Link to="/profilo" className={location.pathname === '/profilo' ? 'attivo' : ''}>Profilo</Link>
      </nav>
    </>
  )
}
