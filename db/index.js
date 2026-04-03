// db/index.js — Helpers de acceso a datos (Supabase + fallback local)
'use strict';

const fetch   = (...a) => import('node-fetch').then(({ default: f }) => f(...a));
const supabase        = require('./client');
const CFG             = require('../config');
const { mem, persistMem } = require('./persistence');

const db = {

  // ─── CHAT ──────────────────────────────────────────────────
  async getChat(limit = 100) {
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
      } catch (e) { console.error('[DB] getChat:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.chat.filter(m => !m.deleted).slice(-limit);
  },

  async addChat(msg) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages').insert(msg).select().single();
        if (error) throw error;
        return data;
      } catch (e) { console.error('[DB] addChat:', e.message); }
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
      } catch (e) { console.error('[DB] deleteChat:', e.message); }
    }
    const m = mem.chat.find(m => String(m.id) === String(id));
    if (m) { m.deleted = true; m.deleted_by = adminId; }
    persistMem();
  },

  async getAllChat(limit = 200) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getAllChat:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.chat.slice().reverse().slice(0, limit);
  },

  // ─── TEAM ──────────────────────────────────────────────────
  async getMembers() {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('team_members').select('*').order('sort_order');
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getMembers:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.members;
  },

  async addMember(m) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('team_members').insert(m).select().single();
        if (error) throw error;
        return data;
      } catch (e) { console.error('[DB] addMember:', e.message); }
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
        const { error } = await supabase.from('team_members').update(data).eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] updateMember:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    const m = mem.members.find(m => String(m.id) === String(id));
    if (m) Object.assign(m, data);
    persistMem();
  },

  async deleteMember(id) {
    if (supabase) {
      try {
        const { error } = await supabase.from('team_members').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] deleteMember:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.members = mem.members.filter(m => String(m.id) !== String(id));
    persistMem();
  },

  // ─── RANKS ─────────────────────────────────────────────────
  async getRanks(adminMode) {
    if (supabase) {
      try {
        let q = supabase.from('ranks').select('*').order('sort_order');
        if (!adminMode) q = q.eq('active', true);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getRanks:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return adminMode ? mem.ranks : mem.ranks.filter(r => r.active);
  },

  async addRank(r) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('ranks').insert(r).select().single();
        if (error) throw error;
        return data;
      } catch (e) { console.error('[DB] addRank:', e.message); }
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
        const { error } = await supabase.from('ranks').update(data).eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] updateRank:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    const r = mem.ranks.find(r => String(r.id) === String(id));
    if (r) Object.assign(r, data);
    persistMem();
  },

  async deleteRank(id) {
    if (supabase) {
      try {
        const { error } = await supabase.from('ranks').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] deleteRank:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.ranks = mem.ranks.filter(r => String(r.id) !== String(id));
    persistMem();
  },

  // ─── GALLERY ───────────────────────────────────────────────
  async getGallery() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('gallery_pics').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getGallery:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.gallery;
  },

  async addPic(p) {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('gallery_pics').insert(p).select().single();
        if (error) throw error;
        return data;
      } catch (e) { console.error('[DB] addPic:', e.message); }
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
        const { error } = await supabase.from('gallery_pics').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] deletePic:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.gallery = mem.gallery.filter(p => String(p.id) !== String(id));
    persistMem();
  },

  // ─── EVENTS ────────────────────────────────────────────────
  async getEvent(activeOnly) {
    if (supabase) {
      try {
        let q = supabase.from('events').select('*').order('created_at', { ascending: false }).limit(1);
        if (activeOnly) q = q.eq('activo', true);
        const { data, error } = await q;
        if (error) throw error;
        return (data && data[0]) || null;
      } catch (e) { console.error('[DB] getEvent:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return null;
    const evs = activeOnly ? mem.events.filter(e => e.activo) : mem.events;
    return evs[evs.length - 1] || null;
  },

  async getAllEvents() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('events').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getAllEvents:', e.message); }
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
      } catch (e) { console.error('[DB] upsertEvent:', e.message); }
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

  // ─── CONFIG ────────────────────────────────────────────────
  async getConfig(key) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('site_config').select('value').eq('key', key).single();
        if (error && error.code !== 'PGRST116') throw error;
        return (data && data.value) || null;
      } catch (e) { console.error('[DB] getConfig:', e.message); }
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
      } catch (e) { console.error('[DB] setConfig:', e.message); }
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
      } catch (e) { console.error('[DB] getAllConfig:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return {};
    return mem.config;
  },

  // ─── BANS ──────────────────────────────────────────────────
  async getBans() {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('banned_users').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getBans:', e.message); }
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
      } catch (e) { console.error('[DB] banUser:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    const existing = mem.banned.findIndex(b => b.user_id === userId);
    const entry = { user_id: userId, username, reason, banned_by: bannedBy, created_at: new Date().toISOString() };
    if (existing >= 0) mem.banned[existing] = entry;
    else mem.banned.push(entry);
    persistMem();
  },

  async unbanUser(userId) {
    if (supabase) {
      try {
        const { error } = await supabase.from('banned_users').delete().eq('user_id', userId);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] unbanUser:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.banned = mem.banned.filter(b => b.user_id !== userId);
    persistMem();
  },

  async isBanned(userId) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('banned_users').select('user_id').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return !!data;
      } catch (e) {
        console.error('[DB] isBanned:', e.message);
        return false;
      }
    }
    if (CFG.IS_SERVERLESS) return false;
    return mem.banned.some(b => b.user_id === userId);
  },

  // ─── ADMIN LOG ─────────────────────────────────────────────
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
      } catch (e) { console.error('[DB] log:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.adminLog.unshift(entry);
    if (mem.adminLog.length > 500) mem.adminLog.pop();
    persistMem();
  },

  async getLog(limit = 100) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('admin_log').select('*').order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getLog:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return [];
    return mem.adminLog.slice(0, limit);
  },

  // ─── TICKETS ───────────────────────────────────────────────
  async addTicket(t) {
    if (supabase) {
      try {
        const ticketData = {
          user_id:     t.user_id,
          username:    t.username || 'Desconocido',
          type:        t.type,
          subject:     t.subject,
          description: t.description,
          status:      'pending',
        };
        if (t.minecraft_nick) ticketData.minecraft_nick = t.minecraft_nick;

        const url = require('../config').SUPABASE_URL + '/rest/v1/tickets';
        const CFG2 = require('../config');
        const headers = {
          'Content-Type':  'application/json',
          'apikey':        CFG2.SUPABASE_SERVICE_KEY,
          'Authorization': 'Bearer ' + CFG2.SUPABASE_SERVICE_KEY,
          'Prefer':        'return=representation',
        };

        let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(ticketData) });

        if (!res.ok) {
          const errText = await res.text();
          console.error('[DB] addTicket REST error:', res.status, errText);
          if (errText.includes('minecraft_nick')) {
            delete ticketData.minecraft_nick;
            res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(ticketData) });
            if (!res.ok) {
              console.error('[DB] addTicket retry error:', res.status, await res.text());
              return null;
            }
          } else {
            return null;
          }
        }

        const data = await res.json();
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
        const CFG2 = require('../config');
        const url = CFG2.SUPABASE_URL + '/rest/v1/tickets?select=*&order=created_at.desc';
        const res = await fetch(url, {
          headers: { 'apikey': CFG2.SUPABASE_SERVICE_KEY, 'Authorization': 'Bearer ' + CFG2.SUPABASE_SERVICE_KEY },
        });
        if (!res.ok) { console.error('[DB] getTickets REST error:', res.status); return []; }
        return await res.json() || [];
      } catch (e) { console.error('[DB] getTickets failed:', e.message); return []; }
    }
    return mem.tickets.slice().reverse();
  },

  async updateTicketStatus(id, status) {
    if (supabase) {
      try {
        const { error } = await supabase.from('tickets').update({ status }).eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] updateTicketStatus:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    const t = mem.tickets.find(t => String(t.id) === String(id));
    if (t) { t.status = status; persistMem(); }
  },

  async deleteTicket(id) {
    if (supabase) {
      try {
        await supabase.from('ticket_messages').delete().eq('ticket_id', id);
        const { error } = await supabase.from('tickets').delete().eq('id', id);
        if (error) throw error;
        return;
      } catch (e) { console.error('[DB] deleteTicket:', e.message); }
    }
    if (CFG.IS_SERVERLESS) return;
    mem.tickets = mem.tickets.filter(t => String(t.id) !== String(id));
    persistMem();
  },

  async getTicketMessages(ticketId) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('ticket_messages').select('*').eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (e) { console.error('[DB] getTicketMessages:', e.message); }
    }
    return (mem.ticketMessages || []).filter(m => String(m.ticket_id) === String(ticketId));
  },

  async addTicketMessage(ticketId, userId, username, content) {
    const msg = { ticket_id: ticketId, user_id: userId, username, content, created_at: new Date().toISOString() };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('ticket_messages').insert(msg).select().single();
        if (error) throw error;
        return data;
      } catch (e) { console.error('[DB] addTicketMessage:', e.message); }
    }
    if (!mem.ticketMessages) mem.ticketMessages = [];
    const nm = { ...msg, id: Date.now() };
    mem.ticketMessages.push(nm);
    persistMem();
    return nm;
  },
};

module.exports = db;
