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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.3,
      transports: ['polling', 'websocket'],
      upgrade: true,
      auth: {
        clientType: 'service',
        serviceName: 'score-service',
      },
    });
  
    this.client.on('connect', () => {
      console.log(`[GameBridge] conectado ao game-service transport=${this.client?.io.engine.transport.name}`);
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      // ✅ Request cached game:over in case we connected after it was emitted
      this.client?.emit('service:getLastGameOver');
    });
  
    this.client.io.on('reconnect', (attempt: number) => {
      console.log(`[GameBridge] reconectado após ${attempt} tentativa(s)`);
      // ✅ Also request on reconnect
      this.client?.emit('service:getLastGameOver');
    });

    this.client.on('disconnect', (reason) => {
      console.warn(`[GameBridge] desconectado do game-service. reason=${reason}`);
      // socket.io já reconecta automaticamente (reconnectionAttempts: Infinity)
      // mas logamos para visibilidade no Render
    });

    this.client.on('connect_error', (err: Error) => {
      console.error(`[GameBridge] connect_error: ${err.message}`);
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

  private lastProcessedGameOverId: string | null = null;

  private lastGameOverTime = 0; // Adicione isso como propriedade da classe

  private registerGameEvents(): void {
    if (!this.client) return;
  
    this.client.on('game:over', (payload: GameOverPayload) => {
      if (!payload.reason) {
        console.error('[GameBridge] game:over ignorado: payload sem reason');
        return;
      }
  
      // ✅ NOVA LÓGICA DE DEDUPLICAÇÃO (Por tempo, não por texto)
      const now = Date.now();
      if (now - this.lastGameOverTime < 3000) { // Bloqueia repetições num intervalo de 3s
        console.log('[GameBridge] game:over duplicado ignorado (dentro do cooldown)');
        return;
      }
      this.lastGameOverTime = now;
  
      try {
        const result = this.scoreService.processGameOver(payload);
        this.io.emit('game:result', result);
        console.log(`[GameBridge] game:result emitido reason=${result.reason} winner=${result.winner ?? 'n/a'}`);
      } catch (err) {
        console.error('[GameBridge] erro ao processar game:over:', err);
      }
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