import { PlayerState } from '../models/PlayerState';
import { AnimalState } from '../models/AnimalState';
import { DiscoveredAnimalRaw } from '../dtos/ScoreDTO';

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

  //Players
  get playerCount(): number { return this.players.size; }
  get isFull(): boolean { return this.players.size >= this.maxPlayers; }

  getPlayers(): Record<string, PlayerState> {
    return Object.fromEntries(this.players);
  }

  getPlayerIds(): string[] { return Array.from(this.players.keys()); }

  getPlayer(id: string): PlayerState | undefined { return this.players.get(id); }

  addPlayer(id: string): PlayerState {
    const player = new PlayerState(id);
    this.players.set(id, player);
    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.puzzleEndConfirmations.delete(id);
  }

  //Catalog
  setCatalog(animals: any[]): void { this.catalogAnimals = animals; }
  getCatalog(): any[] { return this.catalogAnimals; }

  findCatalogAnimal(id: string): any | undefined {
    return this.catalogAnimals.find((a) => a.id === id);
  }

  //Animals
  initializeAnimals(): void {
    this.animals.clear();
    this.catalogAnimals.forEach((animal, index) => {
      this.animals.set(animal.id, new AnimalState(animal.id, 400 + index * 600, 500));
    });
  }

  clearAnimals(): void { this.animals.clear(); }

  getAnimal(id: string): AnimalState | undefined { return this.animals.get(id); }

  allAnimalsDiscovered(): boolean {
    if (this.animals.size === 0) return false;
    return Array.from(this.animals.values()).every((a) => a.discovered);
  }

  //Monta o payload de animais descobertos para o score-service
  //Usa os pontos do catálogo como base
  getDiscoveredAnimalsPayload(): DiscoveredAnimalRaw[] {
    const result: DiscoveredAnimalRaw[] = [];

    for (const animal of this.animals.values()) {
      if (!animal.discovered) continue;

      const catalogEntry = this.findCatalogAnimal(animal.id);
      result.push({
        animalId: animal.id,
        discoveredBy: animal.discoveredBy ?? '',
        timeToDiscoverMs: animal.getElapsedMs(),
        wrongGuesses: animal.wrongGuesses,
        pointsBase: catalogEntry?.points ?? 10,
      });
    }

    return result;
  }

  //Retorna o id do jogador que descobriu mais animais
  //Em caso de empate retorna null
  getLeadingPlayerId(): string | null {
    const counts = new Map<string, number>();

    for (const animal of this.animals.values()) {
      if (!animal.discovered || !animal.discoveredBy) continue;
      counts.set(animal.discoveredBy, (counts.get(animal.discoveredBy) ?? 0) + 1);
    }

    if (counts.size === 0) return null;

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const [first, second] = sorted;

    if (second && first[1] === second[1]) return null;
    return first[0];
  }

  //Puzzle
  getActivePuzzleAnimalId(): string | null { return this.activePuzzleAnimalId; }

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
    return ids.length > 0 && ids.every((id) => this.puzzleEndConfirmations.has(id));
  }

  //Game lifecycle
  reset(): void {
    this.players.forEach((player) => player.reset());
    this.initializeAnimals();
    this.clearActivePuzzle();
  }

  generateSeed(): string {
    return Math.floor(Math.random() * 999999).toString();
  }
}