import { Router } from 'express';
import type { AuthController } from '../controllers/AuthController';

export const buildRouter = (controller: AuthController): Router => {
  const router = Router();

  router.post('/login', controller.login);       //Cria sessão com apelido
  router.get('/validate/:token', controller.validate); //Valida token (usado pelo game-service)

  return router;
};