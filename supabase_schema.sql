-- ============================================================
-- BEETEAM — SCHEMA COMPLETO
-- Ejecuta esto ENTERO en Supabase → SQL Editor
-- Borra y recrea todo desde cero limpio
-- ============================================================

-- 1. BORRAR TODO LO EXISTENTE (en orden por dependencias)
DROP TABLE IF EXISTS ticket_messages CASCADE;
DROP TABLE IF EXISTS tickets         CASCADE;
DROP TABLE IF EXISTS admin_log       CASCADE;
DROP TABLE IF EXISTS banned_users    CASCADE;
DROP TABLE IF EXISTS site_config     CASCADE;
DROP TABLE IF EXISTS events          CASCADE;
DROP TABLE IF EXISTS gallery_pics    CASCADE;
DROP TABLE IF EXISTS ranks           CASCADE;
DROP TABLE IF EXISTS team_members    CASCADE;
DROP TABLE IF EXISTS chat_messages   CASCADE;

-- ============================================================
-- 2. CREAR TABLAS
-- ============================================================

-- CHAT MESSAGES
CREATE TABLE chat_messages (
  id          bigserial PRIMARY KEY,
  user_id     text NOT NULL,
  username    text NOT NULL,
  avatar      text,
  role        text,
  content     text NOT NULL,
  deleted     boolean DEFAULT false,
  deleted_by  text,
  deleted_at  timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- TEAM MEMBERS
CREATE TABLE team_members (
  id         bigserial PRIMARY KEY,
  nick       text NOT NULL,
  role       text NOT NULL DEFAULT 'staff',
  skin_url   text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- RANKS (tienda)
CREATE TABLE ranks (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  name_highlight text NOT NULL,
  price          text NOT NULL,
  featured       boolean DEFAULT false,
  perks          text[] DEFAULT '{}',
  sort_order     integer DEFAULT 0,
  active         boolean DEFAULT true,
  created_at     timestamptz DEFAULT now()
);

-- GALLERY PICS
CREATE TABLE gallery_pics (
  id         bigserial PRIMARY KEY,
  title      text NOT NULL,
  category   text NOT NULL DEFAULT 'otro',
  image_url  text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- EVENTS (countdown)
CREATE TABLE events (
  id          bigserial PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text DEFAULT '',
  fecha       timestamptz NOT NULL,
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- SITE CONFIG
CREATE TABLE site_config (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

-- BANNED USERS
CREATE TABLE banned_users (
  user_id    text PRIMARY KEY,
  username   text,
  reason     text,
  banned_by  text,
  created_at timestamptz DEFAULT now()
);

-- ADMIN LOG
CREATE TABLE admin_log (
  id         bigserial PRIMARY KEY,
  admin_id   text NOT NULL,
  admin_name text NOT NULL,
  action     text NOT NULL,
  target     text,
  detail     text,
  created_at timestamptz DEFAULT now()
);

-- TICKETS
CREATE TABLE tickets (
  id             bigserial PRIMARY KEY,
  user_id        text NOT NULL,
  username       text NOT NULL DEFAULT 'Desconocido',
  minecraft_nick text,
  type           text NOT NULL DEFAULT 'Otro',
  subject        text NOT NULL DEFAULT 'Sin asunto',
  description    text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'pending',
  created_at     timestamptz DEFAULT now()
);

-- TICKET MESSAGES
CREATE TABLE ticket_messages (
  id         bigserial PRIMARY KEY,
  ticket_id  bigint REFERENCES tickets(id) ON DELETE CASCADE,
  user_id    text NOT NULL,
  username   text NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. DATOS INICIALES
-- ============================================================

INSERT INTO ranks (name, name_highlight, price, featured, perks, sort_order) VALUES
  ('Bee Worker',  'Bee',   '$2.99',  false, ARRAY['Prefix [Worker] en el chat','Kit de inicio exclusivo','Acceso a /sethome x2','Color de nombre personalizado'], 1),
  ('Honey VIP',   'Honey', '$6.99',  true,  ARRAY['Todo lo de Worker','Prefix [Honey] brillante','/fly en spawn y zonas safe','/sethome x5 · /nick','Partículas exclusivas','Acceso a eventos VIP'], 2),
  ('Queen Bee',   'Queen', '$12.99', false, ARRAY['Todo lo de Honey VIP','Prefix [Queen] dorado animado','/fly global · /god','Homes ilimitados','Acceso a servidor creativo','Rol especial en Discord','Prioridad en soporte'], 3),
  ('Royal Elite', 'Royal', '$24.99', false, ARRAY['Todo lo de Queen Bee','Prefix [Royal] con efectos únicos','Comandos admin limitados','Badge exclusivo en Discord','Chat privado con staff','Kit mensual legendario'], 4);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE chat_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_pics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POLÍTICAS (service_role del backend ignora RLS)
-- ============================================================

-- Chat: leer solo mensajes no borrados
CREATE POLICY "chat_read" ON chat_messages FOR SELECT USING (deleted = false);

-- Ranks: leer solo activos
CREATE POLICY "ranks_read" ON ranks FOR SELECT USING (active = true);

-- Team, gallery, config, events: lectura pública
CREATE POLICY "team_read"    ON team_members  FOR SELECT USING (true);
CREATE POLICY "gallery_read" ON gallery_pics  FOR SELECT USING (true);
CREATE POLICY "config_read"  ON site_config   FOR SELECT USING (true);
CREATE POLICY "events_read"  ON events        FOR SELECT USING (activo = true);

-- Tickets: lectura y escritura (el backend controla el acceso)
CREATE POLICY "tickets_all"         ON tickets         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ticket_messages_all" ON ticket_messages FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. REFRESCAR SCHEMA CACHE DE POSTGREST
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- 7. VERIFICACIÓN FINAL
-- ============================================================
SELECT
  t.table_name,
  COUNT(c.column_name) AS columnas
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;