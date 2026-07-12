const MAX_AGE_MS = {
  cliente: 30 * 24 * 60 * 60 * 1000,
  operatore: 24 * 60 * 60 * 1000,
  admin: 12 * 60 * 60 * 1000,
};

function opzioniCookie(ruolo) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_MS[ruolo],
  };
}

module.exports = { opzioniCookie };
