export type PlayerDirection = "left" | "right";

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: PlayerDirection;
  oxygen: number;
  score: number;
}