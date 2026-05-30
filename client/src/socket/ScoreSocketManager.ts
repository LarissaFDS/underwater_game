import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

export type GameResultReason = "exploration" | "elimination" | string;

export interface AnimalScoreEntry {
  animalId?: string;
  discoveredBy?: string;
  pointsBase?: number;
  timeBonus?: number;
  wrongPenalty?: number;
  totalPoints?: number;
  [key: string]: unknown;
}

export interface PlayerScoreSummary {
  playerId?: string;
  id?: string;
  name?: string;
  totalPoints?: number;
  animalsFound?: number;
  [key: string]: unknown;
}

export interface GameResultPayload {
  id?: string;
  winner?: string | null;
  winnerId?: string | null;
  reason?: GameResultReason;
  eliminationReason?: "oxygen" | "hearts" | string;
  eliminatedPlayerId?: string;
  animalScores?: AnimalScoreEntry[];
  playerSummaries?: PlayerScoreSummary[];
  animalsFound?: number | AnimalScoreEntry[] | string[];
  scores?: unknown;
  createdAt?: string | Date;
  [key: string]: unknown;
}

interface ScoreServerToClientEvents {
  "game:result": (payload: GameResultPayload) => void;
}

interface ScoreClientToServerEvents {
  "score:getLatest": () => void;
}

/**
 * Socket.IO gateway for the score-service microservice.
 *
 * SocketManager remains responsible for game-service events such as movement,
 * puzzles, state updates, and restart. ScoreSocketManager only listens to the
 * score-service, whose `game:result` event is the backend-calculated final
 * score shown by the frontend.
 */
export class ScoreSocketManager {
  private static instance: ScoreSocketManager;
  private socket?: Socket<ScoreServerToClientEvents, ScoreClientToServerEvents>;

  private constructor() {}

  public static getInstance(): ScoreSocketManager {
    if (!ScoreSocketManager.instance) {
      ScoreSocketManager.instance = new ScoreSocketManager();
    }

    return ScoreSocketManager.instance;
  }

  /**
   * Opens or reuses the Socket.IO connection to the score-service.
   */
  public connect(): Socket<ScoreServerToClientEvents, ScoreClientToServerEvents> {
    const url = this.getScoreServerUrl();

    if (!this.socket) {
      console.log("[ScoreSocketManager] connecting to score-service", url);
      this.socket = io(url);
      this.socket.on("connect", () => {
        console.log(
          "[ScoreSocketManager] connected to score-service",
          this.socket?.id,
          url
        );
      });
    } else if (!this.socket.connected) {
      this.socket.connect();
    }

    return this.socket;
  }

  /**
   * Subscribes to final match results calculated by the score-service.
   */
  public onGameResult(
    handler: (payload: GameResultPayload) => void
  ): () => void {
    const socket = this.connect();
    socket.on("game:result", handler);
    return () => socket.off("game:result", handler);
  }

  private getScoreServerUrl(): string {
    const meta = import.meta as ImportMeta & {
      env?: {
        VITE_SCORE_URL?: string;
      };
    };
    const fallbackHost =
      typeof window === "undefined" ? "localhost" : window.location.hostname;

    return meta.env?.VITE_SCORE_URL?.trim() || `http://${fallbackHost}:3003`;
  }
}

export const scoreSocketManager = ScoreSocketManager.getInstance();
