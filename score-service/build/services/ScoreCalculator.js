"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreCalculator = void 0;
// ----Regras de pontuação----
//cada segundo abaixo de 60 s vale +1 pt (máx +30)
//cada erro perde 3 pts (mín 0)
//Total nunca é negativo
class ScoreCalculator {
    static TIME_BONUS_THRESHOLD_MS = 60_000;
    static TIME_BONUS_PER_SEC = 1;
    static MAX_TIME_BONUS = 30;
    static WRONG_GUESS_PENALTY = 3;
    calculateAnimalScore(raw) {
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
    calculatePlayerSummaries(animalScores) {
        const summaryMap = new Map();
        for (const entry of animalScores) {
            const existing = summaryMap.get(entry.discoveredBy);
            if (existing) {
                existing.totalPoints += entry.totalPoints;
                existing.animalsFound += 1;
            }
            else {
                summaryMap.set(entry.discoveredBy, {
                    playerId: entry.discoveredBy,
                    totalPoints: entry.totalPoints,
                    animalsFound: 1,
                });
            }
        }
        return Array.from(summaryMap.values()).sort((a, b) => b.totalPoints - a.totalPoints);
    }
    calcTimeBonus(ms) {
        const remaining = ScoreCalculator.TIME_BONUS_THRESHOLD_MS - ms;
        if (remaining <= 0)
            return 0;
        const bonusSeconds = Math.floor(remaining / 1000);
        return Math.min(bonusSeconds * ScoreCalculator.TIME_BONUS_PER_SEC, ScoreCalculator.MAX_TIME_BONUS);
    }
}
exports.ScoreCalculator = ScoreCalculator;
