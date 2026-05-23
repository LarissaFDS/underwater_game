import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SocketEvents } from './socket/events'; //Importação dos eventos da Task 1

//Inicialização do Express
const app = express();
app.use(cors());

//Criação do servidor HTTP (necessário para o Socket.IO)
const server = http.createServer(app);

//Configuração do Socket.IO com CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

//Rota de Health Check (Útil para o Render/Fly.io saberem que o app está vivo)
app.get('/', (req: Request, res: Response) => {
  res.send('Servidor do Submarino rodando perfeitamente!');
});

//Lógica de Conexão do Socket.IO
io.on('connection', (socket: Socket) => {
  //Critério de Aceite: Logar o evento exato player:join
  console.log(`${SocketEvents.PLAYER_JOIN} - ID: ${socket.id}`);

  //Aqui entrarão os eventos da Sprint 2 (movimento, puzzle, danos)
  
  //Lógica de Desconexão
  socket.on('disconnect', () => {
    //Critério de Aceite: Logar o evento exato player:disconnect
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
  });
});

//Definição da porta (usa a variável de ambiente do Docker/Deploy, ou 3000 local)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do frontend...`);
});