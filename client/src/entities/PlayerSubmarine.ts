import Phaser from "phaser";
import { SPRITE_KEYS } from "../assets/assetsMap";
import type { PlayerDirection } from "../../../shared/types/Player";

/**
 * Visual options used to render submarine instances.
 */
interface SubmarineVisualOptions {
  assetKey: string;
}

const SUBMARINE_SIZE = 200;
const COLLISION_WIDTH = 117;
const COLLISION_HEIGHT = 48;

/**
 * Phaser container that renders a player submarine.
 *
 * GameScene uses one instance for the locally controlled player and another
 * instance, with alternate colors, as the remote partner representation.
 */
export class PlayerSubmarine extends Phaser.GameObjects.Container {
  private direction: PlayerDirection = "right";
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: Partial<SubmarineVisualOptions> = {}
  ) {
    super(scene, x, y);

    this.sprite = this.createSubmarineSprite(
      options.assetKey ?? SPRITE_KEYS.submarine
    );

    scene.add.existing(this);
  }

  /**
   * Creates the PNG submarine sprite used by both players.
   */
  private createSubmarineSprite(assetKey: string): Phaser.GameObjects.Image {
    const sprite = this.scene.add.image(0, 0, assetKey);
    sprite.setDisplaySize(SUBMARINE_SIZE, SUBMARINE_SIZE);

    this.add(sprite);
    this.scene.tweens.add({
      targets: sprite,
      y: sprite.y + 3,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    return sprite;
  }

  /**
   * Mirrors the submarine horizontally without changing its gameplay position.
   */
  public setDirection(direction: PlayerDirection): void {
    if (this.direction === direction) {
      return;
    }

    this.direction = direction;

    this.sprite.setFlipX(direction === "left");
  }

  /**
   * Returns the last visual direction applied to the submarine.
   */
  public getDirection(): PlayerDirection {
    return this.direction;
  }

  public getBounds(output?: Phaser.Geom.Rectangle): Phaser.Geom.Rectangle {
    const bounds = output ?? new Phaser.Geom.Rectangle();

    return bounds.setTo(
      this.x - COLLISION_WIDTH / 2,
      this.y - COLLISION_HEIGHT / 2,
      COLLISION_WIDTH,
      COLLISION_HEIGHT
    );
  }
}
