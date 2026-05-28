import { GameServer } from './server/GameServer';

const PORT = Number(process.env.PORT) || 3001;

const server = new GameServer();
server.listen(PORT);