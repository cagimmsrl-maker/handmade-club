import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import Login from './Login.jsx'
import Scanner from './Scanner.jsx'

export default function OperatoreApp() {
  const [sede, setSede] = useState(null)
  const [stato, setStato] = useState('caricamento') // caricamento | login | scansione

  useEffect(() => {
    api
      .get('/operatore/sessione')
      .then((dati) => {
        setSede(dati.sede)
        setStato('scansione')
      })
      .catch(() => setStato('login'))
  }, [])

  async function esci() {
    await api.post('/operatore/logout')
    setSede(null)
    setStato('login')
  }

  if (stato === 'caricamento') {
    return <div className="schermo"><p className="testo-secondario">Caricamento...</p></div>
  }

  if (stato === 'login') {
    return (
      <Login
        onAutenticato={(sedeAutenticata) => {
          setSede(sedeAutenticata)
          setStato('scansione')
        }}
      />
    )
  }

  return (
    <>
      <Scanner sede={sede} />
      <div className="schermo" style={{ paddingTop: 0 }}>
        <button className="link-testo" onClick={esci}>Cambia sede / esci</button>
      </div>
    </>
  )
}
