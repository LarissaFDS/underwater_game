"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreServer = void 0;
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const GameResultRepository_1 = require("../repositories/GameResultRepository");
const ScoreCalculator_1 = require("../services/ScoreCalculator");
const ScoreService_1 = require("../services/ScoreService");
const ScoreController_1 = require("../controllers/ScoreController");
const GameBridge_1 = require("../socket/GameBridge");
const routes_1 = require("../routes");
class ScoreServer {
    app;
    server;
    io;
    scoreService;
    bridge;
    allowedOrigins;
    corsOptions;
    constructor() {
        //Infraestrutura
        this.app = (0, express_1.default)();
        this.server = http_1.default.createServer(this.app);
        this.allowedOrigins = this.resolveAllowedOrigins();
        this.corsOptions = {
            origin: this.allowedOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        };
        this.io = new socket_io_1.Server(this.server, {
            path: '/socket.io',
            cors: this.corsOptions,
            transports: ['polling', 'websocket'],
        });
        //Composição das dependências (IoC manual)
        const repo = new GameResultRepository_1.GameResultRepository();
        const calculator = new ScoreCalculator_1.ScoreCalculator();
        this.scoreService = new ScoreService_1.ScoreService(repo, calculator);
        const gameServiceUrl = process.env.GAME_SERVICE_URL || 'http://localhost:3001';
        this.bridge = new GameBridge_1.GameBridge(this.io, this.scoreService, gameServiceUrl);
        //Setup
        this.setupMiddlewares();
        this.setupHttpRoutes();
        this.setupSocketHandlers();
    }
    setupMiddlewares() {
        this.app.use((0, cors_1.default)(this.corsOptions));
        this.app.use(express_1.default.json());
    }
    setupHttpRoutes() {
        const controller = new ScoreController_1.ScoreController(this.scoreService);
        this.app.use('/api', (0, routes_1.buildRouter)(controller));
        this.app.get('/', (_req, res) => {
            res.status(200).json({ status: 'ok', service: 'score-service' });
        });
        this.app.get('/health', (_req, res) => {
            res.status(200).json({
                status: 'ok',
                service: 'score-service',
                socketPath: '/socket.io',
            });
        });
    }
    resolveAllowedOrigins() {
        const defaultOrigins = [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'https://underwater-game.onrender.com',
        ];
        const rawOrigins = [
            process.env.CLIENT_URL,
            process.env.CORS_ORIGIN,
            process.env.CORS_ORIGINS,
            process.env.FRONTEND_ORIGIN,
        ]
            .filter(Boolean)
            .join(',');
        if (!rawOrigins) {
            return defaultOrigins;
        }
        return Array.from(new Set([
            ...defaultOrigins,
            ...rawOrigins
                .split(',')
                .map((origin) => origin.trim())
                .filter(Boolean),
        ]));
    }
    formatHeader(value) {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return value ?? 'n/a';
    }
    setupSocketHandlers() {
        this.io.engine.on('connection_error', (error) => {
            const origin = this.formatHeader(error.req?.headers.origin);
            console.error(`[ScoreServer] connect_error origin=${origin} code=${error.code} message=${error.message}`);
        });
        this.io.on('connection', (socket) => {
            const origin = this.formatHeader(socket.handshake.headers.origin);
            console.log(`[ScoreServer] Frontend connected to score-service socket=${socket.id} origin=${origin}`);
            //Cliente pode pedir o resultado mais recente ao (re)conectar
            socket.on('score:getLatest', () => {
                const latest = this.scoreService.getLatestResult();
                if (latest)
                    socket.emit('game:result', latest);
            });
            socket.on('disconnect', () => {
                console.log(`[ScoreServer] client disconnected socket=${socket.id}`);
            });
        });
    }
    listen(port) {
        this.bridge.connect();
        this.server.listen(port, '0.0.0.0', () => {
            console.log(`Score Service listening on port ${port}`);
            console.log('Socket.IO ready on /socket.io');
            console.log(`[ScoreServer] allowedOrigins=${this.allowedOrigins.join(', ')}`);
            console.log('[ScoreServer] transports=polling,websocket');
        });
    }
}
exports.ScoreServer = ScoreServer;
