import { Router } from 'express';
import { ScoreController } from '../controllers/ScoreController';

export const buildRouter = (controller: ScoreController): Router => {
  const router = Router();

  router.get('/scores', controller.getAll); //lista todos os resultados
  router.get('/scores/latest', controller.getLatest); //resultado mais recente
  router.get('/scores/:id', controller.getById); //resultado por id

  return router;
};