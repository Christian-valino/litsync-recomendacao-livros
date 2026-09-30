/**
 * main.js — Lógica do frontend LitSync
 *
 * Responsabilidades:
 *  - Acordar a API (Render dorme quando fica sem uso) e mostrar o status
 *  - Listar perfis musicais e buscar recomendações por perfil ou texto livre
 *  - Filtrar resultados por tema e carregar mais recomendações
 *  - Guardar livros na "Minha estante" (localStorage)
 *  - Manter a busca atual na URL para poder compartilhar o link
 */

const API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:5000'
  : 'https://litsync-recomendacao-livros.onrender.com';

const PASSO    = 10;   // recomendações por página
const MAX_TOP  = 50;   // limite da API

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

const $ = id => document.getElementById(id);

const estado = {
  perfis:  [],
  consulta: null,   // { tipo: 'perfil', perfil } | { tipo: 'texto', texto }
  top:     PASSO,
  livros:  [],
  filtro:  null,
};

// ── Utilidades ────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(caminho, opcoes = {}, timeout = 30000) {
  const res = await fetch(`${API}${caminho}`, { ...opcoes, signal: AbortSignal.timeout(timeout) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}

function armazenar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {}
}
function ler(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ── Status da API ─────────────────────────────────────────
// O plano gratuito do Render hiberna a API; a primeira requisição
// pode levar até ~1 min. Em vez de dar "offline", avisamos e esperamos.

let apiPronta = null;

function setStatus(tipo, texto) {
  const el = $('apiStatus');
  el.className = `api-status ${tipo}`;
  el.querySelector('.api-status-text').textContent = texto;
}

function banner(texto, { erro = false, retry = false } = {}) {
  const el = $('banner');
  if (!texto) { el.hidden = true; return; }
  $('bannerText').textContent = texto;
  el.classList.toggle('error', erro);
  $('bannerRetry').hidden = !retry;
  el.hidden = false;
}

function acordarAPI() {
  setStatus('', 'Conectando…');
  const aviso = setTimeout(() => {
    setStatus('', 'Acordando servidor…');
    banner('⏳ Acordando o servidor — no plano gratuito isso pode levar até 1 minuto. Já pode ir escrevendo sua busca.');
  }, 2500);

  apiPronta = api('/stats', {}, 90000)
    .then(stats => {
      setStatus('online', 'Online');
      banner(null);
      $('statLivros').textContent = stats.total_livros.toLocaleString('pt-BR');
      $('statPerfis').textContent = stats.total_perfis;
      $('statVocab').textContent  = stats.vocab_size.toLocaleString('pt-BR');
      return true;
    })
    .catch(() => {
      setStatus('offline', 'Offline');
      banner('Não foi possível falar com o servidor agora.', { erro: true, retry: true });
      return false;
    })
    .finally(() => clearTimeout(aviso));

  return apiPronta;
}

// ── Perfis ────────────────────────────────────────────────

function artistasCurtos(texto, n = 3) {
  const vistos = new Set();
  const lista = String(texto).split(/[,;]/).map(s => s.trim()).filter(s => {
    const chave = s.toLowerCase();
    if (!s || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  return lista.slice(0, n).join(', ') + (lista.length > n ? '…' : '');
}

async function carregarPerfis() {
  try {
    estado.perfis = await api('/perfis');
    renderPerfis();
  } catch {
    $('profileList').innerHTML = '<p class="muted">Não foi possível carregar os perfis.</p>';
  }
}

function renderPerfis() {
  const ativo = estado.consulta?.tipo === 'perfil' ? estado.consulta.perfil.usuario : null;
  $('profileList').innerHTML = estado.perfis.map(p => `
    <button class="profile-card ${p.usuario === ativo ? 'active' : ''}" data-usuario="${esc(p.usuario)}">
      <span class="profile-emoji">${EMOJIS[p.genero] || '🎵'}</span>
      <span>
        <span class="profile-genre">${esc(p.genero)}</span>
        <span class="profile-artists">${esc(artistasCurtos(p.artistas))}</span>
      </span>
    </button>`).join('');
}

// ── Consulta ──────────────────────────────────────────────

async function executarConsulta({ novo = true } = {}) {
  const c = estado.consulta;
  if (!c) return;

  if (novo) {
    estado.top    = PASSO;
    estado.livros = [];
    estado.filtro = null;
    atualizarURL();
    renderCabecalho();
    renderSkeleton();
    if (estado.perfis.length) renderPerfis();
    $('results').hidden = false;
    $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const btnMais = $('btnMore');
  btnMais.disabled = true;
  btnMais.textContent = 'Carregando…';
  $('btnSearch').disabled = true;

  try {
    if (!(await apiPronta)) await acordarAPI();
    if (!estado.perfis.length) carregarPerfis();

    const data = c.tipo === 'perfil'
      ? await api(`/recomendar/${encodeURIComponent(c.perfil.usuario)}?top=${estado.top}`)
      : await api('/buscar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ texto: c.texto, top: estado.top }),
        });

    if (estado.consulta !== c) return; // outra busca começou no meio do caminho
    const anteriores = estado.livros.length;
    estado.livros = (data.livros || []).filter(l => l.score > 0);
    renderLivros(anteriores);
  } catch (e) {
    if (estado.consulta !== c) return;
    $('booksGrid').innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-icon">⚠️</div>
        <p>Não conseguimos buscar as recomendações.</p>
        <p class="muted">${esc(e.message)}</p>
        <button class="btn-ghost" data-action="retry">Tentar de novo</button>
      </div>`;
    btnMais.hidden = true;
  } finally {
    btnMais.disabled = false;
    btnMais.textContent = 'Ver mais recomendações';
    $('btnSearch').disabled = false;
  }
}

function buscarPorTexto(texto) {
  texto = texto.trim();
  if (!texto) { $('searchInput').focus(); return; }
  estado.consulta = { tipo: 'texto', texto };
  executarConsulta();
}

function buscarPorPerfil(usuario) {
  const perfil = estado.perfis.find(p => p.usuario === usuario);
  if (!perfil) return;
  estado.consulta = { tipo: 'perfil', perfil };
  executarConsulta();
}

function atualizarURL() {
  const c = estado.consulta;
  const params = new URLSearchParams();
  if (c?.tipo === 'perfil') params.set('perfil', c.perfil.usuario);
  if (c?.tipo === 'texto')  params.set('q', c.texto);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ── Render dos resultados ─────────────────────────────────

function renderCabecalho() {
  const c = estado.consulta;
  const bars = $('audioBars');

  if (c.tipo === 'perfil') {
    const p = c.perfil;
    $('resultsKicker').textContent = 'Perfil musical';
    $('resultsTitle').textContent  = `${EMOJIS[p.genero] || '🎵'} ${p.genero}`;
    $('resultsSub').textContent    = `Para quem ouve ${artistasCurtos(p.artistas, 5)}`;
    const medidas = [
      ['Energia',       p.energy],
      ['Positividade',  p.valence],
      ['Dançabilidade', p.danceability],
    ];
    bars.innerHTML = medidas.map(([nome, v]) => `
      <div>
        <div class="bar-label"><span>${nome}</span><span>${Math.round(v * 100)}%</span></div>
        <div class="bar-track"><div class="bar-fill" data-v="${v * 100}"></div></div>
      </div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() =>
      bars.querySelectorAll('.bar-fill').forEach(el => { el.style.width = `${el.dataset.v}%`; })));
  } else {
    $('resultsKicker').textContent = 'Sua busca';
    $('resultsTitle').textContent  = 'Livros para o seu som';
    $('resultsSub').textContent    = `“${c.texto.length > 160 ? c.texto.slice(0, 160) + '…' : c.texto}”`;
    bars.innerHTML = '';
  }
}

function renderSkeleton() {
  $('filters').innerHTML = '';
  $('btnMore').hidden = true;
  $('booksGrid').innerHTML = '<div class="book skeleton"></div>'.repeat(6);
}

function renderFiltros() {
  const contagem = {};
  estado.livros.forEach(l => { contagem[l.tema] = (contagem[l.tema] || 0) + 1; });
  const temas = Object.entries(contagem).sort((a, b) => b[1] - a[1]);

  if (temas.length < 2) { $('filters').innerHTML = ''; return; }

  $('filters').innerHTML =
    `<button class="chip ${estado.filtro ? '' : 'active'}" data-tema="">Todos<span class="n">${estado.livros.length}</span></button>` +
    temas.map(([t, n]) => `
      <button class="chip ${estado.filtro === t ? 'active' : ''}" data-tema="${esc(t)}">${esc(t)}<span class="n">${n}</span></button>`).join('');
}

function renderLivros(jaExibidos = 0) {
  const grid = $('booksGrid');
  renderFiltros();

  if (!estado.livros.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <div class="empty-icon">🔎</div>
        <p>Não encontramos livros com afinidade para essa descrição.</p>
        <p class="muted">Tente outras palavras — temas, sentimentos, cenários. Em inglês costuma funcionar melhor.</p>
      </div>`;
    $('btnMore').hidden = true;
    return;
  }

  const maxScore = estado.livros[0].score;
  const visiveis = estado.livros
    .map((l, i) => ({ ...l, rank: i + 1 }))
    .filter(l => !estado.filtro || l.tema === estado.filtro);

  grid.innerHTML = visiveis.map((l, i) =>
    cardLivro(l, maxScore, l.rank > jaExibidos ? Math.min(Math.max(i - jaExibidos, 0), 12) * 40 : null)).join('');

  $('btnMore').hidden = estado.top >= MAX_TOP || estado.livros.length < estado.top;
}

function idLivro(l) { return `${l.titulo}|${l.autor}`; }

function cardLivro(l, maxScore, atraso = null) {
  const salvo  = estante.has(idLivro(l));
  const busca  = encodeURIComponent(`${l.titulo} ${l.autor}`);
  const anim   = atraso === null ? 'animation:none' : `animation-delay:${atraso}ms`;
  const barra  = maxScore ? Math.round((l.score / maxScore) * 100) : 0;
  const longa  = (l.sinopse || '').length > 180;

  return `
    <article class="book" style="${anim}" data-id="${esc(idLivro(l))}">
      <div class="book-top">
        ${l.rank ? `<span class="book-rank">#${l.rank}</span>` : ''}
        ${l.tema ? `<span class="book-tema">${esc(l.tema)}</span>` : ''}
        <button class="book-save ${salvo ? 'saved' : ''}" data-action="save"
          aria-label="${salvo ? 'Remover da estante' : 'Salvar na estante'}"
          title="${salvo ? 'Remover da estante' : 'Salvar na estante'}">${salvo ? '♥' : '♡'}</button>
      </div>
      <h3 class="book-title">${esc(l.titulo)}</h3>
      <div class="book-author">${esc(l.autor)}</div>
      <p class="book-synopsis">${esc(l.sinopse)}${longa ? '…' : ''}</p>
      ${longa ? '<button class="book-more" data-action="expand">Ler mais</button>' : ''}
      <div class="book-foot">
        ${l.score != null ? `
          <span class="match" title="Similaridade cosseno: ${l.score.toFixed(4)}">
            Afinidade <span class="match-track"><span class="match-fill" style="width:${barra}%"></span></span>
            ${Math.round(l.score * 100)}%
          </span>` : '<span class="match"></span>'}
        <a class="book-link" href="https://www.goodreads.com/search?q=${busca}" target="_blank" rel="noopener">Goodreads ↗</a>
      </div>
    </article>`;
}

// ── Estante ───────────────────────────────────────────────

const estante = new Map(ler('litsync:estante', []).map(l => [idLivro(l), l]));

function salvarEstante() {
  armazenar('litsync:estante', [...estante.values()]);
  $('shelfCount').textContent = estante.size;
}

function alternarSalvo(id) {
  if (estante.has(id)) {
    estante.delete(id);
    toast('Removido da estante');
  } else {
    const livro = estado.livros.find(l => idLivro(l) === id);
    if (!livro) return;
    const { rank, ...dados } = livro;
    estante.set(id, { ...dados, score: null });
    toast('Salvo na sua estante ♥');
  }
  salvarEstante();

  document.querySelectorAll(`.book[data-id="${CSS.escape(id)}"] .book-save`).forEach(btn => {
    const salvo = estante.has(id);
    btn.classList.toggle('saved', salvo);
    btn.textContent = salvo ? '♥' : '♡';
    btn.title = btn.ariaLabel = salvo ? 'Remover da estante' : 'Salvar na estante';
  });
  if (!$('view-estante').hidden) renderEstante();
}

function renderEstante() {
  $('shelfGrid').innerHTML = [...estante.values()].reverse()
    .map(l => cardLivro({ ...l, rank: null }, 0)).join('');
}

// ── Navegação entre abas ──────────────────────────────────

function irPara(view) {
  document.querySelectorAll('.tab').forEach(t => {
    const ativo = t.dataset.view === view;
    t.classList.toggle('active', ativo);
    t.setAttribute('aria-selected', ativo);
  });
  $('view-descobrir').hidden = view !== 'descobrir';
  $('view-estante').hidden   = view !== 'estante';
  if (view === 'estante') renderEstante();
  window.scrollTo({ top: 0 });
}

// ── Tema claro/escuro ─────────────────────────────────────

function aplicarTema(tema) {
  if (tema) document.documentElement.dataset.theme = tema;
  else delete document.documentElement.dataset.theme;
}

$('btnTheme').addEventListener('click', () => {
  const escuroAgora = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  const novo = escuroAgora ? 'light' : 'dark';
  aplicarTema(novo);
  armazenar('litsync:tema', novo);
});

// ── Eventos ───────────────────────────────────────────────

$('searchForm').addEventListener('submit', e => {
  e.preventDefault();
  buscarPorTexto($('searchInput').value);
});

$('searchInput').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); buscarPorTexto(e.target.value); }
});

document.querySelector('.examples').addEventListener('click', e => {
  const chip = e.target.closest('[data-example]');
  if (!chip) return;
  $('searchInput').value = chip.dataset.example;
  buscarPorTexto(chip.dataset.example);
});

$('profileList').addEventListener('click', e => {
  const card = e.target.closest('[data-usuario]');
  if (card) buscarPorPerfil(card.dataset.usuario);
});

$('filters').addEventListener('click', e => {
  const chip = e.target.closest('[data-tema]');
  if (!chip) return;
  estado.filtro = chip.dataset.tema || null;
  renderLivros(Infinity);
});

$('btnMore').addEventListener('click', () => {
  estado.top = Math.min(estado.top + PASSO, MAX_TOP);
  executarConsulta({ novo: false });
});

$('bannerRetry').addEventListener('click', () => acordarAPI().then(ok => ok && carregarPerfis()));

document.addEventListener('click', e => {
  const alvo = e.target.closest('[data-action], [data-view], [data-goto]');
  if (!alvo) return;

  if (alvo.dataset.view || alvo.dataset.goto) return irPara(alvo.dataset.view || alvo.dataset.goto);

  const card = alvo.closest('.book');
  switch (alvo.dataset.action) {
    case 'save':   alternarSalvo(card.dataset.id); break;
    case 'expand':
      card.classList.toggle('open');
      alvo.textContent = card.classList.contains('open') ? 'Ler menos' : 'Ler mais';
      break;
    case 'retry':  executarConsulta(); break;
  }
});

// ── Início ────────────────────────────────────────────────

aplicarTema(ler('litsync:tema', null));
$('shelfCount').textContent = estante.size;

acordarAPI().then(async ok => {
  if (!ok) return;
  await carregarPerfis();

  // Restaura busca vinda de um link compartilhado
  const params = new URLSearchParams(location.search);
  if (params.get('perfil')) buscarPorPerfil(params.get('perfil'));
  else if (params.get('q')) {
    $('searchInput').value = params.get('q');
    buscarPorTexto(params.get('q'));
  }
});
