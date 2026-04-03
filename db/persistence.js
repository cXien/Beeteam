// db/persistence.js — Persistencia local para desarrollo (nunca en Vercel)
'use strict';

const fs   = require('fs');
const path = require('path');
const CFG  = require('../config');

let persistenceEnabled = !CFG.IS_SERVERLESS;
let SHADOW_PATH = '';

if (!CFG.IS_SERVERLESS) {
  SHADOW_PATH = path.join(__dirname, '..', 'db_persistence');
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

// In-memory fallback solo para desarrollo local sin Supabase
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

module.exports = { mem, persistMem };
