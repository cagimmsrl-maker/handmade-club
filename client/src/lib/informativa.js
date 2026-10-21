// Informativa privacy di Handmade Club (art. 13 GDPR). Un solo posto per
// il testo: la pagina /privacy lo mostra e lo scarica come file. Quando
// cambia il testo, cambiare VERSIONE qui e INFORMATIVA_VERSIONE in
// server/config/privacy.js (è la versione salvata con il consenso).

export const VERSIONE = '2026-10-21'

export const TITOLARE = {
  ragioneSociale: 'CAR FOOD S.r.l.',
  sede: 'Perugia (PG)',
  partitaIva: '03560870549',
  email: 'privacy@handmadecafe.it',
}

export const SEZIONI = [
  {
    titolo: 'Chi tratta i tuoi dati',
    testo: [
      `Il titolare del trattamento è ${TITOLARE.ragioneSociale}, con sede in ${TITOLARE.sede}, P. IVA ${TITOLARE.partitaIva}, che gestisce i locali Handmade Café. Per qualsiasi domanda o per esercitare i tuoi diritti scrivi a ${TITOLARE.email}.`,
    ],
  },
  {
    titolo: 'Quali dati raccogliamo',
    testo: [
      'Alla registrazione: nome e numero di telefono (obbligatori); cognome, email e data di nascita (facoltativi).',
      'Durante l\'uso: le visite registrate alla cassa quando mostri la tessera (data, ora e locale), il livello raggiunto, l\'eventuale convenzione attivata, le promozioni che carichi e quelle che usi.',
      'Dati tecnici: il cookie di sessione che ti tiene collegato, e l\'indirizzo IP nei log del server per sicurezza (protezione da abusi), conservato per un periodo limitato e poi eliminato.',
      'Non raccogliamo la tua posizione, non leggiamo la rubrica e non usiamo cookie di profilazione o di terze parti.',
    ],
  },
  {
    titolo: 'Perché li usiamo',
    testo: [
      'Per gestire la tessera fedeltà: riconoscerti alla cassa, contare le visite, calcolare il livello e lo sconto, applicare le promozioni che hai caricato. Base giuridica: il contratto con te (art. 6.1.b GDPR), cioè il programma fedeltà a cui ti iscrivi.',
      'Per verificare che il numero di telefono sia tuo, con un codice via SMS (quando carichi una promozione o accedi da un nuovo telefono).',
      'Per inviarti promozioni e novità (SMS, notifiche nell\'app, email se l\'hai indicata): solo se dai il consenso marketing, che è facoltativo, separato e revocabile in ogni momento dal tuo profilo (art. 6.1.a GDPR).',
      'La data di nascita, se la inserisci, serve solo per eventuali promozioni di compleanno.',
      'Non prendiamo decisioni automatizzate che producano effetti giuridici su di te. Il livello della tessera si calcola solo dal numero di visite.',
    ],
  },
  {
    titolo: 'A chi li comunichiamo',
    testo: [
      'Al personale dei locali Handmade Café, che alla cassa vede nome, livello, convenzione e promozioni caricate.',
      'A fornitori che lavorano per noi come responsabili del trattamento: Aruba S.p.A. (server in Italia, dove risiede l\'app), Skebby (invio degli SMS con il codice di verifica).',
      'In futuro, al sistema di cassa dei locali (TGS) per applicare gli sconti automaticamente, e ad Apple o Google se sceglierai di aggiungere la tessera al Wallet del telefono: in quel caso aggiorneremo questa informativa.',
      'Nessun dato viene venduto o ceduto a terzi per finalità loro. Non trasferiamo dati fuori dall\'Unione Europea.',
    ],
  },
  {
    titolo: 'Per quanto tempo',
    testo: [
      'Finché la tessera è attiva. Se non la usi per 24 mesi, oppure se cancelli l\'account, i tuoi dati personali vengono anonimizzati: restano solo conteggi statistici non riconducibili a te.',
      'I codici di verifica SMS vengono eliminati dopo l\'uso o la scadenza (5 minuti).',
    ],
  },
  {
    titolo: 'I tuoi diritti',
    testo: [
      'Puoi in ogni momento: accedere ai tuoi dati e scaricarne una copia (dal profilo, "Scarica i miei dati"); correggerli (dal profilo); revocare il consenso marketing (dal profilo); cancellare l\'account (dal profilo, "Cancella il mio account"); chiedere la limitazione del trattamento o opporti; proporre reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).',
      `Per qualsiasi richiesta scrivi a ${TITOLARE.email}: rispondiamo entro 30 giorni.`,
    ],
  },
  {
    titolo: 'Minori',
    testo: [
      'Il programma fedeltà è riservato a chi ha almeno 14 anni. Se risultasse registrato un minore di 14 anni, cancelleremo i dati appena ne avremo notizia.',
    ],
  },
  {
    titolo: 'Modifiche',
    testo: [
      `Questa è la versione del ${VERSIONE}. Se l'informativa cambia in modo rilevante te lo comunichiamo nell'app. Alla registrazione viene salvata la versione che hai accettato.`,
    ],
  },
]

export function informativaTesto() {
  const righe = [
    `INFORMATIVA PRIVACY — HANDMADE CLUB (versione ${VERSIONE})`,
    `Titolare: ${TITOLARE.ragioneSociale}, ${TITOLARE.sede}, P. IVA ${TITOLARE.partitaIva} — ${TITOLARE.email}`,
    '',
  ]
  for (const s of SEZIONI) {
    righe.push(s.titolo.toUpperCase())
    for (const t of s.testo) righe.push(`- ${t}`)
    righe.push('')
  }
  return righe.join('\n')
}
