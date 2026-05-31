"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ScoreCalculator_1 = require("./services/ScoreCalculator");
const GameResultRepository_1 = require("./repositories/GameResultRepository");
const ScoreService_1 = require("./services/ScoreService");
//Instanciar dependências (simulando a injeção de dependência do ScoreServer)
const repo = new GameResultRepository_1.GameResultRepository();
const calculator = new ScoreCalculator_1.ScoreCalculator();
const scoreService = new ScoreService_1.ScoreService(repo, calculator);
//Criar um cenário fictício de fim de jogo (Payload recebido do game-service)
const mockPayload = {
    winner: 'jogador-1-socket',
    reason: 'exploration',
    players: {
        'jogador-1-socket': { id: 'jogador-1-socket', hearts: 3, oxygen: 80, deathCount: 0 },
        'jogador-2-socket': { id: 'jogador-2-socket', hearts: 1, oxygen: 20, deathCount: 2 }
    },
    discoveredAnimals: [
        {
            animalId: 'tartaruga-marinha',
            discoveredBy: 'jogador-1-socket',
            //45 segundos (15s abaixo de 60s) -> Bônus esperado: 15 * 1 = 15 pts
            timeToDiscoverMs: 45000,
            //1 erro -> Punição: 1 * 3 = 3 pts
            wrongGuesses: 1,
            //Base: 50. Cálculo: 50 + 15 - 3 = 62 pts
            pointsBase: 50
        },
        {
            animalId: 'tubarao-branco',
            discoveredBy: 'jogador-2-socket',
            //20 segundos (40s abaixo de 60s) -> O limite do bônus é 30 pts (MAX_TIME_BONUS)
            timeToDiscoverMs: 20000,
            //0 erros
            wrongGuesses: 0,
            //Base: 100. Cálculo: 100 + 30 - 0 = 130 pts
            pointsBase: 100
        },
        {
            animalId: 'peixe-palhaco',
            discoveredBy: 'jogador-1-socket',
            //65 segundos (acima de 60s) -> Bônus: 0 pts
            timeToDiscoverMs: 65000,
            //3 erros -> Punição: 3 * 3 = 9 pts
            wrongGuesses: 3,
            //Base: 20. Cálculo: 20 + 0 - 9 = 11 pts
            pointsBase: 20
        }
    ]
};
//Executar o processamento
console.log('INICIANDO TESTE DO SCORE-SERVICE');
console.log('Processando Payload de Game Over...');
const result = scoreService.processGameOver(mockPayload);
//Exibir o resultado calculado que seria enviado aos clientes
console.log('\nRESULTADO CALCULADO (Pronto para emissão via Socket):');
console.dir(result, { depth: null, colors: true });
//Validar a persistência no repositório em memória
console.log('\nVERIFICANDO REPOSITÓRIO:');
const latest = scoreService.getLatestResult();
if (latest) {
    console.log(`- ID salvo: ${latest.id}`);
    console.log(`- Vencedor registrado: ${latest.winner}`);
    console.log(`- Motivo: ${latest.reason}`);
    console.log(`- Data de criação: ${latest.createdAt}`);
}
else {
    console.log('Erro: Nenhum resultado encontrado no repositório.');
}
console.log('Teste finalizado com sucesso!');
