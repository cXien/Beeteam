# 🐝 BeeTeam — Guía de despliegue completa

## Lo que tienes en este proyecto

```
beeteam/
├── index.html          ← Página principal completa
├── server.js           ← Backend (Node.js + Express)
├── package.json        ← Dependencias
├── vercel.json         ← Config para Vercel
├── .env.example        ← Plantilla de variables de entorno
├── .gitignore
└── public/
    ├── css/main.css    ← Todos los estilos
    └── js/app.js       ← Todo el JavaScript del frontend
```

---

## PASO 1 — Configurar Discord

### 1.1 Crear la aplicación OAuth2 (si aún no lo has hecho)
1. Ve a https://discord.com/developers/applications
2. Haz clic en **New Application** → ponle el nombre "BeeTeam"
3. Ve a **OAuth2** → copia el **Client ID** y el **Client Secret**
4. En **Redirects**, añade: `https://TU_DOMINIO.vercel.app/api/auth/discord/callback`
   - En local también: `http://localhost:3000/api/auth/discord/callback`

### 1.2 Obtener IDs necesarios
- **Guild ID** (ID de tu servidor): activa modo desarrollador en Discord → clic derecho en el icono de tu servidor → **Copiar ID**
- **Role ID** de admin: Configuración del servidor → Roles → clic derecho en el rol de admin → **Copiar ID**

---

## PASO 2 — Subir a GitHub

1. Instala [Git](https://git-scm.com/)
2. Crea un repositorio **privado** en https://github.com/new
3. Desde la carpeta del proyecto:
```bash
git init
git add .
git commit -m "Initial BeeTeam website"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/beeteam.git
git push -u origin main
```

---

## PASO 3 — Desplegar en Vercel

1. Ve a https://vercel.com → crea cuenta con GitHub
2. Haz clic en **Add New → Project**
3. Importa tu repositorio de GitHub
4. En **Environment Variables**, añade estas variables (una por una):

| Variable | Valor |
|---|---|
| `DISCORD_CLIENT_ID` | Tu Client ID de Discord |
| `DISCORD_CLIENT_SECRET` | Tu Client Secret de Discord |
| `DISCORD_GUILD_ID` | ID de tu servidor Discord |
| `ADMIN_ROLE_IDS` | IDs de roles admin separados por coma |
| `SESSION_SECRET` | Texto aleatorio largo (mínimo 32 chars) |
| `BASE_URL` | `https://TU-PROYECTO.vercel.app` |
| `NODE_ENV` | `production` |

5. Haz clic en **Deploy**
6. Vercel te dará una URL como `https://beeteam-abc123.vercel.app`

### 3.1 Dominio personalizado (beeteam.club)
1. En Vercel → tu proyecto → **Settings → Domains**
2. Añade `beeteam.club` y `www.beeteam.club`
3. Vercel te dará unos registros DNS que debes poner en donde compraste el dominio

---

## PASO 4 — Personalizar la web

### Cosas que debes cambiar en `index.html` y `app.js`:

**En `index.html`** — busca y reemplaza:
- `https://discord.gg/TU_INVITE` → tu link real de invitación al Discord

**En `public/js/app.js`** — son los datos de la web:
- Los miembros del equipo (nick, rol, y sube la skin desde el Dashboard)
- Los rangos y precios (también editables desde el Dashboard)
- Los testimonios de jugadores

### Dashboard (solo admins)
- Inicia sesión con tu Discord
- El botón **Dashboard** aparece automáticamente si tu rol en Discord está en `ADMIN_ROLE_IDS`
- Desde ahí puedes: subir logo, subir video de fondo, gestionar miembros del equipo (con imagen de skin manual), editar rangos, configurar el evento/contador y subir fotos a la galería

---

## PASO 5 — Conectar con tu bot de Discord

Tu bot ya está hecho. Para que asigne rangos automáticamente cuando alguien compre:

1. Cuando el admin crea un ticket de compra, el staff lo procesa manualmente por ahora
2. Para automatizar: tu bot puede escuchar mensajes en un canal específico y usar `guild.members.edit()` para asignar el rol al usuario

Si quieres que lo automatice con el bot, dime y te doy el código específico para tu bot.

---

## PASO 6 — Minecraft (ver jugadores online)

La web ya consulta automáticamente `api.mcsrvstat.us/3/beeteam.club` para mostrar jugadores online en tiempo real. Solo asegúrate de que tu servidor esté corriendo en `beeteam.club` (el dominio ya está configurado en el código).

---

## Notas importantes

- **Chat persistente**: el chat actual guarda mensajes en memoria (se borran al redeploy). Para hacerlo permanente, conecta una base de datos gratuita como [Supabase](https://supabase.com) o [PlanetScale](https://planetscale.com). Dime si quieres eso y te doy el código.
- **Imágenes/fotos**: por ahora se guardan en localStorage del navegador del admin. Para hacerlas permanentes en producción necesitarás almacenamiento como Cloudinary (gratis hasta 25GB). Dime si lo necesitas.
- **Seguridad**: nunca subas el archivo `.env` a GitHub (ya está en `.gitignore`). Solo pon las variables en Vercel.

---

## Soporte y dudas

Si algo no funciona, revisa:
1. Las variables de entorno en Vercel estén correctas
2. El Redirect URI en Discord Developer Portal coincida exactamente con tu dominio
3. El bot tenga permiso para gestionar roles en tu servidor
