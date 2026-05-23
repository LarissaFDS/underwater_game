import Phaser from "phaser";
import { PlayerSubmarine } from "../entities/PlayerSubmarine";
import { MovementSystem } from "../systems/MovementSystem";

export class GameScene extends Phaser.Scene {
  private player!: PlayerSubmarine;
  private movementSystem!: MovementSystem;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");

    this.createWorld();

    this.player = new PlayerSubmarine(this, 1200, 800);
    this.movementSystem = new MovementSystem();

    this.cameras.main.setBounds(0, 0, 2400, 1600);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
  }

  update(_time: number, delta: number): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    this.movementSystem.moveToPointer(
      this.player,
      worldPoint.x,
      worldPoint.y,
      delta
    );
  }

  private createWorld(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0a1628, 1);
    graphics.fillRect(0, 0, 2400, 1600);

    graphics.lineStyle(2, 0x123456, 0.5);

    for (let x = 0; x <= 2400; x += 120) {
      graphics.lineBetween(x, 0, x, 1600);
    }

    for (let y = 0; y <= 1600; y += 120) {
      graphics.lineBetween(0, y, 2400, y);
    }
  }
}