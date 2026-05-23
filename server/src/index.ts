import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';

// Inicialização do Express
const app = express();
app.use(cors());

// Criação do servidor HTTP (necessário para o Socket.IO)
const server = http.createServer(app);

// Configuração do Socket.IO com CORS
// O cors: { origin: '*' } é ideal para desenvolvimento. 
// Em produção, você substituirá '*' pela URL do frontend.
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Rota de Health Check (Útil para o Render/Fly.io saberem que o app está vivo)
app.get('/', (req: Request, res: Response) => {
  res.send('Servidor do Submarino rodando perfeitamente!');
});

// Lógica de Conexão do Socket.IO
io.on('connection', (socket: Socket) => {
  console.log(`[Socket.IO] Novo jogador conectado. ID: ${socket.id}`);

  // Aqui entrarão os eventos da Sprint 2 (movimento, puzzle, danos)
  
  // Lógica de Desconexão
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Jogador desconectado. ID: ${socket.id}`);
  });
});

// Definição da porta (usa a variável de ambiente no deploy, ou 3000 local)
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 Aguardando conexões do frontend...`);
});