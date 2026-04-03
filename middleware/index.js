// middleware/index.js — Middleware reutilizables de la aplicación
'use strict';

const db = require('../db');

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'Login requerido' });
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user)
    return res.status(401).json({ error: 'Login requerido' });
  if (!req.session.user.isAdmin)
    return res.status(403).json({ error: 'Solo admins' });
  next();
}

async function checkBan(req, res, next) {
  if (req.session && req.session.user && await db.isBanned(req.session.user.id)) {
    return res.status(403).json({ error: 'Usuario baneado' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, checkBan };
