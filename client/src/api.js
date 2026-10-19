const BASE = '/api';

class ErroreApi extends Error {
  constructor(status, message, dettagli) {
    super(message);
    this.status = status;
    this.dettagli = dettagli;
  }
}

async function richiesta(metodo, percorso, corpo) {
  // Un FormData (upload di file) va mandato così com'è: il browser mette
  // da solo il Content-Type multipart con il boundary.
  const multipart = typeof FormData !== 'undefined' && corpo instanceof FormData;
  const risposta = await fetch(`${BASE}${percorso}`, {
    method: metodo,
    credentials: 'include',
    headers: corpo !== undefined && !multipart ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo === undefined ? undefined : (multipart ? corpo : JSON.stringify(corpo)),
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
  // Upload di un file: `campo` è il nome del campo multipart atteso dal server.
  upload: (percorso, campo, blob, nomeFile = 'foto.jpg') => {
    const fd = new FormData()
    fd.append(campo, blob, nomeFile)
    return richiesta('POST', percorso, fd)
  },
};

export { ErroreApi };
