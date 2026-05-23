const { io } = require('socket.io-client');

const SERVER_URL = 'http://localhost:3001';

console.log('Iniciando simulação de clientes para a issue 10...');

//Conecta os dois clientes quase em simultâneo para encher a sala e iniciar o jogo
const client1 = io(SERVER_URL);
const client2 = io(SERVER_URL);

client1.on('connect', () => console.log('Cliente 1 conectado:', client1.id));
client2.on('connect', () => console.log('Cliente 2 conectado:', client2.id));

//==========================================
//CLIENTE 1
//==========================================
client1.on('game:start', (data) => {
    console.log('\nJOGO INICIADO! A sala está cheia.');
    
    //Cliente 1 bate numa pedra (fica com 2 corações)
    setTimeout(() => {
        console.log('\nCliente 1 bateu num obstáculo (1º Hit)');
        client1.emit('player:hit', { obstacleType: 'rock' });
    }, 1000);

    //Cliente 1 aproxima-se do animal
    setTimeout(() => {
        console.log('\nCliente 1 encontrou o peixe-palhaço!');
        client1.emit('animal:approach', { animalId: 'peixe-palhaco' });
    }, 2000);

    //Cliente 1 pede uma dica (perde 5% de O2)
    setTimeout(() => {
        console.log('\nCliente 1 pediu uma dica extra no puzzle');
        client1.emit('puzzle:hint', { animalId: 'peixe-palhaco', hintIndex: 1 });
    }, 3000);

    //Cliente 1 tenta a letra 'Z' e erra (perde 10% de O2)
    setTimeout(() => {
        console.log('\nCliente 1 chutou a letra Z (errada) no puzzle');
        client1.emit('puzzle:guess', { animalId: 'peixe-palhaco', letter: 'z' });
    }, 4000);

    //Cliente 1 bate noutra pedra (fica com 1 coração)
    setTimeout(() => {
        console.log('\nCliente 1 bateu num obstáculo (2º Hit)');
        client1.emit('player:hit', { obstacleType: 'rock' });
    }, 5000);

    //Cliente 1 bate na 3ª pedra (fica com 0 corações -> 1ª Morte)
    setTimeout(() => {
        console.log('\nCliente 1 bateu num obstáculo (3º Hit) - DEVE MORRER PELA 1ª VEZ!');
        client1.emit('player:hit', { obstacleType: 'rock' });
    }, 6000);

    //Cliente 1 bate em outras 3 pedras instantaneamente (2ª Morte -> Game Over)
    setTimeout(() => {
        console.log('\nCliente 1 vai bater até morrer novamente para testar o GAME OVER GERAL...');
        client1.emit('player:hit', { obstacleType: 'rock' });
        client1.emit('player:hit', { obstacleType: 'rock' });
        client1.emit('player:hit', { obstacleType: 'rock' });
    }, 8000);
});

//==========================================
//LISTENERS PARA VERIFICAR AS RESPOSTAS DO SERVIDOR
//==========================================

//Monitorizar o estado em tempo real
client1.on('state:update', (players) => {
    const p1 = players[client1.id];
    if(p1) {
        console.log(`ESTADO ATUAL -> Vidas: ${p1.hearts}/3 | O2: ${p1.oxygen}% | Mortes: ${p1.deathCount}`);
    }
});

//Respostas do puzzle
client1.on('puzzle:start', (data) => console.log('Puzzle iniciado:', data.hiddenName.join('')));
client1.on('puzzle:hint', (data) => console.log('Nova dica recebida:', data.hint));
client1.on('puzzle:result', (data) => console.log(`Resultado da letra '${data.letter}':`, data.correct ? 'ACERTOU' : 'ERROU'));

//Eventos de morte
client1.on('player:gameover', (data) => {
    console.log('\nALERTA: cliente 1 morreu pela primeira vez e foi enviado para o respawn!');
});

client1.on('game:over', (data) => {
    console.log(`\nFIM DE JOGO DEFINITIVO! O jogador que perdeu as 2 vidas foi eliminado.`);
    console.log(`O vencedor da partida foi o Cliente 2 (ID: ${data.winner})`);
    console.log('\nTeste da issue 10 concluído com sucesso. A encerrar...');
    setTimeout(() => process.exit(0), 1000);
});