"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ScoreServer_1 = require("./server/ScoreServer");
const PORT = Number(process.env.PORT) || 3003;
const server = new ScoreServer_1.ScoreServer();
server.listen(PORT);
