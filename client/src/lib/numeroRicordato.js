// Il numero di telefono della tessera, ricordato sul telefono (20/11/2026).
// Serve solo a non farlo riscrivere a chi deve rientrare (sessione scaduta):
// la schermata di accesso lo ripropone già compilato. Resta nel browser del
// cliente (localStorage, best effort), non dà accesso a nulla da solo.
const CHIAVE = 'hc_mio_numero'

export function ricordaNumero(telefono) {
  if (!telefono) return
  try { window.localStorage.setItem(CHIAVE, String(telefono)) } catch { /* pazienza */ }
}

export function numeroRicordato() {
  try { return window.localStorage.getItem(CHIAVE) || '' } catch { return '' }
}

export function dimenticaNumero() {
  try { window.localStorage.removeItem(CHIAVE) } catch { /* pazienza */ }
}
