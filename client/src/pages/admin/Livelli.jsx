import { api } from '../../api.js'
import CrudSemplice from '../../components/CrudSemplice.jsx'

const campi = [
  { chiave: 'nome', colonnaDb: 'nome', etichetta: 'Nome', tipo: 'testo', obbligatorio: true },
  { chiave: 'sogliaVisite', colonnaDb: 'soglia_visite', etichetta: 'Soglia visite', tipo: 'numero', obbligatorio: true },
  { chiave: 'scontoPercentuale', colonnaDb: 'sconto_percentuale', etichetta: 'Sconto %', tipo: 'numero', obbligatorio: true },
  { chiave: 'colore', colonnaDb: 'colore', etichetta: 'Colore (hex)', tipo: 'testo' },
  { chiave: 'ordine', colonnaDb: 'ordine', etichetta: 'Ordine', tipo: 'numero', obbligatorio: true },
  { chiave: 'attivo', colonnaDb: 'attivo', etichetta: 'Attivo', tipo: 'checkbox' },
]

const valoriIniziali = { nome: '', sogliaVisite: 0, scontoPercentuale: 0, colore: '#8B8B8B', ordine: 1, attivo: true }

export default function Livelli() {
  return (
    <CrudSemplice
      titolo="Livelli"
      campi={campi}
      valoriIniziali={valoriIniziali}
      api={{
        lista: () => api.get('/admin/livelli'),
        crea: (dati) => api.post('/admin/livelli', dati),
        aggiorna: (id, dati) => api.put(`/admin/livelli/${id}`, dati),
        elimina: (id) => api.delete(`/admin/livelli/${id}`),
      }}
    />
  )
}
