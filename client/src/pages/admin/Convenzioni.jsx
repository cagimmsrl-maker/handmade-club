import { api } from '../../api.js'
import CrudSemplice from '../../components/CrudSemplice.jsx'

const campi = [
  { chiave: 'nome', colonnaDb: 'nome', etichetta: 'Nome azienda', tipo: 'testo', obbligatorio: true },
  { chiave: 'codiceAdesione', colonnaDb: 'codice_adesione', etichetta: 'Codice adesione', tipo: 'testo', obbligatorio: true },
  { chiave: 'scontoPercentuale', colonnaDb: 'sconto_percentuale', etichetta: 'Sconto %', tipo: 'numero', obbligatorio: true },
  { chiave: 'note', colonnaDb: 'note', etichetta: 'Note', tipo: 'testo' },
  { chiave: 'attiva', colonnaDb: 'attiva', etichetta: 'Attiva', tipo: 'checkbox' },
]

const valoriIniziali = { nome: '', codiceAdesione: '', scontoPercentuale: 0, note: '', attiva: true }

export default function Convenzioni() {
  return (
    <CrudSemplice
      titolo="Convenzioni"
      campi={campi}
      valoriIniziali={valoriIniziali}
      api={{
        lista: () => api.get('/admin/convenzioni'),
        crea: (dati) => api.post('/admin/convenzioni', dati),
        aggiorna: (id, dati) => api.put(`/admin/convenzioni/${id}`, dati),
        elimina: (id) => api.delete(`/admin/convenzioni/${id}`),
      }}
    />
  )
}
