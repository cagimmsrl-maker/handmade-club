import { QRCodeSVG } from 'qrcode.react'

// QR statico della tessera: il contenuto è tessere.codice_qr, sempre lo
// stesso, così le casse lo leggono come un normale codice a barre. Ha
// sostituito il token rotante (vedi migrazione 003 e CLAUDE.md).
export default function QrStatico({ codiceQr, codiceTessera }) {
  if (!codiceQr) return <div style={{ width: 220, height: 220 }} />

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
        <QRCodeSVG value={codiceQr} size={220} level="M" />
      </div>
      <p style={{ marginTop: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.12em', fontSize: '1.05rem' }}>
        {codiceQr.replace(/(.{4})/g, '$1 ').trim()}
      </p>
      {codiceTessera && <p className="testo-secondario">Tessera {codiceTessera}</p>}
      <p className="testo-secondario" style={{ fontSize: '0.8rem' }}>
        Mostra questo codice alla cassa. Vale anche come screenshot o stampato.
      </p>
    </div>
  )
}
