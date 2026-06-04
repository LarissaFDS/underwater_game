#!/usr/bin/env node
'use strict';
/**
 * test-flow.js — Teste de integração do fluxo completo:
 *
 *   1. Health check dos serviços
 *   2. Dois jogadores fazem login no auth-service  →  recebem { token, nickname }
 *   3. Ambos validam seus tokens  →  GET /api/validate/:token
 *   4. Ambos conectam ao game-service enviando o token no handshake
 *   5. Verificam room:joined com nickname correto
 *   6. Aguardam game:start com a lista de nicknames
 *   7. Testa conexão com token inválido  →  deve ser rejeitada
 *
 * Uso (fora do Docker, com serviços rodando localmente):
 *   npm install && node test-flow.js
 *
 * Uso via Docker (perfil testing):
 *   docker compose --profile testing up test-runner --attach test-runner
 *
 * Variáveis de ambiente:
 *   AUTH_URL  — padrão http://localhost:3004
 *   GAME_URL  — padrão http://localhost:3001
 */

const { io } = require('socket.io-client');

const AUTH_URL   = process.env.AUTH_URL  || 'http://localhost:3004';
const GAME_URL   = process.env.GAME_URL  || 'http://localhost:3001';
const TIMEOUT_MS = 12_000;

// ─── Terminal colors ──────────────────────────────────────────────────────────

const C = {
  reset : '\x1b[0m',
  green : '\x1b[32m',
  red   : '\x1b[31m',
  yellow: '\x1b[33m',
  cyan  : '\x1b[36m',
  bold  : '\x1b[1m',
};

let passed = 0;
let failed = 0;

function pass(msg) {
  console.log(`  ${C.green}✓${C.reset} ${msg}`);
  passed++;
}

function fail(msg) {
  console.log(`  ${C.red}✗ ${msg}${C.reset}`);
  failed++;
}

function info(msg) {
  console.log(`\n${C.yellow}» ${msg}${C.reset}`);
}

function tag(label, msg) {
  console.log(`    ${C.cyan}[${label}]${C.reset} ${msg}`);
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function httpGet(url) {
  const res  = await fetch(url);
  const body = await res.json();
  return { status: res.status, body };
}

async function httpPost(url, data) {
  const res  = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify(data),
  });
  const body = await res.json();
  return { status: res.status, body };
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function loginAs(nickname) {
  const { status, body } = await httpPost(`${AUTH_URL}/api/login`, { nickname });
  if (status !== 200) {
    throw new Error(`Login de "${nickname}" falhou (${status}): ${JSON.stringify(body)}`);
  }
  return body; // { token, nickname }
}

async function validateToken(token) {
  const { status, body } = await httpGet(`${AUTH_URL}/api/validate/${token}`);
  return { valid: status === 200, ...body };
}

// ─── Socket.IO helper ─────────────────────────────────────────────────────────

/**
 * Conecta um jogador ao game-service e aguarda game:start.
 * Resolve com { socket, events, gameStartData } quando a partida iniciar.
 */
function connectPlayer({ token, nickname }) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Timeout (${TIMEOUT_MS}ms) aguardando game:start para "${nickname}"`));
    }, TIMEOUT_MS);

    const events = [];

    const socket = io(GAME_URL, {
      auth: {
        clientType:       'player',
        token,
        clientInstanceId: `test-${nickname}-${Date.now()}`,
      },
      transports: ['polling', 'websocket'],
      reconnection: false,
    });

    socket.on('connect', () => {
      tag(nickname, `conectado  id=${socket.id}`);
    });

    socket.on('room:joined', (data) => {
      tag(nickname, `room:joined  playerId=${data.playerId}  nickname=${data.nickname}`);
      events.push({ name: 'room:joined', data });
    });

    socket.on('game:start', (data) => {
      tag(nickname, `game:start  players=[${data.players.join(', ')}]`);
      tag(nickname, `            nicknames=${JSON.stringify(data.nicknames ?? {})}`);
      events.push({ name: 'game:start', data });
      clearTimeout(timer);
      resolve({ socket, events, gameStartData: data });
    });

    socket.on('room:full', () => {
      clearTimeout(timer);
      socket.disconnect();
      reject(new Error(`"${nickname}" recebeu room:full — sala já está cheia`));
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`"${nickname}" connect_error: ${err.message}`));
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log(`${C.bold}════════════════════════════════════════════${C.reset}`);
  console.log(`${C.bold}  Ocean Puzzle — Teste de integração        ${C.reset}`);
  console.log(`${C.bold}════════════════════════════════════════════${C.reset}`);
  console.log(`  auth-service : ${AUTH_URL}`);
  console.log(`  game-service : ${GAME_URL}`);

  // ── Etapa 1: Health ──────────────────────────────────────────────────────

  info('Etapa 1 — Health checks');

  try {
    const { status, body } = await httpGet(`${AUTH_URL}/health`);
    status === 200
      ? pass(`auth-service saudável: ${JSON.stringify(body)}`)
      : fail(`auth-service retornou ${status}`);
  } catch (e) {
    fail(`auth-service inacessível: ${e.message}`);
    console.log('\n  Certifique-se de que os serviços estão rodando.');
    process.exit(1);
  }

  try {
    const { status, body } = await httpGet(`${GAME_URL}/`);
    status === 200
      ? pass(`game-service saudável: ${JSON.stringify(body)}`)
      : fail(`game-service retornou ${status}`);
  } catch (e) {
    fail(`game-service inacessível: ${e.message}`);
    process.exit(1);
  }

  // ── Etapa 2: Login ───────────────────────────────────────────────────────

  info('Etapa 2 — Login no auth-service');

  let p1, p2;

  try {
    p1 = await loginAs('Capitao_Nemo');
    pass(`Jogador 1  nickname=${p1.nickname}  token=${p1.token.slice(0, 8)}...`);
  } catch (e) {
    fail(e.message);
    process.exit(1);
  }

  try {
    p2 = await loginAs('SubNautica');
    pass(`Jogador 2  nickname=${p2.nickname}  token=${p2.token.slice(0, 8)}...`);
  } catch (e) {
    fail(e.message);
    process.exit(1);
  }

  // ── Etapa 3: Validação de tokens ─────────────────────────────────────────

  info('Etapa 3 — Validação dos tokens gerados');

  for (const p of [p1, p2]) {
    const result = await validateToken(p.token);
    result.valid
      ? pass(`Token de "${p.nickname}" é válido  (nickname retornado: ${result.nickname})`)
      : fail(`Token de "${p.nickname}" foi rejeitado pela validação`);
  }

  // ── Etapa 4: Conexão Socket.IO ───────────────────────────────────────────

  info('Etapa 4 — Conexão simultânea ao game-service');
  console.log('    (aguardando game:start — pode levar alguns segundos...)');

  let r1, r2;

  try {
    [r1, r2] = await Promise.all([
      connectPlayer(p1),
      connectPlayer(p2),
    ]);
  } catch (e) {
    fail(e.message);
    r1?.socket?.disconnect();
    r2?.socket?.disconnect();
    process.exit(1);
  }

  // ── Etapa 5: Verificações ────────────────────────────────────────────────

  info('Etapa 5 — Verificações dos eventos recebidos');

  const hasEvent = (result, name) => result.events.some((e) => e.name === name);

  hasEvent(r1, 'room:joined')
    ? pass(`"${p1.nickname}" recebeu room:joined`)
    : fail(`"${p1.nickname}" NÃO recebeu room:joined`);

  hasEvent(r2, 'room:joined')
    ? pass(`"${p2.nickname}" recebeu room:joined`)
    : fail(`"${p2.nickname}" NÃO recebeu room:joined`);

  hasEvent(r1, 'game:start')
    ? pass(`"${p1.nickname}" recebeu game:start`)
    : fail(`"${p1.nickname}" NÃO recebeu game:start`);

  hasEvent(r2, 'game:start')
    ? pass(`"${p2.nickname}" recebeu game:start`)
    : fail(`"${p2.nickname}" NÃO recebeu game:start`);

  // Nicknames em game:start
  const nicknames = r1.gameStartData?.nicknames ?? {};
  const n1Present = Object.values(nicknames).includes(p1.nickname);
  const n2Present = Object.values(nicknames).includes(p2.nickname);

  n1Present
    ? pass(`Nickname "${p1.nickname}" presente em game:start.nicknames`)
    : fail(`Nickname "${p1.nickname}" ausente em game:start.nicknames — recebido: ${JSON.stringify(nicknames)}`);

  n2Present
    ? pass(`Nickname "${p2.nickname}" presente em game:start.nicknames`)
    : fail(`Nickname "${p2.nickname}" ausente em game:start.nicknames — recebido: ${JSON.stringify(nicknames)}`);

  // Seed presente
  r1.gameStartData?.seed !== undefined
    ? pass(`game:start contém seed: ${r1.gameStartData.seed}`)
    : fail('game:start sem campo seed');

  // ── Etapa 6: Token inválido ───────────────────────────────────────────────

  info('Etapa 6 — Conexão com token inválido (deve ser rejeitada)');

  await new Promise((resolve) => {
    const sock = io(GAME_URL, {
      auth: { clientType: 'player', token: 'token-invalido-para-teste' },
      transports: ['polling'],
      reconnection: false,
    });

    const timer = setTimeout(() => {
      fail('Timeout — rejeição de token inválido não chegou a tempo');
      sock.disconnect();
      resolve();
    }, 5000);

    sock.on('connect_error', (err) => {
      clearTimeout(timer);
      pass(`Conexão rejeitada corretamente: "${err.message}"`);
      sock.disconnect();
      resolve();
    });

    sock.on('connect', () => {
      clearTimeout(timer);
      fail('Token inválido foi aceito — isso não deveria acontecer!');
      sock.disconnect();
      resolve();
    });
  });

  // ── Etapa 7: Conexão sem token ────────────────────────────────────────────

  info('Etapa 7 — Conexão sem token (deve ser rejeitada)');

  await new Promise((resolve) => {
    const sock = io(GAME_URL, {
      auth: { clientType: 'player' /* sem token */ },
      transports: ['polling'],
      reconnection: false,
    });

    const timer = setTimeout(() => {
      fail('Timeout — rejeição de conexão sem token não chegou');
      sock.disconnect();
      resolve();
    }, 5000);

    sock.on('connect_error', (err) => {
      clearTimeout(timer);
      pass(`Conexão sem token rejeitada: "${err.message}"`);
      sock.disconnect();
      resolve();
    });

    sock.on('connect', () => {
      clearTimeout(timer);
      fail('Conexão sem token foi aceita — isso não deveria acontecer!');
      sock.disconnect();
      resolve();
    });
  });

  // ── Cleanup + Resumo ──────────────────────────────────────────────────────

  r1?.socket?.disconnect();
  r2?.socket?.disconnect();

  console.log('');
  console.log(`${C.bold}════════════════════════════════════════════${C.reset}`);

  if (failed === 0) {
    console.log(`  ${C.green}${C.bold}Todos os ${passed} testes passaram! ✓${C.reset}`);
  } else {
    console.log(`  ${C.green}${passed} passaram${C.reset}  /  ${C.red}${failed} falharam${C.reset}`);
  }

  console.log(`${C.bold}════════════════════════════════════════════${C.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\nErro inesperado no test runner:', err);
  process.exit(1);
});