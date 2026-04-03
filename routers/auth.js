// routes/auth.js — Rutas de autenticación Discord OAuth2
'use strict';

const express = require('express');
const fetch   = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
const CFG     = require('../config');

const router = express.Router();

router.get('/discord', (req, res) => {
  const redir = CFG.BASE_URL + '/api/auth/discord/callback';
  res.redirect(
    'https://discord.com/api/oauth2/authorize?client_id=' + CFG.DISCORD_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(redir) +
    '&response_type=code&scope=identify%20guilds.members.read'
  );
});

router.get('/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/?auth=error&reason=missing_code');
  if (!CFG.DISCORD_CLIENT_ID || !CFG.DISCORD_CLIENT_SECRET) {
    console.error('[Auth] Faltan DISCORD_CLIENT_ID o DISCORD_CLIENT_SECRET');
    return res.redirect('/?auth=error&reason=config');
  }

  const redir = CFG.BASE_URL + '/api/auth/discord/callback';
  try {
    const tokRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     CFG.DISCORD_CLIENT_ID,
        client_secret: CFG.DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redir,
      }),
    });
    const tok = await tokRes.json();
    if (!tok.access_token) {
      console.error('[Auth] Error en token de Discord:', tokRes.status, tok);
      return res.redirect('/?auth=error&reason=token&code=' + encodeURIComponent(tok.error || 'unknown'));
    }

    const u = await (await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: 'Bearer ' + tok.access_token },
    })).json();

    let isAdmin = false, roles = [];
    try {
      const memData = await (await fetch(
        'https://discord.com/api/users/@me/guilds/' + CFG.DISCORD_GUILD_ID + '/member',
        { headers: { Authorization: 'Bearer ' + tok.access_token } }
      )).json();
      roles = (memData.roles || []).map(r => String(r).trim());
      isAdmin = CFG.ADMIN_ROLE_IDS.length > 0 && roles.some(r => CFG.ADMIN_ROLE_IDS.includes(r));
    } catch (e2) {
      console.error('[Auth] Error obteniendo roles del guild:', e2.message);
    }

    req.session.user = {
      id:       u.id,
      username: u.username,
      avatar:   u.avatar
        ? 'https://cdn.discordapp.com/avatars/' + u.id + '/' + u.avatar + '.png'
        : 'https://cdn.discordapp.com/embed/avatars/' + (parseInt(u.discriminator || '0') % 5) + '.png',
      isAdmin,
      roles,
    };
    console.log('[Auth] Login exitoso:', u.username, '| Admin:', isAdmin);
    res.redirect('/');
  } catch (e) {
    console.error('[Auth] Error en callback:', e.message);
    res.redirect('/?auth=error');
  }
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

module.exports = router;
