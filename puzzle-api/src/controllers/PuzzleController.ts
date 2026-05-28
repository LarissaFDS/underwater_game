import { Request, Response } from 'express';
import { PuzzleService } from '../services/PuzzleService';

export class PuzzleController {
  constructor(private readonly puzzleService: PuzzleService) {}

  getAnimals = (_req: Request, res: Response): void => {
    res.json(this.puzzleService.getHiddenAnimals());
  };

  guess = (req: Request, res: Response): void => {
    const { animalId, letter } = req.body;

    if (!animalId || !letter || letter.length !== 1) {
      res.status(400).json({ error: 'Campos animalId e letter são obrigatórios.' });
      return;
    }

    const result = this.puzzleService.guess(animalId, letter);

    if (!result) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    res.json(result);
  };

  hint = (req: Request, res: Response): void => {
    const { animalId, hintIndex } = req.body;

    if (!animalId || typeof hintIndex !== 'number') {
      res.status(400).json({ error: 'Campos animalId e hintIndex são obrigatórios.' });
      return;
    }

    const result = this.puzzleService.hint(animalId, hintIndex);

    if (!result) {
      res.status(404).json({ error: 'Animal não encontrado.' });
      return;
    }

    res.json(result);
  };
}