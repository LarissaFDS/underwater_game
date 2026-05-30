import http from 'http';
import express, { Application, Request, Response } from 'express';
import { Server as IoServer } from 'socket.io';
import cors from 'cors';

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

  constructor() {
    //Infraestrutura
    this.app = express();
    this.server = http.createServer(this.app);

    this.io = new IoServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
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
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupHttpRoutes(): void {
    const controller = new ScoreController(this.scoreService);

    this.app.use('/api', buildRouter(controller));

    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'ocean-score-service' });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log(`Cliente conectado ao score-service: ${socket.id}`);

      //Cliente pode pedir o resultado mais recente ao (re)conectar
      socket.on('score:getLatest', () => {
        const latest = this.scoreService.getLatestResult();
        if (latest) socket.emit('game:result', latest);
      });

      socket.on('disconnect', () => {
        console.log(`Cliente desconectado do score-service: ${socket.id}`);
      });
    });
  }

  public listen(port: number): void {
    this.bridge.connect();

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`Score Service rodando na porta ${port}`);
    });
  }
}