import { Routes, Route } from 'react-router-dom'
import ClienteApp from './pages/cliente/ClienteApp.jsx'
import OperatoreApp from './pages/operatore/OperatoreApp.jsx'
import AdminApp from './pages/admin/AdminApp.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/operatore/*" element={<OperatoreApp />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="/*" element={<ClienteApp />} />
    </Routes>
  )
}
