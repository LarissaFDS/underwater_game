export interface Animal {
    id: string;
    name: string;
    hints: string[];
    points: number;
    rarity: 'common' | 'rare';
  }