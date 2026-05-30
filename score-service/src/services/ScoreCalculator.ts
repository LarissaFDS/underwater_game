import {
    AnimalScoreEntry,
    DiscoveredAnimalRaw,
    PlayerScoreSummary,
  } from '../dtos/ScoreDTO';
  
    // ----Regras de pontuação----
    //cada segundo abaixo de 60 s vale +1 pt (máx +30)
    //cada erro perde 3 pts (mín 0)
    //Total nunca é negativo
  export class ScoreCalculator {
    private static readonly TIME_BONUS_THRESHOLD_MS = 60_000;
    private static readonly TIME_BONUS_PER_SEC = 1;
    private static readonly MAX_TIME_BONUS = 30;
    private static readonly WRONG_GUESS_PENALTY = 3;
  
    calculateAnimalScore(raw: DiscoveredAnimalRaw): AnimalScoreEntry {
      const timeBonus = this.calcTimeBonus(raw.timeToDiscoverMs);
      const wrongPenalty = raw.wrongGuesses * ScoreCalculator.WRONG_GUESS_PENALTY;
      const totalPoints = Math.max(0, raw.pointsBase + timeBonus - wrongPenalty);
  
      return {
        animalId: raw.animalId,
        discoveredBy: raw.discoveredBy,
        timeToDiscoverMs: raw.timeToDiscoverMs,
        wrongGuesses: raw.wrongGuesses,
        pointsBase: raw.pointsBase,
        timeBonus,
        wrongPenalty,
        totalPoints,
      };
    }
  
    calculatePlayerSummaries(
      animalScores: AnimalScoreEntry[]
    ): PlayerScoreSummary[] {
      const summaryMap = new Map<string, PlayerScoreSummary>();
  
      for (const entry of animalScores) {
        const existing = summaryMap.get(entry.discoveredBy);
        if (existing) {
          existing.totalPoints += entry.totalPoints;
          existing.animalsFound += 1;
        } else {
          summaryMap.set(entry.discoveredBy, {
            playerId: entry.discoveredBy,
            totalPoints: entry.totalPoints,
            animalsFound: 1,
          });
        }
      }
  
      return Array.from(summaryMap.values()).sort(
        (a, b) => b.totalPoints - a.totalPoints
      );
    }
  
    private calcTimeBonus(ms: number): number {
      const remaining = ScoreCalculator.TIME_BONUS_THRESHOLD_MS - ms;
      if (remaining <= 0) return 0;
  
      const bonusSeconds = Math.floor(remaining / 1000);
      return Math.min(
        bonusSeconds * ScoreCalculator.TIME_BONUS_PER_SEC,
        ScoreCalculator.MAX_TIME_BONUS
      );
    }
  }