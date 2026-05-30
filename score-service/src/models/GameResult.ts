import { AnimalScoreEntry, PlayerScoreSummary } from '../dtos/ScoreDTO';

export class GameResult {
  readonly id: string;
  readonly winner: string | null;
  readonly reason: 'elimination' | 'exploration';
  readonly animalScores: AnimalScoreEntry[];
  readonly playerSummaries: PlayerScoreSummary[];
  readonly createdAt: Date;

  constructor(
    winner: string | null,
    reason: 'elimination' | 'exploration',
    animalScores: AnimalScoreEntry[],
    playerSummaries: PlayerScoreSummary[]
  ) {
    this.id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.winner = winner;
    this.reason = reason;
    this.animalScores = animalScores;
    this.playerSummaries = playerSummaries;
    this.createdAt = new Date();
  }
}