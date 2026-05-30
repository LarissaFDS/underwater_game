import { GameOverPayload, GameResultPayload } from '../dtos/ScoreDTO';
import { GameResult } from '../models/GameResult';
import { GameResultRepository } from '../repositories/GameResultRepository';
import { ScoreCalculator } from './ScoreCalculator';

export class ScoreService {
  constructor(
    private readonly repo: GameResultRepository,
    private readonly calculator: ScoreCalculator
  ) {}

    //Recebe o payload bruto de game:over, calcula pontuações, persiste e retorna o GameResultPayload pronto para emitir ao cliente.
  processGameOver(payload: GameOverPayload): GameResultPayload {
    const animalScores = payload.discoveredAnimals.map((raw) =>
      this.calculator.calculateAnimalScore(raw)
    );

    const playerSummaries =
      this.calculator.calculatePlayerSummaries(animalScores);

    const result = new GameResult(
      payload.winner,
      payload.reason,
      animalScores,
      playerSummaries
    );

    this.repo.save(result);

    return {
      winner: result.winner,
      reason: result.reason,
      animalScores: result.animalScores,
      playerSummaries: result.playerSummaries,
    };
  }

  getLatestResult(): GameResult | undefined {
    return this.repo.findLatest();
  }

  getAllResults(): GameResult[] {
    return this.repo.findAll();
  }

  getResultById(id: string): GameResult | undefined {
    return this.repo.findById(id);
  }
}