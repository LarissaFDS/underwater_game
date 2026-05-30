export class AnimalState {
  id: string;
  x: number;
  y: number;
  discovered: boolean;

  //Rastreamento para pontuação
  puzzleStartedAt: number | null = null;   //Date.now() quando puzzle:start
  wrongGuesses: number = 0;
  discoveredBy: string | null = null;      //socket id do jogador que completou

  constructor(id: string, x: number, y: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.discovered = false;
  }

  startPuzzle(): void {
    this.puzzleStartedAt = Date.now();
    this.wrongGuesses = 0;
  }

  registerWrongGuess(): void {
    this.wrongGuesses += 1;
  }

  getElapsedMs(): number {
    if (!this.puzzleStartedAt) return 0;
    return Date.now() - this.puzzleStartedAt;
  }
}