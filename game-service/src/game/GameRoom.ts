import { PlayerState } from '../models/PlayerState';
import { AnimalState } from '../models/AnimalState';

export class GameRoom {
  private readonly players: Map<string, PlayerState> = new Map();
  private readonly animals: Map<string, AnimalState> = new Map();
  private activePuzzleAnimalId: string | null = null;
  private readonly puzzleEndConfirmations: Set<string> = new Set();
  private catalogAnimals: any[] = [];

  readonly maxPlayers: number;

  constructor(maxPlayers = 2) {
    this.maxPlayers = maxPlayers;
  }

  // ── Players ──────────────────────────────────────────

  get playerCount(): number {
    return this.players.size;
  }

  get isFull(): boolean {
    return this.players.size >= this.maxPlayers;
  }

  getPlayers(): Record<string, PlayerState> {
    return Object.fromEntries(this.players);
  }

  getPlayerIds(): string[] {
    return Array.from(this.players.keys());
  }

  getPlayer(id: string): PlayerState | undefined {
    return this.players.get(id);
  }

  addPlayer(id: string): PlayerState {
    const player = new PlayerState(id);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.puzzleEndConfirmations.delete(id);
  }

  // ── Catalog ───────────────────────────────────────────

  setCatalog(animals: any[]): void {
    this.catalogAnimals = animals;
  }

  getCatalog(): any[] {
    return this.catalogAnimals;
  }

  findCatalogAnimal(id: string): any | undefined {
    return this.catalogAnimals.find((a) => a.id === id);
  }

  // ── Animals ───────────────────────────────────────────

  initializeAnimals(): void {
    this.animals.clear();
    this.catalogAnimals.forEach((animal, index) => {
      this.animals.set(
        animal.id,
        new AnimalState(animal.id, 400 + index * 600, 500)
      );
    });
  }

  clearAnimals(): void {
    this.animals.clear();
  }

  getAnimal(id: string): AnimalState | undefined {
    return this.animals.get(id);
  }

  // ── Puzzle ────────────────────────────────────────────

  getActivePuzzleAnimalId(): string | null {
    return this.activePuzzleAnimalId;
  }

  startPuzzle(animalId: string): void {
    this.activePuzzleAnimalId = animalId;
    this.puzzleEndConfirmations.clear();
  }

  confirmPuzzleEnd(playerId: string): void {
    this.puzzleEndConfirmations.add(playerId);
  }

  clearActivePuzzle(): void {
    this.activePuzzleAnimalId = null;
    this.puzzleEndConfirmations.clear();
  }

  allPlayersEndedPuzzle(): boolean {
    const ids = this.getPlayerIds();
    return (
      ids.length > 0 &&
      ids.every((id) => this.puzzleEndConfirmations.has(id))
    );
  }

  // ── Game lifecycle ────────────────────────────────────

  reset(): void {
    this.players.forEach((player) => player.reset());
    this.initializeAnimals();
    this.clearActivePuzzle();
  }

  generateSeed(): string {
    return Math.floor(Math.random() * 999999).toString();
  }
}