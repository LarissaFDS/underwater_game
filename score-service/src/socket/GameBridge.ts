import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { Server as IoServer } from 'socket.io';
import { ScoreService } from '../services/ScoreService';
import { GameOverPayload } from '../dtos/ScoreDTO';


//GameBridge conecta ao game-service como cliente Socket.io, escuta eventos de jogo (game:over, game:restart) e propaga o resultado calculado para todos os clientes via score-service io
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
      console.log(
        `game:over recebido. reason=${payload.reason}, winner=${payload.winner}`
      );

      try {
        const result = this.scoreService.processGameOver(payload);

        //Propaga para todos os clientes conectados ao score-service
        this.io.emit('game:result', result);
        console.log('game:result emitido para os clientes.');
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
}
