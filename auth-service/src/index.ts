import { AuthServer } from './server/AuthServer';

const PORT = Number(process.env.PORT) || 3004;

const server = new AuthServer();
server.listen(PORT);