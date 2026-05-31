import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

export interface PlayerMovePayload {
  x: number;
  y: number;
}

export interface PlayerMovedPayload extends PlayerMovePayload {
  id: string;
}

export interface PlayerIdentity {
  id: string;
}

export interface GameStartPayload {
  seed: number | string;
  players?: Array<string | PlayerIdentity>;
  playerIds?: string[];
  ids?: string[];
  animals?: AnimalStatePayload[];
}

export type RoomFullPayload = { message?: string } | string;

export interface AnimalApproachPayload {
  animalId: string;
}

export interface AnimalStatePayload {
  id: string;
  x: number;
  y: number;
  discovered?: boolean;
}

export interface PuzzleStartPayload {
  animalId: string;
  hiddenName: string | string[];
  hint1: string;
}

export interface PuzzleEndPayload {
  animalId: string;
}

export interface PuzzleGuessPayload {
  animalId: string;
  letter: string;
}

export interface PuzzleHintRequestPayload {
  animalId: string;
  hintIndex: number;
}

export interface PlayerHitPayload {
  obstacleType: string;
}

export interface PuzzleHintPayload {
  hint?: string;
  oxygen?: number;
  playerId?: string;
  socketId?: string;
  id?: string;
  affectedPlayerId?: string;
  deadPlayerId?: string;
  player?: { id?: string; playerId?: string };
  socket?: { id?: string };
}

export interface PuzzleResultPayload {
  correct: boolean;
  positions: number[];
  letter: string;
  animalId?: string;
  hiddenName?: string | string[];
  hidden_name?: string | string[];
  maskedName?: string | string[];
  nameMask?: string | string[];
  oxygen?: number;
  playerId?: string;
  socketId?: string;
  id?: string;
  affectedPlayerId?: string;
  deadPlayerId?: string;
  player?: { id?: string; playerId?: string };
  socket?: { id?: string };
  completed?: boolean;
  discovered?: boolean;
}

export interface PlayerStatePayload {
  id: string;
  x: number;
  y: number;
  hearts: number;
  oxygen: number;
  deathCount?: number;
}

export type StateUpdatePayload = Record<string, PlayerStatePayload>;

export interface PlayerGameOverPayload {
  playerId?: string;
  socketId?: string;
  id?: string;
  affectedPlayerId?: string;
  deadPlayerId?: string;
  player?: { id?: string; playerId?: string };
  socket?: { id?: string };
  oxygen?: number;
  hearts?: number;
  x?: number;
  y?: number;
  spawn?: { x: number; y: number };
  state?: StateUpdatePayload;
  players?: StateUpdatePayload;
}

export interface GameOverPayload {
  winner?: string | null;
  winnerId?: string | null;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Events produced by the backend and consumed by the Phaser client.
 *
 * `state:update` is the authoritative player snapshot for UI state such as
 * oxygen, hearts, respawn positions, and partner synchronization.
 */
interface ServerToClientEvents {
  "player:moved": (payload: PlayerMovedPayload) => void;
  "game:start": (payload: GameStartPayload) => void;
  "room:full": (payload?: RoomFullPayload) => void;
  "puzzle:start": (payload: PuzzleStartPayload) => void;
  "puzzle:result": (payload: PuzzleResultPayload) => void;
  "puzzle:hint": (payload: PuzzleHintPayload) => void;
  "state:update": (payload: StateUpdatePayload) => void;
  "player:gameover": (payload: PlayerGameOverPayload) => void;
  "game:over": (payload: GameOverPayload) => void;
}

/**
 * Events emitted by the frontend when the local player performs an action.
 *
 * Only local actions are sent from the client; remote player changes arrive
 * back through backend events such as `player:moved` and `state:update`.
 */
interface ClientToServerEvents {
  "player:move": (payload: PlayerMovePayload) => void;
  "animal:approach": (payload: AnimalApproachPayload) => void;
  "puzzle:end": (payload: PuzzleEndPayload) => void;
  "puzzle:guess": (payload: PuzzleGuessPayload) => void;
  "puzzle:hint": (payload: PuzzleHintRequestPayload) => void;
  "player:hit": (payload: PlayerHitPayload) => void;
  "game:restart": () => void;
}

/**
 * Central Socket.IO gateway used by frontend scenes and UI objects.
 *
 * The manager keeps Socket.IO details in one place, exposes typed emit/listen
 * methods, and preserves the last `state:update` so newly opened scenes can
 * initialize themselves with the latest backend-confirmed player state.
 */
export class SocketManager {
  private static instance: SocketManager;
  private static readonly clientInstanceStorageKey = "underwaterGameClientInstanceId";
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lastStateUpdate?: StateUpdatePayload;
  private isStateCacheBound = false;

  private constructor() {}

  /**
   * Returns the singleton socket manager shared by all Phaser scenes.
   */
  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }

    return SocketManager.instance;
  }

  /**
   * Opens or reuses the Socket.IO connection to the backend service.
   */
  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    const url = this.getServerUrl();

    if (!this.socket) {
      const auth = {
        clientType: "player",
        clientInstanceId: this.getClientInstanceId(),
      };

      console.log(`[SocketManager] connecting to game-service = ${url}`);
      this.socket = io(url, {
        auth,
      });
      this.socket.on("connect", () => {
        console.log(
          `[SocketManager] connected to game-service: ${this.socket?.id}`
        );
      });
      this.socket.on("connect_error", (error) => {
        console.error("[SocketManager] connect_error:", error.message);
      });
      this.bindStateCache();
    } else if (!this.socket.connected) {
      console.log(`[SocketManager] reconnecting to game-service = ${url}`);
      this.socket.connect();
      this.bindStateCache();
    }

    return this.socket;
  }

  /**
   * Current Socket.IO instance, including its id after the backend connects it.
   *
   * Scenes compare this id with event payloads to decide whether an update
   * belongs to the local player or to the remote partner.
   */
  public get currentSocket():
    | Socket<ServerToClientEvents, ClientToServerEvents>
    | undefined {
    return this.socket;
  }

  /**
   * Last authoritative state snapshot received from the backend.
   */
  public get currentState(): StateUpdatePayload | undefined {
    return this.lastStateUpdate;
  }

  public emitPlayerMove(payload: PlayerMovePayload): void {
    this.socket?.emit("player:move", payload);
  }

  public emitAnimalApproach(payload: AnimalApproachPayload): void {
    this.socket?.emit("animal:approach", payload);
  }

  public emitPuzzleEnd(payload: PuzzleEndPayload): void {
    this.socket?.emit("puzzle:end", payload);
  }

  public emitPuzzleGuess(payload: PuzzleGuessPayload): void {
    this.socket?.emit("puzzle:guess", payload);
  }

  public emitPuzzleHint(payload: PuzzleHintRequestPayload): void {
    this.socket?.emit("puzzle:hint", payload);
  }

  public emitPlayerHit(payload: PlayerHitPayload): void {
    this.socket?.emit("player:hit", payload);
  }

  /**
   * Requests a new match from the game-service.
   *
   * Restart is part of the real-time gameplay lifecycle, so the button in
   * EndScene emits `game:restart` through this game-service socket instead of
   * the score-service connection that only reports final scoring.
   */
  public emitGameRestart(): void {
    this.socket?.emit("game:restart");
  }

  public onPlayerMoved(
    handler: (payload: PlayerMovedPayload) => void
  ): () => void {
    const socket = this.connect();
    socket.on("player:moved", handler);
    return () => socket.off("player:moved", handler);
  }

  public onGameStart(handler: (payload: GameStartPayload) => void): () => void {
    const socket = this.connect();
    socket.on("game:start", handler);
    return () => socket.off("game:start", handler);
  }

  public onRoomFull(handler: (payload?: RoomFullPayload) => void): () => void {
    const socket = this.connect();
    socket.on("room:full", handler);
    return () => socket.off("room:full", handler);
  }

  public onPuzzleStart(
    handler: (payload: PuzzleStartPayload) => void
  ): () => void {
    const socket = this.connect();
    socket.on("puzzle:start", handler);
    return () => socket.off("puzzle:start", handler);
  }

  public onPuzzleResult(
    handler: (payload: PuzzleResultPayload) => void
  ): () => void {
    const socket = this.connect();
    socket.on("puzzle:result", handler);
    return () => socket.off("puzzle:result", handler);
  }

  public onPuzzleHint(handler: (payload: PuzzleHintPayload) => void): () => void {
    const socket = this.connect();
    socket.on("puzzle:hint", handler);
    return () => socket.off("puzzle:hint", handler);
  }

  public onStateUpdate(handler: (payload: StateUpdatePayload) => void): () => void {
    const socket = this.connect();
    const wrappedHandler = (payload: StateUpdatePayload): void => {
      // Keep a local snapshot so scenes launched after this event still start
      // from the backend's latest known state instead of a default HUD state.
      this.lastStateUpdate = payload;
      handler(payload);
    };
    socket.on("state:update", wrappedHandler);
    return () => socket.off("state:update", wrappedHandler);
  }

  public onPlayerGameOver(
    handler: (payload: PlayerGameOverPayload) => void
  ): () => void {
    const socket = this.connect();
    socket.on("player:gameover", handler);
    return () => socket.off("player:gameover", handler);
  }

  public onGameOver(handler: (payload: GameOverPayload) => void): () => void {
    const socket = this.connect();
    socket.on("game:over", handler);
    return () => socket.off("game:over", handler);
  }

  private getServerUrl(): string {
    const configuredUrl = import.meta.env.VITE_SOCKET_URL?.trim();

    console.log("[SocketManager] VITE_SOCKET_URL =", configuredUrl || "(not set)");

    if (configuredUrl) {
      return configuredUrl;
    }

    return this.getLocalFallbackUrl("VITE_SOCKET_URL", "game-service", 3001);
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
        `[SocketManager] ${envName} is required for deployed HTTPS frontends. ` +
        `Set it to the public HTTPS URL of the ${serviceName}.`;
      console.error(message);
      throw new Error(message);
    }

    return `http://${fallbackHost}:${port}`;
  }

  /**
   * Stable per-tab id sent to the game-service so duplicate sockets created by
   * frontend lifecycle/reload timing are not counted as separate real players.
   * A second browser tab gets its own sessionStorage and still counts as the
   * second player.
   */
  private getClientInstanceId(): string {
    try {
      const currentId = sessionStorage.getItem(
        SocketManager.clientInstanceStorageKey
      );

      if (currentId) {
        return currentId;
      }

      const nextId =
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      sessionStorage.setItem(SocketManager.clientInstanceStorageKey, nextId);

      return nextId;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }

  private bindStateCache(): void {
    if (!this.socket || this.isStateCacheBound) {
      return;
    }

    // This background listener makes the state cache independent from scene
    // subscriptions, which are removed whenever Phaser shuts a scene down.
    this.socket.on("state:update", (payload) => {
      this.lastStateUpdate = payload;
    });
    this.isStateCacheBound = true;
  }
}

export const socketManager = SocketManager.getInstance();
