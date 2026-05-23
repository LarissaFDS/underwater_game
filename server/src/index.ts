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

  //Critério de aceite: retorna se está correto e o array de posições encontradas
  res.json({
    correct: positions.length > 0,
    positions
  });
});

//=========================================================================
//LÓGICA DE WEBSOCKETS / SALAS (TASK 1 e ISSUE 7 e ISSUE 9)
//=========================================================================

const ROOM_NAME = 'ocean_room';
const MAX_PLAYERS = 2;

//Interface para controlar o estado dos animais na sala
interface RoomAnimalState {
  id: string;
  x: number;
  y: number;
  discovered: boolean;
}

//Estado expandido da Sala
const roomState = {
  players: {} as Record<string, { id: string; x: number; y: number }>,
  animals: {} as Record<string, RoomAnimalState>,
  activePuzzleAnimalId: null as string | null //Bloqueia novos puzzles se não for null
};

io.on('connection', (socket: Socket) => {
  console.log(`${SocketEvents.PLAYER_JOIN} - ID: ${socket.id}`);

  const clientsInRoom = io.sockets.adapter.rooms.get(ROOM_NAME)?.size || 0;

  if (clientsInRoom >= MAX_PLAYERS) {
    console.log(`Conexão rejeitada: sala cheia (${socket.id})`);
    socket.emit(SocketEvents.ROOM_FULL, { error: 'A sala já está cheia.' });
    socket.disconnect();
    return;
  }

  socket.join(ROOM_NAME);
  roomState.players[socket.id] = { id: socket.id, x: 0, y: 0 };

  //Quando o 2º jogador entra, inicializamos o mapa e os animais
  if (clientsInRoom + 1 === MAX_PLAYERS) {
    const mapSeed = Math.floor(Math.random() * 999999).toString();
    
    //TAREFA BACKEND: Guardar lista de animais com posição fictícia inicial no mapa
    //Distribuindo os animais em posições X diferentes para o frontend renderizar
    animals.forEach((animal, index) => {
      roomState.animals[animal.id] = {
        id: animal.id,
        x: 400 + index * 600, //Ex: 400, 1000, 1600...
        y: 500,
        discovered: false
      };
    });

    console.log(`Sala cheia! Jogo iniciado. Animais posicionados.`);
    
    io.to(ROOM_NAME).emit(SocketEvents.GAME_START, {
      seed: mapSeed,
      players: Object.keys(roomState.players)
    });
  }

  socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number, y: number }) => {
    if (roomState.players[socket.id]) {
      roomState.players[socket.id].x = data.x;
      roomState.players[socket.id].y = data.y;

      socket.to(ROOM_NAME).emit(SocketEvents.PLAYER_MOVED, {
        id: socket.id,
        x: data.x,
        y: data.y
      });
    }
  });

  //=========================================================================
  //NOVOS EVENTOS - ISSUE 9 (FORCA / PROXIMIDADE)
  //=========================================================================

  socket.on(SocketEvents.ANIMAL_APPROACH, (data: { animalId: string }) => {
    const { animalId } = data;

    //Bloquear se já houver um puzzle ativo na sala
    if (roomState.activePuzzleAnimalId !== null) {
      console.log(`Abordagem ignorada: Já existe um puzzle ativo (${roomState.activePuzzleAnimalId})`);
      return;
    }

    const roomAnimal = roomState.animals[animalId];
    const staticAnimalData = animals.find(a => a.id === animalId);

    //Validações básicas de segurança
    if (!roomAnimal || !staticAnimalData) {
      console.log(`Animal não encontrado no servidor: ${animalId}`);
      return;
    }

    //Verifica se o animal já foi descoberto antes
    if (roomAnimal.discovered) {
      console.log(`Abordagem ignorada: O animal ${animalId} já foi descoberto.`);
      return;
    }

    //Ativa o bloqueio de puzzle na sala
    roomState.activePuzzleAnimalId = animalId;
    console.log(`Puzzle iniciado para o animal: ${animalId}`);

    //Gera o hiddenName (substitui letras por '_', mas preserva hífens e espaços)
    //Ex: "peixe-palhaço" vira ['_', '_', '_', '_', '_', '-', '_', '_', '_', '_', '_', '_', '_']
    const hiddenName = staticAnimalData.name
      .split('')
      .map(char => (char === '-' || char === ' ' ? char : '_'));

    //Emitir puzzle:start para AMBOS os clients da sala com a primeira dica
    io.to(ROOM_NAME).emit(SocketEvents.PUZZLE_START, {
      animalId: animalId,
      hiddenName: hiddenName,
      hint1: staticAnimalData.hints[0] //Primeira dica do array estático
    });
  });

  //=========================================================================

  socket.on('disconnect', () => {
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
    delete roomState.players[socket.id];
    
    //Se a sala esvaziar, limpa o estado do jogo
    if (Object.keys(roomState.players).length === 0) {
      roomState.animals = {};
      roomState.activePuzzleAnimalId = null;
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do frontend...`);
});