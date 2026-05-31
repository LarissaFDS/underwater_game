"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameBridge = void 0;
const socket_io_client_1 = require("socket.io-client");
class GameBridge {
    io;
    scoreService;
    gameServiceUrl;
    client = null;
    reconnectTimer = null;
    destroyed = false;
    constructor(io, scoreService, gameServiceUrl) {
        this.io = io;
        this.scoreService = scoreService;
        this.gameServiceUrl = gameServiceUrl;
    }
    connect() {
        if (this.destroyed)
            return;
        this.client = (0, socket_io_client_1.io)(this.gameServiceUrl, {
            reconnection: true,
            reconnectionAttempts: Infinity, // nunca desiste no Render
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.3,
            // Força polling primeiro — mais estável atrás de proxy reverso Render
            // O upgrade para websocket acontece automaticamente se disponível
            transports: ['polling', 'websocket'],
            upgrade: true,
            // Keepalive: evita que a conexão seja morta por idle no Render (30s timeout)
            pingInterval: 10000,
            pingTimeout: 25000,
            auth: {
                clientType: 'service',
                serviceName: 'score-service',
            },
        });
        this.client.on('connect', () => {
            console.log(`[GameBridge] conectado ao game-service em ${this.gameServiceUrl} transport=${this.client?.io.engine.transport.name}`);
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
        this.client.on('connect_error', (err) => {
            console.error(`[GameBridge] connect_error: ${err.message}`);
        });
        this.client.io.on('reconnect', (attempt) => {
            console.log(`[GameBridge] reconectado após ${attempt} tentativa(s)`);
        });
        this.client.io.on('reconnect_failed', () => {
            // reconnectionAttempts: Infinity — nunca chega aqui, mas defensivamente:
            console.error('[GameBridge] reconnect_failed — agendando retry manual');
            this.scheduleManualReconnect();
        });
        this.registerGameEvents();
    }
    scheduleManualReconnect() {
        if (this.destroyed || this.reconnectTimer)
            return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            console.log('[GameBridge] tentando reconexão manual...');
            this.client?.connect();
        }, 15000);
    }
    registerGameEvents() {
        if (!this.client)
            return;
        this.client.on('game:over', (payload) => {
            console.log(`[GameBridge] game:over recebido reason=${payload.reason} winner=${payload.winner ?? 'n/a'} players=${Object.keys(payload.players ?? {}).join(',') || 'none'} discoveredAnimals=${payload.discoveredAnimals?.length ?? 0}`);
            // Valida payload mínimo antes de processar
            if (!payload.reason) {
                console.error('[GameBridge] game:over ignorado: payload sem reason', payload);
                return;
            }
            try {
                const result = this.scoreService.processGameOver(payload);
                this.io.emit('game:result', result);
                console.log(`[GameBridge] game:result emitido reason=${result.reason} winner=${result.winner ?? 'n/a'} animalScores=${result.animalScores.length} playerSummaries=${result.playerSummaries.length}`);
            }
            catch (err) {
                console.error('[GameBridge] erro ao processar game:over:', err);
            }
        });
        this.client.on('game:start', () => {
            console.log('[GameBridge] game:start recebido — nova partida iniciada.');
        });
    }
    disconnect() {
        this.destroyed = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }
        this.client?.disconnect();
    }
}
exports.GameBridge = GameBridge;
