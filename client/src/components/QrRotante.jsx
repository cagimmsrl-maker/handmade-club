import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { api } from '../api.js'

const ROTAZIONE_SECONDI = 60

export default function QrRotante() {
  const [token, setToken] = useState(null)
  const [secondiRimasti, setSecondiRimasti] = useState(ROTAZIONE_SECONDI)
  const [errore, setErrore] = useState('')
  const timerRotazione = useRef(null)
  const timerCountdown = useRef(null)

  async function aggiornaToken() {
    try {
      const dati = await api.get('/cliente/qr-token')
      setToken(dati.token)
      setSecondiRimasti(ROTAZIONE_SECONDI)
      setErrore('')
    } catch {
      setErrore('Impossibile generare il QR. Verifica la connessione.')
    }
  }

  useEffect(() => {
    aggiornaToken()
    timerRotazione.current = setInterval(aggiornaToken, ROTAZIONE_SECONDI * 1000)
    timerCountdown.current = setInterval(() => {
      setSecondiRimasti((s) => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => {
      clearInterval(timerRotazione.current)
      clearInterval(timerCountdown.current)
    }
  }, [])

  const percentuale = Math.round((secondiRimasti / ROTAZIONE_SECONDI) * 100)

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          background: 'white',
          padding: 16,
          borderRadius: 12,
          display: 'inline-block',
          border: '1px solid var(--colore-bordo)',
        }}
      >
        {token ? (
          <QRCodeSVG value={token} size={200} />
        ) : (
          <div style={{ width: 200, height: 200 }} />
        )}
      </div>
      {errore && <p className="messaggio-errore">{errore}</p>}
      <div
        style={{
          height: 6,
          background: 'var(--colore-bordo)',
          borderRadius: 999,
          marginTop: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentuale}%`,
            background: 'var(--colore-primario)',
            transition: 'width 1s linear',
          }}
        />
      </div>
      <p className="testo-secondario">Il codice si aggiorna tra {secondiRimasti}s</p>
    </div>
  )
}
