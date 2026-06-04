import type { LoginRequest, LoginResponse, ValidateResponse } from '../dtos/AuthDTO';
import { TokenRepository } from '../repositories/TokenRepository';

//Erro lançado quando o apelido não atende às regras de negócio.
export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthValidationError';
  }
}

export class AuthService {
  //min 2 e max 16 caracteres, apenas alfanumérico e underscore.
  private static readonly MIN_LENGTH = 2;
  private static readonly MAX_LENGTH = 16;
  private static readonly VALID_PATTERN = /^[a-zA-Z0-9_]+$/;

  constructor(private readonly tokenRepo: TokenRepository) {}

  //Valida o apelido, persiste um token de sessão e retorna ambos ao cliente.
  //lança AuthValidationError se o apelido for inválido (HTTP 400).
  login(request: LoginRequest): LoginResponse {
    const nickname = this.assertValidNickname(request.nickname);
    const token = this.tokenRepo.save(nickname);
    return { token, nickname };
  }

  //Verifica se o token existe e não está expirado.
  //Não lança exceçã, retorna { valid: false } em caso de falha.
  validate(token: string): ValidateResponse {
    if (!token || typeof token !== 'string') {
      return { valid: false };
    }

    const record = this.tokenRepo.findByToken(token);
    if (!record) {
      return { valid: false };
    }

    return { valid: true, nickname: record.nickname };
  }

  //Valida e normaliza o apelido; retorna a string tratada ou lança erro.
  private assertValidNickname(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AuthValidationError('O campo "nickname" é obrigatório.');
    }

    const trimmed = value.trim();

    if (trimmed.length < AuthService.MIN_LENGTH) {
      throw new AuthValidationError(
        `O apelido deve ter no mínimo ${AuthService.MIN_LENGTH} caracteres.`
      );
    }

    if (trimmed.length > AuthService.MAX_LENGTH) {
      throw new AuthValidationError(
        `O apelido deve ter no máximo ${AuthService.MAX_LENGTH} caracteres.`
      );
    }

    if (!AuthService.VALID_PATTERN.test(trimmed)) {
      throw new AuthValidationError(
        'O apelido deve conter apenas letras, números e underscore (_).'
      );
    }

    return trimmed;
  }
}