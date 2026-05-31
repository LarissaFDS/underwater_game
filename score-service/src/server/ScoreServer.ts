import http from 'http';
import express, { Application, Request, Response } from 'express';
import { Server as IoServer } from 'socket.io';
import cors, { type CorsOptions } from 'cors';

import { GameResultRepository } from '../repositories/GameResultRepository';
import { ScoreCalculator } from '../services/ScoreCalculator';
import { ScoreService } from '../services/ScoreService';
import { ScoreController } from '../controllers/ScoreController';
import { GameBridge } from '../socket/GameBridge';
import { buildRouter } from '../routes';

export class ScoreServer {
  private readonly app: Application;
  private readonly server: http.Server;
  private readonly io: IoServer;
  private readonly scoreService: ScoreService;
  private readonly bridge: GameBridge;
  private readonly allowedOrigins: string[];
  private readonly corsOptions: CorsOptions;

  constructor() {
    //Infraestrutura
    this.app = express();
    this.server = http.createServer(this.app);
    this.allowedOrigins = this.resolveAllowedOrigins();
    this.corsOptions = {
      origin: this.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    };

    this.io = new IoServer(this.server, {
      path: '/socket.io',
      cors: this.corsOptions,
      transports: ['polling', 'websocket'],
    });

    //Composição das dependências (IoC manual)
    const repo = new GameResultRepository();
    const calculator = new ScoreCalculator();
    this.scoreService = new ScoreService(repo, calculator);

    const gameServiceUrl =
      process.env.GAME_SERVICE_URL || 'http://localhost:3001';

    this.bridge = new GameBridge(this.io, this.scoreService, gameServiceUrl);

    //Setup
    this.setupMiddlewares();
    this.setupHttpRoutes();
    this.setupSocketHandlers();
  }

  private setupMiddlewares(): void {
    this.app.use(cors(this.corsOptions));
    this.app.use(express.json());
  }

  private setupHttpRoutes(): void {
    const controller = new ScoreController(this.scoreService);

    this.app.use('/api', buildRouter(controller));

    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'score-service' });
    });

    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        service: 'score-service',
        socketPath: '/socket.io',
      });
    });
  }

  private resolveAllowedOrigins(): string[] {
    const defaultOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://underwater-game.onrender.com',
    ];
    const rawOrigins = [
      process.env.CLIENT_URL,
      process.env.CORS_ORIGIN,
      process.env.CORS_ORIGINS,
      process.env.FRONTEND_ORIGIN,
    ]
      .filter(Boolean)
      .join(',');

    if (!rawOrigins) {
      return defaultOrigins;
    }

    return Array.from(
      new Set([
        ...defaultOrigins,
        ...rawOrigins
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ])
    );
  }

  private formatHeader(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    return value ?? 'n/a';
  }

  private setupSocketHandlers(): void {
    this.io.engine.on('connection_error', (error) => {
      const origin = this.formatHeader(error.req?.headers.origin);
      console.error(
        `[ScoreServer] connect_error origin=${origin} code=${error.code} message=${error.message}`
      );
    });

    this.io.on('connection', (socket) => {
      const origin = this.formatHeader(socket.handshake.headers.origin);
      console.log(
        `[ScoreServer] Frontend connected to score-service socket=${socket.id} origin=${origin}`
      );

      //Cliente pode pedir o resultado mais recente ao (re)conectar
      socket.on('score:getLatest', () => {
        const latest = this.scoreService.getLatestResult();
        if (latest) socket.emit('game:result', latest);
      });

      socket.on('disconnect', () => {
        console.log(`[ScoreServer] client disconnected socket=${socket.id}`);
      });
    });
  }

  public listen(port: number): void {
    this.bridge.connect();

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`Score Service listening on port ${port}`);
      console.log('Socket.IO ready on /socket.io');
      console.log(`[ScoreServer] allowedOrigins=${this.allowedOrigins.join(', ')}`);
      console.log('[ScoreServer] transports=polling,websocket');
    });
  }
}
