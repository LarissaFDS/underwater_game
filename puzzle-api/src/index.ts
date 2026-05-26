import express, { Request, Response } from 'express';
import cors from 'cors';
import routes from './routes';

const app = express();

//Middlewares
app.use(cors());
app.use(express.json());

//Rotas do domínio de Puzzle
app.use('/api', routes);

//Rota de Health Check (útil para o Docker saber se o container está de pé)
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'ocean-puzzle-api'
  });
});

const PORT = Number(process.env.PORT) || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🧩 Puzzle API Microsserviço rodando na porta ${PORT}`);
});