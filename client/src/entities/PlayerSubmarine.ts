import Phaser from "phaser";
import type { PlayerDirection } from "../../../shared/types/Player";

/**
 * Color palette used to visually distinguish submarine instances.
 */
interface SubmarineColors {
  body: number;
  tail: number;
  cabin: number;
  window: number;
}

const DEFAULT_COLORS: SubmarineColors = {
  body: 0x2dd4bf,
  tail: 0x14b8a6,
  cabin: 0x38bdf8,
  window: 0x0f172a,
};

/**
 * Phaser container that renders a player submarine.
 *
 * GameScene uses one instance for the locally controlled player and another
 * instance, with alternate colors, as the remote partner representation.
 */
export class PlayerSubmarine extends Phaser.GameObjects.Container {
  private direction: PlayerDirection = "right";
  private readonly colors: SubmarineColors;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    colors: Partial<SubmarineColors> = {}
  ) {
    super(scene, x, y);
    this.colors = { ...DEFAULT_COLORS, ...colors };

    this.createSubmarineBody();

    scene.add.existing(this);
  }

  /**
   * Creates the simple multi-part submarine shape used by both players.
   */
  private createSubmarineBody(): void {
    const body = this.scene.add.ellipse(0, 0, 90, 36, this.colors.body);
    const window = this.scene.add.circle(18, -2, 8, this.colors.window);
    const tail = this.scene.add.triangle(
      -48,
      0,
      0,
      -16,
      0,
      16,
      -24,
      0,
      this.colors.tail
    );
    const cabin = this.scene.add.rectangle(6, -22, 34, 16, this.colors.cabin);

    this.add([tail, body, cabin, window]);
  }

  /**
   * Mirrors the submarine horizontally without changing its gameplay position.
   */
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

  /**
   * Returns the last visual direction applied to the submarine.
   */
  public getDirection(): PlayerDirection {
    return this.direction;
  }
}
