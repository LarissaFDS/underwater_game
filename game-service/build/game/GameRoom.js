"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRoom = void 0;
const PlayerState_1 = require("../models/PlayerState");
const AnimalState_1 = require("../models/AnimalState");
class GameRoom {
    players = new Map();
    animals = new Map();
    activePuzzleAnimalId = null;
    puzzleEndConfirmations = new Set();
    catalogAnimals = [];
    maxPlayers;
    constructor(maxPlayers = 2) {
        this.maxPlayers = maxPlayers;
    }
    //Players
    get playerCount() { return this.players.size; }
    get isFull() { return this.players.size >= this.maxPlayers; }
    getPlayers() {
        return Object.fromEntries(this.players);
    }
    getPlayerIds() { return Array.from(this.players.keys()); }
    getPlayer(id) { return this.players.get(id); }
    addPlayer(id) {
        const player = new PlayerState_1.PlayerState(id);
        this.players.set(id, player);
        return player;
    }
    removePlayer(id) {
        this.players.delete(id);
        this.puzzleEndConfirmations.delete(id);
    }
    //Catalog
    setCatalog(animals) { this.catalogAnimals = animals; }
    getCatalog() { return this.catalogAnimals; }
    findCatalogAnimal(id) {
        return this.catalogAnimals.find((a) => a.id === id);
    }
    //Animals
    initializeAnimals() {
        this.animals.clear();
        this.catalogAnimals.forEach((animal, index) => {
            this.animals.set(animal.id, new AnimalState_1.AnimalState(animal.id, 400 + index * 600, 500));
        });
    }
    clearAnimals() { this.animals.clear(); }
    getAnimal(id) { return this.animals.get(id); }
    getAnimalCount() { return this.animals.size; }
    getDiscoveredAnimalCount() {
        return Array.from(this.animals.values()).filter((animal) => animal.discovered).length;
    }
    allAnimalsDiscovered() {
        if (this.animals.size === 0)
            return false;
        return Array.from(this.animals.values()).every((a) => a.discovered);
    }
    //Monta o payload de animais descobertos para o score-service
    //Usa os pontos do catálogo como base
    getDiscoveredAnimalsPayload() {
        const result = [];
        for (const animal of this.animals.values()) {
            if (!animal.discovered)
                continue;
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
    getLeadingPlayerId() {
        const counts = new Map();
        for (const animal of this.animals.values()) {
            if (!animal.discovered || !animal.discoveredBy)
                continue;
            counts.set(animal.discoveredBy, (counts.get(animal.discoveredBy) ?? 0) + 1);
        }
        if (counts.size === 0)
            return null;
        const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const [first, second] = sorted;
        if (second && first[1] === second[1])
            return null;
        return first[0];
    }
    //Puzzle
    getActivePuzzleAnimalId() { return this.activePuzzleAnimalId; }
    startPuzzle(animalId) {
        this.activePuzzleAnimalId = animalId;
        this.puzzleEndConfirmations.clear();
    }
    confirmPuzzleEnd(playerId) {
        this.puzzleEndConfirmations.add(playerId);
    }
    clearActivePuzzle() {
        this.activePuzzleAnimalId = null;
        this.puzzleEndConfirmations.clear();
    }
    allPlayersEndedPuzzle() {
        const ids = this.getPlayerIds();
        return ids.length > 0 && ids.every((id) => this.puzzleEndConfirmations.has(id));
    }
    //Game lifecycle
    reset() {
        this.players.forEach((player) => player.reset());
        this.initializeAnimals();
        this.clearActivePuzzle();
    }
    generateSeed() {
        return Math.floor(Math.random() * 999999).toString();
    }
}
exports.GameRoom = GameRoom;
