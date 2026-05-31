"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerState = void 0;
class PlayerState {
    id;
    x;
    y;
    hearts;
    oxygen;
    deathCount;
    constructor(id) {
        this.id = id;
        this.x = 0;
        this.y = 0;
        this.hearts = 3;
        this.oxygen = 100;
        this.deathCount = 0;
    }
    reset() {
        this.x = 0;
        this.y = 0;
        this.hearts = 3;
        this.oxygen = 100;
        this.deathCount = 0;
    }
    // Individual respawn restores resources but preserves deathCount so the
    // second death can trigger the definitive elimination game over.
    respawn() {
        this.x = 0;
        this.y = 0;
        this.hearts = 3;
        this.oxygen = 100;
    }
    isDead() {
        return this.hearts <= 0 || this.oxygen <= 0;
    }
}
exports.PlayerState = PlayerState;
