"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameResult = void 0;
class GameResult {
    id;
    winner;
    reason;
    animalScores;
    playerSummaries;
    createdAt;
    constructor(winner, reason, animalScores, playerSummaries) {
        this.id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        this.winner = winner;
        this.reason = reason;
        this.animalScores = animalScores;
        this.playerSummaries = playerSummaries;
        this.createdAt = new Date();
    }
}
exports.GameResult = GameResult;
