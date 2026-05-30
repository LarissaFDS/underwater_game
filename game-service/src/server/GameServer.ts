import http from 'http';
import express, { Application, Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from '../game/GameRoom';
import { SocketEvents } from '../socket/events';

export class GameServer {
  private readonly app: Application;
  private readonly server: http.Server;
  private readonly io: Server;
  private readonly room: GameRoom;
  private readonly roomName: string;
  private readonly puzzleApiUrl: string;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.room = new GameRoom(2);
    this.roomName = 'ocean_room';
    this.puzzleApiUrl = process.env.PUZZLE_API_URL || 'http://localhost:3002';

    this.io = new Server(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.setupMiddlewares();
    this.setupHttpRoutes();
    this.setupSocketHandlers();
  }

  //HTTP
  private setupMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupHttpRoutes(): void {
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'ocean-game-service' });
    });
  }

  //Catalog
  private async loadCatalog(): Promise<void> {
    try {
      const response = await fetch(`${this.puzzleApiUrl}/api/animals`);
      const animals = await response.json();
      this.room.setCatalog(animals);
      console.log(`Catálogo carregado com ${animals.length} animais.`);
    } catch (error) {
      console.error('Erro ao conectar com a Puzzle API.', error);
    }
  }

  //Game Over
  private emitGameOver(
    winnerId: string | null,
    reason: 'elimination' | 'exploration' //um jogador morreu 2x ou todos os animais foram descobertos
  ): void {
    const discoveredAnimals = this.room.getDiscoveredAnimalsPayload();

    this.io.to(this.roomName).emit(SocketEvents.GAME_OVER, {
      winner: winnerId,
      reason,
      players: this.room.getPlayers(),
      discoveredAnimals,
    });

    console.log(`game:over emitido — reason: ${reason}, winner: ${winnerId}`);
  }

  private checkPlayerDeath(playerId: string): void {
    const player = this.room.getPlayer(playerId);
    if (!player || !player.isDead()) return;

    player.deathCount += 1;

    if (player.deathCount >= 2) {
      const winnerId = this.room
        .getPlayerIds()
        .find((id) => id !== playerId) ?? null;

      this.emitGameOver(winnerId, 'elimination');
    } else {
      player.reset();
      this.room.clearActivePuzzle();

      this.io.to(this.roomName).emit(SocketEvents.PLAYER_GAMEOVER, { playerId });
      this.io.to(this.roomName).emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
    }
  }

  private checkAllAnimalsDiscovered(): void {
    if (!this.room.allAnimalsDiscovered()) return;

    //Ganha quem tiver mais animais descobertos; empate → null
    const winnerId = this.room.getLeadingPlayerId();
    this.emitGameOver(winnerId, 'exploration');
  }

  //Socket handlers
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Conexão: ${socket.id}`);

      const clientsInRoom =
        this.io.sockets.adapter.rooms.get(this.roomName)?.size || 0;

      if (clientsInRoom >= this.room.maxPlayers) {
        socket.emit(SocketEvents.ROOM_FULL, { error: 'A sala já está cheia.' });
        socket.disconnect();
        return;
      }

      socket.join(this.roomName);
      this.room.addPlayer(socket.id);

      if (clientsInRoom + 1 === this.room.maxPlayers) {
        this.loadCatalog().then(() => {
          const seed = this.room.generateSeed();
          this.room.initializeAnimals();

          this.io.to(this.roomName).emit(SocketEvents.GAME_START, {
            seed,
            players: this.room.getPlayerIds(),
          });

          this.io
            .to(this.roomName)
            .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
        });
      }

      this.registerPlayerEvents(socket);
    });
  }

  private registerPlayerEvents(socket: Socket): void {
    socket.on(SocketEvents.PLAYER_MOVE, (data: { x: number; y: number }) => {
      const player = this.room.getPlayer(socket.id);
      if (!player) return;

      player.x = data.x;
      player.y = data.y;

      socket.to(this.roomName).emit(SocketEvents.PLAYER_MOVED, {
        id: socket.id,
        x: data.x,
        y: data.y,
      });
    });

    socket.on(SocketEvents.ANIMAL_APPROACH, async (data: { animalId: string }) => {
      if (this.room.getActivePuzzleAnimalId() !== null) return;

      const { animalId } = data;
      const roomAnimal = this.room.getAnimal(animalId);
      const catalogData = this.room.findCatalogAnimal(animalId);

      if (!roomAnimal || !catalogData || roomAnimal.discovered) return;

      this.room.startPuzzle(animalId);
      //Registra início do timer no AnimalState
      roomAnimal.startPuzzle();

      try {
        const hintResponse = await fetch(`${this.puzzleApiUrl}/api/puzzle/hint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animalId, hintIndex: 0 }),
        });
        const { hint } = await hintResponse.json();

        this.io.to(this.roomName).emit(SocketEvents.PUZZLE_START, {
          animalId,
          hiddenName: catalogData.hiddenName,
          hint1: hint,
        });
      } catch (error) {
        console.error('Erro ao buscar dica inicial:', error);
      }
    });

    socket.on(SocketEvents.PUZZLE_END, (data: { animalId?: string }) => {
      if (!this.room.getActivePuzzleAnimalId()) return;
      if (data?.animalId !== this.room.getActivePuzzleAnimalId()) return;

      this.room.confirmPuzzleEnd(socket.id);

      if (this.room.allPlayersEndedPuzzle()) {
        if (data.animalId) {
          const animal = this.room.getAnimal(data.animalId);
          if (animal) {
            animal.discovered = true;
            animal.discoveredBy = socket.id;
          }
        }
        this.room.clearActivePuzzle();
        this.checkAllAnimalsDiscovered();
      }
    });

    socket.on(SocketEvents.PLAYER_HIT, (_data: { obstacleType: string }) => {
      const player = this.room.getPlayer(socket.id);
      if (!player) return;

      player.hearts -= 1;
      this.io.to(this.roomName).emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
      this.checkPlayerDeath(socket.id);
    });

    socket.on(SocketEvents.PUZZLE_GUESS, async (data: { animalId: string; letter: string }) => {
      const player = this.room.getPlayer(socket.id);
      if (!player || !data.letter) return;

      try {
        const response = await fetch(`${this.puzzleApiUrl}/api/puzzle/guess`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await response.json();

        if (!result.correct) {
          player.oxygen -= 10;
          //Registra erro no AnimalState para o score
          const animal = this.room.getAnimal(data.animalId);
          animal?.registerWrongGuess();
        }

        this.io.to(this.roomName).emit(SocketEvents.PUZZLE_RESULT, {
          correct: result.correct,
          positions: result.positions,
          letter: data.letter.toLowerCase(),
        });

        this.io.to(this.roomName).emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
        this.checkPlayerDeath(socket.id);
      } catch (error) {
        console.error('Erro ao validar chute:', error);
      }
    });

    socket.on(SocketEvents.PUZZLE_HINT, async (data: { animalId: string; hintIndex: number }) => {
      const player = this.room.getPlayer(socket.id);
      if (!player) return;

      try {
        const response = await fetch(`${this.puzzleApiUrl}/api/puzzle/hint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await response.json();

        if (result.hint && result.hint !== 'Sem mais dicas.') {
          player.oxygen -= 5;
        }

        socket.emit(SocketEvents.PUZZLE_HINT, { hint: result.hint });
        this.io.to(this.roomName).emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
        this.checkPlayerDeath(socket.id);
      } catch (error) {
        console.error('Erro ao solicitar dica:', error);
      }
    });

    socket.on(SocketEvents.GAME_RESTART, () => {
      if (this.room.playerCount < this.room.maxPlayers) return;

      this.room.reset();
      const seed = this.room.generateSeed();

      this.io.to(this.roomName).emit(SocketEvents.GAME_START, {
        seed,
        players: this.room.getPlayerIds(),
      });

      this.io
        .to(this.roomName)
        .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());

      console.log(`Jogo reiniciado. Nova seed: ${seed}`);
    });

    socket.on('disconnect', () => {
      console.log(`Desconectado: ${socket.id}`);

      const hadActivePuzzle = this.room.getActivePuzzleAnimalId() !== null;
      this.room.removePlayer(socket.id);

      if (this.room.playerCount === 0) {
        this.room.clearAnimals();
        this.room.clearActivePuzzle();
      } else if (hadActivePuzzle && this.room.allPlayersEndedPuzzle()) {
        this.room.clearActivePuzzle();
      }
    });
  }

  //Entry point
  public listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`🎮 Game Service (Socket) rodando na porta ${port}`);
    });
  }
}