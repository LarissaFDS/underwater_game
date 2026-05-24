import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SocketEvents } from './socket/events';
import { animals } from './data/animals'; //Importando a lista de animais

//Inicialização do Express
const app = express();
app.use(cors());
app.use(express.json());

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
//ROTAS REST API (TASK 2) - mantidas por compatibilidade
//=========================================================================

app.get('/api/animals', (req: Request, res: Response) => {
  const sanitizedAnimals = animals.map(({ name, ...rest }) => rest);
  res.json(sanitizedAnimals);
});

app.post('/api/puzzle/guess', (req: Request, res: Response) => {
  const { animalId, letter } = req.body;
  if (!animalId || !letter || letter.length !== 1) {
    return res.status(400).json({ error: 'Campos animalId e letter são obrigatórios.' });
  }

  const animal = animals.find(a => a.id === animalId);
  if (!animal) return res.status(404).json({ error: 'Animal não encontrado.' });

  const positions: number[] = [];
  const nameLower = animal.name.toLowerCase();
  const letterLower = letter.toLowerCase();

  for (let i = 0; i < nameLower.length; i++) {
    if (nameLower[i] === letterLower) positions.push(i);
  }

  res.json({ correct: positions.length > 0, positions });
});

//=========================================================================
//LÓGICA DE WEBSOCKETS / SALAS (TASKS 1, 7, 9 E 10)
//=========================================================================

const ROOM_NAME = 'ocean_room';
const MAX_PLAYERS = 2;

interface RoomAnimalState {
  id: string;
  x: number;
  y: number;
  discovered: boolean;
}

//interface do jogador expandida
interface RoomPlayerState {
  id: string;
  x: number;
  y: number;
  hearts: number;
  oxygen: number;
  deathCount: number;
}

const roomState = {
  players: {} as Record<string, RoomPlayerState>,
  animals: {} as Record<string, RoomAnimalState>,
  activePuzzleAnimalId: null as string | null,
  puzzleEndConfirmations: new Set<string>()
};

const clearActivePuzzle = () => {
  roomState.activePuzzleAnimalId = null;
  roomState.puzzleEndConfirmations.clear();
};

const allCurrentPlayersEndedPuzzle = () => {
  const currentPlayerIds = Object.keys(roomState.players);

  return (
    currentPlayerIds.length > 0 &&
    currentPlayerIds.every((playerId) =>
      roomState.puzzleEndConfirmations.has(playerId)
    )
  );
};

io.on('connection', (socket: Socket) => {
  console.log(`${SocketEvents.PLAYER_JOIN} - ID: ${socket.id}`);
  const clientsInRoom = io.sockets.adapter.rooms.get(ROOM_NAME)?.size || 0;

  if (clientsInRoom >= MAX_PLAYERS) {
    console.log(`Conexão rejeitada: Sala cheia (${socket.id})`);
    socket.emit(SocketEvents.ROOM_FULL, { error: 'A sala já está cheia.' });
    socket.disconnect();
    return;
  }

  socket.join(ROOM_NAME);
  
  //inicializa jogador com O2, vidas e contagem de mortes
  roomState.players[socket.id] = { 
    id: socket.id, x: 0, y: 0, hearts: 3, oxygen: 100, deathCount: 0 
  };

  if (clientsInRoom + 1 === MAX_PLAYERS) {
    const mapSeed = Math.floor(Math.random() * 999999).toString();
    
    animals.forEach((animal, index) => {
      roomState.animals[animal.id] = {
        id: animal.id, x: 400 + index * 600, y: 500, discovered: false
      };
    });

    console.log(`Sala cheia! Jogo iniciado. Animais posicionados.`);
    io.to(ROOM_NAME).emit(SocketEvents.GAME_START, {
      seed: mapSeed,
      players: Object.keys(roomState.players)
    });
    
    //Envia o estado inicial para os jogadores assim que o jogo começa
    io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
  }

  //Função auxiliar: Checagem de morte/Game Over
  const checkPlayerDeath = (playerId: string) => {
    const player = roomState.players[playerId];
    if (!player) return;

    if (player.hearts <= 0 || player.oxygen <= 0) {
      player.deathCount += 1;
      
      if (player.deathCount >= 2) {
        //Morreu duas vezes: o outro jogador vence
        console.log(`Game Over definitivo para ${playerId}`);
        const winnerId = Object.keys(roomState.players).find(id => id !== playerId);
        io.to(ROOM_NAME).emit(SocketEvents.GAME_OVER, { winner: winnerId });
      } else {
        //Primeira morte: reseta pro spawn e cancela puzzles ativos
        console.log(`Primeira morte de ${playerId}. Voltando ao spawn.`);
        player.hearts = 3;
        player.oxygen = 100;
        player.x = 0;
        player.y = 0;
        clearActivePuzzle(); 
        
        io.to(ROOM_NAME).emit(SocketEvents.PLAYER_GAMEOVER, { playerId });
        io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
      }
    }
  };

  //Movimentação
  socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number, y: number }) => {
    if (roomState.players[socket.id]) {
      roomState.players[socket.id].x = data.x;
      roomState.players[socket.id].y = data.y;
      socket.to(ROOM_NAME).emit(SocketEvents.PLAYER_MOVED, {
        id: socket.id, x: data.x, y: data.y
      });
    }
  });

  //Aproximação do animal
  socket.on(SocketEvents.ANIMAL_APPROACH, (data: { animalId: string }) => {
    const { animalId } = data;
    if (roomState.activePuzzleAnimalId !== null) return;

    const roomAnimal = roomState.animals[animalId];
    const staticAnimalData = animals.find(a => a.id === animalId);

    if (!roomAnimal || !staticAnimalData || roomAnimal.discovered) return;

    roomState.activePuzzleAnimalId = animalId;
    roomState.puzzleEndConfirmations.clear();
    const hiddenName = staticAnimalData.name
      .split('')
      .map(char => (char === '-' || char === ' ' ? char : '_'));

    io.to(ROOM_NAME).emit(SocketEvents.PUZZLE_START, {
      animalId: animalId,
      hiddenName: hiddenName,
      hint1: staticAnimalData.hints[0]
    });
  });

  socket.on(SocketEvents.PUZZLE_END, (data: { animalId?: string }) => {
    if (!roomState.activePuzzleAnimalId) return;
    if (data?.animalId !== roomState.activePuzzleAnimalId) return;

    roomState.puzzleEndConfirmations.add(socket.id);

    if (allCurrentPlayersEndedPuzzle()) {
      clearActivePuzzle();
    }
  });

  //=========================================================================
  //NOVOS EVENTOS - DANO, OXIGÊNIO E PUZZLE EM TEMPO REAL
  //=========================================================================

  //Bateu em obstáculo
  socket.on(SocketEvents.PLAYER_HIT, (data: { obstacleType: string }) => {
    const player = roomState.players[socket.id];
    if (player) {
      player.hearts -= 1;
      io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
      checkPlayerDeath(socket.id);
    }
  });

  //Chute de letra na forca
  socket.on(SocketEvents.PUZZLE_GUESS, (data: { animalId: string, letter: string }) => {
    const player = roomState.players[socket.id];
    if (!player) return;

    const animal = animals.find(a => a.id === data.animalId);
    if (!animal || !data.letter) return;

    const nameLower = animal.name.toLowerCase();
    const letterLower = data.letter.toLowerCase();
    const positions: number[] = [];

    for (let i = 0; i < nameLower.length; i++) {
      if (nameLower[i] === letterLower) positions.push(i);
    }

    //Se errou, tira 10% do O2 do jogador que chutou
    if (positions.length === 0) {
      player.oxygen -= 10;
    }

    io.to(ROOM_NAME).emit(SocketEvents.PUZZLE_RESULT, { 
      correct: positions.length > 0, 
      positions, 
      letter: letterLower 
    });
    
    io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
    checkPlayerDeath(socket.id);
  });

  //Pedir dica
  socket.on(SocketEvents.PUZZLE_HINT, (data: { animalId: string, hintIndex: number }) => {
    const player = roomState.players[socket.id];
    const animal = animals.find(a => a.id === data.animalId);
    if (!player || !animal) return;

    player.oxygen -= 5;
    const nextHint = animal.hints[data.hintIndex] || "Sem mais dicas.";

    socket.emit(SocketEvents.PUZZLE_HINT, { hint: nextHint });
    io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
    checkPlayerDeath(socket.id);
  });

  //=========================================================================

  socket.on('disconnect', () => {
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
    delete roomState.players[socket.id];
    roomState.puzzleEndConfirmations.delete(socket.id);
    
    if (Object.keys(roomState.players).length === 0) {
      roomState.animals = {};
      clearActivePuzzle();
    } else if (
      roomState.activePuzzleAnimalId &&
      allCurrentPlayersEndedPuzzle()
    ) {
      clearActivePuzzle();
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do frontend...`);
});
