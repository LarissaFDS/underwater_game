//Payload recebido em POST /api/login
export interface LoginRequest {
    nickname: unknown;
  }
  
  //Resposta de sucesso de /api/login
  export interface LoginResponse {
    token: string;
    nickname: string;
  }
  
  //Resposta de GET /api/validate/:token
  export interface ValidateResponse {
    valid: boolean;
    nickname?: string;
  }
  
  //Registro interno armazenado no TokenRepository
  export interface TokenRecord {
    nickname: string;
    createdAt: Date;
    expiresAt: Date;
  }