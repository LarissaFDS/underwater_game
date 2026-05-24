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

interface ServerToClientEvents {
  "player:moved": (payload: PlayerMovedPayload) => void;
  "game:start": (payload: GameStartPayload) => void;
  "room:full": (payload?: RoomFullPayload) => void;
  "puzzle:start": (payload: PuzzleStartPayload) => void;
}

interface ClientToServerEvents {
  "player:move": (payload: PlayerMovePayload) => void;
  "animal:approach": (payload: AnimalApproachPayload) => void;
  "puzzle:end": (payload: PuzzleEndPayload) => void;
}

export class SocketManager {
  private static instance: SocketManager;
  private socket?: Socket<ServerToClientEvents, ClientToServerEvents>;

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
    } else if (!this.socket.connected) {
      this.socket.connect();
    }

    return this.socket;
  }

  public get currentSocket():
    | Socket<ServerToClientEvents, ClientToServerEvents>
    | undefined {
    return this.socket;
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
}

export const socketManager = SocketManager.getInstance();
