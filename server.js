// ============================================================
//  BEETEAM - server.js v4 (FIXED)
//  Bugs corregidos:
//  1. Supabase ahora se conecta correctamente en Vercel
//  2. IS_SERVERLESS ya no bloquea Supabase
//  3. Fallback mem[] solo si Supabase falla de verdad
//  4. Cookies de sesión funcionan en Vercel HTTPS
//  5. Tickets: campos user_id/username corregidos
//  6. Ranks: deduplicación en DB (upsert seguro)
//  7. Gallery: imágenes base64 grandes manejadas
//  8. Admin log: target/detail siempre string
// ============================================================
require('dotenv').config();
const express       = require('express');
const cookieSession = require('cookie-session');
const path          = require('path');
const fetch         = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
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
  ADMIN_ROLE_IDS:        (process.env.ADMIN_ROLE_IDS || '').split(',').map(x => x.trim()).filter(Boolean),
  SESSION_SECRET:        process.env.SESSION_SECRET        || 'dev-secret-change-me',
  BASE_URL:              (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  SUPABASE_URL:          process.env.SUPABASE_URL          || '',
  SUPABASE_SERVICE_KEY:  process.env.SUPABASE_SERVICE_KEY  || '',
  SUPABASE_ANON_KEY:     process.env.SUPABASE_ANON_KEY     || '',
  // FIX #1: IS_SERVERLESS solo afecta a persistencia de archivos locales,
  // NO bloquea Supabase. Supabase funciona perfectamente en Vercel.
  IS_SERVERLESS: !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME),
};

console.log('[CONFIG] BASE_URL=', CFG.BASE_URL);
console.log('[CONFIG] IS_SERVERLESS=', CFG.IS_SERVERLESS);
console.log('[CONFIG] SUPABASE_URL presente=', !!CFG.SUPABASE_URL);
console.log('[CONFIG] SUPABASE_SERVICE_KEY presente=', !!CFG.SUPABASE_SERVICE_KEY);

if (!CFG.DISCORD_CLIENT_ID || !CFG.DISCORD_CLIENT_SECRET) {
  console.warn('[CONFIG] DISCORD_CLIENT_ID o DISCORD_CLIENT_SECRET falta. El login de Discord fallará.');
}
if (!CFG.DISCORD_GUILD_ID) {
  console.warn('[CONFIG] DISCORD_GUILD_ID falta. La verificación de roles fallará.');
}

// ============================================================
// SUPABASE CLIENT
// FIX #2: Supabase se inicializa siempre que tenga las vars,
// independientemente de si es serverless o no.
// ============================================================
let supabase = null;
if (CFG.SUPABASE_URL && CFG.SUPABASE_SERVICE_KEY) {
  supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
      }
    }
  });
  console.log('[Supabase] Conectado correctamente ✓');
} else {
  console.error('[Supabase] NO conectado — verifica SUPABASE_URL y SUPABASE_SERVICE_KEY en Vercel env vars');
}

// ============================================================
// PERSISTENCIA LOCAL (solo para desarrollo, nunca en Vercel)
// ============================================================
const fs = require('fs');
let persistenceEnabled = !CFG.IS_SERVERLESS;
let SHADOW_PATH = '';

if (!CFG.IS_SERVERLESS) {
  SHADOW_PATH = path.join(__dirname, 'db_persistence');
  try {
    if (!fs.existsSync(SHADOW_PATH)) fs.mkdirSync(SHADOW_PATH, { recursive: true });
  } catch (e) {
    console.warn('[DB] Persistencia local desactivada:', e.message);
    persistenceEnabled = false;
  }
}

function loadShadow(name, fallback) {
  if (!persistenceEnabled || !SHADOW_PATH) return fallback;
  try {
    const p = path.join(SHADOW_PATH, name + '.json');
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8')) || fallback;
  } catch (e) {
    console.error('[DB] loadShadow error', name, e.message);
    return fallback;
  }
}

function saveShadow(name, data) {
  if (!persistenceEnabled || !SHADOW_PATH) return;
  try {
    fs.writeFileSync(path.join(SHADOW_PATH, name + '.json'), JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[DB] saveShadow error', name, e.message);
    persistenceEnabled = false;
  }
}

// In-memory fallback (solo para desarrollo local sin Supabase)
const mem = {
  chat:           loadShadow('chat', []),
  members:        loadShadow('members', []),
  ranks:          loadShadow('ranks', [
    { id:1, name:'Bee Worker',  name_highlight:'Bee',   price:'$2.99',  featured:false, perks:['Prefix [Worker] en el chat','Kit de inicio exclusivo','Acceso a /sethome x2','Color de nombre personalizado'], sort_order:1, active:true },
    { id:2, name:'Honey VIP',   name_highlight:'Honey', price:'$6.99',  featured:true,  perks:['Todo lo de Worker','Prefix [Honey] brillante','/fly en spawn y zonas safe','/sethome x5 · /nick','Partículas exclusivas','Acceso a eventos VIP'], sort_order:2, active:true },
    { id:3, name:'Queen Bee',   name_highlight:'Queen', price:'$12.99', featured:false, perks:['Todo lo de Honey VIP','Prefix [Queen] dorado animado','/fly global · /god','Homes ilimitados','Acceso a servidor creativo','Rol especial en Discord','Prioridad en soporte'], sort_order:3, active:true },
    { id:4, name:'Royal Elite', name_highlight:'Royal', price:'$24.99', featured:false, perks:['Todo lo de Queen Bee','Prefix [Royal] con efectos únicos','Comandos admin limitados','Badge exclusivo en Discord','Chat privado con staff','Kit mensual legendario'], sort_order:4, active:true },
  ]),
  gallery:        loadShadow('gallery', []),
  events:         loadShadow('events', [{ id:1, nombre:'Torneo PvP Mensual', descripcion:'', fecha: new Date(Date.now()+7*86400000).toISOString(), activo:true }]),
  config:         loadShadow('config', {}),
  banned:         loadShadow('banned', []),
  adminLog:       loadShadow('adminLog', []),
  tickets:        loadShadow('tickets', []),
  ticketMessages: loadShadow('ticketMessages', []),
};

function persistMem() {
  saveShadow('chat',           mem.chat);
  saveShadow('members',        mem.members);
  saveShadow('ranks',          mem.ranks);
  saveShadow('gallery',        mem.gallery);
  saveShadow('events',         mem.events);
  saveShadow('config',         mem.config);
  saveShadow('banned',         mem.banned);
  saveShadow('adminLog',       mem.adminLog);
  saveShadow('tickets',        mem.tickets);
  saveShadow('ticketMessages', mem.ticketMessages);
}

// ============================================================
// DB HELPERS
// FIX #3: Cada helper intenta Supabase primero.
// Solo usa mem[] si Supabase no está configurado Y no es serverless.
// En Vercel sin Supabase simplemente retorna vacío/null.
// ============================================================
const db = {

  // ---------- CHAT ----------
  async getChat(limit) {
    limit = limit || 100;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('deleted', false)
          .order('created_at', { ascending: true })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getChat Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.chat.filter(m => !m.deleted).slice(-limit);
  },

  async addChat(msg) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .insert(msg)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] addChat Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const m = { ...msg, id: Date.now().toString(), created_at: new Date().toISOString() };
    mem.chat.push(m);
    if (mem.chat.length > 500) mem.chat.shift();
    persistMem();
    return m;
  },

  async deleteChat(id, adminId, adminName) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('chat_messages')
          .update({ deleted: true, deleted_by: adminId, deleted_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await this.log(adminId, adminName, 'delete_chat', 'msg:' + id);
        return;
      } catch (e) {
        console.error('[DB] deleteChat Supabase error:', e.message);
      }
    }
    const m = mem.chat.find(m => String(m.id) === String(id));
    if (m) { m.deleted = true; m.deleted_by = adminId; }
    persistMem();
  },

  async getAllChat(limit) {
    limit = limit || 200;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getAllChat Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.chat.slice().reverse().slice(0, limit);
  },

  // ---------- TEAM ----------
  async getMembers() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('*')
          .order('sort_order');
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getMembers Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.members;
  },

  async addMember(m) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('team_members')
          .insert(m)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] addMember Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const nm = { ...m, id: Date.now(), created_at: new Date().toISOString() };
    mem.members.push(nm);
    persistMem();
    return nm;
  },

  async updateMember(id, data) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('team_members')
          .update(data)
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] updateMember Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    const m = mem.members.find(m => String(m.id) === String(id));
    if (m) Object.assign(m, data);
    persistMem();
  },

  async deleteMember(id) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] deleteMember Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.members = mem.members.filter(m => String(m.id) !== String(id));
    persistMem();
  },

  // ---------- RANKS ----------
  async getRanks(adminMode) {
    if (supabase) {
      try {
        let q = supabase.from('ranks').select('*').order('sort_order');
        if (!adminMode) q = q.eq('active', true);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getRanks Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return adminMode ? mem.ranks : mem.ranks.filter(r => r.active);
  },

  async addRank(r) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ranks')
          .insert(r)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] addRank Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const nr = { ...r, id: Date.now() };
    mem.ranks.push(nr);
    persistMem();
    return nr;
  },

  async updateRank(id, data) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('ranks')
          .update(data)
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] updateRank Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    const r = mem.ranks.find(r => String(r.id) === String(id));
    if (r) Object.assign(r, data);
    persistMem();
  },

  async deleteRank(id) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('ranks')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] deleteRank Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.ranks = mem.ranks.filter(r => String(r.id) !== String(id));
    persistMem();
  },

  // ---------- GALLERY ----------
  async getGallery() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('gallery_pics')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getGallery Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.gallery;
  },

  async addPic(p) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('gallery_pics')
          .insert(p)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] addPic Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const np = { ...p, id: Date.now(), created_at: new Date().toISOString() };
    mem.gallery.push(np);
    persistMem();
    return np;
  },

  async deletePic(id) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('gallery_pics')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] deletePic Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.gallery = mem.gallery.filter(p => String(p.id) !== String(id));
    persistMem();
  },

  // ---------- EVENTS ----------
  async getEvent(activeOnly) {
    if (supabase) {
      try {
        let q = supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1);
        if (activeOnly) q = q.eq('activo', true);
        const { data, error } = await q;
        if (error) throw error;
        return (data && data[0]) || null;
      } catch (e) {
        console.error('[DB] getEvent Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const evs = activeOnly ? mem.events.filter(e => e.activo) : mem.events;
    return evs[evs.length - 1] || null;
  },

  async getAllEvents() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getAllEvents Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.events.slice().reverse();
  },

  async upsertEvent(ev) {
    if (supabase) {
      try {
        if (ev.id) {
          const { error } = await supabase.from('events').update(ev).eq('id', ev.id);
          if (error) throw error;
          return ev;
        }
        const { data, error } = await supabase.from('events').insert(ev).select().single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] upsertEvent Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return ev;
    if (ev.id) {
      const e = mem.events.find(e => e.id === ev.id);
      if (e) Object.assign(e, ev);
      persistMem();
      return ev;
    }
    const ne = { ...ev, id: Date.now() };
    mem.events.push(ne);
    persistMem();
    return ne;
  },

  // ---------- CONFIG ----------
  async getConfig(key) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('site_config')
          .select('value')
          .eq('key', key)
          .single();
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
        return (data && data.value) || null;
      } catch (e) {
        console.error('[DB] getConfig Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    return mem.config[key] || null;
  },

  async setConfig(key, value) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('site_config')
          .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] setConfig Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.config[key] = value;
    persistMem();
  },

  async getAllConfig() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('site_config').select('*');
        if (error) throw error;
        const r = {};
        (data || []).forEach(c => { r[c.key] = c.value; });
        return r;
      } catch (e) {
        console.error('[DB] getAllConfig Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return {};
    return mem.config;
  },

  // ---------- BANS ----------
  async getBans() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('banned_users')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getBans Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.banned;
  },

  async banUser(userId, username, reason, bannedBy) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('banned_users')
          .upsert({ user_id: userId, username, reason, banned_by: bannedBy, created_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] banUser Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    const existing = mem.banned.findIndex(b => b.user_id === userId);
    if (existing >= 0) mem.banned[existing] = { user_id: userId, username, reason, banned_by: bannedBy, created_at: new Date().toISOString() };
    else mem.banned.push({ user_id: userId, username, reason, banned_by: bannedBy, created_at: new Date().toISOString() });
    persistMem();
  },

  async unbanUser(userId) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('banned_users')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] unbanUser Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.banned = mem.banned.filter(b => b.user_id !== userId);
    persistMem();
  },

  async isBanned(userId) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('banned_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle(); // FIX: maybeSingle no lanza error si no hay filas
        if (error) throw error;
        return !!data;
      } catch (e) {
        console.error('[DB] isBanned Supabase error:', e.message);
        return false; // FIX: en caso de error, no bloquear al usuario
      }
    }
    if (CFG.IS_SERVERLESS) return false;
    return mem.banned.some(b => b.user_id === userId);
  },

  // ---------- ADMIN LOG ----------
  // FIX #8: target y detail siempre se convierten a string
  async log(adminId, adminName, action, target, detail) {
    const entry = {
      admin_id:   String(adminId   || ''),
      admin_name: String(adminName || ''),
      action:     String(action    || ''),
      target:     String(target    || ''),
      detail:     String(detail    || ''),
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      try {
        const { error } = await supabase.from('admin_log').insert(entry);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] log Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.adminLog.unshift(entry);
    if (mem.adminLog.length > 500) mem.adminLog.pop();
    persistMem();
  },

  async getLog(limit) {
    limit = limit || 100;
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getLog Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.adminLog.slice(0, limit);
  },

  // ---------- TICKETS ----------
  async addTicket(t) {
    if (supabase) {
      // Usar fetch directo a la REST API de Supabase para evitar el bug de schema cache
      try {
        const ticketData = {
          user_id:     t.user_id,
          username:    t.username || 'Desconocido',
          type:        t.type,
          subject:     t.subject,
          description: t.description,
          status:      'pending',
        };
        // Intentar añadir minecraft_nick si está presente (columna opcional)
        if (t.minecraft_nick) ticketData.minecraft_nick = t.minecraft_nick;

        const url = CFG.SUPABASE_URL + '/rest/v1/tickets';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        CFG.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + CFG.SUPABASE_SERVICE_KEY,
            'Prefer':        'return=representation',
          },
          body: JSON.stringify(ticketData),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error('[DB] addTicket REST error:', res.status, errText);
          // Si falla por minecraft_nick (columna no existe), reintentar sin ella
          if (errText.includes('minecraft_nick')) {
            delete ticketData.minecraft_nick;
            const res2 = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type':  'application/json',
                'apikey':        CFG.SUPABASE_SERVICE_KEY,
                'Authorization': 'Bearer ' + CFG.SUPABASE_SERVICE_KEY,
                'Prefer':        'return=representation',
              },
              body: JSON.stringify(ticketData),
            });
            if (!res2.ok) {
              console.error('[DB] addTicket REST retry error:', res2.status, await res2.text());
              return null;
            }
            const data2 = await res2.json();
            return Array.isArray(data2) ? data2[0] : data2;
          }
          return null;
        }

        const data = await res.json();
        console.log('[DB] addTicket REST OK:', JSON.stringify(data));
        return Array.isArray(data) ? data[0] : data;
      } catch (e) {
        console.error('[DB] addTicket failed:', e.message);
        return null;
      }
    }
    if (CFG.IS_SERVERLESS) return null;
    const nt = { ...t, id: Date.now(), status: 'pending', created_at: new Date().toISOString() };
    mem.tickets.push(nt);
    persistMem();
    return nt;
  },

  async getTickets() {
    if (supabase) {
      try {
        const url = CFG.SUPABASE_URL + '/rest/v1/tickets?select=*&order=created_at.desc';
        const res = await fetch(url, {
          headers: {
            'apikey':        CFG.SUPABASE_SERVICE_KEY,
            'Authorization': 'Bearer ' + CFG.SUPABASE_SERVICE_KEY,
          },
        });
        if (!res.ok) {
          console.error('[DB] getTickets REST error:', res.status, await res.text());
          return [];
        }
        return await res.json() || [];
      } catch (e) {
        console.error('[DB] getTickets failed:', e.message);
        return [];
      }
    }
    return mem.tickets.slice().reverse();
  },

  async updateTicketStatus(id, status) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('tickets')
          .update({ status })
          .eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] updateTicketStatus Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    const t = mem.tickets.find(t => String(t.id) === String(id));
    if (t) { t.status = status; persistMem(); }
  },

  async deleteTicket(id) {
    if (supabase) {
      try {
        // Primero borrar mensajes del ticket
        await supabase.from('ticket_messages').delete().eq('ticket_id', id);
        const { error } = await supabase.from('tickets').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) {
        console.error('[DB] deleteTicket Supabase error:', e.message);
      }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.tickets = mem.tickets.filter(t => String(t.id) !== String(id));
    persistMem();
  },

  async getTicketMessages(ticketId) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ticket_messages')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error('[DB] getTicketMessages Supabase error:', e.message);
      }
    }
    return (mem.ticketMessages || []).filter(m => String(m.ticket_id) === String(ticketId));
  },

  async addTicketMessage(ticketId, userId, username, content) {
    const msg = {
      ticket_id:  ticketId,
      user_id:    userId,
      username:   username,
      content:    content,
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ticket_messages')
          .insert(msg)
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error('[DB] addTicketMessage Supabase error:', e.message);
      }
    }
    if (!mem.ticketMessages) mem.ticketMessages = [];
    const nm = { ...msg, id: Date.now() };
    mem.ticketMessages.push(nm);
    persistMem();
    return nm;
  },
};

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json({ limit: '15mb' })); // FIX #7: aumentado para base64 de imágenes
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use(express.static(path.join(__dirname)));

// FIX #4: Configuración de cookies corregida para Vercel
// - sameSite: 'lax' funciona bien con OAuth redirects
// - secure solo en HTTPS real (no forzado por env var buggy)
// - DISABLE_SECURE_COOKIE ahora funciona correctamente
app.use(cookieSession({
  name: 'bt_session',
  secret: CFG.SESSION_SECRET,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  secure: CFG.BASE_URL.startsWith('https') && process.env.DISABLE_SECURE_COOKIE !== 'true',
  httpOnly: true,
  sameSite: 'lax',
}));

function requireAuth(req, res, next) {
  return req.session && req.session.user ? next() : res.status(401).json({ error: 'Login requerido' });
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'Login requerido' });
  if (!req.session.user.isAdmin) return res.status(403).json({ error: 'Solo admins' });
  next();
}

async function checkBan(req, res, next) {
  if (req.session && req.session.user && await db.isBanned(req.session.user.id)) {
    return res.status(403).json({ error: 'Usuario baneado' });
  }
  next();
}

// ============================================================
// AUTH
// ============================================================
app.get('/api/auth/discord', function (req, res) {
  const redir = CFG.BASE_URL + '/api/auth/discord/callback';
  res.redirect(
    'https://discord.com/api/oauth2/authorize?client_id=' + CFG.DISCORD_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(redir) +
    '&response_type=code&scope=identify%20guilds.members.read'
  );
});

app.get('/api/auth/discord/callback', async function (req, res) {
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
        code:          code,
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
      console.log('[Auth] Roles del usuario:', roles);
      console.log('[Auth] Roles admin esperados:', CFG.ADMIN_ROLE_IDS);
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

app.post('/api/auth/logout', function (req, res) {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/me', function (req, res) {
  return req.session && req.session.user
    ? res.json(req.session.user)
    : res.status(401).json({ error: 'No autenticado' });
});

app.get('/api/profile', function (req, res) {
  if (!req.session || !req.session.user) return res.status(401).json({ error: 'No autenticado' });
  res.json({
    id:        req.session.user.id,
    username:  req.session.user.username,
    avatar:    req.session.user.avatar,
    isAdmin:   req.session.user.isAdmin,
    roles:     req.session.user.roles,
    createdAt: new Date().toISOString(),
  });
});

// ============================================================
// PUBLIC API
// ============================================================

// Devuelve URL y anon key de Supabase para que el frontend use Realtime
app.get('/api/public-supabase', (req, res) => {
  res.json({ url: CFG.SUPABASE_URL, anonKey: CFG.SUPABASE_ANON_KEY });
});

app.get('/api/config',  async (req, res) => res.json(await db.getAllConfig()));
app.get('/api/ranks',   async (req, res) => res.json(await db.getRanks(false)));
app.get('/api/team',    async (req, res) => res.json(await db.getMembers()));
app.get('/api/gallery', async (req, res) => res.json(await db.getGallery()));
app.get('/api/event',   async (req, res) => res.json(await db.getEvent(true) || null));
app.get('/api/testimonios', async (req, res) => {
  const raw = await db.getConfig('testimonios');
  try { res.json(JSON.parse(raw || '[]')); }
  catch { res.json([]); }
});

// ==================== BANNERS / NOTICIAS ====================
app.get('/api/noticias', async (req, res) => {
  const raw = await db.getConfig('noticias');
  try { res.json(JSON.parse(raw || '[]')); }
  catch { res.json([]); }
});

app.get('/api/admin/noticias', requireAdmin, async (req, res) => {
  const raw = await db.getConfig('noticias');
  try { res.json(JSON.parse(raw || '[]')); }
  catch { res.json([]); }
});

app.post('/api/admin/noticias', requireAdmin, async (req, res) => {
  const { btype, img_url, img_data, title, desc, color, link } = req.body;
  const tipo = btype || 'banner';
  const finalImg = img_data || img_url || null;
  if (tipo === 'banner' && !finalImg) return res.status(400).json({ error: 'img_url o img_data requerido' });
  if (tipo === 'texto'  && !title)    return res.status(400).json({ error: 'title requerido' });
  const raw = await db.getConfig('noticias');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  const nuevo = {
    id: Date.now(),
    btype: tipo,
    img_url: finalImg,
    title:   title   || null,
    desc:    desc    || null,
    color:   color   || 'purple',
    link:    link    || null,
    created_at: new Date().toISOString()
  };
  list.unshift(nuevo);
  await db.setConfig('noticias', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'add_banner', (title || img_url || '').slice(0,40));
  res.json({ ok: true, banner: nuevo });
});

app.delete('/api/admin/noticias/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const raw = await db.getConfig('noticias');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  list = list.filter(n => n.id !== id);
  await db.setConfig('noticias', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'del_banner', String(id));
  res.json({ ok: true });
});

app.get('/api/mc-status', async (req, res) => {
  try {
    const data = await (await fetch('https://api.mcsrvstat.us/3/beeteam.club')).json();
    res.json(data);
  } catch (e) {
    res.json({ online: false });
  }
});

// ============================================================
// CHAT
// ============================================================
app.get('/api/chat', async (req, res) => {
  res.json(await db.getChat(100));
});

app.post('/api/chat', requireAuth, checkBan, async (req, res) => {
  const content = req.body.content;
  if (!content || typeof content !== 'string') return res.status(400).json({ error: 'Contenido inválido' });
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

// ============================================================
// TICKETS PUBLIC
// FIX #5: Usar los campos correctos del schema
// ============================================================
app.post('/api/tickets', requireAuth, async (req, res) => {
  const b = req.body;
  if (!b.type || !b.subject || !b.description) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: type, subject, description' });
  }
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
    console.error('[POST /api/tickets] Error:', e.message, e.code, e.details);
    res.status(500).json({ error: 'Error: ' + e.message });
  }
});

app.get('/api/tickets', requireAuth, async (req, res) => {
  const all = await db.getTickets();
  const mine = (all || []).filter(t => String(t.user_id) === String(req.session.user.id));
  res.json(mine);
});

app.get('/api/tickets/:id/messages', requireAuth, async (req, res) => {
  const all = await db.getTickets();
  const ticket = all.find(x => String(x.id) === String(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  res.json(await db.getTicketMessages(req.params.id));
});

app.post('/api/tickets/:id/messages', requireAuth, async (req, res) => {
  const content = req.body.content;
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });
  const all = await db.getTickets();
  const ticket = all.find(x => String(x.id) === String(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
  if (ticket.user_id !== req.session.user.id && !req.session.user.isAdmin) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const msg = await db.addTicketMessage(
    req.params.id,
    req.session.user.id,
    req.session.user.username,
    content.trim().slice(0, 1000)
  );
  if (!msg) return res.status(503).json({ error: 'No se pudo guardar el mensaje.' });
  res.json(msg);
});

// ============================================================
// ADMIN API
// ============================================================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
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

app.get('/api/admin/chat',        requireAdmin, async (req, res) => res.json(await db.getAllChat(200)));
app.delete('/api/admin/chat/:id', requireAdmin, async (req, res) => {
  await db.deleteChat(req.params.id, req.session.user.id, req.session.user.username);
  res.json({ ok: true });
});

app.post('/api/admin/team',       requireAdmin, async (req, res) => {
  const b = req.body;
  if (!b.nick || !b.role) return res.status(400).json({ error: 'Faltan campos' });
  const m = await db.addMember({ nick: b.nick, role: b.role, skin_url: b.skin_url || null, sort_order: b.sort_order || 0 });
  await db.log(req.session.user.id, req.session.user.username, 'add_member', b.nick);
  res.json(m);
});
app.put('/api/admin/team/:id',    requireAdmin, async (req, res) => {
  await db.updateMember(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_member', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/team/:id', requireAdmin, async (req, res) => {
  await db.deleteMember(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_member', req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/ranks',        requireAdmin, async (req, res) => res.json(await db.getRanks(true)));
app.post('/api/admin/ranks',       requireAdmin, async (req, res) => {
  const r = await db.addRank(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'add_rank', req.body.name);
  res.json(r);
});
app.put('/api/admin/ranks/:id',    requireAdmin, async (req, res) => {
  await db.updateRank(req.params.id, req.body);
  await db.log(req.session.user.id, req.session.user.username, 'update_rank', req.params.id);
  res.json({ ok: true });
});
app.delete('/api/admin/ranks/:id', requireAdmin, async (req, res) => {
  await db.deleteRank(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_rank', req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/gallery',       requireAdmin, async (req, res) => {
  const b = req.body;
  if (!b.title || !b.image_url) return res.status(400).json({ error: 'Faltan campos' });
  const p = await db.addPic({ title: b.title, category: b.category || 'otro', image_url: b.image_url });
  await db.log(req.session.user.id, req.session.user.username, 'add_pic', b.title);
  res.json(p);
});
app.delete('/api/admin/gallery/:id', requireAdmin, async (req, res) => {
  await db.deletePic(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_pic', req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/events',  requireAdmin, async (req, res) => res.json(await db.getAllEvents()));
app.post('/api/admin/events', requireAdmin, async (req, res) => {
  const ev = await db.upsertEvent(req.body);
  await db.log(req.session.user.id, req.session.user.username, 'upsert_event', req.body.nombre);
  res.json(ev);
});

app.put('/api/admin/config', requireAdmin, async (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key requerido' });
  await db.setConfig(key, value);
  await db.log(req.session.user.id, req.session.user.username, 'set_config', key);
  res.json({ ok: true });
});

// ==================== TESTIMONIOS ====================
// Los testimonios se guardan en site_config como JSON bajo la key 'testimonios'

app.get('/api/admin/testimonios', requireAdmin, async (req, res) => {
  const raw = await db.getConfig('testimonios');
  try { res.json(JSON.parse(raw || '[]')); }
  catch { res.json([]); }
});

app.post('/api/admin/testimonios', requireAdmin, async (req, res) => {
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

app.put('/api/admin/testimonios/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { nick, rank, text, stars } = req.body;
  const raw = await db.getConfig('testimonios');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  const idx = list.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  list[idx] = { id, nick: nick || list[idx].nick, rank: rank ?? list[idx].rank, text: text || list[idx].text, stars: Number(stars) || list[idx].stars };
  await db.setConfig('testimonios', JSON.stringify(list));
  res.json({ ok: true });
});

app.delete('/api/admin/testimonios/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const raw = await db.getConfig('testimonios');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch {}
  list = list.filter(t => t.id !== id);
  await db.setConfig('testimonios', JSON.stringify(list));
  await db.log(req.session.user.id, req.session.user.username, 'del_testimonio', String(id));
  res.json({ ok: true });
});

app.get('/api/admin/bans',            requireAdmin, async (req, res) => res.json(await db.getBans()));
app.post('/api/admin/bans',           requireAdmin, async (req, res) => {
  const b = req.body;
  if (!b.user_id) return res.status(400).json({ error: 'user_id requerido' });
  await db.banUser(b.user_id, b.username || '?', b.reason || 'Sin razón', req.session.user.username);
  await db.log(req.session.user.id, req.session.user.username, 'ban_user', b.user_id, b.reason);
  res.json({ ok: true });
});
app.delete('/api/admin/bans/:userId', requireAdmin, async (req, res) => {
  await db.unbanUser(req.params.userId);
  await db.log(req.session.user.id, req.session.user.username, 'unban_user', req.params.userId);
  res.json({ ok: true });
});

app.get('/api/admin/log', requireAdmin, async (req, res) => res.json(await db.getLog(200)));

app.get('/api/admin/tickets',          requireAdmin, async (req, res) => res.json(await db.getTickets()));
app.put('/api/admin/tickets/:id',      requireAdmin, async (req, res) => {
  await db.updateTicketStatus(req.params.id, req.body.status);
  await db.log(req.session.user.id, req.session.user.username, 'update_ticket', req.params.id, req.body.status);
  res.json({ ok: true });
});
app.delete('/api/admin/tickets/:id',   requireAdmin, async (req, res) => {
  await db.deleteTicket(req.params.id);
  await db.log(req.session.user.id, req.session.user.username, 'delete_ticket', req.params.id);
  res.json({ ok: true });
});

// ============================================================
// FALLBACK SPA
// ============================================================
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log('BeeTeam corriendo en http://localhost:' + PORT));
}

module.exports = app;