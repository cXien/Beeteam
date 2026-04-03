// db/client.js — Inicialización del cliente Supabase
'use strict';

const { createClient } = require('@supabase/supabase-js');

const CFG = require('../config');

let supabase = null;

if (CFG.SUPABASE_URL && CFG.SUPABASE_SERVICE_KEY) {
  supabase = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
      },
    },
  });
  console.log('[Supabase] Conectado correctamente ✓');
} else {
  console.error(
    '[Supabase] NO conectado — verifica SUPABASE_URL y SUPABASE_SERVICE_KEY en las variables de entorno'
  );
}

module.exports = supabase;
