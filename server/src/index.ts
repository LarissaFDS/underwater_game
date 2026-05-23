import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { SocketEvents } from './socket/events';
import { animals } from './data/animals'; // Importando a lista de animais

// Inicialização do Express
const app = express();
app.use(cors());
app.use(express.json()); // OBRIGATÓRIO: Permite que o Express entenda JSON enviado no corpo do POST

// Criação do servidor HTTP (necessário para o Socket.IO)
const server = http.createServer(app);

// Configuração do Socket.IO com CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Rota de Health Check
app.get('/', (req: Request, res: Response) => {
  res.send('Servidor do Submarino rodando perfeitamente!');
});

// =========================================================================
// ROTAS REST API (TASK 2)
// =========================================================================

// GET /api/animals: Retorna os dados dos animais ocultando o nome (resposta)
app.get('/api/animals', (req: Request, res: Response) => {
  // Mapeia removendo o campo 'name' para segurança do client
  const sanitizedAnimals = animals.map(({ name, ...rest }) => rest);
  res.json(sanitizedAnimals);
});

// POST /api/puzzle/guess: Valida o palpite de letra do jogador
app.post('/api/puzzle/guess', (req: Request, res: Response) => {
  const { animalId, letter } = req.body;

  // Validação básica de payload
  if (!animalId || !letter || letter.length !== 1) {
    return res.status(400).json({ error: 'Campos animalId e letter (1 caractere) são obrigatórios.' });
  }

  // Busca o animal pelo ID
  const animal = animals.find(a => a.id === animalId);
  if (!animal) {
    return res.status(404).json({ error: 'Animal não encontrado.' });
  }

  const positions: number[] = [];
  const nameLower = animal.name.toLowerCase();
  const letterLower = letter.toLowerCase();

  // Percorre o nome encontrando todos os índices da letra digitada
  for (let i = 0; i < nameLower.length; i++) {
    if (nameLower[i] === letterLower) {
      positions.push(i);
    }
  }

  // Critério de Aceite: Retorna se está correto e o array de posições encontradas
  res.json({
    correct: positions.length > 0,
    positions
  });
});

// =========================================================================

// Lógica de Conexão do Socket.IO (Task 1)
io.on('connection', (socket: Socket) => {
  console.log(`${SocketEvents.PLAYER_JOIN} - ID: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`${SocketEvents.PLAYER_DISCONNECT} - ID: ${socket.id}`);
  });
});

// Definição da porta
const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Aguardando conexões do frontend...`);
});