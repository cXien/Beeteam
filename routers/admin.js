// routes/admin.js — Rutas del panel de administración (solo admins)
'use strict';

const express = require('express');
const db      = require('../db');
const { requireAdmin } = require('../middleware');

const router = express.Router();

// Todas las rutas de este router requieren ser admin
router.use(requireAdmin);

// ─── STATS ─────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [chat, members, gallery, bans, log, tickets] = await Promise.all([
    db.getAllChat(1000),
    db.getMembers(),
    db.getGallery(),
    db.getBans(),
    db.getLog(10),
    db.getTickets(),
  ]);
  res.json({
    totalChatMessages: chat.filter(m => !m.deleted).length,
    deletedMessages:   chat.filter(m => m.deleted).length,
    uniqueChatUsers:   new Set(chat.map(m => m.user_id)).size,
    teamMembers:       members.length,
    galleryPics:       gallery.length,
    bannedUsers:       bans.length,
    pendingTickets:    tickets.filter(t => t.status === 'pending').length,
    recentLog:         log,
  });
});

// ─── CHAT ──────────────────────────────────────────────────
router.get('/chat', async (req, res) => res.json(await db.getAllChat(200)));

router.delete('/chat/:id', async (req, res) => {
  await db.deleteChat(req.params.id, req.session.user.id, req.session.user.username);
  res.json({ ok: true });
});

// ─── TEAM ──────────────────────────────────────────────────
router.post('/team', async (req, res) => {
  const b = req.body;
  if (!b.nick || !b.role) return res.status(400).json({ error: 'Faltan campos' });
  const m = await db.addMember({ nick: b.nick, role: b.role, skin_url: b.skin_url || null, sort_order: b.sort_order || 0 });
  await db.log(req.session.user.id, req.session.user.username, 'add_member', b.nick);
  res.json(m);
});

router.put('/team/:id', async (req, res) => {
  await db.updateMember(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_member', req.params.id);
  res.json({ ok: true });
});

router.delete('/team/:id', async (req, res) => {
  await db.deleteMember(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_member', req.params.id);
  res.json({ ok: true });
});

// ─── RANKS ─────────────────────────────────────────────────
router.get('/ranks', async (req, res) => res.json(await db.getRanks(true)));

router.post('/ranks', async (req, res) => {
  const r = await db.addRank(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'add_rank', req.body.name);
  res.json(r);
});

router.put('/ranks/:id', async (req, res) => {
  await db.updateRank(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_rank', req.params.id);
  res.json({ ok: true });
});

router.delete('/ranks/:id', async (req, res) => {
  await db.deleteRank(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_rank', req.params.id);
  res.json({ ok: true });
});

// ─── GALLERY ───────────────────────────────────────────────
router.post('/gallery', async (req, res) => {
  const b = req.body;
  if (!b.title || !b.image_url) return res.status(400).json({ error: 'Faltan campos' });
  const p = await db.addPic({ title: b.title, category: b.category || 'otro', image_url: b.image_url });
  await db.log(req.session.user.id, req.session.user.username, 'add_pic', b.title);
  res.json(p);
});

router.delete('/gallery/:id', async (req, res) => {
  await db.deletePic(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_pic', req.params.id);
  res.json({ ok: true });
});

// ─── EVENTS ────────────────────────────────────────────────
router.get('/events', async (req, res) => res.json(await db.getAllEvents()));

router.post('/events', async (req, res) => {
  const ev = await db.upsertEvent(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'upsert_event', req.body.nombre);
  res.json(ev);
});

// ─── CONFIG ────────────────────────────────────────────────
router.put('/config', async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key requerido' });
  await db.setConfig(key, value);
  await db.log(req.session.user.id, req.session.user.username, 'set_config', key);
  res.json({ ok: true });
});

// ─── NOTICIAS / BANNERS ────────────────────────────────────
router.get('/noticias', async (req, res) => {
  const raw = await db.getConfig('noticias');
  try { res.json(JSON.parse(raw || '[]')); } catch { res.json([]); }
});

router.post('/noticias', async (req, res) => {
  const { btype, img_url, img_data, title, desc, color, link } = req.body;
  const tipo = btype || 'banner';
  const finalImg = img_data || img_url || null;
  if (tipo === 'banner' && !finalImg) return res.status(400).json({ error: 'img_url o img_data requerido' });
  if (tipo === 'texto'  && !title)    return res.status(400).json({ error: 'title requerido' });

  const raw = await db.getConfig('noticias');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  const nuevo = {
    id: Date.now(), btype: tipo, img_url: finalImg,
    title: title || null, desc: desc || null,
    color: color || 'purple', link: link || null,
    created_at: new Date().toISOString(),
  };
  list.unshift(nuevo);
  await db.setConfig('noticias', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'add_banner', (title || img_url || '').slice(0, 40));
  res.json({ ok: true, banner: nuevo });
});

router.delete('/noticias/:id', async (req, res) => {
  const id = Number(req.params.id);
  const raw = await db.getConfig('noticias');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  list = list.filter(n => n.id !== id);
  await db.setConfig('noticias', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'del_banner', String(id));
  res.json({ ok: true });
});

// ─── TESTIMONIOS ───────────────────────────────────────────
router.get('/testimonios', async (req, res) => {
  const raw = await db.getConfig('testimonios');
  try { res.json(JSON.parse(raw || '[]')); } catch { res.json([]); }
});

router.post('/testimonios', async (req, res) => {
  const { nick, rank, text, stars } = req.body;
  if (!nick || !text) return res.status(400).json({ error: 'nick y text requeridos' });
  const raw = await db.getConfig('testimonios');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  const nuevo = { id: Date.now(), nick, rank: rank || '', text, stars: Number(stars) || 5 };
  list.push(nuevo);
  await db.setConfig('testimonios', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'add_testimonio', nick);
  res.json({ ok: true, testimonio: nuevo });
});

router.put('/testimonios/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { nick, rank, text, stars } = req.body;
  const raw = await db.getConfig('testimonios');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  list[idx] = {
    id,
    nick:  nick  || list[idx].nick,
    rank:  rank  ?? list[idx].rank,
    text:  text  || list[idx].text,
    stars: Number(stars) || list[idx].stars,
  };
  await db.setConfig('testimonios', JSON.stringify(list));
  res.json({ ok: true });
});

router.delete('/testimonios/:id', async (req, res) => {
  const id = Number(req.params.id);
  const raw = await db.getConfig('testimonios');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  list = list.filter(t => t.id !== id);
  await db.setConfig('testimonios', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'del_testimonio', String(id));
  res.json({ ok: true });
});

// ─── BANS ──────────────────────────────────────────────────
router.get('/bans', async (req, res) => res.json(await db.getBans()));

router.post('/bans', async (req, res) => {
  const b = req.body;
  if (!b.user_id) return res.status(400).json({ error: 'user_id requerido' });
  await db.banUser(b.user_id, b.username || '?', b.reason || 'Sin razón', req.session.user.username);
  await db.log(req.session.user.id, req.session.user.username, 'ban_user', b.user_id, b.reason);
  res.json({ ok: true });
});

router.delete('/bans/:userId', async (req, res) => {
  await db.unbanUser(req.params.userId);
  await db.log(req.session.user.id, req.session.user.username, 'unban_user', req.params.userId);
  res.json({ ok: true });
});

// ─── LOG ───────────────────────────────────────────────────
router.get('/log', async (req, res) => res.json(await db.getLog(200)));

// ─── TICKETS ───────────────────────────────────────────────
router.get('/tickets', async (req, res) => res.json(await db.getTickets()));

router.put('/tickets/:id', async (req, res) => {
  await db.updateTicketStatus(req.params.id, req.body.status);
  await db.log(req.session.user.id, req.session.user.username, 'update_ticket', req.params.id, req.body.status);
  res.json({ ok: true });
});

router.delete('/tickets/:id', async (req, res) => {
  await db.deleteTicket(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_ticket', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
