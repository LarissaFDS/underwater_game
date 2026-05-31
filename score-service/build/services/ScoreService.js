"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreService = void 0;
const GameResult_1 = require("../models/GameResult");
class ScoreService {
    repo;
    calculator;
    constructor(repo, calculator) {
        this.repo = repo;
        this.calculator = calculator;
    }
    // Recebe o payload bruto de game:over, calcula pontuações, persiste e retorna o GameResultPayload pronto para emitir ao cliente.
    processGameOver(payload) {
        const normalizedPayload = this.normalizeGameOverPayload(payload);
        const animalScores = normalizedPayload.discoveredAnimals.map((raw) => this.calculator.calculateAnimalScore(raw));
        const playerSummaries = this.includePlayersWithoutAnimalScores(this.calculator.calculatePlayerSummaries(animalScores), normalizedPayload.players);
        const result = new GameResult_1.GameResult(normalizedPayload.winner, normalizedPayload.reason, animalScores, playerSummaries);
        this.repo.save(result);
        return {
            winner: result.winner,
            reason: result.reason,
            eliminationReason: normalizedPayload.eliminationReason,
            eliminatedPlayerId: normalizedPayload.eliminatedPlayerId,
            animalScores: result.animalScores,
            playerSummaries: result.playerSummaries,
        };
    }
    getLatestResult() {
        return this.repo.findLatest();
    }
    getAllResults() {
        return this.repo.findAll();
    }
    getResultById(id) {
        return this.repo.findById(id);
    }
    includePlayersWithoutAnimalScores(playerSummaries, players) {
        const playerRecord = this.normalizePlayers(players);
        const knownPlayers = new Set(playerSummaries.map((summary) => summary.playerId));
        Object.keys(playerRecord).forEach((playerId) => {
            if (!knownPlayers.has(playerId)) {
                playerSummaries.push({
                    playerId,
                    totalPoints: 0,
                    animalsFound: 0,
                });
            }
        });
        return playerSummaries;
    }
    normalizeGameOverPayload(payload) {
        if (!payload || typeof payload !== 'object') {
            throw new Error('[ScoreService] Invalid game:over payload: payload object is required');
        }
        if (payload.reason !== 'elimination' && payload.reason !== 'exploration') {
            console.error('[ScoreService] Invalid game:over payload: missing or invalid reason', payload);
            throw new Error('[ScoreService] Invalid game:over payload: reason must be "elimination" or "exploration"');
        }
        return {
            winner: payload.winner ?? null,
            reason: payload.reason,
            eliminationReason: payload.eliminationReason,
            eliminatedPlayerId: payload.eliminatedPlayerId,
            players: this.normalizePlayers(payload.players),
            discoveredAnimals: this.normalizeDiscoveredAnimals(payload.discoveredAnimals),
        };
    }
    normalizePlayers(players) {
        if (!players) {
            return {};
        }
        if (Array.isArray(players)) {
            return Object.fromEntries(players
                .filter((player) => player?.id)
                .map((player) => [player.id, player]));
        }
        return players;
    }
    normalizeDiscoveredAnimals(discoveredAnimals) {
        if (!Array.isArray(discoveredAnimals)) {
            return [];
        }
        return discoveredAnimals.map((animal) => ({
            animalId: animal.animalId,
            discoveredBy: animal.discoveredBy,
            timeToDiscoverMs: animal.timeToDiscoverMs ?? animal.elapsedMs ?? animal.timeMs ?? 0,
            wrongGuesses: animal.wrongGuesses ?? 0,
            pointsBase: animal.pointsBase ?? animal.basePoints ?? 0,
        }));
    }
}
exports.ScoreService = ScoreService;
