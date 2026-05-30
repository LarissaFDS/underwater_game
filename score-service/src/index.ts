import { ScoreServer } from './server/ScoreServer';

const PORT = Number(process.env.PORT) || 3003;

const server = new ScoreServer();
server.listen(PORT);