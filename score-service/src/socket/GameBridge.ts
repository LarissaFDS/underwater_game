import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as IoServer } from 'socket.io';
import { ScoreService } from '../services/ScoreService';
import { GameOverPayload } from '../dtos/ScoreDTO';

export class GameBridge {
  private client: ClientSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private readonly io: IoServer,
    private readonly scoreService: ScoreService,
    private readonly gameServiceUrl: string
  ) {}

  connect(): void {
    if (this.destroyed) return;

    this.client = ioClient(this.gameServiceUrl, {
      reconnection: true,
      reconnectionAttempts: Infinity,   // nunca desiste no Render
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.3,
      // Força polling primeiro — mais estável atrás de proxy reverso Render
      // O upgrade para websocket acontece automaticamente se disponível
      transports: ['polling', 'websocket'],
      upgrade: true,
      // Keepalive: evita que a conexão seja morta por idle no Render (30s timeout)
      auth: {
        clientType: 'service',
        serviceName: 'score-service',
      },
    });

    this.client.on('connect', () => {
      console.log(
        `[GameBridge] conectado ao game-service em ${this.gameServiceUrl} transport=${this.client?.io.engine.transport.name}`
      );
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
    });

    this.client.on('disconnect', (reason) => {
      console.warn(`[GameBridge] desconectado do game-service. reason=${reason}`);
      // socket.io já reconecta automaticamente (reconnectionAttempts: Infinity)
      // mas logamos para visibilidade no Render
    });

    this.client.on('connect_error', (err: Error) => {
      console.error(`[GameBridge] connect_error: ${err.message}`);
    });

    this.client.io.on('reconnect', (attempt: number) => {
      console.log(`[GameBridge] reconectado após ${attempt} tentativa(s)`);
    });

    this.client.io.on('reconnect_failed', () => {
      // reconnectionAttempts: Infinity — nunca chega aqui, mas defensivamente:
      console.error('[GameBridge] reconnect_failed — agendando retry manual');
      this.scheduleManualReconnect();
    });

    this.registerGameEvents();
  }

  private scheduleManualReconnect(): void {
    if (this.destroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[GameBridge] tentando reconexão manual...');
      this.client?.connect();
    }, 15000);
  }

  private registerGameEvents(): void {
    if (!this.client) return;

    this.client.on('game:over', (payload: GameOverPayload) => {
      console.log(
        `[GameBridge] game:over recebido reason=${payload.reason} winner=${payload.winner ?? 'n/a'} players=${Object.keys(payload.players ?? {}).join(',') || 'none'} discoveredAnimals=${payload.discoveredAnimals?.length ?? 0}`
      );

      // Valida payload mínimo antes de processar
      if (!payload.reason) {
        console.error('[GameBridge] game:over ignorado: payload sem reason', payload);
        return;
      }

      try {
        const result = this.scoreService.processGameOver(payload);
        this.io.emit('game:result', result);
        console.log(
          `[GameBridge] game:result emitido reason=${result.reason} winner=${result.winner ?? 'n/a'} animalScores=${result.animalScores.length} playerSummaries=${result.playerSummaries.length}`
        );
      } catch (err) {
        console.error('[GameBridge] erro ao processar game:over:', err);
      }
    });

    this.client.on('game:start', () => {
      console.log('[GameBridge] game:start recebido — nova partida iniciada.');
    });
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.client?.disconnect();
  }
}