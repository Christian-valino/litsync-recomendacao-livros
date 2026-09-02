/**
 * main.js — Lógica do frontend LitSync
 *
 * Responsabilidades:
 *  - Verificar status da API
 *  - Carregar e renderizar perfis musicais na sidebar
 *  - Buscar e renderizar recomendações por perfil
 *  - Buscar e renderizar recomendações por texto livre
 */

const API = 'https://litsync-recomendacao-livros.onrender.com';

const EMOJIS = {
  'Rock/Metal':         '🎸',
  'Pop/Dance':          '💃',
  'Hip-Hop/Rap':        '🎤',
  'Jazz/Blues':         '🎷',
  'Eletrônico/Ambient': '🎛️',
  'Folk/Indie':         '🪕',
  'Clássica':           '🎻',
  'Sertanejo/MPB':      '🤠',
  'R&B/Soul':           '🎶',
  'Punk/Alternativo':   '⚡',
};

let perfis = [];

// ── API status ────────────────────────────────────────────

async function checkAPI() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');

  try {
    const res  = await fetch(`${API}/stats`, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    dot.className  = 'dot online';
    text.textContent = `API online · ${data.total_livros.toLocaleString('pt-BR')} livros · ${data.vocab_size.toLocaleString('pt-BR')} termos`;

    document.getElementById('statLivros').textContent = data.total_livros.toLocaleString('pt-BR');
    document.getElementById('statPerfis').textContent = data.total_perfis;
  } catch {
    dot.className  = 'dot offline';
    text.textContent = 'API offline — rode: python backend/app.py';
    showError('API não encontrada. Abra um terminal, vá até a pasta do projeto e rode: <strong>python backend/app.py</strong>');
  }
}

// ── Sidebar ───────────────────────────────────────────────

async function loadPerfis() {
  try {
    const res = await fetch(`${API}/perfis`);
    perfis    = await res.json();
    renderSidebar();
    selectUser(0);
  } catch {
    document.getElementById('userList').innerHTML =
      '<div class="state-msg">API offline</div>';
  }
}

function renderSidebar() {
  const list = document.getElementById('userList');
  list.innerHTML = '';

  perfis.forEach((p, i) => {
    const emoji = EMOJIS[p.genero] || '🎵';
    const div   = document.createElement('div');
    div.className = 'user-card';
    div.innerHTML = `
      <div class="user-emoji">${emoji}</div>
      <div class="user-name">${p.usuario}</div>
      <div class="user-genre">${p.genero}</div>`;
    div.addEventListener('click', () => selectUser(i));
    list.appendChild(div);
  });
}

// ── Selecionar perfil ─────────────────────────────────────

async function selectUser(idx) {
  const p     = perfis[idx];
  const emoji = EMOJIS[p.genero] || '🎵';

  // Sidebar active state
  document.querySelectorAll('.user-card')
    .forEach((c, i) => c.classList.toggle('active', i === idx));

  // Profile hero
  updateHero(emoji, p.genero, p.artistas, p);

  // Section header
  setSectionHeader('Livros recomendados', 'TOP 10');

  // Fetch livros
  showLoading();
  hideError();

  try {
    const res  = await fetch(`${API}/recomendar/${p.usuario}?top=10`);
    const data = await res.json();
    renderBooks(data.livros);
  } catch {
    showError('Erro ao buscar recomendações. Verifique se a API está rodando.');
    showLoading();
  }
}

// ── Busca livre ───────────────────────────────────────────

async function buscarLivre() {
  const texto = document.getElementById('searchInput').value.trim();
  if (!texto) return;

  // Limpa active na sidebar
  document.querySelectorAll('.user-card').forEach(c => c.classList.remove('active'));

  updateHero('🔍', 'Busca livre', texto.substring(0, 120) + (texto.length > 120 ? '...' : ''), null);
  setSectionHeader('Livros recomendados', 'TOP 10');

  const btn = document.getElementById('btnSearch');
  btn.disabled    = true;
  btn.textContent = 'Buscando...';
  showLoading();
  hideError();

  try {
    const res  = await fetch(`${API}/buscar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ texto, top: 10 }),
    });
    const data = await res.json();
    renderBooks(data.livros);
  } catch {
    showError('Erro ao buscar. Verifique se a API está rodando.');
    showLoading();
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Recomendar';
  }
}

// ── Render helpers ────────────────────────────────────────

function updateHero(emoji, genero, artistas, perfil) {
  const hero = document.getElementById('profileHero');
  hero.classList.remove('visible');
  hero.setAttribute('data-emoji', emoji);
  document.getElementById('profileTag').textContent     = perfil ? 'Perfil ativo' : 'Busca livre';
  document.getElementById('profileGenre').textContent   = `${emoji} ${genero}`;
  document.getElementById('profileArtists').textContent = artistas;

  const barsEl = document.getElementById('audioBars');
  if (perfil) {
    const bars = [
      { label: 'Energy',       value: perfil.energy },
      { label: 'Valence',      value: perfil.valence },
      { label: 'Danceability', value: perfil.danceability },
    ];
    barsEl.innerHTML = bars.map(b => `
      <div class="bar-item">
        <div class="bar-label">${b.label} <span>${Math.round(b.value * 100)}%</span></div>
        <div class="bar-track"><div class="bar-fill" data-val="${b.value * 100}"></div></div>
      </div>`).join('');
    requestAnimationFrame(() => {
      barsEl.querySelectorAll('.bar-fill').forEach(el => {
        el.style.width = el.dataset.val + '%';
      });
    });
  } else {
    barsEl.innerHTML = '';
  }

  setTimeout(() => hero.classList.add('visible'), 40);
}

function setSectionHeader(title, count) {
  const sh = document.getElementById('sectionHeader');
  document.getElementById('sectionTitle').textContent = title;
  document.getElementById('sectionCount').textContent = count;
  sh.classList.remove('visible');
  setTimeout(() => sh.classList.add('visible'), 90);
}

function renderBooks(livros) {
  const grid     = document.getElementById('booksGrid');
  grid.innerHTML = '';
  const maxScore = livros[0]?.score || 1;

  livros.forEach((livro, i) => {
    const pct  = Math.round((livro.score / maxScore) * 100);
    const card = document.createElement('div');
    card.className = 'book-card';
    card.innerHTML = `
      <div class="book-pos">${String(livro.posicao).padStart(2, '0')}</div>
      <div class="book-tema">${livro.tema}</div>
      <div class="book-titulo">${livro.titulo}</div>
      <div class="book-autor">${livro.autor}</div>
      <div class="book-sinopse">${livro.sinopse}</div>
      <div class="book-footer">
        <div class="score-label">Score</div>
        <div class="score-bar-mini">
          <div class="score-bar-mini-fill" style="width:${pct}%"></div>
        </div>
        <div class="score-value">${livro.score.toFixed(4)}</div>
      </div>`;
    grid.appendChild(card);
    setTimeout(() => card.classList.add('visible'), 55 + i * 38);
  });
}

function showLoading() {
  document.getElementById('booksGrid').innerHTML =
    '<div class="state-msg">carregando recomendações...</div>';
}
function showError(msg) {
  const el = document.getElementById('errorBox');
  el.innerHTML    = msg;
  el.style.display = 'block';
}
function hideError() {
  document.getElementById('errorBox').style.display = 'none';
}

// ── Enter no textarea ─────────────────────────────────────
document.getElementById('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); buscarLivre(); }
});

// ── Init ──────────────────────────────────────────────────
checkAPI().then(loadPerfis);
