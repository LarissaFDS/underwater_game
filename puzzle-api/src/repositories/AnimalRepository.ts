import { Animal, animals } from '../data/animals';

export class AnimalRepository {
  private readonly animals: Animal[];

  constructor() {
    this.animals = animals;
  }

  findAll(): Animal[] {
    return this.animals;
  }

  findById(id: string): Animal | undefined {
    return this.animals.find((a) => a.id === id);
  }
}