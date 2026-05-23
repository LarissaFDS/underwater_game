export interface PlayerState {
    id: string;
    x: number;
    y: number;
    isAlive: boolean;
  }
  
  export interface GameState {
    players: Record<string, PlayerState>;
    //Futuramente, adicionaremos o mapa e os obstáculos aqui
  }