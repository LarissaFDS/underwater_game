export class AnimalState {
    id: string;
    x: number;
    y: number;
    discovered: boolean;
  
    constructor(id: string, x: number, y: number) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.discovered = false;
    }
  }