const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

console.log('Iniciando simulação de clientes...');

//==========================================
//JOGADOR 1
//==========================================
const client1 = io(SERVER_URL);
client1.on('connect', () => console.log('Cliente 1 conectado:', client1.id));

//Só tentamos encostar no peixe depois que o backend avisa que o jogo está pronto
client1.on('game:start', (data) => {
  console.log('Cliente 1 recebeu GAME_START com seed:', data.seed);
  
  //Agora temos certeza absoluta que o backend já colocou os animais na sala
  setTimeout(() => {
    console.log('Cliente 1 avisando o servidor que achou o peixe-palhaco...');
    client1.emit('animal:approach', { animalId: 'peixe-palhaco' });
  }, 500); //0.5s só para dar um respiro no console
});

client1.on('player:moved', (data) => console.log('Cliente 1 viu movimento do parceiro.'));
client1.on('puzzle:start', (data) => console.log('Cliente 1 entrou no Puzzle:', data.hiddenName.join(''), '| Dica:', data.hint1));

//==========================================
//JOGADOR 2
//==========================================
setTimeout(() => {
  const client2 = io(SERVER_URL);
  
  client2.on('connect', () => {
    console.log('Cliente 2 conectado:', client2.id);
    
    //Jogador 2 se move
    setTimeout(() => {
      client2.emit('player:move', { x: 100, y: 200 });
    }, 500);
  });

  client2.on('game:start', (data) => console.log('Cliente 2 recebeu GAME_START com seed:', data.seed));
  client2.on('puzzle:start', (data) => console.log('Cliente 2 entrou no Puzzle:', data.hiddenName.join(''), '| Dica:', data.hint1));
}, 1000);

//==========================================
//JOGADOR 3 (INTRUSO)
//==========================================
setTimeout(() => {
  const client3 = io(SERVER_URL);
  
  client3.on('room:full', (data) => {
    console.log('Cliente 3 foi bloqueado.');
  });
  
  client3.on('disconnect', () => {
    console.log('Teste concluído com sucesso. Encerrando...');
    process.exit(0);
  });
}, 3000);