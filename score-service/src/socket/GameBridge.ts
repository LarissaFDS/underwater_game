import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as IoServer } from 'socket.io';
import { ScoreService } from '../services/ScoreService';
import { GameOverPayload } from '../dtos/ScoreDTO';


// Consome game:over do game-service e publica game:result calculado para os clientes do score-service.
export class GameBridge {
  private client: ClientSocket | null = null;

  constructor(
    private readonly io: IoServer,
    private readonly scoreService: ScoreService,
    private readonly gameServiceUrl: string
  ) {}

  connect(): void {
    this.client = ioClient(this.gameServiceUrl, {
      reconnection: true,
      reconnectionDelay: 2000,
      transports: ['polling', 'websocket'],
      auth: {
        clientType: 'service',
        serviceName: 'score-service',
      },
    });

    this.client.on('connect', () => {
      console.log(
        `GameBridge conectado ao game-service em ${this.gameServiceUrl}`
      );
    });

    this.client.on('disconnect', () => {
      console.warn('GameBridge desconectado do game-service.');
    });

    this.client.on('connect_error', (err: Error) => {
      console.error('GameBridge erro de conexão:', err.message);
    });

    this.registerGameEvents();
  }

  private registerGameEvents(): void {
    if (!this.client) return;

    //game-service emite 'game:over' com GameOverPayload
    this.client.on('game:over', (payload: GameOverPayload) => {
      const summary = this.summarizeGameOverPayload(payload);
      console.log('[ScoreService] game:over received', summary);

      try {
        const result = this.scoreService.processGameOver(payload);

        //Propaga para todos os clientes conectados ao score-service
        this.io.emit('game:result', result);
        console.log(
          `[ScoreService] game:result emitted reason=${result.reason} winner=${result.winner ?? 'n/a'} animalScores=${result.animalScores.length} playerSummaries=${result.playerSummaries.length}`
        );
      } catch (err) {
        console.error('Erro ao processar game:over:', err);
      }
    });

    //Escuta restart para confirmar o reset do estado local se necessário
    this.client.on('game:start', () => {
      console.log('Nova partida iniciada no game-service.');
      //Aqui poderíamos resetar caches futuros se necessário
    });
  }

  disconnect(): void {
    this.client?.disconnect();
  }

  private summarizeGameOverPayload(payload: GameOverPayload): {
    reason: GameOverPayload['reason'] | undefined;
    winner: string | null | undefined;
    playersCount: number;
    discoveredAnimalsCount: number;
  } {
    const players = payload?.players;
    const playersCount = Array.isArray(players)
      ? players.length
      : Object.keys(players ?? {}).length;

    return {
      reason: payload?.reason,
      winner: payload?.winner,
      playersCount,
      discoveredAnimalsCount: Array.isArray(payload?.discoveredAnimals)
        ? payload.discoveredAnimals.length
        : 0,
    };
  }
}
