// server.js — Punto de entrada de BeeTeam
// Ahora es un archivo ligero que solo configura Express y monta los routers.
'use strict';

const express       = require('express');
const cookieSession = require('cookie-session');
const path          = require('path');

const CFG          = require('./config');
const authRouter   = require('./routes/auth');
const publicRouter = require('./routes/public');
const adminRouter  = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE GLOBAL ──────────────────────────────────────
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
  name:     'bt_session',
  secret:   CFG.SESSION_SECRET,
  maxAge:   7 * 24 * 60 * 60 * 1000,
  // SEGURIDAD: secure:true en producción HTTPS, desactivado solo en desarrollo local
  secure:   CFG.BASE_URL.startsWith('https') && process.env.DISABLE_SECURE_COOKIE !== 'true',
  httpOnly: true,
  sameSite: 'lax',
}));

// ─── ROUTERS ───────────────────────────────────────────────
app.use('/api/auth',  authRouter);
app.use('/api/admin', adminRouter);
app.use('/api',       publicRouter);

// ─── FALLBACK SPA ──────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ─── ARRANQUE ──────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log('BeeTeam corriendo en http://localhost:' + PORT));
}

module.exports = app;
