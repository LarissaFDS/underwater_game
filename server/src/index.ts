import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SocketEvents } from './socket/events';
import { animals } from './data/animals'; //Importando a lista de animais

//Inicialização do Express
const app = express();
app.use(cors());
app.use(express.json()); //OBRIGATÓRIO: Permite que o Express entenda JSON enviado no corpo do POST

//Criação do servidor HTTP (necessário para o Socket.IO)
const server = http.createServer(app);

//Configuração do Socket.IO com CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

//Rota de Health Check
app.get('/', (req: Request, res: Response) => {
  res.send('Servidor do Submarino rodando perfeitamente!');
});

//=========================================================================
//ROTAS REST API (TASK 2)
//=========================================================================

//GET /api/animals: Retorna os dados dos animais ocultando o nome (resposta)
app.get('/api/animals', (req: Request, res: Response) => {
  //Mapeia removendo o campo 'name' para segurança do client
  const sanitizedAnimals = animals.map(({ name, ...rest }) => rest);
  res.json(sanitizedAnimals);
});

//POST /api/puzzle/guess: Valida o palpite de letra do jogador
app.post('/api/puzzle/guess', (req: Request, res: Response) => {
  const { animalId, letter } = req.body;

  //Validação básica de payload
  if (!animalId || !letter || letter.length !== 1) {
    return res.status(400).json({ error: 'Campos animalId e letter (1 caractere) são obrigatórios.' });
  }

  //Busca o animal pelo ID
  const animal = animals.find(a => a.id === animalId);
  if (!animal) {
    return res.status(404).json({ error: 'Animal não encontrado.' });
  }

  const positions: number[] = [];
  const nameLower = animal.name.toLowerCase();
  const letterLower = letter.toLowerCase();

  //Percorre o nome encontrando todos os índices da letra digitada
  for (let i = 0; i < nameLower.length; i++) {
    if (nameLower[i] === letterLower) {
      positions.push(i);
    }
  }

  //Critério de Aceite: Retorna se está correto e o array de posições encontradas
  res.json({
    correct: positions.length > 0,
    positions
  });
});

//=========================================================================
//LÓGICA DE WEBSOCKETS / SALAS (TASK 1 & ISSUE 7)
//=========================================================================

const ROOM_NAME = 'ocean_room';
const MAX_PLAYERS = 2;

//Guarda o estado de posição no servidor: { [socketId]: { id, x, y } }
const gameState: Record<string, { id: string; x: number; y: number }> = {};

io.on('connection', (socket: Socket) => {
  console.log(`${SocketEvents.PLAYER_JOIN} - ID: ${socket.id}`);

  //1. Verifica quantos jogadores já estão na sala
  const clientsInRoom = io.sockets.adapter.rooms.get(ROOM_NAME)?.size || 0;

  //2. Bloqueia a terceira conexão
  if (clientsInRoom >= MAX_PLAYERS) {
    console.log(`Conexão rejeitada: Sala cheia (${socket.id})`);
    //Emite o evento de erro de sala cheia e desconecta o intruso
    socket.emit(SocketEvents.ROOM_FULL, { error: 'A sala já está cheia.' });
    socket.disconnect();
    return;
  }

  //3. Adiciona o jogador à sala e inicializa seu estado em 0,0
  socket.join(ROOM_NAME);
  gameState[socket.id] = { id: socket.id, x: 0, y: 0 };

  //4. Se a sala atingiu 2 jogadores, emite o evento de início para todos
  if (clientsInRoom + 1 === MAX_PLAYERS) {
    const mapSeed = Math.floor(Math.random() * 999999).toString();
    console.log(`Sala cheia! Iniciando jogo com seed: ${mapSeed}`);
    
    io.to(ROOM_NAME).emit(SocketEvents.GAME_START, {
      seed: mapSeed,
      players: Object.keys(gameState)
    });
  }

  //5. Escuta o evento de movimento do cliente local
  socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number, y: number }) => {
    //Atualiza o estado no servidor
    if (gameState[socket.id]) {
      gameState[socket.id].x = data.x;
      gameState[socket.id].y = data.y;

      //Repassa a nova posição apenas para o parceiro na mesma sala
      socket.to(ROOM_NAME).emit(SocketEvents.PLAYER_MOVED, {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  //6. Limpeza na desconexão
  socket.on('disconnect', () => {
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
    delete gameState[socket.id];
  });
});

//=========================================================================

//Definição da porta
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do frontend...`);
});