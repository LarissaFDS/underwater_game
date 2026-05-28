export class PlayerState {
    id: string;
    x: number;
    y: number;
    hearts: number;
    oxygen: number;
    deathCount: number;
  
    constructor(id: string) {
      this.id = id;
      this.x = 0;
      this.y = 0;
      this.hearts = 3;
      this.oxygen = 100;
      this.deathCount = 0;
    }
  
    reset(): void {
      this.x = 0;
      this.y = 0;
      this.hearts = 3;
      this.oxygen = 100;
      this.deathCount = 0;
    }
  
    isDead(): boolean {
      return this.hearts <= 0 || this.oxygen <= 0;
    }
  }