import {
  DiscoveredAnimalRaw,
  GameOverPayload,
  GameResultPayload,
  RawPlayerState,
} from '../dtos/ScoreDTO';
import { GameResult } from '../models/GameResult';
import { GameResultRepository } from '../repositories/GameResultRepository';
import { ScoreCalculator } from './ScoreCalculator';

export class ScoreService {
  constructor(
    private readonly repo: GameResultRepository,
    private readonly calculator: ScoreCalculator
  ) {}

  // Recebe o payload bruto de game:over, calcula pontuações, persiste e retorna o GameResultPayload pronto para emitir ao cliente.
  processGameOver(payload: GameOverPayload): GameResultPayload {
    const normalizedPayload = this.normalizeGameOverPayload(payload);
    const animalScores = normalizedPayload.discoveredAnimals.map((raw) =>
      this.calculator.calculateAnimalScore(raw)
    );

    const playerSummaries = this.includePlayersWithoutAnimalScores(
      this.calculator.calculatePlayerSummaries(animalScores),
      normalizedPayload.players
    );

    const result = new GameResult(
      normalizedPayload.winner,
      normalizedPayload.reason,
      animalScores,
      playerSummaries
    );

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

  getLatestResult(): GameResult | undefined {
    return this.repo.findLatest();
  }

  getAllResults(): GameResult[] {
    return this.repo.findAll();
  }

  getResultById(id: string): GameResult | undefined {
    return this.repo.findById(id);
  }

  private includePlayersWithoutAnimalScores(
    playerSummaries: GameResultPayload['playerSummaries'],
    players: GameOverPayload['players']
  ): GameResultPayload['playerSummaries'] {
    const playerRecord = this.normalizePlayers(players);
    const knownPlayers = new Set(
      playerSummaries.map((summary) => summary.playerId)
    );

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

  private normalizeGameOverPayload(payload: GameOverPayload): GameOverPayload {
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

  private normalizePlayers(
    players: GameOverPayload['players'] | undefined
  ): Record<string, RawPlayerState> {
    if (!players) {
      return {};
    }

    if (Array.isArray(players)) {
      return Object.fromEntries(
        players
          .map((player) => {
            // Tenta achar o ID seja qual for o nome da propriedade que o game-service usou
            const id = player?.id || player?.playerId || player?.socketId;
            return id ? [id, player] : null;
          })
          .filter(Boolean) as [string, RawPlayerState][]
      );
    }

    return players;
  }
  
  private normalizeDiscoveredAnimals(
    discoveredAnimals: DiscoveredAnimalRaw[] | undefined
  ): DiscoveredAnimalRaw[] {
    if (!Array.isArray(discoveredAnimals)) {
      return [];
    }

    return discoveredAnimals.map((animal) => ({
      animalId: animal.animalId,
      discoveredBy: animal.discoveredBy,
      timeToDiscoverMs:
        animal.timeToDiscoverMs ?? animal.elapsedMs ?? animal.timeMs ?? 0,
      wrongGuesses: animal.wrongGuesses ?? 0,
      pointsBase: animal.pointsBase ?? animal.basePoints ?? 0,
    }));
  }
}
