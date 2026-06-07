import http from 'http';
import express, { type Application, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import { TokenRepository } from '../repositories/TokenRepository';
import { AuthService } from '../services/AuthService';
import { AuthController } from '../controllers/AuthController';
import { buildRouter } from '../routes';

export class AuthServer {
  private readonly app: Application;
  private readonly server: http.Server;
  private readonly allowedOrigins: string[];
  private readonly corsOptions: CorsOptions;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.allowedOrigins = this.resolveAllowedOrigins();
    this.corsOptions = {
      origin: this.allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    };
    this.setupMiddlewares();
    this.setupRoutes();
  }

private setupMiddlewares(): void {
  this.app.use(cors(this.corsOptions));
  this.app.options('*', cors(this.corsOptions));
  this.app.use(express.json());
}

  private setupRoutes(): void {
    //Composição de dependências (IoC manual), mesmo padrão dos outros serviços.
    const repo       = new TokenRepository();
    const service    = new AuthService(repo);
    const controller = new AuthController(service);

    this.app.use('/api', buildRouter(controller));

    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'auth-service' });
    });

    this.app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        service: 'auth-service',
        activeTokens: repo.count(),
      });
    });
  }

  private resolveAllowedOrigins(): string[] {
    const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://underwatergame.vercel.app',
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

    if (!rawOrigins) return defaultOrigins;

    return Array.from(
      new Set([
        ...defaultOrigins,
        ...rawOrigins
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean),
      ])
    );
  }

  public listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`Auth Service listening on port ${port}`);
      console.log(`[AuthServer] allowedOrigins=${this.allowedOrigins.join(', ')}`);
    });
  }
}