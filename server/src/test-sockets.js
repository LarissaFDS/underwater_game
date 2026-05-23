const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

console.log('Iniciando simulação de clientes...');

// Conecta o Jogador 1
const client1 = io(SERVER_URL);
client1.on('connect', () => console.log('🟢 Cliente 1 conectado:', client1.id));

// O Jogador 1 escuta o início do jogo e o movimento dos outros
client1.on('game:start', (data) => console.log('🎮 Cliente 1 recebeu GAME_START:', data));
client1.on('player:moved', (data) => console.log('📍 Cliente 1 viu movimento:', data));

setTimeout(() => {
  // Conecta o Jogador 2 após 1 segundo
  const client2 = io(SERVER_URL);
  client2.on('connect', () => {
    console.log('🟢 Cliente 2 conectado:', client2.id);
    
    // Jogador 2 simula um movimento de mouse após se conectar
    setTimeout(() => {
      console.log('🖱️ Cliente 2 enviando movimento (x: 100, y: 200)...');
      client2.emit('player:move', { x: 100, y: 200 });
    }, 500);
  });

  client2.on('game:start', (data) => console.log('🎮 Cliente 2 recebeu GAME_START:', data));
}, 1000);

setTimeout(() => {
  // Tenta conectar o Jogador 3 (Intruso) após 2 segundos
  const client3 = io(SERVER_URL);
  
  client3.on('room:full', (data) => {
    console.log('🔴 Cliente 3 foi bloqueado. Motivo:', data.error);
  });
  
  client3.on('disconnect', () => {
    console.log('🔌 Cliente 3 foi desconectado pelo servidor com sucesso.');
    
    // Finaliza o teste após verificar tudo
    console.log('✅ Teste concluído com sucesso. Pressione Ctrl+C para sair.');
    process.exit(0);
  });
}, 2000);