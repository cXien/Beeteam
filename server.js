// ============================================================
//  BEETEAM - server.js v3
//  Express + Discord OAuth2 + Supabase DB + Admin Panel API
// ============================================================
require('dotenv').config();
const express  = require('express');
const cookieSession = require('cookie-session');
const path     = require('path');
const fetch    = (...a) => import('node-fetch').then(({default:f}) => f(...a));
const { createClient } = require('@supabase/supabase-js');

const app  = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIG
// ============================================================
const CFG = {
  DISCORD_CLIENT_ID:     process.env.DISCORD_CLIENT_ID     || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DISCORD_GUILD_ID:      process.env.DISCORD_GUILD_ID      || '',
  ADMIN_ROLE_IDS:        (process.env.ADMIN_ROLE_IDS || '').split(',').map(function(x){return x.trim();}).filter(Boolean),
  SESSION_SECRET:        process.env.SESSION_SECRET        || 'dev-secret-change-me',
  BASE_URL:              (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  SUPABASE_URL:          process.env.SUPABASE_URL          || '',
  SUPABASE_SERVICE_KEY:  process.env.SUPABASE_SERVICE_KEY  || '',
};

console.log('[CONFIG] BASE_URL=', CFG.BASE_URL);
if (!CFG.DISCORD_CLIENT_ID || !CFG.DISCORD_CLIENT_SECRET) {
  console.warn('[CONFIG] DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is missing. Discord login will fail.');
}
if (!CFG.DISCORD_GUILD_ID) {
  console.warn('[CONFIG] DISCORD_GUILD_ID is missing. Guild role checks may fail.');
}

// ============================================================
// SUPABASE CLIENT
// ============================================================
let supabase = null;
if (CFG.SUPABASE_URL && CFG.SUPABASE_SERVICE_KEY) {
  supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });
  console.log('Supabase connected');
} else {
  console.warn('Supabase not configured - using in-memory fallback');
}

// In-memory fallback
const mem = {
  chat: [], members: [], ranks: [
    { id:1, name:'Bee Worker',  name_highlight:'Bee',   price:'$2.99',  featured:false, perks:['Prefix [Worker]','Kit inicio','x2 /sethome','Color nombre'], sort_order:1, active:true },
    { id:2, name:'Honey VIP',   name_highlight:'Honey', price:'$6.99',  featured:true,  perks:['Todo Worker','/fly spawn','/sethome x5','Eventos VIP'], sort_order:2, active:true },
    { id:3, name:'Queen Bee',   name_highlight:'Queen', price:'$12.99', featured:false, perks:['Todo Honey','/fly global','Homes ilimitados','Servidor creativo'], sort_order:3, active:true },
    { id:4, name:'Royal Elite', name_highlight:'Royal', price:'$24.99', featured:false, perks:['Todo Queen','Comandos admin','Badge Discord','Kit mensual'], sort_order:4, active:true },
  ],
  gallery: [], events: [{ id:1, nombre:'Torneo PvP Mensual', descripcion:'', fecha: new Date(Date.now()+7*86400000).toISOString(), activo:true }],
  config: {}, banned: [], adminLog: [], tickets: [],
};

// ============================================================
// DB HELPERS
// ============================================================
const db = {
  async getChat(limit) {
    limit = limit || 100;
    if (supabase) {
      const {data} = await supabase.from('chat_messages').select('*').eq('deleted',false).order('created_at',{ascending:true}).limit(limit);
      return data || [];
    }
    return mem.chat.filter(function(m){return !m.deleted;}).slice(-limit);
  },
  async addChat(msg) {
    if (supabase) {
      const {data} = await supabase.from('chat_messages').insert(msg).select().single();
      return data;
    }
    const m = Object.assign({}, msg, {id: Date.now().toString(), created_at: new Date().toISOString()});
    mem.chat.push(m);
    if (mem.chat.length > 500) mem.chat.shift();
    return m;
  },
  async deleteChat(id, adminId, adminName) {
    if (supabase) {
      await supabase.from('chat_messages').update({deleted:true, deleted_by:adminId, deleted_at:new Date().toISOString()}).eq('id',id);
      await this.log(adminId, adminName, 'delete_chat', 'msg:'+id);
      return;
    }
    var m = mem.chat.find(function(m){return String(m.id)===String(id);});
    if (m) { m.deleted=true; m.deleted_by=adminId; }
  },
  async getAllChat(limit) {
    limit = limit || 200;
    if (supabase) {
      const {data} = await supabase.from('chat_messages').select('*').order('created_at',{ascending:false}).limit(limit);
      return data || [];
    }
    return mem.chat.slice().reverse().slice(0, limit);
  },
  async getMembers() {
    if (supabase) {
      const {data} = await supabase.from('team_members').select('*').order('sort_order');
      return data || [];
    }
    return mem.members;
  },
  async addMember(m) {
    if (supabase) {
      const {data} = await supabase.from('team_members').insert(m).select().single();
      return data;
    }
    var nm = Object.assign({}, m, {id: Date.now(), created_at: new Date().toISOString()});
    mem.members.push(nm);
    return nm;
  },
  async updateMember(id, data) {
    if (supabase) { await supabase.from('team_members').update(data).eq('id',id); return; }
    var m = mem.members.find(function(m){return String(m.id)===String(id);});
    if (m) Object.assign(m, data);
  },
  async deleteMember(id) {
    if (supabase) { await supabase.from('team_members').delete().eq('id',id); return; }
    mem.members = mem.members.filter(function(m){return String(m.id)!==String(id);});
  },
  async getRanks(adminMode) {
    if (supabase) {
      var q = supabase.from('ranks').select('*').order('sort_order');
      if (!adminMode) q = q.eq('active',true);
      const {data} = await q;
      return data || [];
    }
    return adminMode ? mem.ranks : mem.ranks.filter(function(r){return r.active;});
  },
  async addRank(r) {
    if (supabase) { const {data} = await supabase.from('ranks').insert(r).select().single(); return data; }
    var nr = Object.assign({}, r, {id: Date.now()}); mem.ranks.push(nr); return nr;
  },
  async updateRank(id, data) {
    if (supabase) { await supabase.from('ranks').update(data).eq('id',id); return; }
    var r = mem.ranks.find(function(r){return String(r.id)===String(id);});
    if (r) Object.assign(r, data);
  },
  async deleteRank(id) {
    if (supabase) { await supabase.from('ranks').delete().eq('id',id); return; }
    mem.ranks = mem.ranks.filter(function(r){return String(r.id)!==String(id);});
  },
  async getGallery() {
    if (supabase) { const {data} = await supabase.from('gallery_pics').select('*').order('created_at',{ascending:false}); return data||[]; }
    return mem.gallery;
  },
  async addPic(p) {
    if (supabase) { const {data} = await supabase.from('gallery_pics').insert(p).select().single(); return data; }
    var np = Object.assign({}, p, {id: Date.now(), created_at: new Date().toISOString()}); mem.gallery.push(np); return np;
  },
  async deletePic(id) {
    if (supabase) { await supabase.from('gallery_pics').delete().eq('id',id); return; }
    mem.gallery = mem.gallery.filter(function(p){return String(p.id)!==String(id);});
  },
  async getEvent(activeOnly) {
    if (supabase) {
      var q = supabase.from('events').select('*').order('created_at',{ascending:false}).limit(1);
      if (activeOnly) q = q.eq('activo',true);
      const {data} = await q;
      return (data && data[0]) || null;
    }
    var evs = activeOnly ? mem.events.filter(function(e){return e.activo;}) : mem.events;
    return evs[evs.length-1] || null;
  },
  async getAllEvents() {
    if (supabase) { const {data} = await supabase.from('events').select('*').order('created_at',{ascending:false}); return data||[]; }
    return mem.events.slice().reverse();
  },
  async upsertEvent(ev) {
    if (supabase) {
      if (ev.id) { await supabase.from('events').update(ev).eq('id',ev.id); return ev; }
      const {data} = await supabase.from('events').insert(ev).select().single(); return data;
    }
    if (ev.id) { var e=mem.events.find(function(e){return e.id===ev.id;}); if(e) Object.assign(e,ev); return ev; }
    var ne = Object.assign({}, ev, {id: Date.now()}); mem.events.push(ne); return ne;
  },
  async getConfig(key) {
    if (supabase) { const {data} = await supabase.from('site_config').select('value').eq('key',key).single(); return (data && data.value) || null; }
    return mem.config[key] || null;
  },
  async setConfig(key, value) {
    if (supabase) { await supabase.from('site_config').upsert({key, value, updated_at:new Date().toISOString()}); return; }
    mem.config[key] = value;
  },
  async getAllConfig() {
    if (supabase) { const {data} = await supabase.from('site_config').select('*'); var r={}; (data||[]).forEach(function(c){r[c.key]=c.value;}); return r; }
    return mem.config;
  },
  async getBans() {
    if (supabase) { const {data} = await supabase.from('banned_users').select('*').order('created_at',{ascending:false}); return data||[]; }
    return mem.banned;
  },
  async banUser(userId, username, reason, bannedBy) {
    if (supabase) { await supabase.from('banned_users').upsert({user_id:userId,username,reason,banned_by:bannedBy,created_at:new Date().toISOString()}); return; }
    mem.banned.push({user_id:userId,username,reason,banned_by:bannedBy,created_at:new Date().toISOString()});
  },
  async unbanUser(userId) {
    if (supabase) { await supabase.from('banned_users').delete().eq('user_id',userId); return; }
    mem.banned = mem.banned.filter(function(b){return b.user_id!==userId;});
  },
  async isBanned(userId) {
    if (supabase) { const {data} = await supabase.from('banned_users').select('user_id').eq('user_id',userId).single(); return !!data; }
    return mem.banned.some(function(b){return b.user_id===userId;});
  },
  async log(adminId, adminName, action, target, detail) {
    target = target || '';
    detail = detail || '';
    var entry = { admin_id:adminId, admin_name:adminName, action, target, detail, created_at:new Date().toISOString() };
    if (supabase) { await supabase.from('admin_log').insert(entry); return; }
    mem.adminLog.unshift(entry);
    if (mem.adminLog.length > 500) mem.adminLog.pop();
  },
  async getLog(limit) {
    limit = limit || 100;
    if (supabase) { const {data} = await supabase.from('admin_log').select('*').order('created_at',{ascending:false}).limit(limit); return data||[]; }
    return mem.adminLog.slice(0, limit);
  },
  // TICKETS
  async addTicket(t) {
    if (supabase) {
      const {data} = await supabase.from('tickets').insert(t).select().single();
      return data;
    }
    var nt = Object.assign({}, t, {id: Date.now(), status:'pending', created_at: new Date().toISOString()});
    mem.tickets.push(nt);
    return nt;
  },
  async getTickets() {
    if (supabase) {
      const {data} = await supabase.from('tickets').select('*').order('created_at',{ascending:false});
      return data || [];
    }
    return mem.tickets.slice().reverse();
  },
  async updateTicketStatus(id, status) {
    if (supabase) { await supabase.from('tickets').update({status}).eq('id',id); return; }
    var t = mem.tickets.find(function(t){return String(t.id)===String(id);});
    if (t) t.status = status;
  },
  async deleteTicket(id) {
    if (supabase) { await supabase.from('tickets').delete().eq('id',id); return; }
    mem.tickets = mem.tickets.filter(function(t){return String(t.id)!==String(id);});
  },
  async getTicketMessages(ticketId) {
    if (supabase) {
      const {data} = await supabase.from('ticket_messages').select('*').eq('ticket_id',ticketId).order('created_at',{ascending:true});
      return data || [];
    }
    return (mem.ticketMessages || []).filter(function(m){return String(m.ticket_id)===String(ticketId);});
  },
  async addTicketMessage(ticketId, userId, username, content) {
    const msg = {ticket_id:ticketId, user_id:userId, username:username, content:content, created_at:new Date().toISOString()};
    if (supabase) {
      const {data} = await supabase.from('ticket_messages').insert(msg).select().single();
      return data;
    }
    if (!mem.ticketMessages) mem.ticketMessages = [];
    var nm = Object.assign({}, msg, {id:Date.now()});
    mem.ticketMessages.push(nm);
    return nm;
  },
};

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.use(cookieSession({
  name: 'session',
  secret: CFG.SESSION_SECRET,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  // si estás probando local con NODE_ENV=production, establece DISABLE_SECURE_COOKIE=true para efectos de desarrollo
  secure: process.env.NODE_ENV === 'production' && !process.env.DISABLE_SECURE_COOKIE && CFG.BASE_URL.startsWith('https'),
  httpOnly: true,
  sameSite: 'lax'
}));

function requireAuth(req,res,next)  { return req.session.user ? next() : res.status(401).json({error:'Login required'}); }
function requireAdmin(req,res,next) {
  if (!req.session.user) return res.status(401).json({error:'Login required'});
  if (!req.session.user.isAdmin) return res.status(403).json({error:'Admin only'});
  next();
}
async function checkBan(req,res,next) {
  if (req.session.user && await db.isBanned(req.session.user.id)) return res.status(403).json({error:'Baneado'});
  next();
}

// ============================================================
// AUTH
// ============================================================
app.get('/api/auth/discord', function(req,res) {
  var redir = CFG.BASE_URL + '/api/auth/discord/callback';
  res.redirect('https://discord.com/api/oauth2/authorize?client_id='+CFG.DISCORD_CLIENT_ID+'&redirect_uri='+encodeURIComponent(redir)+'&response_type=code&scope=identify%20guilds.members.read');
});

app.get('/api/auth/discord/callback', async function(req,res) {
  var code = req.query.code;
  if (!code) return res.redirect('/?auth=error&reason=missing_code');
  if (!CFG.DISCORD_CLIENT_ID || !CFG.DISCORD_CLIENT_SECRET) {
    console.error('[Auth] Discord client id/secret missing');
    return res.redirect('/?auth=error&reason=config');
  }
  var redir = CFG.BASE_URL + '/api/auth/discord/callback';
  try {
    var tokRes = await fetch('https://discord.com/api/oauth2/token', {
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id:CFG.DISCORD_CLIENT_ID,
        client_secret:CFG.DISCORD_CLIENT_SECRET,
        grant_type:'authorization_code',
        code:code,
        redirect_uri:redir
      })
    });

    var tok = await tokRes.json();
    if (!tok.access_token) {
      console.error('[Auth] Discord token response error', tokRes.status, tok);
      return res.redirect('/?auth=error&reason=token&code='+encodeURIComponent(tok.error||'unknown'));
    }

    var u = await (await fetch('https://discord.com/api/users/@me', {headers:{Authorization:'Bearer '+tok.access_token}})).json();
    var isAdmin = false, roles = [];
    try {
      var memData = await (await fetch('https://discord.com/api/users/@me/guilds/'+CFG.DISCORD_GUILD_ID+'/member', {headers:{Authorization:'Bearer '+tok.access_token}})).json();
      roles = (memData.roles || []).map(function(r){ return String(r).trim(); });
      console.log('[Auth] guild member roles:', roles, 'expected admin roles:', CFG.ADMIN_ROLE_IDS);
      isAdmin = roles.some(function(r){ return CFG.ADMIN_ROLE_IDS.includes(String(r)); });
    } catch(e2) {
      console.error('[Auth] guild member fetch failed:', e2 && e2.message ? e2.message : e2);
    }
    req.session.user = {
      id: u.id,
      username: u.username,
      avatar: u.avatar ? 'https://cdn.discordapp.com/avatars/'+u.id+'/'+u.avatar+'.png' : 'https://cdn.discordapp.com/embed/avatars/'+(parseInt(u.discriminator||'0')%5)+'.png',
      isAdmin: isAdmin,
      roles: roles,
    };
    res.redirect('/');
  } catch(e) {
    console.error('[Auth]', e.message);
    res.redirect('/?auth=error');
  }
});

app.post('/api/auth/logout', function(req,res) {
  req.session = null;
  res.json({ok:true});
});

app.get('/api/me', function(req,res) {
  return req.session.user ? res.json(req.session.user) : res.status(401).json({error:'Not authenticated'});
});

app.get('/api/profile', function(req,res) {
  if (!req.session.user) return res.status(401).json({error:'Not authenticated'});
  res.json({
    id: req.session.user.id,
    username: req.session.user.username,
    avatar: req.session.user.avatar,
    isAdmin: req.session.user.isAdmin,
    roles: req.session.user.roles,
    createdAt: new Date().toISOString() // o de db si guardas
  });
});

// ============================================================
// PUBLIC API
// ============================================================
app.get('/api/config',  async function(req,res) { res.json(await db.getAllConfig()); });
app.get('/api/ranks',   async function(req,res) { res.json(await db.getRanks(false)); });
app.get('/api/team',    async function(req,res) { res.json(await db.getMembers()); });
app.get('/api/gallery', async function(req,res) { res.json(await db.getGallery()); });
app.get('/api/event',   async function(req,res) { res.json(await db.getEvent(true) || null); });
app.get('/api/mc-status', async function(req,res) {
  try { res.json(await (await fetch('https://api.mcsrvstat.us/3/beeteam.club')).json()); }
  catch(e) { res.json({online:false}); }
});

// TICKETS PUBLIC
app.post('/api/tickets', async function(req,res) {
  var b = req.body;
  if (!b.nick || !b.type || !b.subject || !b.description) return res.status(400).json({error:'Faltan campos'});
  try {
    var ticketData = {
      nick: b.nick.trim().slice(0,50),
      type: b.type.trim().slice(0,100),
      subject: b.subject.trim().slice(0,200),
      description: b.description.trim().slice(0,2000),
      status: 'pending'
    };
    if (req.session.user) {
      ticketData.user_id = req.session.user.id;
      ticketData.user_name = req.session.user.username;
    }
    var t = await db.addTicket(ticketData);
    res.json(t);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// ============================================================
// CHAT
// ============================================================
app.get('/api/chat', async function(req,res) { res.json(await db.getChat(100)); });

app.post('/api/chat', requireAuth, checkBan, async function(req,res) {
  var content = req.body.content;
  if (!content || typeof content !== 'string') return res.status(400).json({error:'Invalid'});
  var clean = content.trim().slice(0,300);
  if (!clean) return res.status(400).json({error:'Empty'});
  var msg = await db.addChat({
    user_id:req.session.user.id,
    username:req.session.user.username,
    avatar:req.session.user.avatar,
    role:req.session.user.isAdmin?'owner':null,
    content:clean
  });
  res.json(msg);
});

// ============================================================
// ADMIN API
// ============================================================
app.get('/api/admin/stats', requireAdmin, async function(req,res) {
  var results = await Promise.all([db.getAllChat(1000), db.getMembers(), db.getGallery(), db.getBans(), db.getLog(10), db.getTickets()]);
  var chat=results[0], members=results[1], gallery=results[2], bans=results[3], log=results[4], tickets=results[5];
  var uniqueUsers = new Set(chat.map(function(m){return m.user_id;})).size;
  res.json({
    totalChatMessages: chat.filter(function(m){return !m.deleted;}).length,
    deletedMessages: chat.filter(function(m){return m.deleted;}).length,
    uniqueChatUsers: uniqueUsers,
    teamMembers: members.length,
    galleryPics: gallery.length,
    bannedUsers: bans.length,
    pendingTickets: tickets.filter(function(t){return t.status==='pending';}).length,
    recentLog: log,
  });
});

app.get('/api/admin/chat', requireAdmin, async function(req,res) { res.json(await db.getAllChat(200)); });
app.delete('/api/admin/chat/:id', requireAdmin, async function(req,res) {
  await db.deleteChat(req.params.id, req.session.user.id, req.session.user.username);
  res.json({ok:true});
});

app.post('/api/admin/team', requireAdmin, async function(req,res) {
  var b = req.body;
  if (!b.nick || !b.role) return res.status(400).json({error:'Faltan campos'});
  var m = await db.addMember({nick:b.nick, role:b.role, skin_url:b.skin_url||null, sort_order:b.sort_order||0});
  await db.log(req.session.user.id, req.session.user.username, 'add_member', b.nick);
  res.json(m);
});
app.put('/api/admin/team/:id', requireAdmin, async function(req,res) {
  await db.updateMember(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_member', req.params.id);
  res.json({ok:true});
});
app.delete('/api/admin/team/:id', requireAdmin, async function(req,res) {
  await db.deleteMember(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_member', req.params.id);
  res.json({ok:true});
});

app.get('/api/admin/ranks', requireAdmin, async function(req,res) { res.json(await db.getRanks(true)); });
app.post('/api/admin/ranks', requireAdmin, async function(req,res) {
  var r = await db.addRank(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'add_rank', req.body.name);
  res.json(r);
});
app.put('/api/admin/ranks/:id', requireAdmin, async function(req,res) {
  await db.updateRank(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_rank', req.params.id);
  res.json({ok:true});
});
app.delete('/api/admin/ranks/:id', requireAdmin, async function(req,res) {
  await db.deleteRank(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_rank', req.params.id);
  res.json({ok:true});
});

app.post('/api/admin/gallery', requireAdmin, async function(req,res) {
  var b = req.body;
  if (!b.title || !b.image_url) return res.status(400).json({error:'Faltan campos'});
  var p = await db.addPic({title:b.title, category:b.category||'otro', image_url:b.image_url});
  await db.log(req.session.user.id, req.session.user.username, 'add_pic', b.title);
  res.json(p);
});
app.delete('/api/admin/gallery/:id', requireAdmin, async function(req,res) {
  await db.deletePic(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_pic', req.params.id);
  res.json({ok:true});
});

app.get('/api/admin/events', requireAdmin, async function(req,res) { res.json(await db.getAllEvents()); });
app.post('/api/admin/events', requireAdmin, async function(req,res) {
  var ev = await db.upsertEvent(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'upsert_event', req.body.nombre);
  res.json(ev);
});

app.put('/api/admin/config', requireAdmin, async function(req,res) {
  var key = req.body.key, value = req.body.value;
  if (!key) return res.status(400).json({error:'key requerido'});
  await db.setConfig(key, value);
  await db.log(req.session.user.id, req.session.user.username, 'set_config', key);
  res.json({ok:true});
});

app.get('/api/admin/bans', requireAdmin, async function(req,res) { res.json(await db.getBans()); });
app.post('/api/admin/bans', requireAdmin, async function(req,res) {
  var b = req.body;
  if (!b.user_id) return res.status(400).json({error:'user_id requerido'});
  await db.banUser(b.user_id, b.username||'?', b.reason||'Sin razon', req.session.user.username);
  await db.log(req.session.user.id, req.session.user.username, 'ban_user', b.user_id, b.reason);
  res.json({ok:true});
});
app.delete('/api/admin/bans/:userId', requireAdmin, async function(req,res) {
  await db.unbanUser(req.params.userId);
  await db.log(req.session.user.id, req.session.user.username, 'unban_user', req.params.userId);
  res.json({ok:true});
});

app.get('/api/admin/log', requireAdmin, async function(req,res) { res.json(await db.getLog(200)); });

// TICKETS ADMIN
app.get('/api/admin/tickets', requireAdmin, async function(req,res) { res.json(await db.getTickets()); });
app.put('/api/admin/tickets/:id', requireAdmin, async function(req,res) {
  await db.updateTicketStatus(req.params.id, req.body.status);
  await db.log(req.session.user.id, req.session.user.username, 'update_ticket', req.params.id, req.body.status);
  res.json({ok:true});
});
app.delete('/api/admin/tickets/:id', requireAdmin, async function(req,res) {
  await db.deleteTicket(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_ticket', req.params.id);
  res.json({ok:true});
});

// TICKET MESSAGES
app.get('/api/tickets/:id/messages', requireAuth, async function(req,res) {
  const t = await db.getTickets();
  const ticket = t.find(function(x){return String(x.id)===String(req.params.id);});
  if (!ticket) return res.status(404).json({error:'Ticket no encontrado'});
  // Verifica que sea el propietario del ticket o un admin
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin) {
    return res.status(403).json({error:'No tienes permiso'});
  }
  res.json(await db.getTicketMessages(req.params.id));
});

app.post('/api/tickets/:id/messages', requireAuth, async function(req,res) {
  const content = req.body.content;
  if (!content) return res.status(400).json({error:'Contenido requerido'});
  const t = await db.getTickets();
  const ticket = t.find(function(x){return String(x.id)===String(req.params.id);});
  if (!ticket) return res.status(404).json({error:'Ticket no encontrado'});
  // Verifica que sea el propietario o admin
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin) {
    return res.status(403).json({error:'No tienes permiso'});
  }
  const msg = await db.addTicketMessage(req.params.id, req.session.user.id, req.session.user.username, content.trim().slice(0,1000));
  res.json(msg);
});

// ============================================================
// FALLBACK SPA
// ============================================================
app.get('*', function(req,res) { res.sendFile(path.join(__dirname,'index.html')); });

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, function() { console.log('BeeTeam running on http://localhost:'+PORT); });
}

module.exports = app;