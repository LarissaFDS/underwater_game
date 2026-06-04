import http from 'http';
import express, { Application, Request, Response } from 'express';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameRoom } from '../game/GameRoom';
import { SocketEvents } from '../socket/events';

//─── Tipos internos de validação de token ───────────────────────────────────
interface TokenValidationResult {
  valid: boolean;
  nickname?: string;
}

interface TokenCacheEntry {
  nickname: string;
  validatedAt: number;
}

//─── GameServer ──────────────────────────────────────────────────────────────
export class GameServer {
  private readonly app: Application;
  private readonly server: http.Server;
  private readonly io: Server;
  private readonly room: GameRoom;
  private readonly roomName: string;
  private readonly serviceRoomName: string;
  private lastCorrectGuesses = new Map<string, string>();
  private readonly playerSocketsByClientInstanceId = new Map<string, string>();
  private readonly puzzleApiUrl: string;
  private readonly authServiceUrl: string;
  private readonly corsOrigin: string | string[];
  private readonly instanceId: string;
  private roomDestructionTimeout: NodeJS.Timeout | null = null;

  //Cache local de validações de token para reduzir chamadas HTTP ao auth-service.
  //Entradas expiram após TOKEN_CACHE_TTL_MS milissegundos.
  private readonly tokenCache: Map<string, TokenCacheEntry> = new Map();
  private static readonly TOKEN_CACHE_TTL_MS = 5 * 60 * 1000; //5 minutos

  constructor() {
    this.app            = express();
    this.server         = http.createServer(this.app);
    this.room           = new GameRoom(2);
    this.roomName       = 'ocean_room';
    this.serviceRoomName = 'internal_services';
    this.puzzleApiUrl   = process.env.PUZZLE_API_URL  || 'http://localhost:3002';
    this.authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';
    this.corsOrigin     = this.resolveCorsOrigin();
    this.instanceId     =
      process.env.RENDER_INSTANCE_ID ||
      process.env.RENDER_SERVICE_ID  ||
      `pid-${process.pid}`;

    this.io = new Server(this.server, {
      cors: { origin: this.corsOrigin, methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling'],
      pingInterval: 15_000,
      pingTimeout:  10_000,
    });

    this.setupMiddlewares();
    this.setupHttpRoutes();
    this.setupSocketHandlers();
  }

  private lastGameOverPayload: object | null = null;

  //─── HTTP ──────────────────────────────────────────────────────────────────
  private setupMiddlewares(): void {
    this.app.use(cors({ origin: this.corsOrigin }));
    this.app.use(express.json());
  }

  private setupHttpRoutes(): void {
    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'ocean-game-service' });
    });
  }

  private resolveCorsOrigin(): string | string[] {
    const rawOrigins =
      process.env.CORS_ORIGIN   ||
      process.env.CORS_ORIGINS  ||
      process.env.FRONTEND_ORIGIN;

    if (!rawOrigins) return '*';

    const origins = rawOrigins
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    return origins.length === 1 ? origins[0] : origins;
  }

  private formatCorsOrigin(): string {
    return Array.isArray(this.corsOrigin)
      ? this.corsOrigin.join(', ')
      : this.corsOrigin;
  }

  private formatHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) return value.join(', ');
    return value ?? 'n/a';
  }

  //─── Catálogo ─────────────────────────────────────────────────────────────
  private async loadCatalog(): Promise<void> {
    try {
      const response = await fetch(`${this.puzzleApiUrl}/api/animals`);
      const animals  = await response.json();
      this.room.setCatalog(animals);
      console.log(`Catálogo carregado com ${animals.length} animais.`);
    } catch (error) {
      console.error('Erro ao conectar com a Puzzle API.', error);
    }
  }

  //─── Validação de token (com cache) ───────────────────────────────────────
  private async validateToken(token: string): Promise<TokenValidationResult> {
    const cached = this.tokenCache.get(token);
    if (cached && Date.now() - cached.validatedAt < GameServer.TOKEN_CACHE_TTL_MS) {
      return { valid: true, nickname: cached.nickname };
    }

    try {
      const res = await fetch(`${this.authServiceUrl}/api/validate/${token}`);
      if (!res.ok) return { valid: false };

      const data = await res.json() as TokenValidationResult;

      if (data.valid && data.nickname) {
        this.tokenCache.set(token, {
          nickname: data.nickname,
          validatedAt: Date.now(),
        });
      }

      return data;
    } catch (err) {
      console.error('[GameServer] Falha ao contatar auth-service:', err);
      return { valid: false };
    }
  }

  //─── Game Over ────────────────────────────────────────────────────────────
  private emitGameOver(
    winnerId: string | null,
    reason: 'elimination' | 'exploration',
    eliminationReason?: 'oxygen' | 'hearts',
    eliminatedPlayerId?: string
  ): void {
    if (!reason) throw new Error('emitGameOver requires a reason');

    const discoveredAnimals = this.room.getDiscoveredAnimalsPayload();
    const payload = {
      winner: winnerId,
      reason,
      eliminationReason,
      eliminatedPlayerId,
      players: this.room.getPlayers(),
      discoveredAnimals,
    };

    this.lastGameOverPayload = payload;

    this.io
      .to(this.roomName)
      .to(this.serviceRoomName)
      .emit(SocketEvents.GAME_OVER, payload);

    console.log('[GameServer] game:over emitted', payload);
  }

  private checkPlayerDeath(playerId: string): void {
    const player = this.room.getPlayer(playerId);
    if (!player || !player.isDead()) return;

    player.deathCount += 1;
    console.log(`Morte registrada para ${playerId}. deathCount=${player.deathCount}`);

    if (player.deathCount >= 2) {
      const winnerId =
        this.room.getPlayerIds().find((id) => id !== playerId) ?? null;

      this.emitGameOver(
        winnerId,
        'elimination',
        this.getEliminationReason(player),
        playerId
      );
    } else {
      player.respawn();
      this.room.clearActivePuzzle();

      this.io.to(this.roomName).emit(SocketEvents.PLAYER_GAMEOVER, { playerId });
      this.io.to(this.roomName).emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
    }
  }

  private checkAllAnimalsDiscovered(): void {
    if (!this.room.allAnimalsDiscovered()) return;

    const winnerId = this.room.getLeadingPlayerId();
    this.emitGameOver(winnerId, 'exploration');
  }

  //─── Socket handlers ──────────────────────────────────────────────────────
  private setupSocketHandlers(): void {
    //── Middleware de autenticação ─────────────────────────────────────────
    //Executado para cada conexão antes do handler 'connection'.
    //Conexões de microsserviços (clientType === 'service') não precisam de token.
    //Conexões de jogadores devem apresentar um token válido do auth-service.
    this.io.use(async (socket, next) => {
      const { clientType, token } = socket.handshake.auth as {
        clientType?: string;
        token?: string;
      };

      //Microsserviços internos (score-service etc.) não passam por validação
      if (clientType === 'service') {
        return next();
      }

      if (!token) {
        return next(
          new Error('Token de autenticação ausente. Faça login antes de conectar.')
        );
      }

      const result = await this.validateToken(token);

      if (!result.valid || !result.nickname) {
        return next(
          new Error('Token inválido ou expirado. Faça login novamente.')
        );
      }

      //Nickname validado fica disponível para o handler de conexão
      socket.data.nickname = result.nickname;
      next();
    });

    //── Handler de conexão ────────────────────────────────────────────────
    this.io.engine.on('connection_error', (error) => {
      const origin = this.formatHeader(error.req?.headers.origin);
      console.error(
        `[GameServer] connect_error origin=${origin} code=${error.code} message=${error.message}`
      );
    });

    this.io.on('connection', (socket: Socket) => {
      const { clientType, serviceName, clientInstanceId } = socket.handshake
        .auth as {
        clientType?: string;
        serviceName?: string;
        clientInstanceId?: string;
      };

      //O nickname já foi validado e injetado pelo middleware acima.
      //O fallback 'Jogador' é apenas um guarda de tipo, nunca deveria ocorrer.
      const nickname = (socket.data.nickname as string | undefined) ?? 'Jogador';

      const origin         = this.formatHeader(socket.handshake.headers.origin);
      const playersBefore  = this.room.getPlayerIds();
      const playerCountBefore = this.room.playerCount;

      console.log(
        `[GameServer] connection instance=${this.instanceId} socket=${socket.id} origin=${origin} auth=${JSON.stringify(socket.handshake.auth)}`
      );

      //── Conexão de microsserviço ─────────────────────────────────────────
      if (clientType === 'service') {
        console.log(
          `[GameServer] service connected socket=${socket.id} serviceName=${serviceName ?? 'unknown'}`
        );
        socket.join(this.serviceRoomName);

        if (this.lastGameOverPayload) {
          socket.emit(SocketEvents.GAME_OVER, this.lastGameOverPayload);
          console.log('[GameServer] replayed last game:over to reconnected service');
        }

        socket.on('service:getLastGameOver', () => {
          if (this.lastGameOverPayload) {
            socket.emit(SocketEvents.GAME_OVER, this.lastGameOverPayload);
          }
        });

        return;
      }

      //── Conexão de jogador ───────────────────────────────────────────────
      console.log(
        `[GameServer] player connecting instance=${this.instanceId} socket=${socket.id}` +
        ` nickname=${nickname} clientInstanceId=${clientInstanceId ?? 'n/a'}` +
        ` playerCountBefore=${playerCountBefore} playersBefore=${playersBefore.join(',') || 'none'}`
      );

      if (clientInstanceId) {
        socket.data.clientInstanceId = clientInstanceId;
        this.replaceDuplicatePlayerSocket(clientInstanceId, socket.id);
      }

      if (this.room.playerCount >= this.room.maxPlayers) {
        console.warn(
          `[GameServer] room:full instance=${this.instanceId} socket=${socket.id}` +
          ` playerCount=${this.room.playerCount}`
        );
        socket.emit(SocketEvents.ROOM_FULL, { error: 'A sala já está cheia.' });
        socket.disconnect();
        return;
      }

      socket.join(this.roomName);
      this.room.addPlayer(socket.id, nickname);

      if (clientInstanceId) {
        this.playerSocketsByClientInstanceId.set(clientInstanceId, socket.id);
      }

      console.log(
        `[GameServer] player added instance=${this.instanceId} socket=${socket.id}` +
        ` nickname=${nickname} playerCountAfter=${this.room.playerCount}`
      );

      //── room:joined — confirma entrada na sala com apelido resolvido ─────
      socket.emit(SocketEvents.ROOM_JOINED, {
        playerId: socket.id,
        nickname,
      });

      //── Inicia a partida quando a sala está cheia ────────────────────────
      if (this.room.playerCount === this.room.maxPlayers) {
        this.loadCatalog().then(() => {
          const seed = this.room.generateSeed();
          this.room.initializeAnimals();
          this.lastGameOverPayload = null;

          this.io.to(this.roomName).emit(SocketEvents.GAME_START, {
            seed,
            players:   this.room.getPlayerIds(),
            nicknames: this.room.getNicknames(), //{ socketId: nickname }
          });

          this.io
            .to(this.roomName)
            .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
        });
      }

      this.registerPlayerEvents(socket);
    });
  }

  private getEliminationReason(player: {
    oxygen: number;
    hearts: number;
  }): 'oxygen' | 'hearts' {
    return player.oxygen <= 0 ? 'oxygen' : 'hearts';
  }

  private replaceDuplicatePlayerSocket(
    clientInstanceId: string,
    nextSocketId: string
  ): void {
    const previousSocketId =
      this.playerSocketsByClientInstanceId.get(clientInstanceId);

    if (!previousSocketId || previousSocketId === nextSocketId) return;

    console.log(
      `[GameServer] replacing duplicate clientInstanceId=${clientInstanceId}` +
      ` previousSocket=${previousSocketId} nextSocket=${nextSocketId}`
    );

    this.room.removePlayer(previousSocketId);
    this.io.sockets.sockets.get(previousSocketId)?.disconnect(true);
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

      const { animalId }  = data;
      const roomAnimal    = this.room.getAnimal(animalId);
      const catalogData   = this.room.findCatalogAnimal(animalId);

      if (!roomAnimal || !catalogData || roomAnimal.discovered) return;

      this.room.startPuzzle(animalId);
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
      const activeAnimalId = this.room.getActivePuzzleAnimalId();
      if (!activeAnimalId) return;
      if (data?.animalId !== activeAnimalId) return;

      this.room.confirmPuzzleEnd(socket.id);

      const animal = this.room.getAnimal(activeAnimalId);
      if (!animal || animal.discovered) {
        this.room.clearActivePuzzle();
        return;
      }

      animal.discovered  = true;
      const winnerSocketId =
        this.lastCorrectGuesses.get(activeAnimalId) || socket.id;
      animal.discoveredBy = winnerSocketId;
      this.lastCorrectGuesses.delete(activeAnimalId);
      this.room.clearActivePuzzle();

      console.log(
        `[GameServer] animal discovered animalId=${activeAnimalId}` +
        ` discoveredBy=${winnerSocketId}` +
        ` discoveredCount=${this.room.getDiscoveredAnimalCount()}` +
        ` totalAnimals=${this.room.getAnimalCount()}`
      );

      this.io.to(this.roomName).emit(SocketEvents.PUZZLE_RESULT, {
        animalId: activeAnimalId,
        correct:    true,
        positions:  [],
        letter:     '',
        completed:  true,
        discovered: true,
      });

      this.checkAllAnimalsDiscovered();
    });

    socket.on(SocketEvents.PLAYER_HIT, (_data: { obstacleType: string }) => {
      const player = this.room.getPlayer(socket.id);
      if (!player) return;

      player.hearts -= 1;
      this.io
        .to(this.roomName)
        .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
      this.checkPlayerDeath(socket.id);
    });

    socket.on(
      SocketEvents.PUZZLE_GUESS,
      async (data: { animalId: string; letter: string }) => {
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
            const animal = this.room.getAnimal(data.animalId);
            animal?.registerWrongGuess();
          } else {
            this.lastCorrectGuesses.set(data.animalId, socket.id);
          }

          this.io.to(this.roomName).emit(SocketEvents.PUZZLE_RESULT, {
            animalId:  data.animalId,
            correct:   result.correct,
            positions: result.positions,
            letter:    data.letter.toLowerCase(),
          });

          this.io
            .to(this.roomName)
            .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
          this.checkPlayerDeath(socket.id);
        } catch (error) {
          console.error('Erro ao validar chute:', error);
        }
      }
    );

    socket.on(
      SocketEvents.PUZZLE_HINT,
      async (data: { animalId: string; hintIndex: number }) => {
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
          this.io
            .to(this.roomName)
            .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());
          this.checkPlayerDeath(socket.id);
        } catch (error) {
          console.error('Erro ao solicitar dica:', error);
        }
      }
    );

    socket.on(SocketEvents.GAME_RESTART, () => {
      if (this.room.playerCount < this.room.maxPlayers) return;

      this.room.reset();
      const seed = this.room.generateSeed();

      this.io.to(this.roomName).emit(SocketEvents.GAME_START, {
        seed,
        players:   this.room.getPlayerIds(),
        nicknames: this.room.getNicknames(),
      });

      this.io
        .to(this.roomName)
        .emit(SocketEvents.STATE_UPDATE, this.room.getPlayers());

      console.log(`Jogo reiniciado. Nova seed: ${seed}`);
    });

    socket.on('disconnect', () => {
      const playerCountBefore = this.room.playerCount;
      console.log(
        `[GameServer] disconnected instance=${this.instanceId} socket=${socket.id}` +
        ` clientInstanceId=${socket.data.clientInstanceId ?? 'n/a'}` +
        ` playerCountBefore=${playerCountBefore}`
      );

      this.room.removePlayer(socket.id);
      this.removePlayerSocketMapping(socket);

      if (this.room.playerCount === 0) {
        this.room.clearAnimals();
        this.room.clearActivePuzzle();

        if (this.roomDestructionTimeout) {
          clearTimeout(this.roomDestructionTimeout);
          this.roomDestructionTimeout = null;
        }
        console.log('[GameServer] Sala vazia. Estado limpo.');
      } else if (this.room.playerCount === 1) {
        console.log(
          '[GameServer] Parceiro desconectou. Notificando jogador restante e iniciando timer de 10s.'
        );

        this.io.to(this.roomName).emit('partner:disconnected');

        this.roomDestructionTimeout = setTimeout(() => {
          console.log('[GameServer] Timeout de 10s atingido. Destruindo sala.');
          this.room.clearAnimals();
          this.room.clearActivePuzzle();
          this.io.in(this.roomName).disconnectSockets(true);
          this.roomDestructionTimeout = null;
        }, 10000);
      }
    });
  }

  private removePlayerSocketMapping(socket: Socket): void {
    const clientInstanceId = socket.data.clientInstanceId;

    if (
      typeof clientInstanceId === 'string' &&
      this.playerSocketsByClientInstanceId.get(clientInstanceId) === socket.id
    ) {
      this.playerSocketsByClientInstanceId.delete(clientInstanceId);
    }
  }

  //─── Entry point ──────────────────────────────────────────────────────────

  public listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`🎮 Game Service (Socket) rodando na porta ${port}`);
      console.log(
        `[GameServer] instance=${this.instanceId}` +
        ` corsOrigin=${this.formatCorsOrigin()}` +
        ` transports=websocket,polling` +
        ` authServiceUrl=${this.authServiceUrl}`
      );
    });
  }
}