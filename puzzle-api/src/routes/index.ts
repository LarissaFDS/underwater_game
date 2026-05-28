import { Router } from 'express';
import { PuzzleController } from '../controllers/PuzzleController';

export const buildRouter = (controller: PuzzleController): Router => {
  const router = Router();

  router.get('/animals', controller.getAnimals);
  router.post('/puzzle/guess', controller.guess);
  router.post('/puzzle/hint', controller.hint);

  return router;
};