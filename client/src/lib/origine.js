// Canale di acquisizione (migrazione 015). Il link stampato o pubblicato
// porta ?da=<canale> (es. /installa?da=instagram): lo leggiamo alla prima
// apertura, lo teniamo in localStorage (best effort) e lo mandiamo con la
// registrazione. Senza parametro il server salva NULL = banco.
// Limite noto: su iPhone l'app aggiunta alla Home ha uno storage separato
// da Safari, quindi il canale si perde se la tessera viene creata dentro
// l'app installata; per Android e per chi si registra nel browser regge.

const CHIAVE = 'hc_origine'
const VALIDO = /^[a-z0-9_-]{1,40}$/

export function ricordaOrigineDaUrl() {
  try {
    const da = new URLSearchParams(window.location.search).get('da')
    if (!da) return
    const v = da.trim().toLowerCase()
    if (VALIDO.test(v)) window.localStorage.setItem(CHIAVE, v)
  } catch { /* storage non disponibile */ }
}

export function origineRicordata() {
  try {
    const v = window.localStorage.getItem(CHIAVE) || ''
    return VALIDO.test(v) ? v : undefined
  } catch { return undefined }
}

export function dimenticaOrigine() {
  try { window.localStorage.removeItem(CHIAVE) } catch { /* pazienza */ }
}
