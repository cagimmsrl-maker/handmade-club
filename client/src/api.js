const BASE = '/api';

class ErroreApi extends Error {
  constructor(status, message, dettagli) {
    super(message);
    this.status = status;
    this.dettagli = dettagli;
  }
}

async function richiesta(metodo, percorso, corpo) {
  const risposta = await fetch(`${BASE}${percorso}`, {
    method: metodo,
    credentials: 'include',
    headers: corpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });

  const testo = await risposta.text();
  const dati = testo ? JSON.parse(testo) : null;

  if (!risposta.ok) {
    throw new ErroreApi(risposta.status, dati?.errore || 'Errore imprevisto.', dati?.dettagli);
  }
  return dati;
}

export const api = {
  get: (percorso) => richiesta('GET', percorso),
  post: (percorso, corpo) => richiesta('POST', percorso, corpo ?? {}),
  put: (percorso, corpo) => richiesta('PUT', percorso, corpo ?? {}),
  delete: (percorso) => richiesta('DELETE', percorso),
};

export { ErroreApi };
