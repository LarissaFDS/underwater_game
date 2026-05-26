import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SocketEvents } from './socket/events';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

//URL do microsserviço Puzzle API (configurado via variável de ambiente no Docker)
const PUZZLE_API_URL = process.env.PUZZLE_API_URL || 'http://localhost:3002';

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'ocean-game-service'
  });
});

//=========================
//ESTADO DO JOGO E DA SALA
//=========================
const ROOM_NAME = 'ocean_room';
const MAX_PLAYERS = 2;

interface RoomPlayerState {
  id: string;
  x: number;
  y: number;
  hearts: number;
  oxygen: number;
  deathCount: number;
}

interface RoomAnimalState {
  id: string;
  x: number;
  y: number;
  discovered: boolean;
}

const roomState = {
  players: {} as Record<string, RoomPlayerState>,
  animals: {} as Record<string, RoomAnimalState>,
  activePuzzleAnimalId: null as string | null,
  puzzleEndConfirmations: new Set<string>()
};

//Cache do catálogo de animais vindo da API
let catalogAnimals: any[] = [];

const loadCatalog = async () => {
  try {
    const response = await fetch(`${PUZZLE_API_URL}/api/animals`);
    catalogAnimals = await response.json();
    console.log(`Catálogo carregado com ${catalogAnimals.length} animais.`);
  } catch (error) {
    console.error('Erro ao conectar com a Puzzle API. Ela está rodando?', error);
  }
};

const clearActivePuzzle = () => {
  roomState.activePuzzleAnimalId = null;
  roomState.puzzleEndConfirmations.clear();
};

const allCurrentPlayersEndedPuzzle = () => {
  const currentPlayerIds = Object.keys(roomState.players);
  return (
    currentPlayerIds.length > 0 &&
    currentPlayerIds.every((playerId) => roomState.puzzleEndConfirmations.has(playerId))
  );
};

//================
//LÓGICA DO SOCKET
//================

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
  
  roomState.players[socket.id] = { 
    id: socket.id, x: 0, y: 0, hearts: 3, oxygen: 100, deathCount: 0 
  };

  if (clientsInRoom + 1 === MAX_PLAYERS) {
    //Se for o segundo jogador entrando, carrega os animais da API e inicia o jogo
    loadCatalog().then(() => {
      const mapSeed = Math.floor(Math.random() * 999999).toString();
      
      catalogAnimals.forEach((animal, index) => {
        roomState.animals[animal.id] = {
          id: animal.id, x: 400 + index * 600, y: 500, discovered: false
        };
      });

      console.log(`Sala cheia! Jogo iniciado. Animais posicionados.`);
      io.to(ROOM_NAME).emit(SocketEvents.GAME_START, {
        seed: mapSeed,
        players: Object.keys(roomState.players)
      });
      
      io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
    });
  }

  const checkPlayerDeath = (playerId: string) => {
    const player = roomState.players[playerId];
    if (!player) return;

    if (player.hearts <= 0 || player.oxygen <= 0) {
      player.deathCount += 1;
      
      if (player.deathCount >= 2) {
        console.log(`Game Over definitivo para ${playerId}`);
        const winnerId = Object.keys(roomState.players).find(id => id !== playerId);
        io.to(ROOM_NAME).emit(SocketEvents.GAME_OVER, { winner: winnerId });
      } else {
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

  socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number, y: number }) => {
    if (roomState.players[socket.id]) {
      roomState.players[socket.id].x = data.x;
      roomState.players[socket.id].y = data.y;
      socket.to(ROOM_NAME).emit(SocketEvents.PLAYER_MOVED, {
        id: socket.id, x: data.x, y: data.y
      });
    }
  });

  socket.on(SocketEvents.ANIMAL_APPROACH, async (data: { animalId: string }) => {
    if (roomState.activePuzzleAnimalId !== null) return;

    const { animalId } = data;
    const roomAnimal = roomState.animals[animalId];
    const catalogData = catalogAnimals.find(a => a.id === animalId);

    if (!roomAnimal || !catalogData || roomAnimal.discovered) return;

    roomState.activePuzzleAnimalId = animalId;
    roomState.puzzleEndConfirmations.clear();

    //Busca a primeira dica pela puzzle-api, igual às dicas seguintes
    try {
      const hintResponse = await fetch(`${PUZZLE_API_URL}/api/puzzle/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ animalId, hintIndex: 0 })
      });
      const { hint } = await hintResponse.json();

      io.to(ROOM_NAME).emit(SocketEvents.PUZZLE_START, {
        animalId,
        hiddenName: catalogData.hiddenName, //hiddenName ainda vem do catalog
        hint1: hint
      });
    } catch (error) {
      console.error('Erro ao buscar dica inicial na Puzzle API:', error);
    }
  });

  socket.on(SocketEvents.PUZZLE_END, (data: { animalId?: string }) => {
    if (!roomState.activePuzzleAnimalId) return;
    if (data?.animalId !== roomState.activePuzzleAnimalId) return;

    roomState.puzzleEndConfirmations.add(socket.id);

    if (allCurrentPlayersEndedPuzzle()) {
      clearActivePuzzle();
      //Opcional: marcar o animal como 'discovered' no estado da sala
      if (data.animalId && roomState.animals[data.animalId]) {
        roomState.animals[data.animalId].discovered = true;
      }
    }
  });

  socket.on(SocketEvents.PLAYER_HIT, (data: { obstacleType: string }) => {
    const player = roomState.players[socket.id];
    if (player) {
      player.hearts -= 1;
      io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
      checkPlayerDeath(socket.id);
    }
  });

  //COMUNICAÇÃO HTTP COM A PUZZLE API
  socket.on(SocketEvents.PUZZLE_GUESS, async (data: { animalId: string, letter: string }) => {
    const player = roomState.players[socket.id];
    if (!player || !data.letter) return;

    try {
      const response = await fetch(`${PUZZLE_API_URL}/api/puzzle/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();

      if (!result.correct) {
        player.oxygen -= 10;
      }

      io.to(ROOM_NAME).emit(SocketEvents.PUZZLE_RESULT, { 
        correct: result.correct, 
        positions: result.positions, 
        letter: data.letter.toLowerCase() 
      });
      
      io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
      checkPlayerDeath(socket.id);

    } catch (error) {
      console.error("Erro ao validar chute na Puzzle API:", error);
    }
  });

  //COMUNICAÇÃO HTTP COM A PUZZLE API
  socket.on(SocketEvents.PUZZLE_HINT, async (data: { animalId: string, hintIndex: number }) => {
    const player = roomState.players[socket.id];
    if (!player) return;

    try {
      const response = await fetch(`${PUZZLE_API_URL}/api/puzzle/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();

      if (result.hint && result.hint !== "Sem mais dicas.") {
        player.oxygen -= 5;
      }

      socket.emit(SocketEvents.PUZZLE_HINT, { hint: result.hint });
      io.to(ROOM_NAME).emit(SocketEvents.STATE_UPDATE, roomState.players);
      checkPlayerDeath(socket.id);

    } catch (error) {
      console.error("Erro ao solicitar dica na Puzzle API:", error);
    }
  });

  socket.on('disconnect', () => {
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
    delete roomState.players[socket.id];
    roomState.puzzleEndConfirmations.delete(socket.id);
    
    if (Object.keys(roomState.players).length === 0) {
      roomState.animals = {};
      clearActivePuzzle();
    } else if (roomState.activePuzzleAnimalId && allCurrentPlayersEndedPuzzle()) {
      clearActivePuzzle();
    }
  });
});

const PORT = Number(process.env.PORT) || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Game Service (Socket) rodando na porta ${PORT}`);
});