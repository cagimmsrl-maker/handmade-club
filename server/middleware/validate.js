// Middleware generico di validazione input con zod, come da CLAUDE.md
// ("Input validation su ogni endpoint. Mai fidarsi del client").
module.exports = function validate(schema) {
  return (req, res, next) => {
    const risultato = schema.safeParse(req.body);
    if (!risultato.success) {
      return res.status(400).json({
        errore: 'Dati non validi.',
        dettagli: risultato.error.issues.map((i) => ({ campo: i.path.join('.'), messaggio: i.message })),
      });
    }
    req.body = risultato.data;
    next();
  };
};
