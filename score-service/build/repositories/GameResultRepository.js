"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameResultRepository = void 0;
class GameResultRepository {
    results = new Map();
    save(result) {
        this.results.set(result.id, result);
    }
    findById(id) {
        return this.results.get(id);
    }
    findAll() {
        return Array.from(this.results.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    findLatest() {
        return this.findAll()[0];
    }
}
exports.GameResultRepository = GameResultRepository;
