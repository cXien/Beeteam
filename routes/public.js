// routes/public.js — Rutas públicas de la API (sin autenticación requerida)
'use strict';

const express = require('express');
const fetch   = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
const db      = require('../db');
const CFG     = require('../config');
const { requireAuth, checkBan } = require('../middleware');

const router = express.Router();

// Configuración pública de Supabase (para Realtime en el frontend)
router.get('/public-supabase', (req, res) => {
  res.json({ url: CFG.SUPABASE_URL, anonKey: CFG.SUPABASE_ANON_KEY });
});

router.get('/config',  async (req, res) => res.json(await db.getAllConfig()));
router.get('/ranks',   async (req, res) => res.json(await db.getRanks(false)));
router.get('/team',    async (req, res) => res.json(await db.getMembers()));
router.get('/gallery', async (req, res) => res.json(await db.getGallery()));
router.get('/event',   async (req, res) => res.json(await db.getEvent(true) || null));

router.get('/testimonios', async (req, res) => {
  const raw = await db.getConfig('testimonios');
  try { res.json(JSON.parse(raw || '[]')); } catch { res.json([]); }
});

router.get('/noticias', async (req, res) => {
  const raw = await db.getConfig('noticias');
  try { res.json(JSON.parse(raw || '[]')); } catch { res.json([]); }
});

router.get('/mc-status', async (req, res) => {
  try {
    const data = await (await fetch('https://api.mcsrvstat.us/3/beeteam.club')).json();
    res.json(data);
  } catch {
    res.json({ online: false });
  }
});

// Perfil y sesión
router.get('/me', (req, res) => {
  return req.session && req.session.user
    ? res.json(req.session.user)
    : res.status(401).json({ error: 'No autenticado' });
});

router.get('/profile', (req, res) => {
  if (!req.session || !req.session.user)
    return res.status(401).json({ error: 'No autenticado' });
  res.json({
    id:        req.session.user.id,
    username:  req.session.user.username,
    avatar:    req.session.user.avatar,
    isAdmin:   req.session.user.isAdmin,
    roles:     req.session.user.roles,
    createdAt: new Date().toISOString(),
  });
});

// Chat
router.get('/chat', async (req, res) => {
  res.json(await db.getChat(100));
});

router.post('/chat', requireAuth, checkBan, async (req, res) => {
  const content = req.body.content;
  if (!content || typeof content !== 'string')
    return res.status(400).json({ error: 'Contenido inválido' });
  const clean = content.trim().slice(0, 300);
  if (!clean) return res.status(400).json({ error: 'Mensaje vacío' });

  const msg = await db.addChat({
    user_id:  req.session.user.id,
    username: req.session.user.username,
    avatar:   req.session.user.avatar,
    role:     req.session.user.isAdmin ? 'owner' : null,
    content:  clean,
  });

  if (!msg) return res.status(503).json({ error: 'No se pudo guardar el mensaje. Verifica Supabase.' });
  res.json(msg);
});

// Tickets (usuario autenticado)
router.post('/tickets', requireAuth, async (req, res) => {
  const b = req.body;
  if (!b.type || !b.subject || !b.description)
    return res.status(400).json({ error: 'Faltan campos obligatorios: type, subject, description' });
  try {
    const t = await db.addTicket({
      user_id:        req.session.user.id,
      username:       req.session.user.username,
      minecraft_nick: (b.nick || '').trim().slice(0, 100) || null,
      type:           (b.type || '').trim().slice(0, 100),
      subject:        (b.subject || '').trim().slice(0, 200),
      description:    (b.description || '').trim().slice(0, 2000),
    });
    if (!t) return res.status(503).json({ error: 'No se pudo crear el ticket en Supabase.' });
    res.json(t);
  } catch (e) {
    console.error('[POST /api/tickets] Error:', e.message);
    res.status(500).json({ error: 'Error: ' + e.message });
  }
});

router.get('/tickets', requireAuth, async (req, res) => {
  const all = await db.getTickets();
  const mine = (all || []).filter(t => String(t.user_id) === String(req.session.user.id));
  res.json(mine);
});

router.get('/tickets/:id/messages', requireAuth, async (req, res) => {
  const all = await db.getTickets();
  const ticket = all.find(x => String(x.id) === String(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin)
    return res.status(403).json({ error: 'Sin permiso' });
  res.json(await db.getTicketMessages(req.params.id));
});

router.post('/tickets/:id/messages', requireAuth, async (req, res) => {
  const content = req.body.content;
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });
  const all = await db.getTickets();
  const ticket = all.find(x => String(x.id) === String(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin)
    return res.status(403).json({ error: 'Sin permiso' });
  const msg = await db.addTicketMessage(
    req.params.id, req.session.user.id, req.session.user.username,
    content.trim().slice(0, 1000)
  );
  if (!msg) return res.status(503).json({ error: 'No se pudo guardar el mensaje.' });
  res.json(msg);
});

module.exports = router;
