// Etichette testuali delle promozioni, condivise da cliente, operatore e admin.

const GIORNI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

export function etichettaTipo(p) {
  switch (p.tipo) {
    case 'sconto_percentuale': return `-${formatNumero(p.valore)}% sullo scontrino`
    case 'prezzo_fisso': return `${p.prodotto} a € ${formatNumero(p.valore)}`
    case 'omaggio': return `${p.prodotto} in omaggio`
    default: return null
  }
}

export function etichettaValidita(p) {
  const parti = []
  const dal = formatData(p.validoDal)
  const al = formatData(p.validoAl)
  parti.push(dal === al ? `il ${dal}` : `dal ${dal} al ${al}`)
  if (p.giorniSettimana && p.giorniSettimana.length > 0 && p.giorniSettimana.length < 7) {
    parti.push(p.giorniSettimana.map((g) => GIORNI[g]).join(', '))
  }
  if (p.oraInizio && p.oraFine) parti.push(`${p.oraInizio}–${p.oraFine}`)
  if (p.sedeNome) parti.push(`solo ${p.sedeNome}`)
  return parti.join(' · ')
}

function formatData(iso) {
  const [a, m, g] = String(iso).slice(0, 10).split('-')
  return `${g}/${m}/${a}`
}
function formatNumero(n) {
  if (n == null) return ''
  return Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2).replace('.', ',')
}
