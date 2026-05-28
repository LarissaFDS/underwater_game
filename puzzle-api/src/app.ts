import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { AnimalRepository } from './repositories/AnimalRepository';
import { PuzzleService } from './services/PuzzleService';
import { PuzzleController } from './controllers/PuzzleController';
import { buildRouter } from './routes';

export class App {
  private readonly app: Application;

  constructor() {
    this.app = express();
    this.setupMiddlewares();
    this.setupRoutes();
  }

  private setupMiddlewares(): void {
    this.app.use(cors());
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    const repo = new AnimalRepository();
    const service = new PuzzleService(repo);
    const controller = new PuzzleController(service);

    this.app.use('/api', buildRouter(controller));

    this.app.get('/', (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', service: 'ocean-puzzle-api' });
    });
  }

  public listen(port: number): void {
    this.app.listen(port, '0.0.0.0', () => {
      console.log(`🧩 Puzzle API Microsserviço rodando na porta ${port}`);
    });
  }
}