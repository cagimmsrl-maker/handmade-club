require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth.routes');
const clienteRoutes = require('./routes/cliente.routes');
const operatoreRoutes = require('./routes/operatore.routes');
const adminRoutes = require('./routes/admin.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Dietro Nginx: necessario perché il rate limiting per IP (req.ip) usi
// X-Forwarded-For invece dell'IP del reverse proxy.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/operatore', operatoreRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/salute', (req, res) => res.json({ ok: true }));

// In produzione Nginx serve i file statici di client/dist direttamente;
// questo blocco serve solo come comodo fallback per test locali senza Nginx.
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Handmade Club backend in ascolto sulla porta ${PORT}`);
});
