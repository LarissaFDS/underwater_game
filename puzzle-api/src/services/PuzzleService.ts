import { AnimalRepository } from '../repositories/AnimalRepository';

export interface GuessResult {
  correct: boolean;
  positions: number[];
}

export interface HintResult {
  hint: string;
}

export interface HiddenAnimal {
  id: string;
  hiddenName: string[];
  points: number;
  rarity: string;
}

export class PuzzleService {
  constructor(private readonly repo: AnimalRepository) {}

  private normalizeLetter(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  getHiddenAnimals(): HiddenAnimal[] {
    return this.repo.findAll().map(({ name, hints: _hints, ...rest }) => {
      const hiddenName = name
        .split('')
        .map((char) => (char === '-' || char === ' ' ? char : '_'));
      return { ...rest, hiddenName };
    });
  }

  guess(animalId: string, letter: string): GuessResult | null {
    const animal = this.repo.findById(animalId);
    if (!animal) return null;

    const positions: number[] = [];
    const nameLower = this.normalizeLetter(animal.name);
    const letterLower = this.normalizeLetter(letter);

    for (let i = 0; i < nameLower.length; i++) {
      if (nameLower[i] === letterLower) positions.push(i);
    }

    return { correct: positions.length > 0, positions };
  }

  hint(animalId: string, hintIndex: number): HintResult | null {
    const animal = this.repo.findById(animalId);
    if (!animal) return null;

    return { hint: animal.hints[hintIndex] ?? 'Sem mais dicas.' };
  }
}