import { GameResult } from '../models/GameResult';

export class GameResultRepository {
  private readonly results: Map<string, GameResult> = new Map();

  save(result: GameResult): void {
    this.results.set(result.id, result);
  }

  findById(id: string): GameResult | undefined {
    return this.results.get(id);
  }

  findAll(): GameResult[] {
    return Array.from(this.results.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  findLatest(): GameResult | undefined {
    return this.findAll()[0];
  }
}