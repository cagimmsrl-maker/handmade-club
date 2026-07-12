import { api } from '../../api.js'
import CrudSemplice from '../../components/CrudSemplice.jsx'

const campi = [
  { chiave: 'nome', colonnaDb: 'nome', etichetta: 'Nome sede', tipo: 'testo', obbligatorio: true },
  { chiave: 'indirizzo', colonnaDb: 'indirizzo', etichetta: 'Indirizzo', tipo: 'testo' },
  { chiave: 'pinOperatore', colonnaDb: 'pin_operatore', etichetta: 'PIN operatore', tipo: 'testo', obbligatorio: true },
  { chiave: 'attiva', colonnaDb: 'attiva', etichetta: 'Attiva', tipo: 'checkbox' },
]

const valoriIniziali = { nome: '', indirizzo: '', pinOperatore: '', attiva: true }

export default function Sedi() {
  return (
    <CrudSemplice
      titolo="Sedi"
      campi={campi}
      valoriIniziali={valoriIniziali}
      api={{
        lista: () => api.get('/admin/sedi'),
        crea: (dati) => api.post('/admin/sedi', dati),
        aggiorna: (id, dati) => api.put(`/admin/sedi/${id}`, dati),
        elimina: (id) => api.delete(`/admin/sedi/${id}`),
      }}
    />
  )
}
