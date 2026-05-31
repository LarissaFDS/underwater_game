"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const GameServer_1 = require("./server/GameServer");
const PORT = Number(process.env.PORT) || 3001;
const server = new GameServer_1.GameServer();
server.listen(PORT);
