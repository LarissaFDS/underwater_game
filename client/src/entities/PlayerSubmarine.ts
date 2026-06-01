import Phaser from "phaser";
import type { PlayerDirection } from "../../../shared/types/Player";

/**
 * Options accepted by the PlayerSubmarine constructor.
 *
 * `isPartner` tints the sprite slightly so remote partner submarines are
 * visually distinct without changing gameplay bounds or collision logic.
 */
interface SubmarineOptions {
  isPartner?: boolean;
}

/**
 * Phaser container that renders a player submarine using a PNG sprite.
 *
 * The container is the gameplay object (collision, position, camera follow).
 * The internal sprite is the purely visual layer: it carries the idle tween
 * and horizontal flip, so gameplay bounds are never altered by visual changes.
 *
 * GameScene uses one instance for the locally controlled player and another
 * instance (isPartner: true) as the remote partner representation.
 */
export class PlayerSubmarine extends Phaser.GameObjects.Container {
  private direction: PlayerDirection = "right";
  private readonly sprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options: SubmarineOptions = {}
  ) {
    super(scene, x, y);

    this.sprite = scene.add.image(0, 0, "submarine");
    this.sprite.setDisplaySize(120, 48);

    // Tint the partner sprite so the two submarines are distinguishable.
    if (options.isPartner) {
      this.sprite.setTint(0x9ca3af);
    }

    this.add(this.sprite);
    scene.add.existing(this);

    this.startIdleTween();
  }

  /**
   * Soft vertical oscillation on the sprite only — the container stays still
   * so movement logic and camera follow are not affected by the animation.
   */
  private startIdleTween(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      y: "+=3",
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Mirrors the submarine horizontally without changing its gameplay position.
   * Uses sprite.setFlipX instead of container scaling to keep getBounds() stable.
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
}
