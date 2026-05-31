import { Request, Response } from 'express';
import { ScoreService } from '../services/ScoreService';

export class ScoreController {
  constructor(private readonly scoreService: ScoreService) {}

  getLatest = (_req: Request, res: Response): void => {
    const result = this.scoreService.getLatestResult();

    if (!result) {
      // Retorna 200 com null. O frontend vai ler esse null sem disparar erro no console.
      res.status(200).json(null);
      return;
    }

    res.json(result);
  };

  getAll = (_req: Request, res: Response): void => {
    res.json(this.scoreService.getAllResults());
  };

  getById = (req: Request, res: Response): void => {
    const { id } = req.params;
    const result = this.scoreService.getResultById(id);

    if (!result) {
      res.status(404).json({ error: `Resultado ${id} não encontrado.` });
      return;
    }

    res.json(result);
  };
}