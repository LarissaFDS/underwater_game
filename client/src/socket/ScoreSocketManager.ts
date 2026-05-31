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
  private hasLoggedReconnectFailure = false;

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
      console.log(`[ScoreSocketManager] connecting to score-service = ${url}`);
      this.socket = io(url, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
        transports: ["websocket", "polling"],
      });
      this.socket.on("connect", () => {
        this.hasLoggedReconnectFailure = false;
        console.log(
          `[ScoreSocketManager] connected to score-service: ${this.socket?.id}`
        );
        this.requestLatestResult();
      });
      this.socket.on("connect_error", (error) => {
        console.error("[ScoreSocketManager] connect_error:", error.message);
      });
      this.socket.io.on("reconnect_failed", () => {
        if (this.hasLoggedReconnectFailure) {
          return;
        }

        this.hasLoggedReconnectFailure = true;
        console.error(
          "[ScoreSocketManager] reconnect_failed: score-service unavailable after retry limit"
        );
      });
    } else if (!this.socket.connected) {
      console.log(`[ScoreSocketManager] reconnecting to score-service = ${url}`);
      this.socket.connect();
    }

    return this.socket;
  }

  public requestLatestResult(): void {
    const socket = this.connect();

    if (socket.connected) {
      socket.emit("score:getLatest");
    }
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
    const configuredUrl = import.meta.env.VITE_SCORE_URL?.trim();

    console.log(
      "[ScoreSocketManager] VITE_SCORE_URL =",
      configuredUrl || "(not set)"
    );

    if (configuredUrl) {
      return configuredUrl;
    }

    return this.getLocalFallbackUrl("VITE_SCORE_URL", "score-service", 3003);
  }

  private getLocalFallbackUrl(
    envName: string,
    serviceName: string,
    port: number
  ): string {
    const fallbackHost =
      typeof window === "undefined" ? "localhost" : window.location.hostname;
    const pageProtocol =
      typeof window === "undefined" ? "http:" : window.location.protocol;
    const isLocalHost = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "::1",
      "[::1]",
    ].includes(fallbackHost);

    if (pageProtocol === "https:" && !isLocalHost) {
      const message =
        `[ScoreSocketManager] ${envName} is required for deployed HTTPS frontends. ` +
        `Set it to the public HTTPS URL of the ${serviceName}.`;
      console.error(message);
      throw new Error(message);
    }

    return `http://${fallbackHost}:${port}`;
  }
}

export const scoreSocketManager = ScoreSocketManager.getInstance();
