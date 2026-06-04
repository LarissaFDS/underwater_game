import type { Request, Response } from 'express';
import { AuthService, AuthValidationError } from '../services/AuthService';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

 
    //POST /api/login
    //Body: {nickname: string}
    //Resposta 200: {token: string, nickname: string}
    //Resposta 400: {error: string}, apelido inválido
    
  login = (req: Request, res: Response): void => {
    try {
      const result = this.authService.login(req.body as { nickname: unknown });
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof AuthValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('[AuthController] Unexpected error on login:', err);
      res.status(500).json({ error: 'Erro interno do servidor.' });
    }
  };

    //GET /api/validate/:token
    //Resposta 200: {valid: true, nickname: string}
    //Resposta 401: {valid: false}
  validate = (req: Request, res: Response): void => {
    const result = this.authService.validate(req.params.token ?? '');
    res.status(result.valid ? 200 : 401).json(result);
  };
}