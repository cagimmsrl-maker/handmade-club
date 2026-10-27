import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

// Codice a barre EAN-13 della tessera (stesso numero del QR). Serve alle
// casse con lettore laser 1D, che non leggono i QR. Disegnato in SVG, su
// fondo bianco, con le cifre sotto come su una tessera vera.
export default function CodiceBarre({ codice }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !codice) return
    try {
      JsBarcode(ref.current, codice, {
        format: /^\d{13}$/.test(codice) ? 'EAN13' : 'CODE128',
        width: 2, height: 56, displayValue: true, fontSize: 14, margin: 6,
        background: '#ffffff', lineColor: '#1E1A17',
      })
    } catch { /* codice non rappresentabile: resta vuoto */ }
  }, [codice])
  if (!codice) return null
  return <svg ref={ref} className="tessera-barcode" role="img" aria-label={`Codice tessera ${codice}`} />
}
