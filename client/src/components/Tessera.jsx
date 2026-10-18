import { QRCodeSVG } from 'qrcode.react'

// La tessera fedeltà come la vede il cliente: card scura con il logo, il
// livello, il QR statico (tessere.codice_qr) e il codice umano. Il QR è
// su fondo bianco per essere letto dalle casse anche con schermo scuro.
export default function Tessera({ nome, codiceQr, codiceTessera, livello, visite }) {
  return (
    <div className="card tessera" style={{ textAlign: 'center' }}>
      <div className="tessera-intestazione">
        <img src="/brand/logo-chiaro.png" alt="Handmade Café" />
        {livello && (
          <span className="tessera-livello" style={livello.colore ? { borderColor: livello.colore, color: '#fff', background: `${livello.colore}33` } : undefined}>
            {livello.nome}{livello.scontoPercentuale > 0 ? ` · -${livello.scontoPercentuale}%` : ''}
          </span>
        )}
      </div>

      {codiceQr ? (
        <div className="tessera-qr">
          <QRCodeSVG value={codiceQr} size={196} level="M" />
        </div>
      ) : (
        <div className="tessera-qr" style={{ width: 224, height: 224 }} />
      )}

      {codiceQr && <p className="tessera-codice">{codiceQr.replace(/(.{4})/g, '$1 ').trim()}</p>}
      <p className="tessera-nota">Mostra il codice alla cassa</p>

      <div className="tessera-piede">
        <span><strong>{nome}</strong></span>
        <span>{codiceTessera}{visite != null ? ` · ${visite} ${visite === 1 ? 'visita' : 'visite'}` : ''}</span>
      </div>
    </div>
  )
}
