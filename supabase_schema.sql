

-- CHAT MESSAGES
create table if not exists chat_messages (
  id          bigserial primary key,
  user_id     text not null,
  username    text not null,
  avatar      text,
  role        text,
  content     text not null,
  deleted     boolean default false,
  deleted_by  text,
  deleted_at  timestamptz,
  created_at  timestamptz default now()
);

-- TEAM MEMBERS
create table if not exists team_members (
  id         bigserial primary key,
  nick       text not null,
  role       text not null default 'staff',
  skin_url   text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- RANKS (tienda)
create table if not exists ranks (
  id             bigserial primary key,
  name           text not null,
  name_highlight text not null,
  price          text not null,
  featured       boolean default false,
  perks          text[] default '{}',
  sort_order     integer default 0,
  active         boolean default true,
  created_at     timestamptz default now()
);

-- GALLERY PICS
create table if not exists gallery_pics (
  id         bigserial primary key,
  title      text not null,
  category   text not null default 'otro',
  image_url  text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- EVENTS (countdown)
create table if not exists events (
  id         bigserial primary key,
  nombre     text not null,
  descripcion text default '',
  fecha      timestamptz not null,
  activo     boolean default true,
  created_at timestamptz default now()
);

-- SITE CONFIG (logo, video, etc.)
create table if not exists site_config (
  key        text primary key,
  value      text,
  updated_at timestamptz default now()
);

-- BANNED USERS
create table if not exists banned_users (
  user_id    text primary key,
  username   text,
  reason     text,
  banned_by  text,
  created_at timestamptz default now()
);

-- ADMIN LOG (auditoría de acciones admin)
create table if not exists admin_log (
  id         bigserial primary key,
  admin_id   text not null,
  admin_name text not null,
  action     text not null,
  target     text,
  detail     text,
  created_at timestamptz default now()
);

-- Datos iniciales para ranks
insert into ranks (name, name_highlight, price, featured, perks, sort_order) values
  ('Bee Worker',  'Bee',   '$2.99',  false, ARRAY['Prefix [Worker] en el chat','Kit de inicio exclusivo','Acceso a /sethome x2','Color de nombre personalizado'], 1),
  ('Honey VIP',   'Honey', '$6.99',  true,  ARRAY['Todo lo de Worker','Prefix [Honey] brillante','/fly en spawn y zonas safe','/sethome x5 · /nick','Partículas exclusivas','Acceso a eventos VIP'], 2),
  ('Queen Bee',   'Queen', '$12.99', false, ARRAY['Todo lo de Honey VIP','Prefix [Queen] dorado animado','/fly global · /god','Homes ilimitados','Acceso a servidor creativo','Rol especial en Discord','Prioridad en soporte'], 3),
  ('Royal Elite', 'Royal', '$24.99', false, ARRAY['Todo lo de Queen Bee','Prefix [Royal] con efectos únicos','Comandos admin limitados','Badge exclusivo en Discord','Chat privado con staff','Kit mensual legendario'], 4)
on conflict do nothing;

-- RLS: habilitar seguridad a nivel de fila (Supabase)
alter table chat_messages enable row level security;
alter table team_members   enable row level security;
alter table ranks          enable row level security;
alter table gallery_pics   enable row level security;
alter table events         enable row level security;
alter table site_config    enable row level security;
alter table banned_users   enable row level security;
alter table admin_log      enable row level security;

-- Políticas: el backend usa service_role key (ignora RLS)
-- Los clientes anon solo pueden leer chat no borrado, ranks activos, equipo, galería, eventos activos
create policy "chat_read" on chat_messages for select using (deleted = false);
create policy "ranks_read" on ranks for select using (active = true);
create policy "team_read" on team_members for select using (true);
create policy "gallery_read" on gallery_pics for select using (true);
create policy "events_read" on events for select using (activo = true);
create policy "config_read" on site_config for select using (true);
