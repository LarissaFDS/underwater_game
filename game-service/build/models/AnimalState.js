"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnimalState = void 0;
class AnimalState {
    id;
    x;
    y;
    discovered;
    //Rastreamento para pontuação
    puzzleStartedAt = null; //Date.now() quando puzzle:start
    wrongGuesses = 0;
    discoveredBy = null; //socket id do jogador que completou
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.discovered = false;
    }
    startPuzzle() {
        this.puzzleStartedAt = Date.now();
        this.wrongGuesses = 0;
    }
    registerWrongGuess() {
        this.wrongGuesses += 1;
    }
    getElapsedMs() {
        if (!this.puzzleStartedAt)
            return 0;
        return Date.now() - this.puzzleStartedAt;
    }
}
exports.AnimalState = AnimalState;
