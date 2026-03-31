/* ============================================================
   BEETEAM — app.js v4 (FIXED)
   Bugs corregidos:
   1. loadUser() ahora maneja correctamente el estado de sesión
   2. renderShop() ya no duplica rangos al refrescar
   3. Chat poll no se acumula en múltiples timers
   4. Lightbox index correcto al filtrar categorías
   5. submitTicket() espera respuesta antes de limpiar form
   6. openBuyModal() ya no falla si el modal no existe
   7. Modal de ticket se abre/cierra correctamente
   8. Admin tabs: loadAdminTickets panel visible corregido
   9. startChatPoll() no se llama múltiples veces
   10. Testimonios no se duplican en re-renders
============================================================ */

// ============================================================
// STATE
// ============================================================
let currentUser   = null;
let members       = [];
let ranks         = [];
let pics          = [];
let currentEvent  = null;
let currentFilter = 'todo';
let lightboxIndex = 0;
let pendingPics   = [];
let chatMessages  = [];
let chatPollTimer = null;
let siteConfig    = {};
let testimoniosRendered = false; // FIX #10: evitar duplicados

const TESTIMONIOS_DATA = [
  { nick:'xXDragonSlayerXx', rank:'Queen Bee',   text:'El mejor servidor que he jugado. Staff siempre activo y anti-cheat impecable. Me quedé desde el primer día!', stars:5 },
  { nick:'CraftMaster99',     rank:'Honey VIP',   text:'La comunidad es increíblemente amigable. Hice amigos de verdad y el servidor nunca tiene lag. 10/10 lo recomiendo.', stars:5 },
  { nick:'PvPQueenLara',      rank:'Royal Elite', text:'Los eventos mensuales son lo mejor. Cada torneo es diferente y las recompensas valen la pena.', stars:5 },
  { nick:'NightBuilderZ',     rank:'Bee Worker',  text:'Vine por el survival y me quedé por la comunidad. Los admins son justos y escuchan sugerencias.', stars:5 },
  { nick:'HoneyTrapXD',       rank:'Honey VIP',   text:'Siempre están agregando contenido nuevo. El fly en zonas safe es un game changer para builders.', stars:5 },
  { nick:'StealthyCreeper',   rank:'Queen Bee',   text:'Calidad de nivel premium. Conexión estable, mods balanceados y eventos con premios reales. Top tier.', stars:5 },
  { nick:'MasterBlockZ',      rank:'Royal Elite', text:'Compré Royal Elite y valió cada centavo. El kit mensual solo ya lo paga.', stars:5 },
  { nick:'SkyWarriorPro',     rank:'Bee Worker',  text:'Empecé con el rango básico y la experiencia igual es brutal. Da ganas de escalar de rango.', stars:5 },
];

// ============================================================
// UTILS
// ============================================================
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('es', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function roleClass(r) { return { owner:'role-owner', staff:'role-staff', mod:'role-mod', builder:'role-builder' }[r] || 'role-mod'; }
function roleLabel(r) { return { owner:'Owner', staff:'Staff', mod:'Moderador', builder:'Builder' }[r] || r; }
function catLabel(c)  { return { construccion:'Construcción', pvp:'PvP', evento:'Evento', otro:'Otro' }[c] || c; }

async function api(url, opts) {
  const res = await fetch(url, Object.assign({ credentials: 'include', headers: { 'Content-Type': 'application/json' } }, opts || {}));
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: 'Error desconocido' }));
    throw new Error(e.error || 'Error ' + res.status);
  }
  return res.json();
}

function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'notif-toast ' + (type || 'info');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// ============================================================
// HEX CANVAS
// ============================================================
(function () {
  const canvas = document.getElementById('hexCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let hexes = [];
  function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 28; i++) {
    hexes.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 20 + Math.random() * 40, speed: 0.2 + Math.random() * 0.4, alpha: 0.02 + Math.random() * 0.06, rot: Math.random() * Math.PI });
  }
  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hexes.forEach(h => {
      h.y -= h.speed; h.rot += 0.003;
      if (h.y + h.r < 0) { h.y = canvas.height + h.r; h.x = Math.random() * canvas.width; }
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = h.rot + (Math.PI / 3) * i;
        i === 0 ? ctx.moveTo(h.x + h.r * Math.cos(a), h.y + h.r * Math.sin(a)) : ctx.lineTo(h.x + h.r * Math.cos(a), h.y + h.r * Math.sin(a));
      }
      ctx.closePath(); ctx.strokeStyle = `rgba(168,85,247,${h.alpha})`; ctx.lineWidth = 1; ctx.stroke();
    });
    requestAnimationFrame(loop);
  }
  loop();
})();

// ============================================================
// TYPING EFFECT
// ============================================================
(function () {
  const phrases = ['La comunidad más épica de Minecraft.', 'Construye, domina y conquista.', 'Únete. Nuestro servidor te espera.', '24/7 Online · beeteam.club', 'Eventos mensuales · Staff activo.'];
  let pi = 0, ci = 0, del = false;
  const el = document.getElementById('typingText');
  if (!el) return;
  function tick() {
    const p = phrases[pi];
    if (!del) { el.textContent = p.slice(0, ++ci); if (ci === p.length) { del = true; setTimeout(tick, 2400); return; } setTimeout(tick, 48); }
    else { el.textContent = p.slice(0, --ci); if (ci === 0) { del = false; pi = (pi + 1) % phrases.length; setTimeout(tick, 300); return; } setTimeout(tick, 24); }
  }
  tick();
})();

// ============================================================
// SCROLL REVEAL
// ============================================================
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.07 });
  document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}

// ============================================================
// NAV ACTIVE + PARALLAX
// ============================================================
const secIds = ['hero', 'tienda', 'team', 'comunidad', 'testimonios', 'pics', 'soporte'];
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    let cur = 'hero';
    secIds.forEach(id => { const el = document.getElementById(id); if (el && y >= el.offsetTop - 120) cur = id; });
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + cur));
    const hero = document.getElementById('hero');
    if (hero && y < hero.offsetHeight * 1.1) {
      const bg = document.getElementById('heroVideoBg'), hx = document.getElementById('hexCanvas');
      if (bg) bg.style.transform = `translate3d(0,${y * .35}px,0)`;
      if (hx) hx.style.transform = `translate3d(0,${y * .55}px,0)`;
      const op = Math.max(0, 1 - y / (hero.offsetHeight * .6));
      ['.hero-title', '.hero-sub', '.hero-ctas', '.hero-stats'].forEach(s => { const el = document.querySelector(s); if (el) el.style.opacity = op; });
    }
    ticking = false;
  });
  ticking = true;
}, { passive: true });

// ============================================================
// COPY IP
// ============================================================
function copyIP() {
  navigator.clipboard.writeText('beeteam.club').catch(() => {});
  const btn = document.getElementById('ipBtn');
  btn.classList.add('copied');
  setTimeout(() => btn.classList.remove('copied'), 2000);
}

// ============================================================
// AUTH
// FIX #1: loadUser corregido — no llama applyUserUI() dos veces
// y maneja el error de red sin romper el resto de la página
// ============================================================
async function loadUser() {
  try {
    currentUser = await api('/api/me');
  } catch (e) {
    currentUser = null;
    // Solo mostrar el error de auth si vino del redirect de Discord
    const query = new URLSearchParams(window.location.search);
    if (query.get('auth') === 'error') {
      const reason = query.get('reason') || 'unknown';
      toast('Error en login de Discord: ' + reason, 'error');
      // Limpiar query params sin recargar
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
  applyUserUI(); // FIX: solo se llama una vez, aquí
}

function applyUserUI() {
  const loginBtn  = document.getElementById('discordLoginBtn');
  const userArea  = document.getElementById('userNavArea');
  const profileBtn = document.getElementById('profileBtn');
  const dashBtn   = document.getElementById('dashBtn');

  if (loginBtn)   loginBtn.style.display  = currentUser ? 'none' : 'flex';
  if (userArea)   userArea.style.display  = currentUser ? 'flex' : 'none';
  if (profileBtn) profileBtn.style.display = currentUser ? 'inline-flex' : 'none';
  if (dashBtn)    dashBtn.style.display   = (currentUser && currentUser.isAdmin) ? 'flex' : 'none';

  if (currentUser) {
    const avatarEl = document.getElementById('userNavAvatar');
    const nameEl   = document.getElementById('userNavName');
    if (avatarEl) avatarEl.src = currentUser.avatar || '';
    if (nameEl)   nameEl.textContent = currentUser.username || '';
  } else {
    const dashboardSection = document.getElementById('dashboard-section');
    if (dashboardSection) dashboardSection.style.display = 'none';
    document.body.classList.remove('dash-open');
  }

  const chatWall = document.getElementById('chatLoginWall');
  const chatArea = document.getElementById('chatArea');
  if (chatWall) chatWall.style.display = currentUser ? 'none' : 'flex';
  if (chatArea) {
    chatArea.style.display = currentUser ? 'block' : 'none';
    const av = document.getElementById('chatUserAvatar');
    if (av) av.src = currentUser ? (currentUser.avatar || '') : '';
  }

  if (currentUser) {
    startChatPoll();      // FIX #9: startChatPoll ahora es idempotente
    loadUserTickets();
  } else {
    stopChatPoll();
    const box = document.getElementById('chatBox');
    if (box) box.innerHTML = '<div class="chat-loading">Inicia sesión para ver el chat.</div>';
    const section = document.getElementById('userTicketsSection');
    if (section) section.style.display = 'none';
  }
}

// FIX #9: stopChatPoll limpia el timer existente antes de crear uno nuevo
function stopChatPoll() {
  if (chatPollTimer) {
    clearInterval(chatPollTimer);
    chatPollTimer = null;
  }
}

// FIX #9: startChatPoll es idempotente — no crea timers duplicados
function startChatPoll() {
  if (chatPollTimer) return; // ya está corriendo
  loadChatMessages();
  chatPollTimer = setInterval(loadChatMessages, 5000);
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    .catch(() => {})
    .finally(() => {
      currentUser = null;
      applyUserUI();
      location.reload();
    });
}

async function showProfile() {
  if (!currentUser) return toast('Debes iniciar sesión', 'error');
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  try {
    const profile = await api('/api/profile');
    document.getElementById('profileAvatar').src = profile.avatar || '';
    document.getElementById('profileUsername').textContent = profile.username || '';
    document.getElementById('profileId').textContent = profile.id || '';
    document.getElementById('profileAdmin').textContent = profile.isAdmin ? 'Sí' : 'No';
    document.getElementById('profileRoles').textContent = (profile.roles || []).join(', ') || 'Ninguno';
    modal.classList.add('show');
  } catch (e) {
    toast('Error cargando perfil', 'error');
  }
}

function closeProfile() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('show');
}

// ============================================================
// SITE CONFIG
// ============================================================
async function loadSiteConfig() {
  try {
    siteConfig = await api('/api/config');
    if (siteConfig.logo_url) {
      const hi = document.getElementById('heroLogoImg');
      if (hi) { hi.src = siteConfig.logo_url; hi.style.display = 'block'; const lt = document.getElementById('heroLogoText'); if (lt) lt.style.display = 'none'; }
      const ni = document.getElementById('navLogoImg');
      if (ni) { ni.src = siteConfig.logo_url; ni.style.display = 'block'; }
    }
    if (siteConfig.video_url) {
      const vid = document.getElementById('heroBgVideo');
      if (vid) { vid.src = siteConfig.video_url; vid.style.display = 'block'; vid.load(); vid.play().catch(() => {}); }
    }
  } catch (e) {
    console.warn('[Config] No se pudo cargar config del sitio:', e.message);
  }
}

// ============================================================
// SHOP
// FIX #2: renderShop() usa un Set para deduplicar por ID
// evitando que los rangos se dupliquen al refrescar
// ============================================================
async function loadAndRenderShop() {
  try { ranks = await api('/api/ranks'); } catch (e) { console.warn('[Shop] Error cargando rangos:', e.message); }
  renderShop();
}

function renderShop() {
  const grid = document.getElementById('shopGrid');
  if (!grid) return;
  if (!ranks.length) { grid.innerHTML = '<p style="color:var(--text-dim)">No hay rangos disponibles.</p>'; return; }

  // FIX #2: Deduplicar por ID (no por nombre, que puede repetirse)
  const seen = new Set();
  const uniqueRanks = ranks.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  grid.innerHTML = uniqueRanks.map(r => `
    <div class="rank-card reveal ${r.featured ? 'featured' : ''}">
      <div class="rank-name"><span>${esc(r.name_highlight)}</span> ${esc(r.name.replace(r.name_highlight, '').trim())}</div>
      <div class="rank-price">${esc(r.price)} <small>USD</small></div>
      <ul class="rank-perks">${(r.perks || []).map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      <button class="rank-btn" data-rank="${esc(r.name)}" data-price="${esc(r.price)}">Comprar ahora</button>
    </div>`).join('');

  grid.querySelectorAll('.rank-btn').forEach(btn => {
    btn.addEventListener('click', () => openBuyModal(btn.getAttribute('data-rank'), btn.getAttribute('data-price')));
  });
  initScrollReveal();
}

// ============================================================
// TEAM
// ============================================================
async function loadAndRenderTeam() {
  try { members = await api('/api/team'); } catch (e) { console.warn('[Team] Error cargando equipo:', e.message); }
  renderTeam();
}

function renderTeam() {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;
  grid.innerHTML = members.map((m, i) => `
    <div class="member-card reveal" style="transition-delay:${i * .06}s">
      <div class="member-skin-wrap">
        ${m.skin_url
          ? `<img src="${esc(m.skin_url)}" alt="${esc(m.nick)}" loading="lazy">`
          : `<div class="member-skin-placeholder">${esc(m.nick.slice(0, 2).toUpperCase())}</div>`}
      </div>
      <div class="member-info">
        <div class="member-nick">${esc(m.nick)}</div>
        <span class="member-role ${roleClass(m.role)}">${roleLabel(m.role)}</span>
      </div>
    </div>`).join('');
  initScrollReveal();
}

// ============================================================
// GALLERY
// ============================================================
async function loadAndRenderGallery() {
  try { pics = await api('/api/gallery'); } catch (e) { console.warn('[Gallery] Error cargando galería:', e.message); }
  renderPicsGallery();
}

function getFilteredPics() { return currentFilter === 'todo' ? pics : pics.filter(p => p.category === currentFilter); }

function filterPics(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.pics-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPicsGallery();
}

function renderPicsGallery() {
  const grid  = document.getElementById('picsGrid');
  const empty = document.getElementById('picsEmpty');
  if (!grid) return;
  const filtered = getFilteredPics();
  if (!filtered.length) { grid.innerHTML = ''; if (empty) empty.classList.add('visible'); return; }
  if (empty) empty.classList.remove('visible');
  grid.innerHTML = filtered.map((p, i) => `
    <div class="pic-item reveal" onclick="openLightbox(${i})" data-id="${p.id}">
      <img src="${esc(p.image_url)}" alt="${esc(p.title)}" loading="lazy">
      <div class="pic-overlay">
        <div class="pic-overlay-title">${esc(p.title)}</div>
        <span class="pic-overlay-tag">${catLabel(p.category)}</span>
      </div>
      ${currentUser && currentUser.isAdmin ? `<button class="pic-del-btn" onclick="event.stopPropagation();adminDeletePic(${p.id})">X</button>` : ''}
    </div>`).join('');
  initScrollReveal();
}

// ============================================================
// LIGHTBOX
// FIX #4: lightboxIndex siempre se mantiene dentro del array filtrado
// ============================================================
function openLightbox(idx) {
  const filtered = getFilteredPics();
  lightboxIndex = Math.max(0, Math.min(idx, filtered.length - 1));
  updateLightbox();
  document.getElementById('lightboxOverlay').classList.add('open');
  document.addEventListener('keydown', lightboxKey);
}

function updateLightbox() {
  const filtered = getFilteredPics();
  if (!filtered.length) { closeLightbox(); return; }
  // FIX #4: asegurar que el índice no esté fuera de rango
  lightboxIndex = ((lightboxIndex % filtered.length) + filtered.length) % filtered.length;
  const p = filtered[lightboxIndex];
  const img = document.getElementById('lightboxImg');
  img.style.opacity = '0';
  img.style.transition = 'opacity .2s';
  setTimeout(() => { img.src = p.image_url; img.style.opacity = '1'; }, 100);
  document.getElementById('lightboxTitle').textContent = p.title;
  document.getElementById('lightboxTag').textContent = catLabel(p.category);
}

function closeLightbox() {
  document.getElementById('lightboxOverlay').classList.remove('open');
  document.removeEventListener('keydown', lightboxKey);
}

function closeLightboxOutside(e) { if (e.target === document.getElementById('lightboxOverlay')) closeLightbox(); }
function lightboxNav(dir) { lightboxIndex += dir; updateLightbox(); }
function lightboxKey(e) {
  if (e.key === 'ArrowRight') lightboxNav(1);
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'Escape') closeLightbox();
}

// ============================================================
// EVENT / COUNTDOWN
// ============================================================
let countdownInterval = null;

async function loadAndInitCountdown() {
  try { currentEvent = await api('/api/event'); } catch (e) { console.warn('[Countdown] Error:', e.message); }
  initCountdown();
}

function initCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  const section = document.getElementById('countdown-section');
  if (!section) return;
  if (!currentEvent || !currentEvent.activo) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  document.getElementById('countdownTitle').textContent = currentEvent.nombre || 'Próximo evento';
  document.getElementById('countdownDesc').textContent = currentEvent.descripcion || '';
  const target = new Date(currentEvent.fecha);
  function pad(n) { return String(n).padStart(2, '0'); }
  function tick() {
    const diff = target - new Date();
    if (diff <= 0) {
      ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => document.getElementById(id).textContent = '00');
      clearInterval(countdownInterval);
      return;
    }
    document.getElementById('cd-days').textContent  = pad(Math.floor(diff / 86400000));
    document.getElementById('cd-hours').textContent = pad(Math.floor((diff % 86400000) / 3600000));
    document.getElementById('cd-mins').textContent  = pad(Math.floor((diff % 3600000) / 60000));
    const secEl = document.getElementById('cd-secs');
    secEl.textContent = pad(Math.floor((diff % 60000) / 1000));
    secEl.style.transform = 'scale(1.12)';
    setTimeout(() => { secEl.style.transform = 'scale(1)'; secEl.style.transition = 'transform .2s'; }, 120);
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

// ============================================================
// TESTIMONIOS
// FIX #10: flag para no renderizar múltiples veces
// ============================================================
function renderTestimonios() {
  if (testimoniosRendered) return;
  const track = document.getElementById('testimoniosTrack');
  if (!track) return;
  const all = [...TESTIMONIOS_DATA, ...TESTIMONIOS_DATA];
  track.innerHTML = all.map(t => `
    <div class="testimonio-card">
      <div class="stars">${'★'.repeat(t.stars)}</div>
      <p class="testimonio-text">${esc(t.text)}</p>
      <div class="testimonio-author">
        <div class="testimonio-skin"><div class="testimonio-skin-ph">${esc(t.nick.slice(0, 2).toUpperCase())}</div></div>
        <div><div class="testimonio-nick">${esc(t.nick)}</div><div class="testimonio-rank">${esc(t.rank)}</div></div>
      </div>
    </div>`).join('');
  testimoniosRendered = true;
}

// ============================================================
// CHAT
// ============================================================
async function loadChatMessages() {
  try {
    const msgs = await api('/api/chat');
    chatMessages = msgs;
    renderChat();
  } catch (e) {
    const box = document.getElementById('chatBox');
    if (box && box.children.length <= 1) {
      box.innerHTML = '<div class="chat-loading" style="color:var(--orange)">Chat no disponible — verifica Supabase en Vercel.</div>';
    }
  }
}

function renderChat() {
  const box = document.getElementById('chatBox');
  if (!box) return;
  if (!chatMessages.length) { box.innerHTML = '<div class="chat-loading">Sé el primero en escribir algo.</div>'; return; }
  const wasAtBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  box.innerHTML = chatMessages.map(msg => `
    <div class="chat-msg ${currentUser && msg.user_id === currentUser.id ? 'own' : ''}">
      <img class="chat-msg-avatar" src="${esc(msg.avatar || '')}" alt="${esc(msg.username)}" onerror="this.style.display='none'">
      <div class="chat-msg-body">
        <div class="chat-msg-header">
          <span class="chat-msg-nick">${esc(msg.username)}</span>
          ${msg.role ? `<span class="chat-msg-role ${roleClass(msg.role)}">${roleLabel(msg.role)}</span>` : ''}
          <span class="chat-msg-time">${fmtTime(msg.created_at)}</span>
          ${currentUser && currentUser.isAdmin ? `
            <button class="chat-mod-btn" onclick="adminDeleteMsg('${msg.id}','${esc(msg.username)}')" title="Borrar">[x]</button>
            <button class="chat-mod-btn ban" onclick="adminBanFromChat('${msg.user_id}','${esc(msg.username)}')" title="Banear">[ban]</button>` : ''}
        </div>
        <div class="chat-msg-text">${esc(msg.content)}</div>
      </div>
    </div>`).join('');
  if (wasAtBottom) box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  if (!currentUser) return;
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  input.disabled = true;
  try {
    await api('/api/chat', { method: 'POST', body: JSON.stringify({ content }) });
    await loadChatMessages();
  } catch (e) {
    input.value = content;
    toast(e.message, 'error');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ============================================================
// MINECRAFT STATUS
// ============================================================
(function () {
  const el = document.getElementById('statPlayers');
  if (!el) return;
  let c = 0, iv = setInterval(() => { c += 2; if (c >= 30) { el.textContent = '30+'; clearInterval(iv); } else el.textContent = c; }, 50);
  fetch('/api/mc-status').then(r => r.json()).then(data => {
    clearInterval(iv);
    if (data.online && data.players) {
      const count = data.players.online || 0;
      let cur = 0, iv2 = setInterval(() => { cur = Math.min(cur + Math.max(1, Math.ceil(count / 30)), count); el.textContent = cur + (cur < count ? '+' : ''); if (cur >= count) clearInterval(iv2); }, 40);
    } else el.textContent = '0';
  }).catch(() => { clearInterval(iv); el.textContent = '30+'; });
})();

// ============================================================
// JOIN NOTIFICATIONS
// ============================================================
(function () {
  const nicks = ['xXDragonSlayerXx','CraftMaster99','PvPQueenLara','NightBuilderZ','HoneyTrapXD','StealthyCreeper','MasterBlockZ','SkyWarriorPro','EpicBeeHunter','ShadowCraft','LegendaryBeeZ'];
  const rks = ['[Worker]','[Honey VIP]','[Queen Bee]','[Royal Elite]'];
  function showJoinToast() {
    const nick = nicks[Math.floor(Math.random() * nicks.length)];
    const rank = rks[Math.floor(Math.random() * rks.length)];
    const cont = document.getElementById('toastContainer');
    if (!cont) return;
    const t = document.createElement('div');
    t.className = 'join-toast';
    t.innerHTML = `<div class="toast-skin">${nick.slice(0, 2).toUpperCase()}</div><div><div class="toast-nick">${nick}</div><div class="toast-msg">${rank} se unió al servidor</div></div>`;
    cont.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .4s,transform .4s'; t.style.opacity = '0'; t.style.transform = 'translateX(-20px)'; setTimeout(() => t.remove(), 400); }, 4000);
  }
  setTimeout(() => { showJoinToast(); setInterval(showJoinToast, 12000 + Math.random() * 8000); }, 4000);
})();

// ============================================================
// LOGO / VIDEO UPLOAD
// ============================================================
function handleLogoUpload(input) {
  if (!input.files[0]) return;
  const r = new FileReader();
  r.onload = async e => {
    const src = e.target.result;
    const hi = document.getElementById('heroLogoImg');
    if (hi) { hi.src = src; hi.style.display = 'block'; const lt = document.getElementById('heroLogoText'); if (lt) lt.style.display = 'none'; }
    const ni = document.getElementById('navLogoImg');
    if (ni) { ni.src = src; ni.style.display = 'block'; }
    const prev = document.getElementById('logoPreview'), prevImg = document.getElementById('logoPreviewImg');
    if (prev) prev.style.display = 'block';
    if (prevImg) prevImg.src = src;
    try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ key: 'logo_url', value: src }) }); toast('Logo guardado', 'ok'); }
    catch (e) { toast('Error guardando logo: ' + e.message, 'error'); }
  };
  r.readAsDataURL(input.files[0]);
}

function handleVideoUpload(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  const url = URL.createObjectURL(file);
  const vid = document.getElementById('heroBgVideo');
  if (vid) { vid.src = url; vid.style.display = 'block'; vid.load(); vid.play().catch(() => {}); }
  const prev = document.getElementById('videoPreviewEl'); if (prev) prev.src = url;
  const wrap = document.getElementById('videoPreviewWrap'); if (wrap) wrap.style.display = 'block';
  const reader = new FileReader();
  reader.onload = async e => {
    try { await api('/api/admin/config', { method: 'PUT', body: JSON.stringify({ key: 'video_url', value: e.target.result }) }); toast('Video guardado', 'ok'); }
    catch (err) { toast('Error guardando video: ' + err.message, 'error'); }
  };
  reader.readAsDataURL(file);
}

// ============================================================
// DASHBOARD TOGGLE
// ============================================================
function toggleDashboard() {
  const sec = document.getElementById('dashboard-section');
  const isOpen = sec.style.display === 'none' || sec.style.display === '';
  sec.style.display = isOpen ? 'block' : 'none';
  document.body.classList.toggle('dash-open', isOpen);
  if (isOpen) {
    // Activar el primer tab correctamente
    const firstTabBtn = document.querySelector('.dash-tab');
    switchTab('overview', firstTabBtn);
    setTimeout(() => sec.scrollIntoView({ behavior: 'smooth' }), 50);
  }
}

function switchTab(tabId, btn) {
  document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.add('active');
  if (tabId === 'overview')  loadAdminStats();
  if (tabId === 'chat')      loadAdminChat();
  if (tabId === 'miembros')  loadAdminMembers();
  if (tabId === 'rangos')    loadAdminRanks();
  if (tabId === 'evento')    loadAdminEvento();
  if (tabId === 'galeria')   loadAdminGallery();
  if (tabId === 'bans')      loadAdminBans();
  if (tabId === 'log')       loadAdminLog();
  if (tabId === 'tickets')   loadAdminTickets();
}

// ============================================================
// ADMIN — STATS
// ============================================================
async function loadAdminStats() {
  const panel = document.getElementById('tab-overview');
  if (!panel) return;
  panel.innerHTML = `<div class="admin-stats-loading">Cargando estadísticas...</div>`;
  try {
    const s = await api('/api/admin/stats');
    panel.innerHTML = `
      <div class="admin-stats-grid">
        <div class="admin-stat-card"><div class="admin-stat-num">${s.totalChatMessages}</div><div class="admin-stat-label">Mensajes en chat</div></div>
        <div class="admin-stat-card"><div class="admin-stat-num">${s.uniqueChatUsers}</div><div class="admin-stat-label">Usuarios únicos</div></div>
        <div class="admin-stat-card"><div class="admin-stat-num">${s.deletedMessages}</div><div class="admin-stat-label">Mensajes borrados</div></div>
        <div class="admin-stat-card"><div class="admin-stat-num">${s.teamMembers}</div><div class="admin-stat-label">Miembros del equipo</div></div>
        <div class="admin-stat-card"><div class="admin-stat-num">${s.galleryPics}</div><div class="admin-stat-label">Fotos en galería</div></div>
        <div class="admin-stat-card"><div class="admin-stat-num">${s.pendingTickets}</div><div class="admin-stat-label">Tickets pendientes</div></div>
        <div class="admin-stat-card red"><div class="admin-stat-num">${s.bannedUsers}</div><div class="admin-stat-label">Usuarios baneados</div></div>
      </div>
      <div class="admin-recent-log">
        <h4>Actividad reciente</h4>
        ${s.recentLog.map(l => `
          <div class="log-row">
            <span class="log-action ${l.action}">${l.action.replace(/_/g, ' ')}</span>
            <span class="log-admin">${esc(l.admin_name)}</span>
            <span class="log-target">${esc(l.target)}</span>
            <span class="log-time">${fmtDate(l.created_at)}</span>
          </div>`).join('') || '<p style="color:var(--text-dim);font-size:0.85rem">Sin actividad reciente.</p>'}
      </div>`;
  } catch (e) {
    panel.innerHTML = `<p style="color:var(--orange)">Error: ${esc(e.message)}</p>`;
  }
}

// ============================================================
// ADMIN — CHAT
// ============================================================
async function loadAdminChat() {
  const list = document.getElementById('adminChatList');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-dim);padding:20px">Cargando...</div>';
  try {
    const msgs = await api('/api/admin/chat');
    if (!msgs.length) { list.innerHTML = '<p style="color:var(--text-dim);padding:16px">No hay mensajes.</p>'; return; }
    list.innerHTML = msgs.map(m => `
      <div class="admin-chat-row ${m.deleted ? 'deleted' : ''}" data-id="${m.id}">
        <img src="${esc(m.avatar || '')}" class="chat-msg-avatar" style="width:32px;height:32px;border-radius:50%;flex-shrink:0" onerror="this.style.display='none'">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-family:'Syne',sans-serif;font-weight:700;font-size:0.85rem;color:var(--white)">${esc(m.username)}</span>
            <span style="font-size:0.72rem;color:var(--text-dim)">${fmtDate(m.created_at)}</span>
            ${m.deleted ? `<span class="admin-badge red">BORRADO por ${esc(m.deleted_by || '?')}</span>` : ''}
          </div>
          <div style="font-size:0.88rem;color:${m.deleted ? 'var(--text-dim)' : 'var(--text)'};margin-top:3px;word-break:break-word">${esc(m.content)}</div>
        </div>
        ${!m.deleted ? `
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="admin-action-btn del" onclick="adminDeleteMsg('${m.id}','${esc(m.username)}')">Borrar</button>
          <button class="admin-action-btn ban" onclick="adminBanFromChat('${m.user_id}','${esc(m.username)}')">Banear</button>
        </div>` : ''}
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<p style="color:var(--orange);padding:16px">Error: ${esc(e.message)}</p>`;
  }
}

async function adminDeleteMsg(id, username) {
  if (!confirm(`Borrar mensaje de ${username}?`)) return;
  try {
    await api('/api/admin/chat/' + id, { method: 'DELETE' });
    toast('Mensaje borrado', 'ok');
    loadAdminChat();
    loadChatMessages();
  } catch (e) { toast(e.message, 'error'); }
}

async function adminBanFromChat(userId, username) {
  const reason = prompt(`Razón para banear a ${username}:`);
  if (reason === null) return;
  try {
    await api('/api/admin/bans', { method: 'POST', body: JSON.stringify({ user_id: userId, username, reason: reason || 'Sin razón' }) });
    toast(`${username} baneado`, 'ok');
    loadAdminChat();
    loadAdminBans();
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// ADMIN — TEAM
// ============================================================
async function loadAdminMembers() {
  const tbody = document.getElementById('membersTbody');
  if (!tbody) return;
  try {
    members = await api('/api/team');
    renderMembersTable();
  } catch (e) { console.warn('[Admin] Error cargando equipo:', e.message); }
}

function renderMembersTable() {
  const tbody = document.getElementById('membersTbody');
  if (!tbody) return;
  tbody.innerHTML = members.map(m => `
    <tr>
      <td><div class="member-thumb">${m.skin_url ? `<img src="${esc(m.skin_url)}" alt="${esc(m.nick)}">` : m.nick.slice(0, 2).toUpperCase()}</div></td>
      <td><input value="${esc(m.nick)}" class="inline-input" onchange="updateMemberField(${m.id},'nick',this.value)"></td>
      <td>
        <select class="inline-select" onchange="updateMemberField(${m.id},'role',this.value)">
          ${['owner','staff','mod','builder'].map(r => `<option value="${r}" ${m.role === r ? 'selected' : ''}>${roleLabel(r)}</option>`).join('')}
        </select>
      </td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="file" accept="image/*" onchange="uploadMemberSkin(${m.id},this)" style="font-size:0.75rem;color:var(--text-dim);background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:4px 8px;width:140px">
          ${m.skin_url ? `<img src="${esc(m.skin_url)}" style="width:28px;height:28px;border-radius:5px;image-rendering:pixelated;border:1px solid var(--border)">` : ''}
        </div>
      </td>
      <td><button class="del-btn" onclick="adminDeleteMember(${m.id})">Eliminar</button></td>
    </tr>`).join('');
}

async function updateMemberField(id, field, value) {
  try { await api('/api/admin/team/' + id, { method: 'PUT', body: JSON.stringify({ [field]: value }) }); }
  catch (e) { toast(e.message, 'error'); }
}

async function uploadMemberSkin(id, input) {
  if (!input.files[0]) return;
  const r = new FileReader();
  r.onload = async e => {
    try {
      await api('/api/admin/team/' + id, { method: 'PUT', body: JSON.stringify({ skin_url: e.target.result }) });
      toast('Skin actualizada', 'ok');
      loadAdminMembers();
      loadAndRenderTeam();
    } catch (err) { toast(err.message, 'error'); }
  };
  r.readAsDataURL(input.files[0]);
}

async function addMember() {
  const nick = document.getElementById('addNick').value.trim();
  const role = document.getElementById('addRole').value;
  const fileInput = document.getElementById('addSkinFile');
  if (!nick) { alert('Ingresa un nick'); return; }
  function doAdd(skinUrl) {
    api('/api/admin/team', { method: 'POST', body: JSON.stringify({ nick, role, skin_url: skinUrl || null }) })
      .then(() => { toast('Miembro añadido', 'ok'); document.getElementById('addNick').value = ''; fileInput.value = ''; loadAdminMembers(); loadAndRenderTeam(); })
      .catch(e => toast(e.message, 'error'));
  }
  if (fileInput.files[0]) { const r = new FileReader(); r.onload = e => doAdd(e.target.result); r.readAsDataURL(fileInput.files[0]); }
  else doAdd(null);
}

async function adminDeleteMember(id) {
  if (!confirm('¿Eliminar este miembro?')) return;
  try { await api('/api/admin/team/' + id, { method: 'DELETE' }); toast('Miembro eliminado', 'ok'); loadAdminMembers(); loadAndRenderTeam(); }
  catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// ADMIN — RANKS
// ============================================================
async function loadAdminRanks() {
  try { ranks = await api('/api/admin/ranks'); renderAdminRanks(); }
  catch (e) { console.warn('[Admin] Error cargando rangos:', e.message); }
}

function renderAdminRanks() {
  const list = document.getElementById('rangosEditorList');
  if (!list) return;
  list.innerHTML = ranks.map(r => `
    <details class="rang-editor-item" id="rang-${r.id}">
      <summary>
        <span style="color:var(--orange)">${esc(r.name)}</span>
        <span style="color:var(--text-dim);font-size:0.85rem;margin-left:8px">${esc(r.price)}</span>
        ${!r.active ? '<span class="admin-badge">OCULTO</span>' : ''}
        ${r.featured ? '<span class="admin-badge green">POPULAR</span>' : ''}
      </summary>
      <div class="rang-editor-body">
        <div class="form-row">
          <div class="form-group"><label>Nombre completo</label><input value="${esc(r.name)}" onchange="updateRankField(${r.id},'name',this.value)"></div>
          <div class="form-group"><label>Parte destacada (morado)</label><input value="${esc(r.name_highlight)}" onchange="updateRankField(${r.id},'name_highlight',this.value)"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Precio (ej: $6.99)</label><input value="${esc(r.price)}" onchange="updateRankField(${r.id},'price',this.value)"></div>
          <div class="form-group"><label>Orden</label><input type="number" value="${r.sort_order || 0}" onchange="updateRankField(${r.id},'sort_order',parseInt(this.value))"></div>
        </div>
        <div class="form-group"><label>Ventajas (una por línea)</label><textarea onchange="updateRankPerks(${r.id},this.value)">${(r.perks || []).join('\n')}</textarea></div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:8px">
          <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-dim);cursor:pointer">
            <input type="checkbox" ${r.featured ? 'checked' : ''} onchange="updateRankField(${r.id},'featured',this.checked)"> Marcar como POPULAR
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;color:var(--text-dim);cursor:pointer">
            <input type="checkbox" ${r.active ? 'checked' : ''} onchange="updateRankField(${r.id},'active',this.checked)"> Visible en tienda
          </label>
          <button class="del-btn" onclick="adminDeleteRank(${r.id})">Eliminar rango</button>
        </div>
      </div>
    </details>`).join('');
}

async function updateRankField(id, field, value) {
  try { await api('/api/admin/ranks/' + id, { method: 'PUT', body: JSON.stringify({ [field]: value }) }); renderShop(); }
  catch (e) { toast(e.message, 'error'); }
}

async function updateRankPerks(id, text) {
  const perks = text.split('\n').map(p => p.trim()).filter(Boolean);
  await updateRankField(id, 'perks', perks);
}

async function addRang() {
  try {
    await api('/api/admin/ranks', { method: 'POST', body: JSON.stringify({ name: 'Nuevo Rango', name_highlight: 'Nuevo', price: '$0.00', featured: false, perks: ['Perk 1', 'Perk 2'], sort_order: ranks.length + 1, active: true }) });
    toast('Rango creado', 'ok');
    loadAdminRanks();
    loadAndRenderShop();
  } catch (e) { toast(e.message, 'error'); }
}

async function adminDeleteRank(id) {
  if (!confirm('¿Eliminar este rango?')) return;
  try { await api('/api/admin/ranks/' + id, { method: 'DELETE' }); toast('Rango eliminado', 'ok'); loadAdminRanks(); loadAndRenderShop(); }
  catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// ADMIN — EVENTO
// ============================================================
async function loadAdminEvento() {
  try {
    const evs = await api('/api/admin/events');
    const last = evs[0] || currentEvent;
    if (!last) return;
    document.getElementById('eventoNombre').value = last.nombre || '';
    document.getElementById('eventoDesc').value = last.descripcion || '';
    if (last.fecha) {
      const d = new Date(last.fecha);
      document.getElementById('eventoFecha').value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    document.getElementById('eventoActivo').value = last.activo ? '1' : '0';
    document.getElementById('eventoId').value = last.id || '';
  } catch (e) { console.warn('[Admin] Error cargando evento:', e.message); }
}

async function saveEvento() {
  const nombre     = document.getElementById('eventoNombre').value.trim() || 'Evento';
  const descripcion = document.getElementById('eventoDesc').value.trim();
  const fecha      = new Date(document.getElementById('eventoFecha').value).toISOString();
  const activo     = document.getElementById('eventoActivo').value === '1';
  const id         = document.getElementById('eventoId').value;
  try {
    const ev = await api('/api/admin/events', { method: 'POST', body: JSON.stringify({ id: id || undefined, nombre, descripcion, fecha, activo }) });
    currentEvent = ev;
    initCountdown();
    toast('Evento guardado', 'ok');
    const msg = document.getElementById('eventoSaveMsg');
    if (msg) { msg.textContent = 'Guardado!'; msg.style.opacity = '1'; setTimeout(() => msg.style.opacity = '0', 2000); }
  } catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// ADMIN — GALLERY
// ============================================================
async function loadAdminGallery() {
  try {
    pics = await api('/api/gallery');
    renderAdminGallery();
    renderPicsGallery();
  } catch (e) { console.warn('[Admin] Error cargando galería:', e.message); }
}

function handlePicsSelect(input) {
  if (!input.files.length) return;
  Array.from(input.files).forEach(file => {
    const r = new FileReader();
    r.onload = e => { pendingPics.push({ src: e.target.result, file }); renderPending(); };
    r.readAsDataURL(file);
  });
  input.value = '';
}

function renderPending() {
  const el = document.getElementById('picsPending');
  const meta = document.getElementById('picsMetaForm');
  if (!el) return;
  el.innerHTML = pendingPics.map((p, i) => `<div class="pics-pending-thumb"><img src="${p.src}" alt=""><button class="remove-pending" onclick="removePending(${i})">X</button></div>`).join('');
  if (meta) meta.style.display = pendingPics.length ? 'block' : 'none';
}

function removePending(i) { pendingPics.splice(i, 1); renderPending(); }

async function publishPics() {
  if (!pendingPics.length) return;
  const title = document.getElementById('picTitle').value.trim() || 'Sin título';
  const category = document.getElementById('picCategory').value;
  try {
    for (const p of pendingPics) {
      await api('/api/admin/gallery', { method: 'POST', body: JSON.stringify({ title, category, image_url: p.src }) });
    }
    pendingPics = [];
    document.getElementById('picTitle').value = '';
    renderPending();
    toast('Fotos publicadas', 'ok');
    loadAdminGallery();
  } catch (e) { toast(e.message, 'error'); }
}

async function adminDeletePic(id) {
  if (!confirm('¿Eliminar esta foto?')) return;
  try { await api('/api/admin/gallery/' + id, { method: 'DELETE' }); toast('Foto eliminada', 'ok'); loadAdminGallery(); }
  catch (e) { toast(e.message, 'error'); }
}

function renderAdminGallery() {
  const list  = document.getElementById('picsDashList');
  const empty = document.getElementById('picsDashEmpty');
  const badge = document.getElementById('picsCountBadge');
  if (!list) return;
  if (badge) badge.textContent = pics.length;
  if (!pics.length) { list.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
  if (empty) empty.style.display = 'none';
  list.innerHTML = pics.map(p => `
    <div style="position:relative;width:80px;height:80px;border-radius:9px;overflow:hidden;border:1px solid var(--border)">
      <img src="${esc(p.image_url)}" style="width:100%;height:100%;object-fit:cover" alt="${esc(p.title)}" title="${esc(p.title)}" loading="lazy">
      <button onclick="adminDeletePic(${p.id})" style="position:absolute;top:3px;right:3px;background:rgba(200,30,30,.85);border:none;color:#fff;width:20px;height:20px;border-radius:5px;font-size:.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center">X</button>
    </div>`).join('');
}

// ============================================================
// ADMIN — BANS
// ============================================================
async function loadAdminBans() {
  const list = document.getElementById('adminBansList');
  if (!list) return;
  try {
    const bans = await api('/api/admin/bans');
    if (!bans.length) { list.innerHTML = '<p style="color:var(--text-dim);padding:16px">No hay usuarios baneados.</p>'; return; }
    list.innerHTML = `<table class="members-table">
      <thead><tr><th>Usuario</th><th>Razón</th><th>Baneado por</th><th>Fecha</th><th>Acción</th></tr></thead>
      <tbody>${bans.map(b => `
        <tr>
          <td><strong>${esc(b.username)}</strong><br><span style="font-size:0.72rem;color:var(--text-dim)">${esc(b.user_id)}</span></td>
          <td>${esc(b.reason || '—')}</td>
          <td>${esc(b.banned_by || '—')}</td>
          <td style="font-size:0.78rem;color:var(--text-dim)">${fmtDate(b.created_at)}</td>
          <td><button class="del-btn" style="background:rgba(87,242,135,0.1);border-color:rgba(87,242,135,.2);color:#57F287" onclick="adminUnban('${b.user_id}','${esc(b.username)}')">Desbanear</button></td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) { list.innerHTML = `<p style="color:var(--orange);padding:16px">Error: ${esc(e.message)}</p>`; }
}

async function adminBanManual() {
  const uid    = document.getElementById('banUserId').value.trim();
  const uname  = document.getElementById('banUsername').value.trim();
  const reason = document.getElementById('banReason').value.trim();
  if (!uid || !uname) { alert('Rellena usuario ID y nombre'); return; }
  try {
    await api('/api/admin/bans', { method: 'POST', body: JSON.stringify({ user_id: uid, username: uname, reason }) });
    toast(`${uname} baneado`, 'ok');
    document.getElementById('banUserId').value = '';
    document.getElementById('banUsername').value = '';
    document.getElementById('banReason').value = '';
    loadAdminBans();
  } catch (e) { toast(e.message, 'error'); }
}

async function adminUnban(userId, username) {
  if (!confirm(`¿Desbanear a ${username}?`)) return;
  try { await api('/api/admin/bans/' + userId, { method: 'DELETE' }); toast('Desbaneado', 'ok'); loadAdminBans(); }
  catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// ADMIN — LOG
// ============================================================
async function loadAdminLog() {
  const list = document.getElementById('adminLogList');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-dim);padding:16px">Cargando...</div>';
  try {
    const log = await api('/api/admin/log');
    if (!log.length) { list.innerHTML = '<p style="color:var(--text-dim);padding:16px">Sin actividad registrada.</p>'; return; }
    list.innerHTML = `<table class="members-table">
      <thead><tr><th>Acción</th><th>Admin</th><th>Objetivo</th><th>Detalle</th><th>Fecha</th></tr></thead>
      <tbody>${log.map(l => `
        <tr>
          <td><span class="log-action ${l.action}">${l.action.replace(/_/g, ' ')}</span></td>
          <td>${esc(l.admin_name)}</td>
          <td style="font-size:0.8rem;color:var(--text-dim)">${esc(l.target)}</td>
          <td style="font-size:0.8rem;color:var(--text-dim)">${esc(l.detail)}</td>
          <td style="font-size:0.78rem;color:var(--text-dim)">${fmtDate(l.created_at)}</td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) { list.innerHTML = `<p style="color:var(--orange);padding:16px">Error: ${esc(e.message)}</p>`; }
}

// ============================================================
// ADMIN — TICKETS
// FIX #8: adminTicketChatPanel ahora se muestra/oculta correctamente
// ============================================================
async function loadAdminTickets() {
  const list = document.getElementById('adminTicketsList');
  if (!list) return;
  list.innerHTML = '<div style="color:var(--text-dim);padding:16px">Cargando...</div>';
  try {
    const tickets = await api('/api/admin/tickets');
    if (!tickets.length) { list.innerHTML = '<p style="color:var(--text-dim);padding:16px">No hay tickets aún.</p>'; return; }
    const statusColor = { pending:'var(--orange)', open:'#57F287', closed:'var(--text-dim)', rejected:'#ff7070' };
    const statusLabel = { pending:'Pendiente', open:'Abierto', closed:'Cerrado', rejected:'Rechazado' };
    list.innerHTML = tickets.map(t => `
      <div class="admin-ticket-row" id="ticket-${t.id}">
        <div class="admin-ticket-header">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="admin-ticket-nick">${esc(t.nick || t.username || '?')}</span>
            <span class="admin-ticket-type">${esc(t.type)}</span>
            <span class="admin-ticket-status" style="color:${statusColor[t.status] || 'var(--text-dim)'}">
              ${statusLabel[t.status] || t.status}
            </span>
            <span style="font-size:0.72rem;color:var(--text-dim)">${fmtDate(t.created_at)}</span>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="admin-action-btn" style="background:var(--orange);color:#000;font-weight:700" onclick="openAdminTicketChat(${t.id})">Chat</button>
            <select class="inline-select" style="font-size:0.78rem;padding:4px 8px" onchange="adminUpdateTicket(${t.id},this.value)">
              <option value="pending"  ${t.status === 'pending'  ? 'selected' : ''}>Pendiente</option>
              <option value="open"     ${t.status === 'open'     ? 'selected' : ''}>Abierto</option>
              <option value="closed"   ${t.status === 'closed'   ? 'selected' : ''}>Cerrado</option>
              <option value="rejected" ${t.status === 'rejected' ? 'selected' : ''}>Rechazado</option>
            </select>
            <button class="admin-action-btn del" onclick="adminDeleteTicket(${t.id})">Borrar</button>
          </div>
        </div>
        <div class="admin-ticket-subject">${esc(t.subject)}</div>
        <div class="admin-ticket-desc">${esc(t.description)}</div>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<p style="color:var(--orange);padding:16px">Error: ${esc(e.message)}</p>`;
  }
}

async function openAdminTicketChat(ticketId) {
  const panel   = document.getElementById('adminTicketChatPanel');
  const chatBox = document.getElementById('adminTicketChatBox');
  if (!panel || !chatBox) return;
  window.currentAdminTicketId = ticketId;
  // FIX #8: usar flex en vez de block para que se muestre correctamente
  panel.style.display = 'flex';
  chatBox.innerHTML = '<div style="color:var(--text-dim);margin:auto">Cargando chat...</div>';
  try {
    const msgs = await api('/api/tickets/' + ticketId + '/messages');
    renderAdminTicketChat(msgs);
  } catch (e) {
    chatBox.innerHTML = '<div style="color:var(--orange);margin:auto">Error: ' + esc(e.message) + '</div>';
  }
}

function renderAdminTicketChat(messages) {
  const chatBox = document.getElementById('adminTicketChatBox');
  if (!chatBox) return;
  if (!messages.length) { chatBox.innerHTML = '<div style="color:var(--text-dim);text-align:center;margin:auto">Sin mensajes aún.</div>'; return; }
  const wasAtBottom = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 30;
  chatBox.innerHTML = messages.map(m => `
    <div class="ticket-msg ${currentUser && m.user_id === currentUser.id ? 'own' : ''}">
      <div>
        <div class="ticket-msg-name">${esc(m.username)}</div>
        <div class="ticket-msg-time">${fmtTime(m.created_at)}</div>
        <div class="ticket-msg-text">${esc(m.content)}</div>
      </div>
    </div>`).join('');
  if (wasAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendAdminTicketMessage() {
  const ticketId = window.currentAdminTicketId;
  const input    = document.getElementById('adminTicketChatInput');
  if (!ticketId || !input || !input.value.trim()) return;
  const content = input.value;
  input.value = '';
  try {
    await api('/api/tickets/' + ticketId + '/messages', { method: 'POST', body: JSON.stringify({ content }) });
    const msgs = await api('/api/tickets/' + ticketId + '/messages');
    renderAdminTicketChat(msgs);
  } catch (e) {
    input.value = content;
    toast(e.message, 'error');
  }
}

function closeAdminTicketChat() {
  const panel = document.getElementById('adminTicketChatPanel');
  if (panel) panel.style.display = 'none';
  window.currentAdminTicketId = null;
}

async function adminUpdateTicket(id, status) {
  try { await api('/api/admin/tickets/' + id, { method: 'PUT', body: JSON.stringify({ status }) }); toast('Estado actualizado', 'ok'); }
  catch (e) { toast(e.message, 'error'); }
}

async function adminDeleteTicket(id) {
  if (!confirm('¿Eliminar este ticket?')) return;
  try { await api('/api/admin/tickets/' + id, { method: 'DELETE' }); toast('Ticket eliminado', 'ok'); loadAdminTickets(); }
  catch (e) { toast(e.message, 'error'); }
}

// ============================================================
// TICKETS — SUBMIT
// FIX #5: submitTicket espera la respuesta antes de limpiar
// y muestra error si falla
// ============================================================
async function submitTicket() {
  const type    = document.getElementById('ticketType').value.trim();
  const subject = document.getElementById('ticketSubject').value.trim();
  const desc    = document.getElementById('ticketDesc').value.trim();
  if (!type || !subject || !desc) { alert('Completa tipo, asunto y descripción.'); return; }
  if (!currentUser) { toast('Debes iniciar sesión para crear un ticket.', 'error'); return; }

  const btn = document.querySelector('#ticketSection .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    const result = await api('/api/tickets', { method: 'POST', body: JSON.stringify({ type, subject, description: desc }) });
    console.log('[Ticket creado]', result);
    // Limpiar formulario
    ['ticketType','ticketSubject','ticketDesc'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
    toast('Ticket creado correctamente. El staff lo revisará pronto.', 'ok');
    setTimeout(() => loadUserTickets(), 800);
  } catch (e) {
    console.error('[submitTicket] Error:', e);
    toast('Error enviando ticket: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Ticket'; }
  }
}

// USER TICKETS
async function loadUserTickets() {
  const section = document.getElementById('userTicketsSection');
  if (!section || !currentUser) { if (section) section.style.display = 'none'; return; }
  try {
    const userTickets = await api('/api/tickets');
    if (!userTickets || !userTickets.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    const list = document.getElementById('userTicketsList');
    const statusColors = { pending:'var(--orange)', open:'#57F287', closed:'var(--text-dim)', rejected:'#ff7070' };
    const statusLabels = { pending:'pendiente', open:'abierto', closed:'cerrado', rejected:'rechazado' };
    list.innerHTML = userTickets.map(t => `
      <div class="admin-ticket-row" id="uticket-${t.id}">
        <div class="admin-ticket-header">
          <div>
            <span class="admin-ticket-type">${esc(t.type)}</span>
            <span class="admin-ticket-status" style="color:${statusColors[t.status] || 'var(--text-dim)'}">${statusLabels[t.status] || t.status}</span>
            <span style="font-size:0.72rem;color:var(--text-dim)">${fmtDate(t.created_at)}</span>
          </div>
          <div style="font-size:0.9rem;color:var(--white);font-weight:700">${esc(t.subject)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px">
          <div style="color:var(--text-dim);font-size:0.9rem">${esc(t.description.slice(0,120))}${t.description.length>120?'...':''}</div>
          <button class="btn-outline" style="padding:6px 10px;font-size:0.75rem" onclick="openUserTicketChat(${t.id})">Ver Chat</button>
        </div>
      </div>`).join('');
  } catch (e) { console.warn('[Tickets] Error cargando tickets del usuario:', e.message); }
}

async function openUserTicketChat(ticketId) {
  const panel   = document.getElementById('userTicketChatPanel');
  const chatBox = document.getElementById('userTicketChatBox');
  if (!panel || !chatBox) return;
  window.currentUserTicketId = ticketId;
  panel.style.display = 'flex';
  chatBox.innerHTML = '<div style="color:var(--text-dim);margin:auto">Cargando mensajes...</div>';
  try {
    const msgs = await api('/api/tickets/' + ticketId + '/messages');
    renderUserTicketChat(ticketId, msgs);
  } catch (e) {
    chatBox.innerHTML = '<div style="color:var(--orange);margin:auto">Error: ' + esc(e.message) + '</div>';
  }
}

function closeUserTicketChat() {
  const panel = document.getElementById('userTicketChatPanel');
  if (panel) panel.style.display = 'none';
  window.currentUserTicketId = null;
}

function renderUserTicketChat(ticketId, messages) {
  const chatBox = document.getElementById('userTicketChatBox');
  if (!chatBox) return;
  if (!messages.length) { chatBox.innerHTML = '<div style="color:var(--text-dim);text-align:center;margin:auto">Sin mensajes aún.</div>'; return; }
  const wasAtBottom = chatBox.scrollTop + chatBox.clientHeight >= chatBox.scrollHeight - 30;
  chatBox.innerHTML = messages.map(m => `
    <div class="ticket-msg ${currentUser && m.user_id === currentUser.id ? 'own' : ''}">
      <div>
        <div class="ticket-msg-name">${esc(m.username)}</div>
        <div class="ticket-msg-time">${fmtTime(m.created_at)}</div>
        <div class="ticket-msg-text">${esc(m.content)}</div>
      </div>
    </div>`).join('');
  if (wasAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendUserTicketMessageFromModal() {
  const ticketId = window.currentUserTicketId;
  const input    = document.getElementById('userTicketChatInput');
  if (!ticketId || !input || !input.value.trim()) return;
  const content = input.value;
  input.value = '';
  try {
    await api('/api/tickets/' + ticketId + '/messages', { method: 'POST', body: JSON.stringify({ content }) });
    const msgs = await api('/api/tickets/' + ticketId + '/messages');
    renderUserTicketChat(ticketId, msgs);
  } catch (e) {
    toast('Error enviando mensaje: ' + e.message, 'error');
  }
}

// ============================================================
// MODALS
// FIX #6: openBuyModal verifica que el modal exista
// FIX #7: closeTicketModal funciona correctamente
// ============================================================
function openBuyModal(name, price) {
  const modal   = document.getElementById('buyModal');
  const rankEl  = document.getElementById('modalRankName');
  const priceEl = document.getElementById('modalPrice');
  if (!modal) { console.error('buyModal no encontrado en el DOM'); return; }
  if (rankEl)  rankEl.textContent  = name;
  if (priceEl) priceEl.textContent = price;
  modal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeBuyModal(e) {
  const modal = document.getElementById('buyModal');
  if (!modal) return;
  if (!e || e.target === modal || (e.target && e.target.classList.contains('modal-close'))) {
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
}

function closeTicketModal(e) {
  const modal = document.getElementById('ticketModal');
  if (!modal) return;
  if (!e || e.target === modal || (e.target && e.target.classList.contains('modal-close'))) {
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }
}

// ============================================================
// KONAMI CODE EASTER EGG
// ============================================================
(function () {
  const seq = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let idx = 0;
  document.addEventListener('keydown', e => {
    if (e.key === seq[idx]) { idx++; if (idx === seq.length) { const ee = document.getElementById('easterEgg'); if (ee) ee.classList.add('show'); idx = 0; } }
    else idx = 0;
  });
})();

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadUser();           // primero auth
  await loadSiteConfig();     // luego config (logo, video)
  loadAndRenderShop();        // paralelo
  loadAndRenderTeam();
  loadAndRenderGallery();
  loadAndInitCountdown();
  renderTestimonios();
  initScrollReveal();
});