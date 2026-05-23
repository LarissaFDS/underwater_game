import Phaser from "phaser";
import { PlayerSubmarine } from "../entities/PlayerSubmarine";

export class MovementSystem {
  private readonly speed: number;

  constructor(speed = 260) {
    this.speed = speed;
  }

  public moveToPointer(
    player: PlayerSubmarine,
    targetX: number,
    targetY: number,
    delta: number
  ): void {
    const distance = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      targetX,
      targetY
    );

    if (distance < 4) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(
      player.x,
      player.y,
      targetX,
      targetY
    );

    const movement = (this.speed * delta) / 1000;

    player.x += Math.cos(angle) * movement;
    player.y += Math.sin(angle) * movement;

    if (targetX > player.x) {
      player.setDirection("right");
    } else if (targetX < player.x) {
      player.setDirection("left");
    }
  }
}