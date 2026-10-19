import { Routes, Route } from 'react-router-dom'
import ClienteApp from './pages/cliente/ClienteApp.jsx'
import OperatoreApp from './pages/operatore/OperatoreApp.jsx'
import AdminApp from './pages/admin/AdminApp.jsx'
import Installa from './pages/cliente/Installa.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/operatore/*" element={<OperatoreApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      {/* Atterraggio del QR al banco: prima l'icona sulla Home, poi la tessera. */}
      <Route path="/installa" element={<Installa />} />
      <Route path="/*" element={<ClienteApp />} />
    </Routes>
  )
}
