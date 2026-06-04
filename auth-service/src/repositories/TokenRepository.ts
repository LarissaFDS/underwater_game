import { randomUUID } from 'crypto';
import type { TokenRecord } from '../dtos/AuthDTO';

export class TokenRepository {
  //Tokens expiram após 20 minutos.
  private static readonly TOKEN_TTL_MS = 60 * 20 * 1000;

  private readonly store: Map<string, TokenRecord> = new Map();

  //Persiste um novo token para o apelido fornecido e retorna o token gerado.
  save(nickname: string): string {
    const token = randomUUID();
    const now = Date.now();

    this.store.set(token, {
      nickname,
      createdAt: new Date(now),
      expiresAt: new Date(now + TokenRepository.TOKEN_TTL_MS),
    });

    return token;
  }

  //Busca e valida o token. Remove automaticamente tokens expirados.
  findByToken(token: string): TokenRecord | undefined {
    const record = this.store.get(token);
    if (!record) return undefined;

    if (record.expiresAt < new Date()) {
      this.store.delete(token);
      return undefined;
    }

    return record;
  }

  delete(token: string): boolean {
    return this.store.delete(token);
  }

  //Quantidade de tokens ativos — útil para health check.
  count(): number {
    return this.store.size;
  }
}