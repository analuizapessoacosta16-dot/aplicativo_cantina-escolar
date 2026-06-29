// ============================================================
// FIREBASE CONFIG — substitua pelos seus dados do Firebase Console
// Crie seu projeto em: https://console.firebase.google.com
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAf3Du63ng5CZ_nflrDlOBy_JZIaYZdePg",
  authDomain: "cantina-escolar-cafe2.firebaseapp.com",
  projectId: "cantina-escolar-cafe2",
  storageBucket: "cantina-escolar-cafe2.firebasestorage.app",
  messagingSenderId: "748388087093",
  appId: "1:748388087093:web:17b7b9330abe05ea9bc87c"
};

// ============================================================
// LOGIN
// ============================================================

const USUARIOS = [
  { usuario: 'diretor',    senha: '1234',    nome: 'Diretor(a)' },
  { usuario: 'cantina',   senha: 'cantina',  nome: 'Responsável Cantina' },
  { usuario: 'portaria',  senha: 'portaria', nome: 'Responsável Portaria' },
  { usuario: 'admin',     senha: 'admin',    nome: 'Administrador' },
];

// ============================================================
// FIREBASE — inicialização e acesso ao Firestore
// ============================================================

let firebaseApp, firestoreDB;
let firebaseOk = false;

function iniciarFirebase() {
  try {
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK não carregou');
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.app();
    }
    firestoreDB = firebase.firestore();
    firebaseOk = true;
    console.log('✅ Firebase conectado!');
    mostrarStatusSync('conectado');
  } catch (e) {
    console.warn('⚠️ Firebase não disponível, usando modo local:', e.message);
    firebaseOk = false;
    mostrarStatusSync('local');
  }
}

function mostrarStatusSync(estado) {
  let el = document.getElementById('sync-status');
  if (!el) return;
  if (estado === 'conectado') {
    el.innerHTML = '🟢 Banco de dados sincronizado';
    el.style.color = '#1D9E75';
  } else if (estado === 'sincronizando') {
    el.innerHTML = '🔄 Sincronizando...';
    el.style.color = '#F59E0B';
  } else if (estado === 'erro') {
    el.innerHTML = '🔴 Erro ao sincronizar';
    el.style.color = '#EF4444';
  } else {
    el.innerHTML = '🟡 Modo local (sem Firebase)';
    el.style.color = '#F59E0B';
  }
}

// ============================================================
// BANCO DE DADOS — híbrido (Firebase + localStorage como fallback)
// ============================================================

const DB_INICIAL = {
  alunos: [
    { id: 'ALU001', nome: 'Ana Beatriz Lima',    turma: '5º A', turno: 'Manhã',  restricoes: '',            qr_token: 'qr-alu001-permanente', qr_token_entrada: 'ent-alu001-permanente', ra: '' },
    { id: 'ALU002', nome: 'Carlos Mendes',        turma: '6º B', turno: 'Manhã',  restricoes: 'Sem glúten',  qr_token: 'qr-alu002-permanente', qr_token_entrada: 'ent-alu002-permanente', ra: '' },
    { id: 'ALU003', nome: 'Fernanda Costa',       turma: '5º A', turno: 'Tarde',  restricoes: '',            qr_token: 'qr-alu003-permanente', qr_token_entrada: 'ent-alu003-permanente', ra: '' },
    { id: 'ALU004', nome: 'João Pedro Oliveira',  turma: '7º C', turno: 'Manhã',  restricoes: 'Vegetariano', qr_token: 'qr-alu004-permanente', qr_token_entrada: 'ent-alu004-permanente', ra: '' },
    { id: 'ALU005', nome: 'Mariana Santos',       turma: '6º B', turno: 'Tarde',  restricoes: '',            qr_token: 'qr-alu005-permanente', qr_token_entrada: 'ent-alu005-permanente', ra: '' },
    { id: 'ALU006', nome: 'Rafael Alves',         turma: '7º C', turno: 'Manhã',  restricoes: '',            qr_token: 'qr-alu006-permanente', qr_token_entrada: 'ent-alu006-permanente', ra: '' },
    { id: 'ALU007', nome: 'Sophia Rocha',         turma: '5º B', turno: 'Manhã',  restricoes: 'Sem lactose', qr_token: 'qr-alu007-permanente', qr_token_entrada: 'ent-alu007-permanente', ra: '' },
    { id: 'ALU008', nome: 'Lucas Ferreira',       turma: '6º A', turno: 'Tarde',  restricoes: '',            qr_token: 'qr-alu008-permanente', qr_token_entrada: 'ent-alu008-permanente', ra: '' },
  ],
  registros: [],
  agendamentos: [],
  faltas: [],
  entradas: []
};

// db em memória (carregado do Firebase ou localStorage)
let db = JSON.parse(JSON.stringify(DB_INICIAL));
let filtroSalaAlunos = 'todas';
let filtroSalaAgend = 'todas';
let filtroSalaPres = 'todas';
let filtroSalaRel = 'todas';
let filtroSalaRelPres = 'todas';
let filtroSalaEnt = 'todas';
let turmasAlunosExpandidas = {};
let turmasQrEntradaExpandidas = {};
let turmasRelExpandidas = {};
let turmasRelPresOkExpandidas = {};
let turmasRelPresFaltaExpandidas = {};

// ------ localStorage (fallback) ------

function salvarLocal() {
  localStorage.setItem('cantina_db', JSON.stringify(db));
}

function carregarLocal() {
  const raw = localStorage.getItem('cantina_db');
  return raw ? JSON.parse(raw) : null;
}

// ------ Firebase ------

// Salva TODO o db no Firestore dividido em coleções
async function salvarFirebase() {
  if (!firebaseOk) return;
  mostrarStatusSync('sincronizando');
  try {
    const batch = firestoreDB.batch();

    // alunos — um doc por aluno
    const alunosRef = firestoreDB.collection('alunos');
    db.alunos.forEach(al => {
      batch.set(alunosRef.doc(al.id), al);
    });

    // registros — um doc por registro
    const regRef = firestoreDB.collection('registros');
    db.registros.forEach(r => {
      batch.set(regRef.doc(r.id), r);
    });

    // agendamentos — um doc por agendamento
    const agRef = firestoreDB.collection('agendamentos');
    db.agendamentos.forEach(a => {
      batch.set(agRef.doc(a.id), a);
    });

    // faltas — um doc por falta
    const faltasRef = firestoreDB.collection('faltas');
    db.faltas.forEach(f => {
      batch.set(faltasRef.doc(f.id), f);
    });

    // entradas — um doc por entrada
    const entradasRef = firestoreDB.collection('entradas');
    db.entradas.forEach(e => {
      batch.set(entradasRef.doc(e.id), e);
    });

    await batch.commit();
    salvarLocal(); // cópia local também
    mostrarStatusSync('conectado');
  } catch (e) {
    console.error('Erro ao salvar Firebase:', e);
    salvarLocal();
    mostrarStatusSync('erro');
  }
}

// Carrega TODO o db do Firestore
async function carregarFirebase() {
  if (!firebaseOk) return false;
  // Timeout de 8s para não travar o app caso o Firebase não responda
  const TIMEOUT_MS = 8000;
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout: Firebase demorou para responder')), TIMEOUT_MS)
  );
  try {
    return await Promise.race([_carregarFirebaseReal(), timeoutPromise]);
  } catch (e) {
    console.warn('⚠️ Firebase timeout/erro — entrando em modo local:', e.message);
    mostrarStatusSync('local');
    firebaseOk = false;
    return false;
  }
}

async function _carregarFirebaseReal() {
  if (!firebaseOk) return false;
  mostrarStatusSync('sincronizando');
  try {
    const loadCollection = async (name) => {
      try {
        return await firestoreDB.collection(name).get();
      } catch (e) {
        console.warn(`Coleção '${name}' não encontrada ou vazia:`, e.message);
        return { docs: [] };
      }
    };

    const [alunosSnap, regSnap, agSnap, faltasSnap, entradasSnap] = await Promise.all([
      loadCollection('alunos'),
      loadCollection('registros'),
      loadCollection('agendamentos'),
      loadCollection('faltas'),
      loadCollection('entradas'),
    ]);

    const alunos       = alunosSnap?.docs ? alunosSnap.docs.map(d => d.data()) : [];
    const registros    = regSnap?.docs ? regSnap.docs.map(d => d.data()) : [];
    const agendamentos = agSnap?.docs ? agSnap.docs.map(d => d.data()) : [];
    const faltas       = faltasSnap?.docs ? faltasSnap.docs.map(d => d.data()) : [];
    const entradas     = entradasSnap?.docs ? entradasSnap.docs.map(d => d.data()) : [];

    // Se Firestore está vazio E temos dados locais, migra dados locais pro Firebase
    if (alunos.length === 0) {
      const local = carregarLocal();
      if (local && local.alunos && local.alunos.length > 0) {
        console.log('Migrando dados locais para o Firebase...');
        db = garantirMigracoes(local);
        await salvarFirebase();
        mostrarStatusSync('conectado');
        return true;
      }
      // Nenhum dado em lugar nenhum — usa DB_INICIAL e salva no Firebase
      db = JSON.parse(JSON.stringify(DB_INICIAL));
      db = garantirMigracoes(db);
      await salvarFirebase();
    } else {
      db = {
        alunos,
        registros,
        agendamentos,
        faltas,
        entradas,
      };
      db = garantirMigracoes(db);
      salvarLocal();
    }

    mostrarStatusSync('conectado');
    return true;
  } catch (e) {
    console.error('Erro ao carregar Firebase:', e);
    mostrarStatusSync('erro');
    return false;
  }
}

// Operações individuais rápidas (evita reescrever tudo)
async function salvarAlunoDB(aluno) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('alunos').doc(aluno.id).set(aluno);
  } catch(e) { console.error('salvarAluno:', e); mostrarStatusSync('erro'); }
}

async function deletarAlunoDB(id) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('alunos').doc(id).delete();
  } catch(e) { console.error('deletarAluno:', e); mostrarStatusSync('erro'); }
}

async function salvarRegistroDB(reg) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('registros').doc(reg.id).set(reg);
  } catch(e) { console.error('salvarRegistro:', e); mostrarStatusSync('erro'); }
}

async function salvarAgendDB(ag) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('agendamentos').doc(ag.id).set(ag);
  } catch(e) { console.error('salvarAgend:', e); mostrarStatusSync('erro'); }
}

async function deletarAgendDB(id) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('agendamentos').doc(id).delete();
  } catch(e) { console.error('deletarAgend:', e); mostrarStatusSync('erro'); }
}

async function salvarFaltaDB(falta) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('faltas').doc(falta.id).set(falta);
  } catch(e) { console.error('salvarFalta:', e); mostrarStatusSync('erro'); }
}

async function deletarFaltaDB(id) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('faltas').doc(id).delete();
  } catch(e) { console.error('deletarFalta:', e); mostrarStatusSync('erro'); }
}

async function salvarEntradaDB(entrada) {
  salvarLocal();
  if (!firebaseOk) return;
  try {
    await firestoreDB.collection('entradas').doc(entrada.id).set(entrada);
  } catch(e) { console.error('salvarEntrada:', e); mostrarStatusSync('erro'); }
}

// Verifica se um aluno passou pela portaria em um determinado dia
function alunoPasouNaPortaria(aluno_id, data) {
  if (!db.entradas) db.entradas = [];
  return db.entradas.some(e => e.aluno_id === aluno_id && e.data === data);
}

// Mantém salvarDB() para compatibilidade — salva local + firebase em batch
function salvarDB() {
  salvarLocal();
  salvarFirebase(); // async, não bloqueia
}

// ============================================================
// MIGRAÇÃO DE DADOS (garantir campos obrigatórios)
// ============================================================

function garantirMigracoes(dados) {
  if (!dados.alunos)       dados.alunos = [];
  if (!dados.registros)    dados.registros = [];
  if (!dados.agendamentos) dados.agendamentos = [];
  if (!dados.faltas)       dados.faltas = [];
  if (!dados.entradas)     dados.entradas = [];

  dados.alunos.forEach(al => {
    if (!al.qr_token)          al.qr_token = 'qr-' + al.id + '-' + Math.random().toString(36).slice(2);
    if (!al.qr_token_entrada)  al.qr_token_entrada = 'ent-' + al.id + '-' + Math.random().toString(36).slice(2);
    if (al.ra === undefined)   al.ra = '';
  });
  return dados;
}

// ============================================================
// MENU RESPONSIVO
// ============================================================

function toggleMenu() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburguer');
  links.classList.toggle('aberto');
  btn.classList.toggle('aberto');
}

function fecharMenu() {
  const links = document.getElementById('nav-links');
  const btn   = document.getElementById('nav-hamburguer');
  if (links) links.classList.remove('aberto');
  if (btn)   btn.classList.remove('aberto');
}

document.addEventListener('click', e => {
  const nav = document.querySelector('nav');
  if (nav && !nav.contains(e.target)) fecharMenu();
});

// ============================================================
// LOGIN
// ============================================================

function fazerLogin() {
  const usuarioInput = document.getElementById('login-usuario');
  const senhaInput   = document.getElementById('login-senha');
  const erro         = document.getElementById('login-erro');

  const usuario = usuarioInput.value.trim().toLowerCase();
  const senha   = senhaInput.value.trim();

  if (!usuario || !senha) {
    erro.textContent = 'Digite usuário e senha para entrar.';
    erro.style.display = 'block';
    if (!usuario) usuarioInput.focus(); else senhaInput.focus();
    return;
  }

  const user = USUARIOS.find(u => u.usuario.toLowerCase() === usuario && u.senha === senha);

  if (!user) {
    erro.textContent = 'Usuário ou senha incorretos.';
    erro.style.display = 'block';
    senhaInput.value = '';
    senhaInput.focus();
    return;
  }

  erro.style.display = 'none';
  sessionStorage.setItem('cantina_logado', JSON.stringify(user));
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  inicializarApp();
}

function sair() {
  if (!confirm('Deseja sair do sistema?')) return;
  sessionStorage.removeItem('cantina_logado');
  document.getElementById('app').style.display = 'none';
  document.getElementById('tela-login').style.display = 'flex';
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-senha').value = '';
  pararCamera();
  pararCameraEntrada();
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

window.addEventListener('DOMContentLoaded', async () => {
  // Iniciar Firebase
  iniciarFirebase();

  // Mostrar tela de carregamento
  mostrarCarregando(true);

  // Tentar carregar do Firebase; fallback para localStorage
  const carregouFirebase = await carregarFirebase();
  if (!carregouFirebase) {
    const local = carregarLocal();
    if (local) {
      db = garantirMigracoes(local);
    } else {
      db = garantirMigracoes(JSON.parse(JSON.stringify(DB_INICIAL)));
      salvarLocal();
    }
  }

  mostrarCarregando(false);

  const logado = sessionStorage.getItem('cantina_logado');
  if (logado) {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    inicializarApp();
  }
});

function mostrarCarregando(sim) {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.style.display = sim ? 'flex' : 'none';
}

function inicializarApp() {
  document.getElementById('dash-filtro').value = hoje();
  document.getElementById('leit-data').value   = hoje();
  document.getElementById('ag-filtro').value   = hoje();
  document.getElementById('pres-filtro').value = hoje();
  document.getElementById('ent-data').value    = hoje();
  const _hoje2  = new Date();
  const _7dias2 = new Date(); _7dias2.setDate(_hoje2.getDate() - 6);
  document.getElementById('rel-inicio').value  = _7dias2.toISOString().split('T')[0];
  document.getElementById('rel-fim').value     = _hoje2.toISOString().split('T')[0];
  renderDash();
  setTimeout(() => gerarQREscola(), 300);

  // Escuta em tempo real do Firebase para sincronizar entre dispositivos
  if (firebaseOk) iniciarEscutaTempoReal();
}

// ============================================================
// ESCUTA EM TEMPO REAL — atualiza a tela se outro dispositivo mudar algo
// ============================================================

let escutas = [];

function iniciarEscutaTempoReal() {
  // Para escutas anteriores
  escutas.forEach(u => u());
  escutas = [];

  const onErr = e => console.warn('Escuta Firebase erro:', e);

  escutas.push(
    firestoreDB.collection('alunos').onSnapshot(snap => {
      db.alunos = snap.docs.map(d => d.data());
      salvarLocal();
      renderAlunosSilencioso();
    }, onErr)
  );

  escutas.push(
    firestoreDB.collection('registros').onSnapshot(snap => {
      db.registros = snap.docs.map(d => d.data());
      salvarLocal();
      renderDashSilencioso();
    }, onErr)
  );

  escutas.push(
    firestoreDB.collection('agendamentos').onSnapshot(snap => {
      db.agendamentos = snap.docs.map(d => d.data());
      salvarLocal();
    }, onErr)
  );

  escutas.push(
    firestoreDB.collection('faltas').onSnapshot(snap => {
      db.faltas = snap.docs.map(d => d.data());
      salvarLocal();
    }, onErr)
  );

  escutas.push(
    firestoreDB.collection('entradas').onSnapshot(snap => {
      db.entradas = snap.docs.map(d => d.data());
      salvarLocal();
    }, onErr)
  );
}

// Renders silenciosos (sem focar inputs, chamados pela escuta)
function renderAlunosSilencioso() {
  if (document.getElementById('tela-alunos').classList.contains('ativa')) renderAlunos();
}
function renderDashSilencioso() {
  if (document.getElementById('tela-dashboard').classList.contains('ativa')) renderDash();
}

// ============================================================
// HELPERS
// ============================================================

function iniciais(nome) {
  return nome.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

function hoje() {
  return new Date().toISOString().split('T')[0];
}

function uuid() {
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escapeHtml(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function jsArgString(texto) {
  // Retorna uma string segura para usar em onclick="fn('...')"
  // (evita quebrar aspas no HTML e no JS)
  return "'" + String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + "'";
}

function alerta(idEl, tipo, msg) {
  const el = document.getElementById(idEl);
  el.className = 'alerta alerta-' + (tipo === 'ok' ? 'ok' : 'err');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function gerarQRCanvas(canvasEl, texto, tamanho = 200) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    canvasEl.width = tamanho;
    canvasEl.height = tamanho;
    canvasEl.getContext('2d').drawImage(img, 0, 0, tamanho, tamanho);
  };
  img.onerror = () => {
    canvasEl.width = tamanho;
    canvasEl.height = tamanho;
    const ctx = canvasEl.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, tamanho, tamanho);
    ctx.fillStyle = '#1D9E75';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR:', tamanho / 2, tamanho / 2 - 10);
    ctx.font = '10px monospace';
    ctx.fillStyle = '#333';
    ctx.fillText(texto.slice(0, 24), tamanho / 2, tamanho / 2 + 10);
  };
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${tamanho}x${tamanho}&data=${encodeURIComponent(texto)}`;
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('aberto');
}

// ============================================================
// NAVEGAÇÃO
// ============================================================

function ir(btn) {
  fecharMenu();
  const tela = btn.dataset.tela;
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('ativo'));
  document.getElementById('tela-' + tela).classList.add('ativa');
  btn.classList.add('ativo');
  if (tela === 'dashboard')    renderDash();
  if (tela === 'agendamentos') renderAgend();
  if (tela === 'presencas')    renderPresencas();
  if (tela === 'relatorios')   renderRelatorio();
  if (tela === 'rel-presenca') { document.getElementById('rel-pres-data').value = hoje(); renderRelatorioPresenca(); }
  if (tela === 'entrada')      { pararCameraEntrada(); document.getElementById('ent-data').value = hoje(); setTimeout(() => { gerarQREscola(); }, 200); }
  if (tela === 'alunos')       renderAlunos();
  if (tela !== 'leitor')       pararCamera();
  if (tela !== 'entrada')      pararCameraEntrada();
}

function irPara(tela) {
  const btn = document.querySelector('[data-tela="' + tela + '"]');
  if (btn) ir(btn);
}

// ============================================================
// DASHBOARD
// ============================================================

function renderDash() {
  const data = document.getElementById('dash-filtro').value;

  // Migração rápida: agendamentos antigos sem campo validado_manual
  if (db.agendamentos) {
    db.agendamentos.forEach(a => {
      if (a.validado_manual === undefined) a.validado_manual = false;
    });
  }

  // Marcar faltas automaticamente para quem NÃO passou na portaria e NÃO tem agendamento validado manualmente
  if (!db.faltas) db.faltas = [];
  const faltasHoje = db.faltas.filter(f => f.data === data);
  const faltouIds = new Set(faltasHoje.map(f => f.aluno_id));

  const agsDia = (db.agendamentos || []).filter(a => a.data === data);

  db.alunos.forEach(al => {
    const passou = alunoPasouNaPortaria(al.id, data);
    const temValidadoManual = agsDia.some(a => a.aluno_id === al.id && a.validado_manual);
    if (!passou && !temValidadoManual && !faltouIds.has(al.id)) {
      const falta = { id: uuid(), aluno_id: al.id, data };
      db.faltas.push(falta);
      // persiste async (não precisa bloquear render)
      salvarFaltaDB(falta);
      faltouIds.add(al.id);
    }
  });

  // Verificações de segurança para elementos obrigatórios


  const dashData = document.getElementById('dash-data');
  const dAgend = document.getElementById('d-agend');
  const dServ = document.getElementById('d-serv');
  const dPend = document.getElementById('d-pend');
  const dBlock = document.getElementById('d-block');
  const dPct = document.getElementById('d-pct');
  const dBarra = document.getElementById('d-barra');
  const dProgTxt = document.getElementById('d-prog-txt');
  const dBarrasRef = document.getElementById('d-barras-ref');
  const dTurmas = document.getElementById('d-turmas');
  const dRegistros = document.getElementById('d-registros');
  
  if (!dashData || !dAgend || !dServ || !dPend || !dBlock || !dBarra || !dProgTxt || !dBarrasRef || !dTurmas || !dRegistros) {
    console.warn('⚠️ Alguns elementos do dashboard não foram encontrados. Dashboard pode não estar visível.');
    return;
  }

  dashData.textContent = 'Exibindo: ' + data.split('-').reverse().join('/');

  const refsOrdem = ['Lanche manhã', 'Almoço', 'Lanche tarde'];

  const refsDia = (db.agendamentos || []).filter(a => a.data === data);
  const idsElegiveis = new Set();


  db.alunos.forEach(al => {
    const passou = alunoPasouNaPortaria(al.id, data);
    const temValidadoManual = refsDia.some(a => a.aluno_id === al.id && a.validado_manual);
    if (passou || temValidadoManual) idsElegiveis.add(al.id);
  });

  const regsDia  = db.registros.filter(r => r.data === data && idsElegiveis.has(r.aluno_id));

  const servidos  = regsDia.filter(r => r.acao === 'liberado');
  const bloqueados = regsDia.filter(r => r.acao === 'bloqueado');

  const totalElegiveis = idsElegiveis.size * 3;
  dAgend.textContent  = totalElegiveis;
  dServ.textContent   = servidos.length;
  dPend.textContent   = totalElegiveis - servidos.length;
  dBlock.textContent  = bloqueados.length;


  const porRef = {};
  refsOrdem.forEach(r => { porRef[r] = { serv: 0, block: 0 }; });
  regsDia.forEach(r => {
    if (!porRef[r.refeicao]) porRef[r.refeicao] = { serv: 0, block: 0 };
    if (r.acao === 'liberado')  porRef[r.refeicao].serv++;
    if (r.acao === 'bloqueado') porRef[r.refeicao].block++;
  });

  // Atualizar progresso geral
  const total = totalElegiveis || 0;
  const pct = total ? Math.round(servidos.length / total * 100) : 0;
  dPct.textContent      = pct + '%';
  dBarra.style.width    = pct + '%';
  dProgTxt.textContent = servidos.length + ' de ' + total + ' refeições servidas';


  // 3 barras de progresso por refeição
  const icones = { 'Lanche manhã': '☀️', 'Almoço': '🍛', 'Lanche tarde': '🌤️' };
  const cores  = { 'Lanche manhã': '#F59E0B', 'Almoço': '#1D9E75', 'Lanche tarde': '#6366F1' };
  const totalAlunos = idsElegiveis.size || 1;
  dBarrasRef.innerHTML = refsOrdem.map(ref => {
    const serv   = porRef[ref] ? porRef[ref].serv : 0;
    const pctRef = Math.round(serv / totalAlunos * 100);
    const faltam = totalAlunos - serv;

    // Se for lanche tarde, ajustar texto conforme pedido
    const acao   = ref === 'Almoço' ? 'almoçaram' : (ref === 'Lanche tarde' ? 'lancharam' : 'lancharam');

    return `
      <div style="padding:14px 0;border-bottom:1px solid var(--borda);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;">
          <span style="font-size:14px;font-weight:700;color:var(--texto);">${icones[ref]} ${ref}</span>
          <span style="font-size:15px;font-weight:800;color:${cores[ref]};">${pctRef}%</span>
        </div>
        <div style="background:var(--borda);border-radius:99px;height:12px;overflow:hidden;margin-bottom:5px;">
          <div style="height:100%;width:${pctRef}%;background:${cores[ref]};border-radius:99px;transition:width .6s ease;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="font-size:11px;color:var(--texto3);">${serv} já ${acao}</span>
          <span style="font-size:11px;color:var(--texto3);">${faltam} ainda não ${acao}</span>
        </div>
      </div>
    `;
  }).join('') + `<div style="padding-top:10px;font-size:11px;color:var(--texto3);text-align:center;">${servidos.length} de ${totalElegiveis || 0} refeições servidas no total</div>`;

  // Pedido: mostrar quantos alunos ainda faltam comer o lanche tarde
  // (mantendo coerência com a regra do painel: só conta elegíveis)
  const servTarde = porRef['Lanche tarde'] ? porRef['Lanche tarde'].serv : 0;
  const faltamTarde = totalAlunos - servTarde;
  // Mostrar mesmo quando for 0, para garantir que a área amarela apareça sempre no Painel
  dBarrasRef.innerHTML += `<div style="margin-top:8px;font-size:11px;color:var(--texto3);text-align:center;">${faltamTarde} aluno(s) ainda não comeram o 🌤️ Lanche tarde</div>`;



  dTurmas.innerHTML = refsOrdem.map(ref => `

    <tr>
      <td><strong>${ref}</strong></td>
      <td>${idsElegiveis.size}</td>
      <td class="verde">${porRef[ref] ? porRef[ref].serv : 0}</td>
      <td>${porRef[ref] ? idsElegiveis.size - porRef[ref].serv : idsElegiveis.size}</td>
    </tr>
  `).join('');


  const regs = [...regsDia].reverse().slice(0, 15);
  verificarAlertas();

  dRegistros.innerHTML = regs.length
    ? regs.map(r => {
        const al  = db.alunos.find(x => x.id === r.aluno_id);
        const cor = r.acao === 'liberado' ? 'verde' : 'vermelho';
        const ic  = r.acao === 'liberado' ? '✓' : '✕';
        const badge = r.acao === 'liberado' ? 'badge-ok' : 'badge-block';
        return `
          <div class="hist-item">
            <div class="hist-icone ${cor}">${ic}</div>
            <div style="flex:1">
              <div class="hist-nome">${al ? al.nome : '?'}</div>
              <div class="hist-sub">${r.refeicao} · ${r.hora || ''}</div>
            </div>
            <span class="badge ${badge}">${r.acao}</span>
          </div>
        `;
      }).join('')
    : '<p class="vazio">Sem leituras nesta data.</p>';
}


// ============================================================
// ALERTA — alunos que ainda não comeram em cada refeição
// ============================================================

function verificarAlertas() {
  const data      = document.getElementById('dash-filtro').value || hoje();
  const horaAtual = new Date().getHours();
  const alertas   = [];

  const horarios = {
    'Lanche manhã': { inicio: 7,  fim: 10 },
    'Almoço':       { inicio: 11, fim: 14 },
    'Lanche tarde': { inicio: 14, fim: 17 },
  };

  const refsOrdem = ['Lanche manhã', 'Almoço', 'Lanche tarde'];

  refsOrdem.forEach(ref => {
    const h = horarios[ref];
    if (horaAtual < h.inicio) return; // ainda não começou

    const naoComeram = db.alunos.filter(al => {
      const faltou = (db.faltas || []).find(f => f.aluno_id === al.id && f.data === data);
      if (faltou) return false;
      const comeu = db.registros.find(r =>
        r.aluno_id === al.id && r.data === data && r.refeicao === ref && r.acao === 'liberado'
      );
      return !comeu;
    });

    if (naoComeram.length > 0) {
      alertas.push({ ref, alunos: naoComeram });
    }
  });

  const container = document.getElementById('d-alertas-refeicao');
  if (!container) return;

  if (!alertas.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = alertas.map(a => {
    const nomes = a.alunos.slice(0, 5).map(al => al.nome).join(', ') +
      (a.alunos.length > 5 ? ` e mais ${a.alunos.length - 5}` : '');
    return `
      <div class="alerta-refeicao">
        <div class="alerta-refeicao-icone">⚠️</div>
        <div>
          <div class="alerta-refeicao-titulo">${a.alunos.length} aluno(s) ainda não fizeram: ${a.ref}</div>
          <div class="alerta-refeicao-nomes">${nomes}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// CÂMERA / LEITOR QR
// ============================================================

let sessao = { lib: 0, blk: 0, hist: [] };
let qrScanner = null;
let cooldown  = false;

function iniciarCamera() {
  if (qrScanner) return;

  const refeicao = document.getElementById('leit-refeicao').value;
  if (!refeicao) {
    alert('Selecione a refeição antes de ligar a câmera!');
    return;
  }

  mostrarRes('idle', '📷', 'Iniciando câmera...', 'Aguarde permissão do navegador.');
  document.getElementById('btn-iniciar').disabled = true;
  document.getElementById('btn-parar').disabled   = false;

  qrScanner = new Html5Qrcode('qr-reader');

  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras.length) {
      mostrarRes('warn', '⚠️', 'Sem câmera', 'Nenhuma câmera encontrada neste dispositivo.');
      pararCamera();
      return;
    }

    const cam = cameras.find(c => /back|rear|traseira|environment/i.test(c.label))
              || cameras[cameras.length - 1];

    qrScanner.start(
      cam.id,
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
      onQRLido,
      () => {}
    )
    .then(() => mostrarRes('idle', '📷', 'Câmera ativa', 'Aponte para o QR Code do aluno'))
    .catch(() => { mostrarRes('warn', '⚠️', 'Erro', 'Não foi possível acessar a câmera.'); pararCamera(); });

  }).catch(() => {
    mostrarRes('warn', '⚠️', 'Permissão negada', 'Permita o acesso à câmera no navegador.');
    pararCamera();
  });
}

function pararCamera() {
  if (qrScanner) {
    qrScanner.stop().catch(() => {});
    qrScanner.clear();
    qrScanner = null;
  }
  document.getElementById('btn-iniciar').disabled = false;
  document.getElementById('btn-parar').disabled   = true;
  cooldown = false;
  mostrarRes('idle', '📷', 'Câmera desligada', 'Clique em "Ligar câmera" para começar');
}

async function onQRLido(token) {
  if (cooldown) return;
  cooldown = true;
  setTimeout(() => { cooldown = false; }, 2500);

  const resp     = document.getElementById('leit-resp').value.trim() || 'Responsável';
  const refeicao = document.getElementById('leit-refeicao').value;
  const data     = document.getElementById('leit-data').value || hoje();
  const hora     = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const al = db.alunos.find(a => a.qr_token === token);
  if (!al) {
    mostrarRes('warn', '❓', 'QR inválido', 'Código não encontrado no sistema.');
    return;
  }

  const jaUsou = db.registros.find(r =>
    r.aluno_id === al.id &&
    r.data     === data  &&
    r.refeicao === refeicao &&
    r.acao     === 'liberado'
  );

  // Regra nova: se o aluno está marcado como falta no dia, bloquear passagem
  if (!db.faltas) db.faltas = [];
  const isFaltaNoDia = db.faltas.some(f => f.aluno_id === al.id && f.data === data);

  const novoReg = {
    id: uuid(), aluno_id: al.id, data, refeicao,
    acao: (jaUsou || isFaltaNoDia) ? 'bloqueado' : 'liberado',
    hora,
    responsavel: resp
  };


  db.registros.push(novoReg);
  await salvarRegistroDB(novoReg);

  if (novoReg.acao === 'bloqueado') {
    sessao.blk++;
    sessao.hist.unshift({ acao: 'bloqueado', nome: al.nome, refeicao, hora });

    if (isFaltaNoDia && !jaUsou) {
      mostrarRes('block', '⛔', al.nome,
        'PROIBIDO: aluno marcado como FALTA no dia · ' + refeicao + ' · ' + al.turma);
    } else {
      const horaOriginal = jaUsou && jaUsou.hora ? jaUsou.hora : '';
      mostrarRes('block', '🚫', al.nome,
        'JÁ RECEBEU · ' + refeicao + ' · ' + al.turma + (horaOriginal ? ' · Passou às ' + horaOriginal : ''));
    }
  } else {
    sessao.lib++;
    sessao.hist.unshift({ acao: 'liberado', nome: al.nome, refeicao, hora });
    mostrarRes('ok', '✅', al.nome,
      al.turma + ' · ' + refeicao + ' · ' + hora +
      (al.restricoes ? ' · ⚠️ ' + al.restricoes : ''));
  }


  document.getElementById('sess-lib').textContent = sessao.lib;
  document.getElementById('sess-blk').textContent = sessao.blk;
  document.getElementById('sess-tot').textContent = sessao.lib + sessao.blk;

  document.getElementById('leit-hist').innerHTML = sessao.hist.slice(0, 12).map(h => {
    const cor   = h.acao === 'liberado' ? 'verde' : 'vermelho';
    const ic    = h.acao === 'liberado' ? '✓' : '✕';
    const badge = h.acao === 'liberado' ? 'badge-ok' : 'badge-block';
    return `
      <div class="hist-item">
        <div class="hist-icone ${cor}">${ic}</div>
        <div style="flex:1">
          <div class="hist-nome">${h.nome}</div>
          <div class="hist-sub">${h.refeicao} · ${h.hora}</div>
        </div>
        <span class="badge ${badge}">${h.acao}</span>
      </div>
    `;
  }).join('');
}

function mostrarRes(tipo, icone, nome, sub) {
  const el = document.getElementById('leit-resultado');
  const classes = { ok: 'res-ok', block: 'res-block', warn: 'res-warn', idle: 'res-idle' };
  el.className = 'resultado ' + (classes[tipo] || 'res-idle');
  el.innerHTML = `
    <div class="res-icon">${icone}</div>
    <div class="res-nome">${nome}</div>
    <div class="res-sub">${sub}</div>
  `;

  // Alerta de restrição alimentar
  if (tipo === 'ok') {
    const al = db.alunos.find(a => a.nome === nome);
    if (al && al.restricoes) {
      el.innerHTML += `
        <div style="
          margin-top: 12px;
          background: var(--amarelo-claro);
          border: 2px solid var(--amarelo);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 14px;
          font-weight: 700;
          color: var(--amarelo);
        ">
          ⚠️ ATENÇÃO — RESTRIÇÃO ALIMENTAR<br>
          <span style="font-weight:400;font-size:13px;">${al.restricoes}</span>
        </div>`;
    }
  }
}

// ============================================================
// ALUNOS
// ============================================================

function ordenarAlunosPorTurmaENome(lista) {
  return [...lista].sort((a, b) =>
    a.turma.localeCompare(b.turma, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })
  );
}

function obterTurmasAlunos() {
  return [...new Set((db.alunos || []).map(a => (a.turma || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }));
}

function garantirFiltroSalaValido(valorAtual) {
  const turmas = obterTurmasAlunos();
  return valorAtual !== 'todas' && !turmas.includes(valorAtual) ? 'todas' : valorAtual;
}

function renderFiltrosSala(containerId, turmaAtiva, setterName, listaBase, obterTurmaItem) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  const turmas = obterTurmasAlunos();
  const total = listaBase.length;

  wrap.innerHTML = [
    `<button class="aba-sala ${turmaAtiva === 'todas' ? 'ativa' : ''}" onclick="${setterName}(${jsArgString('todas')})">Todas as salas <span>${total}</span></button>`,
    ...turmas.map(turma => {
      const qtd = listaBase.filter(item => obterTurmaItem(item) === turma).length;
      return `<button class="aba-sala ${turmaAtiva === turma ? 'ativa' : ''}" onclick="${setterName}(${jsArgString(turma)})">${escapeHtml(turma)} <span>${qtd}</span></button>`;
    })
  ].join('');
}

function agruparPorTurma(lista, obterTurmaItem) {
  return lista.reduce((acc, item) => {
    const turma = obterTurmaItem(item) || 'Sem turma';
    (acc[turma] ||= []).push(item);
    return acc;
  }, {});
}

function renderLinhasAgrupadasPorSala(lista, filtroAtivo, obterTurmaItem, montarLinha, colspan, rotuloSingular = 'registro') {
  if (filtroAtivo !== 'todas') return lista.map(montarLinha).join('');

  const grupos = agruparPorTurma(lista, obterTurmaItem);
  return Object.entries(grupos).map(([turma, itens]) => `
    <tr class="linha-grupo-sala">
      <td colspan="${colspan}">
        <div class="grupo-sala-topo">
          <span class="grupo-sala-titulo">Sala ${escapeHtml(turma)}</span>
          <span class="grupo-sala-qtd">${itens.length} ${rotuloSingular}${itens.length > 1 ? 's' : ''}</span>
        </div>
      </td>
    </tr>
    ${itens.map(montarLinha).join('')}
  `).join('');
}

function renderLinhasAgrupadasPorSalaExpansivel(lista, filtroAtivo, obterTurmaItem, montarLinha, colspan, estado, toggleFnName, rotuloSingular = 'aluno', limitePrevia = 3) {
  if (filtroAtivo !== 'todas') return lista.map(montarLinha).join('');

  const grupos = agruparPorTurma(lista, obterTurmaItem);
  return Object.entries(grupos).map(([turma, itens]) => {
    const expandida = !!estado[turma];
    const visiveis = expandida ? itens : itens.slice(0, limitePrevia);
    const ocultos = Math.max(0, itens.length - visiveis.length);
    return `
      <tr class="linha-grupo-sala">
        <td colspan="${colspan}">
          <button class="grupo-sala-botao" onclick="${toggleFnName}(${jsArgString(turma)})">
            <div class="grupo-sala-topo">
              <div class="grupo-sala-esquerda">
                <span class="grupo-sala-seta ${expandida ? 'aberta' : ''}">▾</span>
                <span class="grupo-sala-titulo">Sala ${escapeHtml(turma)}</span>
              </div>
              <span class="grupo-sala-qtd">${itens.length} ${rotuloSingular}${itens.length > 1 ? 's' : ''}</span>
            </div>
            <div class="grupo-sala-subinfo">
              ${expandida ? 'Clique para recolher a turma.' : `Mostrando ${visiveis.length} de ${itens.length} ${rotuloSingular}${itens.length > 1 ? 's' : ''}.`}
            </div>
          </button>
        </td>
      </tr>
      ${visiveis.map(montarLinha).join('')}
      ${ocultos ? `
        <tr class="linha-previa-sala">
          <td colspan="${colspan}">
            <button class="grupo-sala-link" onclick="${toggleFnName}(${jsArgString(turma)})">
              Ver mais ${ocultos} ${rotuloSingular}${ocultos > 1 ? 's' : ''} desta turma
            </button>
          </td>
        </tr>
      ` : ''}
    `;
  }).join('');
}


function renderCardsAgrupadosPorSala(lista, filtroAtivo, obterTurmaItem, montarCard) {
  if (filtroAtivo !== 'todas') return lista.map(montarCard).join('');

  const grupos = agruparPorTurma(lista, obterTurmaItem);
  return Object.entries(grupos).map(([turma, itens]) => `
    <div class="lista-sala-bloco">
      <div class="grupo-sala-topo lista-sala-topo">
        <span class="grupo-sala-titulo">Sala ${escapeHtml(turma)}</span>
        <span class="grupo-sala-qtd">${itens.length} aluno${itens.length > 1 ? 's' : ''}</span>
      </div>
      ${itens.map(montarCard).join('')}
    </div>
  `).join('');
}

function setFiltroSalaAlunos(turma) {
  filtroSalaAlunos = turma || 'todas';
  renderAlunos();
}

function toggleTurmaAlunos(turma) {
  turmasAlunosExpandidas[turma] = !turmasAlunosExpandidas[turma];
  renderAlunos();
}

function setFiltroSalaAgend(turma) { filtroSalaAgend = turma || 'todas'; renderAgend(); }
function setFiltroSalaPres(turma) { filtroSalaPres = turma || 'todas'; renderPresencas(); }
function setFiltroSalaRel(turma) { filtroSalaRel = turma || 'todas'; renderRelatorio(); }
function setFiltroSalaRelPres(turma) { filtroSalaRelPres = turma || 'todas'; renderRelatorioPresenca(); }
function setFiltroSalaEnt(turma) { filtroSalaEnt = turma || 'todas'; renderQRsEntrada(); }
function toggleTurmaQrEntrada(turma) {
  turmasQrEntradaExpandidas[turma] = !turmasQrEntradaExpandidas[turma];
  renderQRsEntrada();
}

function toggleTurmaRel(turma) {
  turmasRelExpandidas[turma] = !turmasRelExpandidas[turma];
  renderRelatorio();
}
function toggleTurmaRelPresOk(turma) {
  turmasRelPresOkExpandidas[turma] = !turmasRelPresOkExpandidas[turma];
  renderRelatorioPresenca();
}
function toggleTurmaRelPresFalta(turma) {
  turmasRelPresFaltaExpandidas[turma] = !turmasRelPresFaltaExpandidas[turma];
  renderRelatorioPresenca();
}


function montarLinhaAluno(a) {
  return `
    <tr>
      <td>
        <div class="aluno-info">
          <div class="avatar">${iniciais(a.nome)}</div>
          <div>
            <div class="aluno-nome">${escapeHtml(a.nome)}</div>
            <div class="aluno-id">ID: ${escapeHtml(a.id)}${a.ra ? ' · RA: ' + escapeHtml(a.ra) : ''}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(a.turma)}</td>
      <td><span class="badge badge-info">${escapeHtml(a.turno)}</span></td>
      <td style="font-size:12px;color:${a.restricoes ? 'var(--amarelo)' : 'var(--texto3)'};">
        ${a.restricoes ? escapeHtml(a.restricoes) : '—'}
      </td>
      <td>
        <div class="acoes-tabela">
          <button class="btn btn-verde btn-sm" onclick="verQRAluno(${jsArgString(a.id)}, 'cantina')">🍽️ QR Cantina</button>
          <button class="btn btn-roxo btn-sm"  onclick="verQRAluno(${jsArgString(a.id)}, 'entrada')">🏫 QR Entrada</button>
          <button class="btn btn-out btn-sm" onclick="editarAluno(${jsArgString(a.id)})">Editar</button>
          <button class="btn btn-red btn-sm" onclick="removerAluno(${jsArgString(a.id)}, ${jsArgString(a.nome)})">Remover</button>
        </div>
      </td>
    </tr>
  `;
}

function renderAlunos() {
  const busca = (document.getElementById('al-busca').value || '').toLowerCase();
  const tbody = document.getElementById('al-corpo');
  filtroSalaAlunos = garantirFiltroSalaValido(filtroSalaAlunos);
  renderFiltrosSala('al-filtros-sala', filtroSalaAlunos, 'setFiltroSalaAlunos', db.alunos, aluno => aluno.turma);

  const lista = ordenarAlunosPorTurmaENome(
    db.alunos.filter(a => {
      const nome = (a.nome || '').toLowerCase();
      const turma = (a.turma || '').toLowerCase();
      const bateBusca = nome.includes(busca) || turma.includes(busca);
      const bateSala = filtroSalaAlunos === 'todas' || a.turma === filtroSalaAlunos;
      return bateBusca && bateSala;
    })
  );

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="vazio">${filtroSalaAlunos === 'todas' ? 'Nenhum aluno encontrado.' : 'Nenhum aluno encontrado nesta sala.'}</td></tr>`;
    return;
  }

  if (filtroSalaAlunos !== 'todas') {
    tbody.innerHTML = lista.map(montarLinhaAluno).join('');
    return;
  }

  const grupos = agruparPorTurma(lista, aluno => aluno.turma);
  const LIMITE_PREVIA = 3;

  tbody.innerHTML = Object.entries(grupos).map(([turma, alunos]) => {
    const expandida = !!turmasAlunosExpandidas[turma];
    const alunosVisiveis = expandida ? alunos : alunos.slice(0, LIMITE_PREVIA);
    const ocultos = Math.max(0, alunos.length - alunosVisiveis.length);

    return `
      <tr class="linha-grupo-sala">
        <td colspan="5">
          <button class="grupo-sala-botao" onclick="toggleTurmaAlunos(${jsArgString(turma)})">
            <div class="grupo-sala-topo">
              <div class="grupo-sala-esquerda">
                <span class="grupo-sala-seta ${expandida ? 'aberta' : ''}">▾</span>
                <span class="grupo-sala-titulo">Sala ${escapeHtml(turma)}</span>
              </div>
              <span class="grupo-sala-qtd">${alunos.length} aluno${alunos.length > 1 ? 's' : ''}</span>
            </div>
            <div class="grupo-sala-subinfo">
              ${expandida ? 'Clique para recolher a turma.' : `Mostrando ${alunosVisiveis.length} de ${alunos.length} aluno${alunos.length > 1 ? 's' : ''}.`}
            </div>
          </button>
        </td>
      </tr>
      ${alunosVisiveis.map(montarLinhaAluno).join('')}
      ${ocultos ? `
        <tr class="linha-previa-sala">
          <td colspan="5">
            <button class="grupo-sala-link" onclick="toggleTurmaAlunos(${jsArgString(turma)})">
              Ver mais ${ocultos} aluno${ocultos > 1 ? 's' : ''} desta turma
            </button>
          </td>
        </tr>
      ` : ''}
    `;
  }).join('');
}

function verQRAluno(id, tipo) {
  const al = db.alunos.find(a => a.id === id);
  if (!al) return;

  const ehEntrada = tipo === 'entrada';
  const token = ehEntrada ? al.qr_token_entrada : al.qr_token;
  const label = ehEntrada
    ? '🏫 QR de ENTRADA — Portaria · Agenda refeições automaticamente'
    : '🍽️ QR de CANTINA — Lanche manhã, Almoço e Lanche tarde';

  document.getElementById('qr-titulo').textContent    = al.nome;
  document.getElementById('qr-info').textContent      = al.turma + ' · ' + al.turno;
  document.getElementById('qr-validade-txt').textContent = '🟢 ' + label + ' · Permanente · Todos os dias';
  gerarQRCanvas(document.getElementById('qr-canvas'), token, 200);
  document.getElementById('modal-qr').classList.add('aberto');
}

function abrirModalAluno() {
  document.getElementById('al-nome').value  = '';
  document.getElementById('al-turma').value = '';
  document.getElementById('al-rest').value  = '';
  document.getElementById('al-ra').value    = '';
  document.getElementById('modal-aluno').classList.add('aberto');
  setTimeout(() => document.getElementById('al-nome').focus(), 100);
}

async function salvarAluno() {
  const nome  = document.getElementById('al-nome').value.trim();
  const turma = document.getElementById('al-turma').value.trim();
  const turno = document.getElementById('al-turno').value;
  const rest  = document.getElementById('al-rest').value.trim();
  const ra    = document.getElementById('al-ra').value.trim();

  if (!nome || !turma) {
    alerta('al-alerta', 'err', 'Nome e turma são obrigatórios.');
    return;
  }

  const novoId = 'ALU' + Date.now();
  const novoAluno = { id: novoId, nome, turma, turno, restricoes: rest, qr_token: uuid(), qr_token_entrada: uuid(), ra };
  db.alunos.push(novoAluno);
  await salvarAlunoDB(novoAluno);
  fecharModal('modal-aluno');
  alerta('al-alerta', 'ok', '"' + nome + '" cadastrado!');
  renderAlunos();
  setTimeout(() => verQRAluno(novoAluno.id, 'cantina'), 300);
}

async function removerAluno(id, nome) {
  if (!confirm('Remover "' + nome + '"? Esta ação não pode ser desfeita.')) return;
  db.alunos = db.alunos.filter(a => a.id !== id);
  await deletarAlunoDB(id);
  alerta('al-alerta', 'ok', '"' + nome + '" removido.');
  renderAlunos();
}

// ============================================================
// EDITAR ALUNO
// ============================================================

function editarAluno(id) {
  const al = db.alunos.find(a => a.id === id);
  if (!al) return;
  document.getElementById('edit-al-id').value    = al.id;
  document.getElementById('edit-al-nome').value  = al.nome;
  document.getElementById('edit-al-ra').value    = al.ra || '';
  document.getElementById('edit-al-turma').value = al.turma;
  document.getElementById('edit-al-turno').value = al.turno;
  document.getElementById('edit-al-rest').value  = al.restricoes || '';
  document.getElementById('modal-editar-aluno').classList.add('aberto');
}

async function salvarEdicaoAluno() {
  const id    = document.getElementById('edit-al-id').value;
  const nome  = document.getElementById('edit-al-nome').value.trim();
  const ra    = document.getElementById('edit-al-ra').value.trim();
  const turma = document.getElementById('edit-al-turma').value.trim();
  const turno = document.getElementById('edit-al-turno').value;
  const rest  = document.getElementById('edit-al-rest').value.trim();

  if (!nome || !turma) {
    alert('Nome e turma são obrigatórios.');
    return;
  }

  const al = db.alunos.find(a => a.id === id);
  if (!al) return;

  al.nome       = nome;
  al.ra         = ra;
  al.turma      = turma;
  al.turno      = turno;
  al.restricoes = rest;
  if (!al.qr_token_entrada) al.qr_token_entrada = uuid();

  await salvarAlunoDB(al);
  fecharModal('modal-editar-aluno');
  alerta('al-alerta', 'ok', '"' + nome + '" atualizado com sucesso!');
  renderAlunos();
}

// ============================================================
// IMPRIMIR QR
// ============================================================

function imprimirQR() {
  const canvas   = document.getElementById('qr-canvas');
  const titulo   = document.getElementById('qr-titulo').textContent;
  const info     = document.getElementById('qr-info').textContent;
  const validade = document.getElementById('qr-validade-txt').textContent;
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
    <head>
      <title>QR Code — ${titulo}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        img  { width: 220px; height: 220px; margin: 16px 0; display:block; margin: 12px auto; }
        h2   { margin-bottom: 4px; font-size: 20px; }
        .sub { color: #555; font-size: 13px; margin-bottom: 4px; }
        .tag { font-size: 12px; font-weight: bold; margin-top: 8px; padding: 6px 12px; border-radius: 6px; display:inline-block; }
        .tag-cantina { color: #085041; background: #E1F5EE; }
        .tag-entrada { color: #1a3a6b; background: #E6F1FB; }
      </style>
    </head>
    <body>
      <h2>${titulo}</h2>
      <p class="sub">${info}</p>
      <img src="${canvas.toDataURL()}">
      <p class="tag ${validade.includes('CANTINA') ? 'tag-cantina' : 'tag-entrada'}">${validade}</p>
    </body>
    </html>
  `);
  win.print();
}

// ============================================================
// AGENDAMENTOS
// ============================================================

function renderAgend() {
  const data = document.getElementById('ag-filtro').value;
  const ref  = document.getElementById('ag-ref-filtro').value;
  filtroSalaAgend = garantirFiltroSalaValido(filtroSalaAgend);

  if (!db.agendamentos) db.agendamentos = [];

  let listaDia = db.agendamentos.filter(a => a.data === data);

  // Regra do painel: mostrar apenas se passou pela portaria OU se foi validado manualmente
  listaDia = listaDia.filter(a => {
    if (a.validado_manual) return true;
    return alunoPasouNaPortaria(a.aluno_id, a.data);
  });

  listaDia = listaDia.filter(a => {
    const al = db.alunos.find(x => x.id === a.aluno_id);
    return al && (filtroSalaAgend === 'todas' || al.turma === filtroSalaAgend);
  });

  renderFiltrosSala('ag-filtros-sala', filtroSalaAgend, 'setFiltroSalaAgend', db.alunos, aluno => aluno.turma);

  let lista = ref ? listaDia.filter(a => a.refeicao === ref) : listaDia;

  document.getElementById('ag-contador').textContent = lista.length + ' agendamento(s)';

  const refs = ['Lanche manhã', 'Almoço', 'Lanche tarde'];
  document.getElementById('ag-resumo').innerHTML = refs.map(r => {
    const qtd = listaDia.filter(a => a.refeicao === r).length;
    return `<div class="stat">
      <div class="stat-val">${qtd}</div>
      <div class="stat-label">${r}</div>
    </div>`;
  }).join('');

  const tbody = document.getElementById('ag-corpo');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum agendamento para este período.</td></tr>';
    return;
  }

  const montarLinhaAgendamento = a => {
    const al = db.alunos.find(x => x.id === a.aluno_id);
    if (!al) return '';
    const servido = db.registros.find(r =>
      r.aluno_id === al.id && r.data === data && r.refeicao === a.refeicao && r.acao === 'liberado'
    );
    const badge = servido
      ? '<span class="badge badge-ok">Servido</span>'
      : '<span class="badge badge-pend">Pendente</span>';
    return `
      <tr>
        <td>
          <div class="aluno-info">
            <div class="avatar">${iniciais(al.nome)}</div>
            <div>
              <div class="aluno-nome">${al.nome}</div>
              ${al.restricoes ? `<div class="aluno-rest">${al.restricoes}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${al.turma}</td>
        <td>${a.refeicao}</td>
        <td>${badge}</td>
        <td>
          <button class="btn btn-red btn-sm" onclick="removerAgend(${jsArgString(a.id)})">Remover</button>
        </td>
      </tr>
    `;
  };

  tbody.innerHTML = renderLinhasAgrupadasPorSala(lista, filtroSalaAgend, a => {
    const al = db.alunos.find(x => x.id === a.aluno_id);
    return al ? al.turma : '';
  }, montarLinhaAgendamento, 5, 'agendamento');
}

async function gerarLote() {
  const data = document.getElementById('ag-filtro').value;
  const ref  = document.getElementById('ag-ref-filtro').value || 'Almoço';
  if (!db.agendamentos) db.agendamentos = [];


  const novos = [];
  db.alunos.forEach(al => {
    // Validar se o aluno passou pela portaria
    if (!alunoPasouNaPortaria(al.id, data)) {
      return; // Pula alunos que não passaram pela portaria
    }

    const existe = db.agendamentos.find(a =>
      a.aluno_id === al.id && a.data === data && a.refeicao === ref
    );
    if (!existe) {
      const ag = { id: uuid(), aluno_id: al.id, data, refeicao: ref, validado_manual: false };
      db.agendamentos.push(ag);
      novos.push(ag);

    }
  });

  // Salvar em batch no Firebase
  if (firebaseOk && novos.length) {
    mostrarStatusSync('sincronizando');
    try {
      const batch = firestoreDB.batch();
      novos.forEach(ag => batch.set(firestoreDB.collection('agendamentos').doc(ag.id), ag));
      await batch.commit();
      mostrarStatusSync('conectado');
    } catch(e) { console.error(e); mostrarStatusSync('erro'); }
  }
  salvarLocal();

  alerta('ag-alerta', 'ok', novos.length + ' agendamentos criados para ' + ref + '!');
  renderAgend();
}

function abrirModalAgend() {
  if (!db.agendamentos) db.agendamentos = [];
  const sel = document.getElementById('ag-sel-aluno');
  sel.innerHTML = '<option value="">Selecione...</option>';
  db.alunos.forEach(a => {
    sel.innerHTML += `<option value="${a.id}">${a.nome} — ${a.turma}</option>`;
  });
  document.getElementById('ag-data').value = document.getElementById('ag-filtro').value || hoje();
  document.getElementById('modal-agend').classList.add('aberto');
}

async function salvarAgend() {
  if (!db.agendamentos) db.agendamentos = [];
  const aluno_id = document.getElementById('ag-sel-aluno').value;
  const data     = document.getElementById('ag-data').value;
  const refeicao = document.getElementById('ag-ref').value;

  if (!aluno_id || !data) {
    alerta('ag-alerta', 'err', 'Selecione um aluno e uma data.');
    return;
  }

  // Validar se o aluno passou pela portaria
  if (!alunoPasouNaPortaria(aluno_id, data)) {
    const aluno = db.alunos.find(a => a.id === aluno_id);
    alerta('ag-alerta', 'err', '❌ ' + aluno.nome + ' ainda não passou pela portaria neste dia. Agendamento não permitido.');
    return;
  }

  const existe = db.agendamentos.find(a =>
    a.aluno_id === aluno_id && a.data === data && a.refeicao === refeicao
  );
  if (existe) {
    alerta('ag-alerta', 'err', 'Este aluno já tem agendamento para esta refeição neste dia.');
    return;
  }

  const ag = { id: uuid(), aluno_id, data, refeicao, validado_manual: true };
  db.agendamentos.push(ag);
  await salvarAgendDB(ag);

  fecharModal('modal-agend');
  alerta('ag-alerta', 'ok', 'Agendamento criado!');
  renderAgend();
}

async function removerAgend(id) {
  if (!confirm('Remover este agendamento?')) return;
  db.agendamentos = db.agendamentos.filter(a => a.id !== id);
  await deletarAgendDB(id);
  renderAgend();
}

// ============================================================
// PRESENÇAS
// ============================================================

function renderPresencas() {
  const data    = document.getElementById('pres-filtro').value || hoje();
  const ref     = document.getElementById('pres-ref-filtro').value;
  const busca   = (document.getElementById('pres-busca').value || '').toLowerCase();
  filtroSalaPres = garantirFiltroSalaValido(filtroSalaPres);

  if (!db.faltas) db.faltas = [];

  const faltasHoje = db.faltas.filter(f => f.data === data).map(f => f.aluno_id);
  const baseTurma = db.alunos.filter(a => filtroSalaPres === 'todas' || a.turma === filtroSalaPres);

  renderFiltrosSala('pres-filtros-sala', filtroSalaPres, 'setFiltroSalaPres', db.alunos, aluno => aluno.turma);

  let lista = baseTurma.filter(a =>
    (a.nome || '').toLowerCase().includes(busca) || (a.turma || '').toLowerCase().includes(busca)
  );

  lista = ordenarAlunosPorTurmaENome(lista);

  const totalAlunos  = baseTurma.length;
  const totalFaltas  = baseTurma.filter(a => faltasHoje.includes(a.id)).length;
  const presentes    = totalAlunos - totalFaltas;

  const naoComeram = baseTurma.filter(al => {
    const faltou  = faltasHoje.includes(al.id);
    const comeu   = db.registros.find(r =>
      r.aluno_id === al.id && r.data === data && r.refeicao === ref && r.acao === 'liberado'
    );
    return !faltou && !comeu;
  }).length;

  document.getElementById('pres-presentes').textContent  = presentes;
  document.getElementById('pres-faltaram').textContent   = totalFaltas;
  document.getElementById('pres-nao-comeram').textContent = naoComeram;

  const tbody = document.getElementById('pres-corpo');
  if (!lista.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum aluno encontrado para este filtro.</td></tr>';
    sincronizarAgendamentos(data, ref, faltasHoje);
    return;
  }

  const montarLinhaPresenca = al => {
    const faltou = faltasHoje.includes(al.id);
    const comeu  = db.registros.find(r =>
      r.aluno_id === al.id && r.data === data && r.refeicao === ref && r.acao === 'liberado'
    );

    let situacaoBadge, refBadge, botao;

    if (faltou) {
      situacaoBadge = '<span class="badge badge-block">Faltou</span>';
      refBadge      = '<span class="badge badge-pend">—</span>';
      botao         = `<button class="btn btn-verde btn-sm" onclick="marcarPresente('${al.id}')">Marcar presente</button>`;
    } else if (comeu) {
      situacaoBadge = '<span class="badge badge-ok">Presente</span>';
      refBadge      = `<span class="badge badge-ok">Comeu às ${comeu.hora}</span>`;
      botao         = `<button class="btn btn-red btn-sm" onclick="marcarFalta('${al.id}')">Marcar falta</button>`;
    } else {
      situacaoBadge = '<span class="badge badge-ok">Presente</span>';
      refBadge      = '<span class="badge badge-warn">Não comeu ainda</span>';
      botao         = `<button class="btn btn-red btn-sm" onclick="marcarFalta('${al.id}')">Marcar falta</button>`;
    }

    return `
      <tr>
        <td>
          <div class="aluno-info">
            <div class="avatar" style="${faltou ? 'background:var(--vermelho-claro);color:var(--vermelho)' : ''}">${iniciais(al.nome)}</div>
            <div>
              <div class="aluno-nome">${al.nome}</div>
              <div class="aluno-id">ID: ${al.id}</div>
            </div>
          </div>
        </td>
        <td>${al.turma}</td>
        <td><span class="badge badge-info">${al.turno}</span></td>
        <td>${situacaoBadge}</td>
        <td>${refBadge}</td>
        <td>${botao}</td>
      </tr>
    `;
  };

  tbody.innerHTML = renderLinhasAgrupadasPorSala(lista, filtroSalaPres, al => al.turma, montarLinhaPresenca, 6, 'aluno');

  sincronizarAgendamentos(data, ref, faltasHoje);
}

async function sincronizarAgendamentos(data, ref, faltasHoje) {
  if (!db.agendamentos) db.agendamentos = [];

  const adicionados = [];
  const removidos   = [];

  db.alunos.forEach(al => {
    const faltou = faltasHoje.includes(al.id);
    const agIdx  = db.agendamentos.findIndex(a =>
      a.aluno_id === al.id && a.data === data && a.refeicao === ref
    );

    if (faltou && agIdx !== -1) {
      removidos.push(db.agendamentos[agIdx].id);
      db.agendamentos.splice(agIdx, 1);
    } else if (!faltou && agIdx === -1) {
      const ag = { id: uuid(), aluno_id: al.id, data, refeicao: ref };
      db.agendamentos.push(ag);
      adicionados.push(ag);
    }
  });

  if (adicionados.length || removidos.length) {
    salvarLocal();
    if (firebaseOk) {
      try {
        const batch = firestoreDB.batch();
        adicionados.forEach(ag => batch.set(firestoreDB.collection('agendamentos').doc(ag.id), ag));
        removidos.forEach(id => batch.delete(firestoreDB.collection('agendamentos').doc(id)));
        await batch.commit();
      } catch(e) { console.error('sincronizarAgendamentos:', e); }
    }
  }
}

async function marcarFalta(aluno_id) {
  const data = document.getElementById('pres-filtro').value || hoje();
  if (!db.faltas) db.faltas = [];

  const jaExiste = db.faltas.find(f => f.aluno_id === aluno_id && f.data === data);
  if (!jaExiste) {
    const falta = { id: uuid(), aluno_id, data };
    db.faltas.push(falta);
    await salvarFaltaDB(falta);
  }
  renderPresencas();
}

async function marcarPresente(aluno_id) {
  const data = document.getElementById('pres-filtro').value || hoje();
  if (!db.faltas) db.faltas = [];

  const falta = db.faltas.find(f => f.aluno_id === aluno_id && f.data === data);
  db.faltas = db.faltas.filter(f => !(f.aluno_id === aluno_id && f.data === data));
  if (falta) await deletarFaltaDB(falta.id);
  renderPresencas();
}

async function marcarTodosPresentes() {
  const data = document.getElementById('pres-filtro').value || hoje();
  if (!db.faltas) db.faltas = [];

  const faltasHoje = db.faltas.filter(f => f.data === data);
  db.faltas = db.faltas.filter(f => f.data !== data);

  if (faltasHoje.length && firebaseOk) {
    try {
      const batch = firestoreDB.batch();
      faltasHoje.forEach(f => batch.delete(firestoreDB.collection('faltas').doc(f.id)));
      await batch.commit();
    } catch(e) { console.error(e); }
  }
  salvarLocal();
  renderPresencas();
}

// ============================================================
// LEITOR DE ENTRADA — portaria
// ============================================================

let entScanner  = null;
let entCooldown = false;
let entSessao   = { ok: 0, err: 0, hist: [] };

function iniciarCameraEntrada() {
  if (entScanner) return;

  mostrarResEntrada('idle', '🏫', 'Iniciando câmera...', 'Aguarde permissão do navegador.');
  document.getElementById('ent-btn-iniciar').disabled = true;
  document.getElementById('ent-btn-parar').disabled   = false;

  entScanner = new Html5Qrcode('ent-qr-reader');

  Html5Qrcode.getCameras().then(cameras => {
    if (!cameras.length) {
      mostrarResEntrada('warn', '⚠️', 'Sem câmera', 'Nenhuma câmera encontrada.');
      pararCameraEntrada();
      return;
    }

    const cam = cameras.find(c => /back|rear|traseira|environment/i.test(c.label))
              || cameras[cameras.length - 1];

    entScanner.start(
      cam.id,
      { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
      onCarteirinhaLida,
      () => {}
    )
    .then(() => mostrarResEntrada('idle', '📷', 'Câmera ativa', 'Aponte para a carteirinha do aluno'))
    .catch(() => { mostrarResEntrada('warn', '⚠️', 'Erro', 'Não foi possível acessar a câmera.'); pararCameraEntrada(); });

  }).catch(() => {
    mostrarResEntrada('warn', '⚠️', 'Permissão negada', 'Permita o acesso à câmera no navegador.');
    pararCameraEntrada();
  });
}

function pararCameraEntrada() {
  if (entScanner) {
    entScanner.stop().catch(() => {});
    entScanner.clear();
    entScanner = null;
  }
  const btnI = document.getElementById('ent-btn-iniciar');
  const btnP = document.getElementById('ent-btn-parar');
  if (btnI) btnI.disabled = false;
  if (btnP) btnP.disabled = true;
  entCooldown = false;
  mostrarResEntrada('idle', '🏫', 'Câmera desligada', 'Clique em "Ligar câmera" para começar');
}

async function onCarteirinhaLida(ra) {
  // QR único da escola
  if (ra === QR_TOKEN_ESCOLA) {
    const raDigitado = prompt('Digite o RA do aluno:');
    if (!raDigitado) return;
    ra = raDigitado.trim();
  }

  if (entCooldown) return;
  entCooldown = true;
  setTimeout(() => { entCooldown = false; }, 2500);

  const data = document.getElementById('ent-data').value || hoje();
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const al = db.alunos.find(a => a.qr_token_entrada === ra.trim() || (a.ra && a.ra === ra.trim()));

  if (!al) {
    entSessao.err++;
    entSessao.hist.unshift({ ok: false, nome: 'Não reconhecido', sub: ra, hora });
    mostrarResEntrada('warn', '❓', 'QR não reconhecido',
      'Código "' + ra + '" não está cadastrado no sistema.');
    atualizarSessaoEntrada();
    return;
  }

  // Remover falta se existir
  if (!db.faltas) db.faltas = [];
  const faltaExistente = db.faltas.find(f => f.aluno_id === al.id && f.data === data);
  if (faltaExistente) {
    db.faltas = db.faltas.filter(f => !(f.aluno_id === al.id && f.data === data));
    await deletarFaltaDB(faltaExistente.id);
  }

  // Registrar entrada na portaria — pedido: permitir passar o QR na entrada apenas uma vez por dia
  if (!db.entradas) db.entradas = [];
  const entradaExistente = db.entradas.find(e => e.aluno_id === al.id && e.data === data);
  if (entradaExistente) {
    entSessao.err++;
    entSessao.hist.unshift({ ok: false, nome: al.nome, sub: 'Passagem já registrada', hora });
    mostrarResEntrada('warn', '⛔', al.nome,
      'QR já utilizado na portaria neste dia. Passagem proibida.');
    atualizarSessaoEntrada();
    return;
  }

  const entrada = { id: uuid(), aluno_id: al.id, data, hora };
  db.entradas.push(entrada);
  await salvarEntradaDB(entrada);


  // Agendar refeições
  if (!db.agendamentos) db.agendamentos = [];
  const refs = [];
  if (document.getElementById('ent-ref-manha').checked)  refs.push('Lanche manhã');
  if (document.getElementById('ent-ref-almoco').checked) refs.push('Almoço');
  if (document.getElementById('ent-ref-tarde').checked)  refs.push('Lanche tarde');

  const novosAg = [];
  refs.forEach(ref => {
    const existe = db.agendamentos.find(a =>
      a.aluno_id === al.id && a.data === data && a.refeicao === ref
    );
    if (!existe) {
      const ag = { id: uuid(), aluno_id: al.id, data, refeicao: ref };
      db.agendamentos.push(ag);
      novosAg.push(ag);
    }
  });

  if (novosAg.length && firebaseOk) {
    try {
      const batch = firestoreDB.batch();
      novosAg.forEach(ag => batch.set(firestoreDB.collection('agendamentos').doc(ag.id), ag));
      await batch.commit();
    } catch(e) { console.error(e); }
  }
  salvarLocal();

  entSessao.ok++;
  entSessao.hist.unshift({ ok: true, nome: al.nome, sub: al.turma + ' · ' + refs.join(', '), hora });

  mostrarResEntrada('ok', '✅', al.nome,
    al.turma + ' · ' + al.turno + ' · Entrada às ' + hora +
    (al.restricoes ? ' · ⚠️ ' + al.restricoes : '') +
    '\nRefeições agendadas: ' + refs.join(', '));

  atualizarSessaoEntrada();
}

function atualizarSessaoEntrada() {
  document.getElementById('ent-sess-ok').textContent  = entSessao.ok;
  document.getElementById('ent-sess-err').textContent = entSessao.err;

  document.getElementById('ent-hist').innerHTML = entSessao.hist.slice(0, 12).map(h => `
    <div class="hist-item">
      <div class="hist-icone ${h.ok ? 'verde' : 'vermelho'}">${h.ok ? '✓' : '✕'}</div>
      <div style="flex:1">
        <div class="hist-nome">${h.nome}</div>
        <div class="hist-sub">${h.sub} · ${h.hora}</div>
      </div>
      <span class="badge ${h.ok ? 'badge-ok' : 'badge-block'}">${h.ok ? 'entrou' : 'inválido'}</span>
    </div>
  `).join('');
}

function mostrarResEntrada(tipo, icone, nome, sub) {
  const el = document.getElementById('ent-resultado');
  if (!el) return;
  const classes = { ok: 'res-ok', block: 'res-block', warn: 'res-warn', idle: 'res-idle' };
  el.className = 'resultado ' + (classes[tipo] || 'res-idle');
  el.innerHTML = `
    <div class="res-icon">${icone}</div>
    <div class="res-nome">${nome}</div>
    <div class="res-sub">${sub}</div>
  `;
}

// ============================================================
// QR ÚNICO DA ESCOLA
// ============================================================

const QR_TOKEN_ESCOLA = 'ESCOLA-ENTRADA-QR-UNICO-PERMANENTE';

function gerarQREscola() {
  const canvas = document.getElementById('qr-escola-canvas');
  if (!canvas) return;
  gerarQRCanvas(canvas, QR_TOKEN_ESCOLA, 200);
}

function imprimirQREntrada() {
  const canvas = document.getElementById('qr-escola-canvas');
  if (!canvas) return;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>QR Entrada — Escola</title>
    <style>
      body { font-family: sans-serif; text-align:center; padding:40px; background:#0D1B2A; color:#fff; }
      .box { background:#fff; border-radius:20px; padding:40px; display:inline-block; }
      img  { width:260px; height:260px; display:block; margin:16px auto; }
      h2   { font-size:22px; margin-bottom:6px; color:#0D1B2A; }
      p    { color:#64748B; font-size:13px; }
      .tag { background:#00D68F; color:#fff; padding:8px 18px; border-radius:99px; font-size:12px; font-weight:700; margin-top:12px; display:inline-block; }
    </style></head>
    <body>
      <div class="box">
        <h2>🏫 QR Code de Entrada</h2>
        <p>Fixe este QR na portaria da escola</p>
        <img src="${canvas.toDataURL()}">
        <p>Todos os alunos usam este mesmo QR Code todos os dias</p>
        <div class="tag">✅ QR Permanente · Agendamento automático</div>
      </div>
    </body></html>
  `);
  win.print();
}

// ============================================================
// RELATÓRIOS
// ============================================================

function renderRelatorio() {
  const inicio = document.getElementById('rel-inicio').value;
  const fim    = document.getElementById('rel-fim').value;
  const tipo   = document.getElementById('rel-tipo').value;
  filtroSalaRel = garantirFiltroSalaValido(filtroSalaRel);

  if (!inicio || !fim) return;

  const datas = [];
  let cur = new Date(inicio + 'T00:00:00');
  const end = new Date(fim + 'T00:00:00');
  while (cur <= end) {
    datas.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const alunosFiltrados = db.alunos.filter(al => filtroSalaRel === 'todas' || al.turma === filtroSalaRel);
  const idsFiltrados = new Set(alunosFiltrados.map(al => al.id));
  const faltasNoPeriodo = (db.faltas || []).filter(f => f.data >= inicio && f.data <= fim && idsFiltrados.has(f.aluno_id));
  const refsNoPeriodo   = db.registros.filter(r => r.data >= inicio && r.data <= fim && r.acao === 'liberado' && idsFiltrados.has(r.aluno_id));

  renderFiltrosSala('rel-filtros-sala', filtroSalaRel, 'setFiltroSalaRel', db.alunos, aluno => aluno.turma);

  document.getElementById('rel-total-dias').textContent   = datas.length;
  document.getElementById('rel-total-faltas').textContent = faltasNoPeriodo.length;
  document.getElementById('rel-total-ref').textContent    = refsNoPeriodo.length;

  if (tipo === 'faltas') {
    renderRelatorioFaltas(datas, inicio, fim, alunosFiltrados);
  } else {
    renderRelatorioRefeicoes(datas, inicio, fim, alunosFiltrados);
  }
}

function renderRelatorioFaltas(datas, inicio, fim, alunosLista = db.alunos) {
  document.getElementById('rel-titulo-tabela').textContent = 'Faltas por aluno no período';
  document.getElementById('rel-thead').innerHTML = `
    <tr>
      <th>Aluno</th><th>Turma</th><th>Turno</th><th>Total de faltas</th><th>Dias faltados</th>
    </tr>`;

  const faltas = db.faltas || [];

  const rows = alunosLista.map(al => {
    const faltasAl = faltas.filter(f => f.aluno_id === al.id && f.data >= inicio && f.data <= fim);
    const diasFaltados = faltasAl.map(f => f.data.split('-').reverse().join('/')).join(', ') || '—';
    return { al, total: faltasAl.length, diasFaltados };
  }).sort((a, b) =>
    b.total - a.total ||
    a.al.turma.localeCompare(b.al.turma, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
    a.al.nome.localeCompare(b.al.nome, 'pt-BR', { sensitivity: 'base' })
  );

  if (!rows.length) {
    document.getElementById('rel-corpo').innerHTML = '<tr><td colspan="5" class="vazio">Nenhum aluno encontrado para este filtro.</td></tr>';
    return;
  }

  const montarLinhaRelFalta = ({ al, total, diasFaltados }) => {
    const cor = total === 0 ? 'verde' : total >= 3 ? 'vermelho' : 'amarelo';
    return `
      <tr>
        <td><div class="aluno-info"><div class="avatar">${iniciais(al.nome)}</div><div><div class="aluno-nome">${al.nome}</div></div></div></td>
        <td>${al.turma}</td>
        <td><span class="badge badge-info">${al.turno}</span></td>
        <td><strong class="${cor}">${total}</strong> falta(s)</td>
        <td style="font-size:11px;color:var(--texto2);max-width:200px;">${diasFaltados}</td>
      </tr>`;
  };

  document.getElementById('rel-corpo').innerHTML = renderLinhasAgrupadasPorSalaExpansivel(rows, filtroSalaRel, item => item.al.turma, montarLinhaRelFalta, 5, turmasRelExpandidas, 'toggleTurmaRel', 'aluno');
}

function renderRelatorioRefeicoes(datas, inicio, fim, alunosLista = db.alunos) {
  document.getElementById('rel-titulo-tabela').textContent = 'Refeições servidas por aluno no período';
  document.getElementById('rel-thead').innerHTML = `
    <tr>
      <th>Aluno</th><th>Turma</th><th>☀️ Lanche manhã</th><th>🍛 Almoço</th><th>🌤️ Lanche tarde</th><th>Total</th>
    </tr>`;

  const refs = ['Lanche manhã', 'Almoço', 'Lanche tarde'];

  const rows = alunosLista.map(al => {
    const contagem = {};
    refs.forEach(r => {
      contagem[r] = db.registros.filter(reg =>
        reg.aluno_id === al.id && reg.data >= inicio && reg.data <= fim &&
        reg.refeicao === r && reg.acao === 'liberado'
      ).length;
    });
    const total = refs.reduce((s, r) => s + contagem[r], 0);
    return { al, contagem, total };
  }).sort((a, b) =>
    b.total - a.total ||
    a.al.turma.localeCompare(b.al.turma, 'pt-BR', { numeric: true, sensitivity: 'base' }) ||
    a.al.nome.localeCompare(b.al.nome, 'pt-BR', { sensitivity: 'base' })
  );

  if (!rows.length) {
    document.getElementById('rel-corpo').innerHTML = '<tr><td colspan="6" class="vazio">Nenhum aluno encontrado para este filtro.</td></tr>';
    return;
  }

  const montarLinhaRelRefeicao = ({ al, contagem, total }) => `
    <tr>
      <td><div class="aluno-info"><div class="avatar">${iniciais(al.nome)}</div><div><div class="aluno-nome">${al.nome}</div></div></div></td>
      <td>${al.turma}</td>
      <td class="verde">${contagem['Lanche manhã']}</td>
      <td class="verde">${contagem['Almoço']}</td>
      <td class="verde">${contagem['Lanche tarde']}</td>
      <td><strong>${total}</strong></td>
    </tr>`;

  document.getElementById('rel-corpo').innerHTML = renderLinhasAgrupadasPorSalaExpansivel(rows, filtroSalaRel, item => item.al.turma, montarLinhaRelRefeicao, 6, turmasRelExpandidas, 'toggleTurmaRel', 'aluno');
}

// ============================================================
// RELATÓRIO DE PRESENÇA DO DIA
// ============================================================

function gerarRelatorioPresenca() {
  const data = document.getElementById('ent-data').value || hoje();
  document.getElementById('rel-pres-data').value = data;
  renderRelatorioPresenca();
  document.querySelectorAll('.tela').forEach(t => t.classList.remove('ativa'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('ativo'));
  document.getElementById('tela-rel-presenca').classList.add('ativa');
  const tabPresenca = document.querySelector('[data-tela="rel-presenca"]');
  if (tabPresenca) tabPresenca.classList.add('ativo');
}

function renderRelatorioPresenca() {
  const data = document.getElementById('rel-pres-data').value || hoje();
  const dataFormatada = data.split('-').reverse().join('/');
  filtroSalaRelPres = garantirFiltroSalaValido(filtroSalaRelPres);

  document.getElementById('rel-pres-subtitulo').textContent = 'Presença do dia ' + dataFormatada;

  if (!db.faltas) db.faltas = [];
  const faltasHoje = db.faltas.filter(f => f.data === data).map(f => f.aluno_id);

  const baseTurma = db.alunos.filter(al => filtroSalaRelPres === 'todas' || al.turma === filtroSalaRelPres);
  renderFiltrosSala('rel-pres-filtros-sala', filtroSalaRelPres, 'setFiltroSalaRelPres', db.alunos, aluno => aluno.turma);

  const presentes = ordenarAlunosPorTurmaENome(baseTurma.filter(al => !faltasHoje.includes(al.id)));
  const faltaram  = ordenarAlunosPorTurmaENome(baseTurma.filter(al =>  faltasHoje.includes(al.id)));

  document.getElementById('rel-pres-num-ok').textContent    = presentes.length;
  document.getElementById('rel-pres-num-falta').textContent = faltaram.length;

  const corpoOk = document.getElementById('rel-pres-corpo-ok');
  if (!presentes.length) {
    corpoOk.innerHTML = '<tr><td colspan="4" class="vazio">Nenhum aluno presente registrado.</td></tr>';
  } else {
    const montarLinhaPresOk = al => {
      const refs = ['Lanche manhã','Almoço','Lanche tarde'];
      const badges = refs.map(r => {
        const comeu = db.registros.find(reg =>
          reg.aluno_id === al.id && reg.data === data && reg.refeicao === r && reg.acao === 'liberado'
        );
        return comeu
          ? `<span class="badge badge-ok" style="margin:1px;">${r.split(' ')[0]}</span>`
          : `<span class="badge badge-pend" style="margin:1px;">${r.split(' ')[0]}</span>`;
      }).join('');

      const entradaReg = db.registros.find(r =>
        r.aluno_id === al.id && r.data === data && r.acao === 'liberado'
      );
      const horaEntrada = entradaReg ? entradaReg.hora : '—';

      return `
        <tr>
          <td><div class="aluno-info"><div class="avatar">${iniciais(al.nome)}</div><div><div class="aluno-nome">${al.nome}</div></div></div></td>
          <td>${al.turma}</td>
          <td style="font-size:12px;">${horaEntrada}</td>
          <td>${badges}</td>
        </tr>`;
    };

    corpoOk.innerHTML = renderLinhasAgrupadasPorSalaExpansivel(presentes, filtroSalaRelPres, al => al.turma, montarLinhaPresOk, 4, turmasRelPresOkExpandidas, 'toggleTurmaRelPresOk', 'aluno');
  }

  const corpoFalta = document.getElementById('rel-pres-corpo-falta');
  if (!faltaram.length) {
    corpoFalta.innerHTML = '<tr><td colspan="3" class="vazio">Nenhuma falta registrada! 🎉</td></tr>';
  } else {
    const montarLinhaPresFalta = al => `
      <tr>
        <td><div class="aluno-info"><div class="avatar" style="background:var(--vermelho-claro);color:var(--vermelho);">${iniciais(al.nome)}</div><div><div class="aluno-nome">${al.nome}</div></div></div></td>
        <td>${al.turma}</td>
        <td><span class="badge badge-info">${al.turno}</span></td>
      </tr>`;

    corpoFalta.innerHTML = renderLinhasAgrupadasPorSalaExpansivel(faltaram, filtroSalaRelPres, al => al.turma, montarLinhaPresFalta, 3, turmasRelPresFaltaExpandidas, 'toggleTurmaRelPresFalta', 'aluno');
  }
}

// ============================================================
// QR CODES INDIVIDUAIS DE ENTRADA — listagem na aba Entrada
// ============================================================

function obterListaQRsEntradaFiltrada() {
  const busca = (document.getElementById('ent-busca-aluno').value || '').toLowerCase();
  filtroSalaEnt = garantirFiltroSalaValido(filtroSalaEnt);

  return ordenarAlunosPorTurmaENome(
    db.alunos.filter(a => {
      const bateBusca = (a.nome || '').toLowerCase().includes(busca) || (a.turma || '').toLowerCase().includes(busca);
      const bateSala = filtroSalaEnt === 'todas' || a.turma === filtroSalaEnt;
      return bateBusca && bateSala;
    })
  );
}

function renderQRsEntrada() {
  const lista = obterListaQRsEntradaFiltrada();
  const container = document.getElementById('ent-lista-qrs');
  if (!container) return;
  renderFiltrosSala('ent-filtros-sala', filtroSalaEnt, 'setFiltroSalaEnt', db.alunos, aluno => aluno.turma);

  if (!lista.length) {
    container.innerHTML = '<p class="vazio">Nenhum aluno encontrado.</p>';
    return;
  }

  const montarCardQrEntrada = al => `
    <div class="lista-qr-item">
      <div class="avatar">${iniciais(al.nome)}</div>
      <div class="lista-qr-conteudo">
        <div class="lista-qr-nome">${al.nome}</div>
        <div class="lista-qr-sub">${al.turma} · ${al.turno}</div>
      </div>
      <div class="lista-qr-acoes">
        <button class="btn btn-roxo btn-sm" onclick="verQREntradaAluno(${jsArgString(al.id)})">🏫 Ver QR Entrada</button>
        <button class="btn btn-out btn-sm"  onclick="imprimirQREntradaAluno(${jsArgString(al.id)})">🖨️ Imprimir</button>
      </div>
    </div>
  `;

  let conteudoLista = '';

  if (filtroSalaEnt !== 'todas') {
    conteudoLista = lista.map(montarCardQrEntrada).join('');
  } else {
    const grupos = agruparPorTurma(lista, al => al.turma);
    const LIMITE_PREVIA_QR = 3;

    conteudoLista = Object.entries(grupos).map(([turma, alunos]) => {
      const expandida = !!turmasQrEntradaExpandidas[turma];
      const alunosVisiveis = expandida ? alunos : alunos.slice(0, LIMITE_PREVIA_QR);
      const ocultos = Math.max(0, alunos.length - alunosVisiveis.length);

      return `
        <div class="lista-sala-bloco">
          <button class="grupo-sala-botao lista-sala-botao" onclick="toggleTurmaQrEntrada(${jsArgString(turma)})">
            <div class="grupo-sala-topo lista-sala-topo">
              <div class="grupo-sala-esquerda">
                <span class="grupo-sala-seta ${expandida ? 'aberta' : ''}">▾</span>
                <span class="grupo-sala-titulo">Sala ${escapeHtml(turma)}</span>
              </div>
              <span class="grupo-sala-qtd">${alunos.length} aluno${alunos.length > 1 ? 's' : ''}</span>
            </div>
            <div class="grupo-sala-subinfo">
              ${expandida ? 'Clique para recolher os QR Codes desta turma.' : `Mostrando ${alunosVisiveis.length} de ${alunos.length} aluno${alunos.length > 1 ? 's' : ''}.`}
            </div>
          </button>
          ${alunosVisiveis.map(montarCardQrEntrada).join('')}
          ${ocultos ? `
            <div class="lista-qr-previa">
              <button class="grupo-sala-link" onclick="toggleTurmaQrEntrada(${jsArgString(turma)})">
                Ver mais ${ocultos} QR Code${ocultos > 1 ? 's' : ''} desta turma
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  container.innerHTML = conteudoLista + `
    <div class="lista-qr-rodape">
      <button class="btn btn-verde" onclick="imprimirTodosQREntrada()">🖨️ Imprimir QR de Entrada dos alunos exibidos</button>
    </div>
  `;
}

function verQREntradaAluno(id) {
  const al = db.alunos.find(a => a.id === id);
  if (!al) return;
  document.getElementById('qr-titulo').textContent    = al.nome;
  document.getElementById('qr-info').textContent      = al.turma + ' · ' + al.turno;
  document.getElementById('qr-validade-txt').textContent =
    '🏫 QR de ENTRADA · Permanente · Agenda refeições automaticamente todos os dias';
  gerarQRCanvas(document.getElementById('qr-canvas'), al.qr_token_entrada, 200);
  document.getElementById('modal-qr').classList.add('aberto');
}

function imprimirQREntradaAluno(id) {
  const al = db.alunos.find(a => a.id === id);
  if (!al) return;
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(al.qr_token_entrada)}`;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head><title>QR Entrada — ${al.nome}</title>
    <style>
      body { font-family:sans-serif;text-align:center;padding:40px;background:#080C10;color:#fff; }
      .box { background:#0F1519;border:2px solid rgba(0,255,178,.3);border-radius:20px;padding:36px;display:inline-block; }
      img  { width:220px;height:220px;display:block;margin:14px auto;background:#fff;border-radius:12px;padding:8px; }
      h2   { font-size:20px;font-weight:800;margin-bottom:4px;color:#fff; }
      .turma { font-size:13px;color:#8A9BB0;margin-bottom:4px; }
      .tag { background:rgba(0,255,178,.15);color:#00FFB2;border:1px solid rgba(0,255,178,.3);padding:7px 18px;border-radius:99px;font-size:12px;font-weight:700;margin-top:14px;display:inline-block; }
      .aviso { font-size:11px;color:#4A5568;margin-top:10px; }
    </style></head>
    <body>
      <div class="box">
        <h2>${al.nome}</h2>
        <div class="turma">${al.turma} · ${al.turno}</div>
        <img src="${url}" alt="QR Entrada">
        <div class="tag">🏫 QR de Entrada · Portaria</div>
        <div class="aviso">Use este QR todos os dias ao chegar na escola</div>
      </div>
    </body></html>
  `);
  win.print();
}

function imprimirTodosQREntrada() {
  const alunos = obterListaQRsEntradaFiltrada();
  if (!alunos.length) {
    alert('Nenhum aluno encontrado para imprimir com o filtro atual.');
    return;
  }

  const win = window.open('', '_blank');
  const cards = alunos.map(al => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(al.qr_token_entrada)}`;
    return `
      <div class="card-qr">
        <div class="nome">${al.nome}</div>
        <div class="turma">${al.turma} · ${al.turno}</div>
        <img src="${url}" alt="QR">
        <div class="tag">🏫 QR Entrada</div>
      </div>
    `;
  }).join('');
  win.document.write(`
    <html><head><title>QR Codes de Entrada — Todos os Alunos</title>
    <style>
      body { font-family:sans-serif;background:#fff;padding:20px; }
      h1   { text-align:center;font-size:18px;margin-bottom:20px;color:#0F172A; }
      .grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
      .card-qr { border:1.5px solid #E2E8F0;border-radius:14px;padding:16px;text-align:center;break-inside:avoid; }
      .nome  { font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px; }
      .turma { font-size:11px;color:#64748B;margin-bottom:8px; }
      img    { width:160px;height:160px;display:block;margin:0 auto 8px; }
      .tag   { font-size:10px;font-weight:700;color:#007A57;background:#E6FBF4;padding:3px 10px;border-radius:99px;display:inline-block; }
      @media print { body { padding:10px; } }
    </style></head>
    <body>
      <h1>🏫 QR Codes de Entrada — Alunos exibidos</h1>
      <div class="grid">${cards}</div>
    </body></html>
  `);
  win.print();
}

// ============================================================
// IMPRIMIR TODOS QR DE CANTINA — usado na aba Alunos
// ============================================================
function obterListaAlunosFiltradaAlunos() {
  const buscaEl = document.getElementById('al-busca');
  const busca = (buscaEl ? buscaEl.value : '').toLowerCase();
  filtroSalaAlunos = garantirFiltroSalaValido(filtroSalaAlunos);
  return ordenarAlunosPorTurmaENome(
    db.alunos.filter(a => {
      const nome = (a.nome || '').toLowerCase();
      const turma = (a.turma || '').toLowerCase();
      const bateBusca = nome.includes(busca) || turma.includes(busca);
      const bateSala = filtroSalaAlunos === 'todas' || a.turma === filtroSalaAlunos;
      return bateBusca && bateSala;
    })
  );
}

function imprimirTodosQRCantina() {
  const alunos = obterListaAlunosFiltradaAlunos();
  if (!alunos.length) {
    alert('Nenhum aluno encontrado para imprimir com o filtro atual.');
    return;
  }
  const win = window.open('', '_blank');
  const cards = alunos.map(al => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(al.qr_token)}`;
    return `
      <div class="card-qr">
        <div class="nome">${al.nome}</div>
        <div class="turma">${al.turma} · ${al.turno}</div>
        <img src="${url}" alt="QR">
        <div class="tag">🍽️ QR Cantina</div>
      </div>
    `;
  }).join('');
  win.document.write(`
    <html><head><title>QR Codes de Cantina — Todos os Alunos</title>
    <style>
      body { font-family:sans-serif;background:#fff;padding:20px; }
      h1   { text-align:center;font-size:18px;margin-bottom:20px;color:#0F172A; }
      .grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
      .card-qr { border:1.5px solid #E2E8F0;border-radius:14px;padding:16px;text-align:center;break-inside:avoid; }
      .nome  { font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px; }
      .turma { font-size:11px;color:#64748B;margin-bottom:8px; }
      img    { width:160px;height:160px;display:block;margin:0 auto 8px; }
      .tag   { font-size:10px;font-weight:700;color:#085041;background:#E1F5EE;padding:3px 10px;border-radius:99px;display:inline-block; }
      @media print { body { padding:10px; } }
    </style></head>
    <body>
      <h1>🍽️ QR Codes de Cantina — Alunos exibidos</h1>
      <div class="grid">${cards}</div>
    </body></html>
  `);
  win.print();
}

// Sobrescreve imprimirTodosQREntrada para usar o filtro da aba Alunos quando chamado de lá
const _imprimirTodosQREntradaOriginal = imprimirTodosQREntrada;
imprimirTodosQREntrada = function() {
  // Se a tela de alunos estiver ativa, usa o filtro/busca dela
  const telaAlunosAtiva = document.getElementById('tela-alunos') && document.getElementById('tela-alunos').classList.contains('ativa');
  const alunos = telaAlunosAtiva ? obterListaAlunosFiltradaAlunos() : (typeof obterListaQRsEntradaFiltrada === 'function' ? obterListaQRsEntradaFiltrada() : db.alunos);
  if (!alunos.length) {
    alert('Nenhum aluno encontrado para imprimir com o filtro atual.');
    return;
  }
  const win = window.open('', '_blank');
  const cards = alunos.map(al => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(al.qr_token_entrada)}`;
    return `
      <div class="card-qr">
        <div class="nome">${al.nome}</div>
        <div class="turma">${al.turma} · ${al.turno}</div>
        <img src="${url}" alt="QR">
        <div class="tag">🏫 QR Entrada</div>
      </div>
    `;
  }).join('');
  win.document.write(`
    <html><head><title>QR Codes de Entrada — Todos os Alunos</title>
    <style>
      body { font-family:sans-serif;background:#fff;padding:20px; }
      h1   { text-align:center;font-size:18px;margin-bottom:20px;color:#0F172A; }
      .grid { display:grid;grid-template-columns:repeat(3,1fr);gap:16px; }
      .card-qr { border:1.5px solid #E2E8F0;border-radius:14px;padding:16px;text-align:center;break-inside:avoid; }
      .nome  { font-size:13px;font-weight:800;color:#0F172A;margin-bottom:2px; }
      .turma { font-size:11px;color:#64748B;margin-bottom:8px; }
      img    { width:160px;height:160px;display:block;margin:0 auto 8px; }
      .tag   { font-size:10px;font-weight:700;color:#1a3a6b;background:#E6F1FB;padding:3px 10px;border-radius:99px;display:inline-block; }
      @media print { body { padding:10px; } }
    </style></head>
    <body>
      <h1>🏫 QR Codes de Entrada — Alunos exibidos</h1>
      <div class="grid">${cards}</div>
    </body></html>
  `);
  win.print();
};

// Campos de data são inicializados dentro de inicializarApp()


// ============================================================
// BACKUP — Exportar / Importar JSON
// ============================================================

function exportarBackupJSON() {
  try {
    const dados = {
      versao: 1,
      exportadoEm: new Date().toISOString(),
      escola: 'Cantina Escolar',
      db: db
    };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const data = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `backup-cantina-${data}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (typeof alerta === 'function') alerta('al-alerta', 'ok', '✅ Backup exportado!');
  } catch (e) {
    console.error('Erro ao exportar backup:', e);
    alert('Erro ao exportar backup: ' + e.message);
  }
}

function importarBackupJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const dados = JSON.parse(text);
      if (!dados.db || !Array.isArray(dados.db.alunos)) {
        alert('Arquivo inválido: não parece ser um backup desta aplicação.');
        return;
      }
      const totalAlunos = dados.db.alunos.length;
      const ok = confirm(
        `Importar backup?\n\n` +
        `📅 Exportado: ${dados.exportadoEm || 'desconhecido'}\n` +
        `👥 Alunos: ${totalAlunos}\n\n` +
        `⚠️ ATENÇÃO: Isto SUBSTITUIRÁ todos os dados atuais (alunos, registros, agendamentos, faltas e entradas). Esta ação não pode ser desfeita.\n\n` +
        `Deseja continuar?`
      );
      if (!ok) return;

      db = garantirMigracoes(dados.db);
      salvarLocal();
      if (firebaseOk) {
        try { await salvarFirebase(); } catch(e) { console.warn('Falha ao subir backup ao Firebase:', e); }
      }
      alert('✅ Backup importado com sucesso! A página será recarregada.');
      location.reload();
    } catch (e) {
      console.error('Erro ao importar backup:', e);
      alert('Erro ao importar backup: ' + e.message);
    }
  };
  input.click();
}
