// config.js — Configuración centralizada de la aplicación
'use strict';

require('dotenv').config();

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

module.exports = CFG;
