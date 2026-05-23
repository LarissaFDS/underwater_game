import Phaser from "phaser";
import type { PlayerDirection } from "../../../shared/types/Player";

export class PlayerSubmarine extends Phaser.GameObjects.Container {
  private direction: PlayerDirection = "right";

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.createSubmarineBody();

    scene.add.existing(this);
  }

  private createSubmarineBody(): void {
    const body = this.scene.add.ellipse(0, 0, 90, 36, 0x2dd4bf);
    const window = this.scene.add.circle(18, -2, 8, 0x0f172a);
    const tail = this.scene.add.triangle(-48, 0, 0, -16, 0, 16, -24, 0, 0x14b8a6);
    const cabin = this.scene.add.rectangle(6, -22, 34, 16, 0x38bdf8);

    this.add([tail, body, cabin, window]);
  }

  public setDirection(direction: PlayerDirection): void {
    if (this.direction === direction) {
      return;
    }

    this.direction = direction;

    if (direction === "right") {
      this.setScale(1, 1);
    } else {
      this.setScale(-1, 1);
    }
  }

  public getDirection(): PlayerDirection {
    return this.direction;
  }
}