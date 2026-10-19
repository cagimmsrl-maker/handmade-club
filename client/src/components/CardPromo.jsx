import { etichettaTipo, etichettaValidita } from '../lib/promo.js'

// Scheda di una promozione, usata in bacheca cliente e (compatta) dall'operatore.

export default function CardPromo({ promo, azione, azioneTesto, inCorso, compatta = false }) {
  const tipo = etichettaTipo(promo)
  return (
    <div className={`card${promo.immagine && !compatta ? ' card-con-foto' : ''}`} style={{ borderLeft: promo.caricata ? '4px solid var(--colore-primario)' : undefined }}>
      {promo.immagine && !compatta && <img className="promo-foto" src={promo.immagine} alt="" loading="lazy" />}
      <h3 style={{ margin: '0 0 4px', fontSize: compatta ? '1.1rem' : '1.2rem' }}>{promo.titolo}</h3>
      {tipo && <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{tipo}</p>}
      {promo.descrizione && !compatta && <p style={{ margin: '0 0 6px' }}>{promo.descrizione}</p>}
      <p className="testo-secondario" style={{ margin: 0 }}>{etichettaValidita(promo)}</p>
      {promo.usiPerCliente != null && !compatta && (
        <p className="testo-secondario" style={{ margin: '4px 0 0' }}>
          {promo.usiPerCliente === 1 ? 'Utilizzabile una volta' : `Utilizzabile ${promo.usiPerCliente} volte`}
          {promo.caricata && promo.usi > 0 ? ` · usata ${promo.usi}` : ''}
        </p>
      )}
      {azione && (
        <button className="btn btn-primario" style={{ marginTop: 12 }} onClick={azione} disabled={inCorso}>
          {inCorso ? '…' : azioneTesto}
        </button>
      )}
    </div>
  )
}
