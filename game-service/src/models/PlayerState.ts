export class PlayerState {
  id: string;
  nickname: string;
  x: number;
  y: number;
  hearts: number;
  oxygen: number;
  deathCount: number;

  constructor(id: string, nickname = 'Jogador') {
    this.id       = id;
    this.nickname = nickname;
    this.x        = 0;
    this.y        = 0;
    this.hearts   = 3;
    this.oxygen   = 100;
    this.deathCount = 0;
  }

  reset(): void {
    this.x         = 0;
    this.y         = 0;
    this.hearts    = 3;
    this.oxygen    = 100;
    this.deathCount = 0;
    // nickname é preservado entre partidas da mesma sessão
  }

  // Individual respawn restores resources but preserves deathCount so the
  // second death can trigger the definitive elimination game over.
  respawn(): void {
    this.x      = 0;
    this.y      = 0;
    this.hearts = 3;
    this.oxygen = 100;
  }

  isDead(): boolean {
    return this.hearts <= 0 || this.oxygen <= 0;
  }
}