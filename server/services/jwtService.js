const jwt = require('jsonwebtoken');

const DURATA_SESSIONE = {
  cliente: '30d',
  operatore: '24h',
  admin: '12h',
};

const NOME_COOKIE = {
  cliente: 'hc_cliente',
  operatore: 'hc_operatore',
  admin: 'hc_admin',
};

function creaTokenSessione(ruolo, payload) {
  return jwt.sign({ ...payload, ruolo }, process.env.JWT_SESSION_SECRET, {
    expiresIn: DURATA_SESSIONE[ruolo],
  });
}

function verificaTokenSessione(token, ruoloAtteso) {
  const payload = jwt.verify(token, process.env.JWT_SESSION_SECRET);
  if (payload.ruolo !== ruoloAtteso) {
    throw new Error('Ruolo del token non valido per questa rotta');
  }
  return payload;
}

function creaTokenRegistrazione(telefono) {
  return jwt.sign({ telefono, scopo: 'registrazione' }, process.env.JWT_SESSION_SECRET, {
    expiresIn: '10m',
  });
}

function verificaTokenRegistrazione(token) {
  const payload = jwt.verify(token, process.env.JWT_SESSION_SECRET);
  if (payload.scopo !== 'registrazione') {
    throw new Error('Token di registrazione non valido');
  }
  return payload;
}

function creaTokenQr({ tesseraId, clienteId }) {
  return jwt.sign({ tesseraId, clienteId }, process.env.JWT_QR_SECRET, { expiresIn: '90s' });
}

function verificaTokenQr(token) {
  return jwt.verify(token, process.env.JWT_QR_SECRET);
}

module.exports = {
  NOME_COOKIE,
  DURATA_SESSIONE,
  creaTokenSessione,
  verificaTokenSessione,
  creaTokenRegistrazione,
  verificaTokenRegistrazione,
  creaTokenQr,
  verificaTokenQr,
};
