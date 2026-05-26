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
  playerId: string;
  socketId?: string;
  id?: string;
  x?: number;
  y?: number;
  spawn?: { x: number; y: number };
  state?: StateUpdatePayload;
  players?: StateUpdatePayload;
}

export interface GameOverPayload {
  winner?: string;
  winnerId?: string;
}

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

interface ClientToServerEvents {
  "player:move": (payload: PlayerMovePayload) => void;
  "animal:approach": (payload: AnimalApproachPayload) => void;
  "puzzle:end": (payload: PuzzleEndPayload) => void;
  "puzzle:guess": (payload: PuzzleGuessPayload) => void;
  "puzzle:hint": (payload: PuzzleHintRequestPayload) => void;
  "player:hit": (payload: PlayerHitPayload) => void;
}

export class SocketManager {
  private static instance: SocketManager;
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;
  private lastStateUpdate?: StateUpdatePayload;
  private isStateCacheBound = false;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }

    return SocketManager.instance;
  }

  public connect(): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      this.socket = io(this.getServerUrl());
      this.bindStateCache();
    } else if (!this.socket.connected) {
      this.socket.connect();
      this.bindStateCache();
    }

    return this.socket;
  }

  public get currentSocket():
    | Socket<ServerToClientEvents, ClientToServerEvents>
    | undefined {
    return this.socket;
  }

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
    const meta = import.meta as ImportMeta & {
      env?: Record<string, string | undefined>;
    };
    // return meta.env?.VITE_SOCKET_URL ?? "http://localhost:3001"; // teste para o mesmo pc
    return (
    meta.env?.VITE_SOCKET_URL ??
    `http://${window.location.hostname}:3001` // teste para computadores diferentes na mesma rede local
  );

  }

  private bindStateCache(): void {
    if (!this.socket || this.isStateCacheBound) {
      return;
    }

    this.socket.on("state:update", (payload) => {
      this.lastStateUpdate = payload;
    });
    this.isStateCacheBound = true;
  }
}

export const socketManager = SocketManager.getInstance();
