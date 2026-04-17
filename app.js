/* ══════════════════════════════════════════════
   LaboreS — Lógica da Aplicação
   ═══════════════════════════════════════════════ */

// ──────────────────────────────────────────────
// BANCO DE DADOS VIA API / SQLite
// ──────────────────────────────────────────────
const API_BASE = '';

let db = { empresas: [], laudos: [], medico: { nome: '' } };

async function apiRequest(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Erro ao acessar a API');
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadDB() {
  const data = await apiRequest('/api/state');
  db = data;
}

// ──────────────────────────────────────────────
// ESTADO DA SESSÃO
// ──────────────────────────────────────────────
let currentUser = null; // { role: 'medico'|'empresa', id?, nome }
let currentLoginTab = 'empresa';
let selectedFile = null;

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────
function switchLoginTab(tab) {
  currentLoginTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b,i) => {
    b.classList.toggle('active', (i === 0 && tab === 'empresa') || (i === 1 && tab === 'medico'));
  });
  document.getElementById('loginUser').placeholder = tab === 'medico' ? 'Login do médico' : 'Login da empresa';
}

function togglePass() {
  const inp = document.getElementById('loginPass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function doLogin() {
  const user = document.getElementById('loginUser').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');

  try {
    const resp = await apiRequest('/api/login', 'POST', {
      role: currentLoginTab,
      user,
      senha: pass,
    });
    currentUser = resp;
    await enterApp();
  } catch (error) {
    showLoginError(errEl);
  }
}

function showLoginError(el) {
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3500);
}

document.getElementById('loginPass').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

function doLogout() {
  currentUser = null;
  document.getElementById('appScreen').classList.remove('active');
  document.getElementById('loginScreen').classList.add('active');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}

// ──────────────────────────────────────────────
// ENTRAR NO APP
// ──────────────────────────────────────────────
async function enterApp() {
  document.getElementById('loginScreen').classList.remove('active');
  document.getElementById('appScreen').classList.add('active');
  await loadDB();
  buildNav();
  buildUserBadge();
  populateEmpresaSelects();
  navigateTo('dashboard');
}

function buildUserBadge() {
  const el = document.getElementById('userBadge');
  const role = currentUser.role === 'medico' ? 'Médico' : 'Empresa';
  el.innerHTML = `
    <div class="badge-role">${role}</div>
    <div class="badge-name">${currentUser.nome}</div>
  `;
  const initials = currentUser.nome.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
  document.getElementById('topbarAvatar').textContent = initials;
}

function buildNav() {
  const nav = document.getElementById('sidebarNav');
  const items = currentUser.role === 'medico'
    ? [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'upload',    icon: '📤', label: 'Enviar Laudo' },
        { id: 'laudos',    icon: '📋', label: 'Todos os Laudos' },
        { id: 'empresas',  icon: '🏢', label: 'Empresas' },
      ]
    : [
        { id: 'dashboard', icon: '📊', label: 'Dashboard' },
        { id: 'laudos',    icon: '📋', label: 'Meus Laudos' },
      ];

  nav.innerHTML = items.map(it => `
    <button class="nav-item" id="nav-${it.id}" onclick="navigateTo('${it.id}')">
      <span class="nav-icon">${it.icon}</span>
      ${it.label}
    </button>
  `).join('');
}

// ──────────────────────────────────────────────
// NAVEGAÇÃO
// ──────────────────────────────────────────────
const pageMap = {
  dashboard: 'pageDashboard',
  upload:    'pageUpload',
  laudos:    'pageLaudos',
  empresas:  'pageEmpresas',
};
const titleMap = {
  dashboard: 'Dashboard',
  upload:    'Enviar Laudo',
  laudos:    'Laudos',
  empresas:  'Empresas',
};

function navigateTo(page) {
  // hide all
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

  document.getElementById(pageMap[page]).classList.add('active');
  const navBtn = document.getElementById(`nav-${page}`);
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('topbarTitle').textContent = titleMap[page];

  if (page === 'dashboard') renderDashboard();
  if (page === 'laudos')    renderLaudos();
  if (page === 'empresas')  renderEmpresas();

  // close sidebar on mobile
  if (window.innerWidth <= 900) closeSidebar();
}

// ──────────────────────────────────────────────
// SIDEBAR TOGGLE
// ──────────────────────────────────────────────
let sidebarOpen = window.innerWidth > 900;

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  if (window.innerWidth <= 900) {
    sb.classList.toggle('open');
    ensureBackdrop(sb.classList.contains('open'));
  } else {
    sb.classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('expanded');
  }
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  ensureBackdrop(false);
}

function ensureBackdrop(show) {
  let bd = document.getElementById('sidebarBackdrop');
  if (!bd) {
    bd = document.createElement('div');
    bd.id = 'sidebarBackdrop';
    bd.className = 'sidebar-backdrop';
    bd.onclick = closeSidebar;
    document.body.appendChild(bd);
  }
  bd.classList.toggle('visible', show);
}

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
function renderDashboard() {
  const myLaudos = getLaudosForUser();

  const total    = myLaudos.length;
  const aptos    = myLaudos.filter(l => l.resultado === 'Apto').length;
  const restric  = myLaudos.filter(l => l.resultado === 'Apto com restrição').length;
  const inaptos  = myLaudos.filter(l => l.resultado === 'Inapto').length;

  let statsHTML = '';
  if (currentUser.role === 'medico') {
    statsHTML += statCard('📋', 'Total de Laudos', total, 0);
    statsHTML += statCard('✅', 'Aptos', aptos, 1);
    statsHTML += statCard('⚠️', 'Com Restrição', restric, 2);
    statsHTML += statCard('❌', 'Inaptos', inaptos, 3);
  } else {
    const emp = db.empresas.find(e => e.id === currentUser.id);
    document.getElementById('dashDesc').textContent = `Laudos vinculados a: ${emp?.nome}`;
    statsHTML += statCard('📋', 'Total de Laudos', total, 0);
    statsHTML += statCard('✅', 'Aptos', aptos, 1);
    statsHTML += statCard('⚠️', 'Com Restrição', restric, 2);
    statsHTML += statCard('❌', 'Inaptos', inaptos, 3);
  }
  document.getElementById('statsGrid').innerHTML = statsHTML;

  // recentes
  const recentes = [...myLaudos].sort((a,b) => b.data.localeCompare(a.data)).slice(0,5);
  document.getElementById('recentLaudos').innerHTML = recentes.length
    ? recentes.map(laudoItem).join('')
    : '<p style="color:var(--text-muted);font-size:.88rem;padding:12px 0">Nenhum laudo ainda.</p>';
}

function statCard(icon, label, value, idx) {
  return `<div class="stat-card" style="animation-delay:${idx*0.05}s">
    <span class="stat-icon">${icon}</span>
    <span class="stat-label">${label}</span>
    <span class="stat-value">${value}</span>
  </div>`;
}

function laudoItem(l) {
  const initials = l.paciente.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const emp = db.empresas.find(e => e.id === l.empresaId);
  return `<div class="laudo-item" onclick="openModal('${l.id}')">
    <div class="laudo-avatar">${initials}</div>
    <div class="laudo-info">
      <div class="laudo-name">${l.paciente}</div>
      <div class="laudo-meta">${l.tipo} · ${formatDate(l.data)} · ${emp?.nome || '—'}</div>
    </div>
    <div class="laudo-badge">${badgeHTML(l.resultado)}</div>
  </div>`;
}

// ──────────────────────────────────────────────
// LAUDOS TABLE
// ──────────────────────────────────────────────
function renderLaudos() {
  const isAdmin = currentUser.role === 'medico';
  document.getElementById('laudosDesc').textContent = isAdmin
    ? 'Todos os laudos cadastrados no sistema'
    : `Laudos de ${currentUser.nome}`;

  // show/hide empresa filter for medico
  document.getElementById('filterEmpresaLaudo').style.display = isAdmin ? '' : 'none';
  if (isAdmin) {
    const sel = document.getElementById('filterEmpresaLaudo');
    sel.innerHTML = '<option value="">Todas as empresas</option>' +
      db.empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
  }

  filterLaudos();
}

function filterLaudos() {
  const q      = (document.getElementById('searchInput').value || '').toLowerCase();
  const resF   = document.getElementById('filterResultado').value;
  const tipoF  = document.getElementById('filterTipo').value;
  const empF   = document.getElementById('filterEmpresaLaudo').value;

  document.getElementById('clearSearchBtn').style.display = q ? '' : 'none';

  let list = getLaudosForUser();

  if (q)    list = list.filter(l =>
    l.paciente.toLowerCase().includes(q) ||
    (l.cpf||'').includes(q) ||
    l.tipo.toLowerCase().includes(q) ||
    l.resultado.toLowerCase().includes(q)
  );
  if (resF)  list = list.filter(l => l.resultado === resF);
  if (tipoF) list = list.filter(l => l.tipo === tipoF);
  if (empF)  list = list.filter(l => l.empresaId === empF);

  const count = list.length;
  document.getElementById('laudosCount').textContent = `${count} laudo${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('laudosTableBody');
  const empty = document.getElementById('emptyState');

  if (list.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = list.map(l => {
    const emp = db.empresas.find(e => e.id === l.empresaId);
    return `<tr onclick="openModal('${l.id}')">
      <td><span class="cell-paciente">${highlight(l.paciente, q)}</span></td>
      <td><span class="cell-cpf">${l.cpf || '—'}</span></td>
      <td>${emp?.nome || '—'}</td>
      <td>${l.tipo}</td>
      <td>${formatDate(l.data)}</td>
      <td>${badgeHTML(l.resultado)}</td>
      <td>
        <button class="btn-icon" title="Ver laudo" onclick="event.stopPropagation();openModal('${l.id}')">🔍</button>
        ${currentUser.role === 'medico' ? `<button class="btn-icon" title="Excluir" onclick="event.stopPropagation();deleteLaudo('${l.id}')">🗑</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  filterLaudos();
}

// ──────────────────────────────────────────────
// UPLOAD LAUDO
// ──────────────────────────────────────────────
function populateEmpresaSelects() {
  const sel = document.getElementById('upEmpresa');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione a empresa...</option>' +
    db.empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
}

function handleFile(input) {
  if (input.files[0]) {
    selectedFile = input.files[0];
    const label = document.getElementById('fileLabel');
    label.textContent = `📄 ${selectedFile.name}`;
    document.getElementById('fileDrop').classList.add('has-file');
  }
}

// Drag and drop
document.addEventListener('DOMContentLoaded', () => {
  const drop = document.getElementById('fileDrop');
  if (!drop) return;
  ['dragover','dragleave','drop'].forEach(evt => drop.addEventListener(evt, e => {
    e.preventDefault();
    if (evt === 'dragover') drop.style.borderColor = 'var(--teal)';
    if (evt === 'dragleave') drop.style.borderColor = '';
    if (evt === 'drop') {
      drop.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) {
        selectedFile = file;
        document.getElementById('fileLabel').textContent = `📄 ${file.name}`;
        drop.classList.add('has-file');
      }
    }
  }));
});

async function submitLaudo() {
  const paciente  = document.getElementById('upPaciente').value.trim();
  const cpf       = document.getElementById('upCpf').value.trim();
  const empresaId = document.getElementById('upEmpresa').value;
  const tipo      = document.getElementById('upTipo').value;
  const data      = document.getElementById('upData').value;
  const resultado = document.getElementById('upResultado').value;
  const cid       = document.getElementById('upCid').value.trim();
  const obs       = document.getElementById('upObs').value.trim();
  const errEl     = document.getElementById('uploadError');
  const sucEl     = document.getElementById('uploadSuccess');

  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!paciente || !empresaId || !tipo || !data || !resultado) {
    errEl.textContent = 'Preencha todos os campos obrigatórios (*).';
    errEl.classList.remove('hidden');
    return;
  }

  const novoLaudo = {
    paciente,
    cpf,
    empresaId,
    tipo,
    data,
    resultado,
    cid,
    obs,
    arquivo: selectedFile ? selectedFile.name : null,
    medico: db.medico.nome,
  };

  await apiRequest('/api/laudos', 'POST', novoLaudo);
  await loadDB();
  filterLaudos();

  sucEl.classList.remove('hidden');
  setTimeout(() => sucEl.classList.add('hidden'), 3000);
  clearUploadForm();
}

function clearUploadForm() {
  ['upPaciente','upCpf','upCid','upObs'].forEach(id => document.getElementById(id).value = '');
  ['upEmpresa','upTipo','upResultado'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('upData').value = '';
  selectedFile = null;
  document.getElementById('fileLabel').textContent = 'Clique para selecionar ou arraste o arquivo aqui';
  document.getElementById('fileDrop').classList.remove('has-file');
  document.getElementById('fileInput').value = '';
}

// ──────────────────────────────────────────────
// EMPRESAS
// ──────────────────────────────────────────────
async function addEmpresa() {
  const nome  = document.getElementById('empNome').value.trim();
  const cnpj  = document.getElementById('empCnpj').value.trim();
  const user  = document.getElementById('empUser').value.trim();
  const senha = document.getElementById('empSenha').value;
  const errEl = document.getElementById('empError');
  const sucEl = document.getElementById('empSuccess');

  errEl.classList.add('hidden');
  sucEl.classList.add('hidden');

  if (!nome || !user || !senha) {
    errEl.textContent = 'Preencha os campos obrigatórios.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await apiRequest('/api/empresas', 'POST', { nome, cnpj, user, senha });
    await loadDB();
    populateEmpresaSelects();
    renderEmpresas();

    ['empNome','empCnpj','empUser','empSenha'].forEach(id => document.getElementById(id).value = '');
    sucEl.classList.remove('hidden');
    setTimeout(() => sucEl.classList.add('hidden'), 3000);
  } catch (error) {
    errEl.textContent = error.message || 'Erro ao cadastrar empresa.';
    errEl.classList.remove('hidden');
  }
}

function renderEmpresas() {
  const grid = document.getElementById('empresaGrid');
  if (!grid) return;
  grid.innerHTML = db.empresas.map((e, i) => {
    const cnt = db.laudos.filter(l => l.empresaId === e.id).length;
    return `<div class="empresa-card" style="animation-delay:${i*0.07}s">
      <div class="emp-name">🏢 ${e.nome}</div>
      <div class="emp-cnpj">${e.cnpj || 'CNPJ não informado'}</div>
      <span class="emp-user">👤 ${e.user}</span>
      <div class="emp-laudos">📋 ${cnt} laudo${cnt !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

async function deleteLaudo(id) {
  if (!confirm('Deseja excluir este laudo? Esta ação é irreversível.')) return;
  await apiRequest(`/api/laudos/${id}`, 'DELETE');
  await loadDB();
  filterLaudos();
}

// ──────────────────────────────────────────────
// MODAL
// ──────────────────────────────────────────────
function openModal(id) {
  const l = db.laudos.find(l => l.id === id);
  if (!l) return;
  const emp = db.empresas.find(e => e.id === l.empresaId);

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-header">
      <div class="modal-title">${l.paciente}</div>
      <div class="modal-subtitle">${l.tipo} · ${formatDate(l.data)}</div>
    </div>
    <div class="modal-row"><span class="modal-key">CPF</span><span class="modal-val">${l.cpf || 'Não informado'}</span></div>
    <div class="modal-row"><span class="modal-key">Empresa</span><span class="modal-val">${emp?.nome || '—'}</span></div>
    <div class="modal-row"><span class="modal-key">Tipo</span><span class="modal-val">${l.tipo}</span></div>
    <div class="modal-row"><span class="modal-key">Data</span><span class="modal-val">${formatDate(l.data)}</span></div>
    <div class="modal-row"><span class="modal-key">Médico</span><span class="modal-val">${l.medico}</span></div>
    <div class="modal-row"><span class="modal-key">CID</span><span class="modal-val">${l.cid || 'Não informado'}</span></div>
    <div class="modal-row"><span class="modal-key">Resultado</span><span class="modal-val">${badgeHTML(l.resultado)}</span></div>
    <hr class="modal-divider"/>
    <div class="modal-row">
      <span class="modal-key">Observações</span>
      <span class="modal-val"><div class="modal-obs">${l.obs || 'Nenhuma observação registrada.'}</div></span>
    </div>
    ${l.arquivo ? `<hr class="modal-divider"/>
    <div class="modal-row">
      <span class="modal-key">Arquivo</span>
      <span class="modal-val"><a class="modal-file-link" href="#" onclick="return false">📎 ${l.arquivo}</a></span>
    </div>` : ''}
  `;

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function getLaudosForUser() {
  if (currentUser.role === 'medico') return db.laudos;
  return db.laudos.filter(l => l.empresaId === currentUser.id);
}

function badgeHTML(resultado) {
  const map = {
    'Apto':              'badge-apto',
    'Apto com restrição':'badge-restricao',
    'Inapto':            'badge-inapto',
  };
  return `<span class="badge ${map[resultado] || 'badge-default'}">${resultado}</span>`;
}

function formatDate(d) {
  if (!d) return '—';
  const [y,m,day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function highlight(text, q) {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(re, '<mark style="background:rgba(0,180,166,.2);color:var(--teal);border-radius:2px">$1</mark>');
}

function maskCPF(el) {
  let v = el.value.replace(/\D/g,'').slice(0,11);
  v = v.replace(/(\d{3})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
  el.value = v;
}

function maskCNPJ(el) {
  let v = el.value.replace(/\D/g,'').slice(0,14);
  v = v.replace(/(\d{2})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d)/,'$1.$2')
       .replace(/(\d{3})(\d)/,'$1/$2')
       .replace(/(\d{4})(\d{1,2})$/,'$1-$2');
  el.value = v;
}
