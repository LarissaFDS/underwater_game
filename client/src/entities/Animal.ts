import Phaser from "phaser";
import { getAnimalAssetKey } from "../assets/assetsMap";

/**
 * Animal placement and discovery state provided by the backend or fallback map.
 */
export interface AnimalConfig {
  id: string;
  x: number;
  y: number;
  discovered?: boolean;
  color?: number;
}

const DETECTION_RADIUS = 80;
const ANIMAL_SIZE = 100;
const PATROL_DISTANCE = 40;
const PATROL_DURATION_MS = 2200;

/**
 * Interactive animal marker in the map.
 *
 * GameScene checks the local submarine against the detection radius and emits
 * `animal:approach` when an undiscovered animal is reached.
 */
export class Animal extends Phaser.GameObjects.Container {
  public readonly id: string;
  public readonly detectionRadius = DETECTION_RADIUS;
  public discovered: boolean;
  private patrolTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: AnimalConfig) {
    super(scene, config.x, config.y);

    this.id = config.id;
    this.discovered = config.discovered ?? false;
    this.createVisuals(config.color ?? 0xf97316);

    scene.add.existing(this);

    if (this.discovered) {
      this.markDiscovered();
    } else {
      this.startPatrol();
    }
  }

  /**
   * Radius used by GameScene to decide when the local player approached it.
   */
  public getDetectionRadius(): number {
    return this.detectionRadius;
  }

  /**
   * Draws the visible animal sprite and keeps detection as an invisible area.
   */
  private createVisuals(_color: number): void {
    const detectionArea = this.scene.add.circle(
      0,
      0,
      this.detectionRadius,
      0xffffff,
      0
    );
    detectionArea.setVisible(false);

    const body = this.scene.add.image(0, 0, getAnimalAssetKey(this.id));
    body.setDisplaySize(ANIMAL_SIZE, ANIMAL_SIZE);

    this.add([detectionArea, body]);
    this.setDepth(20);
  }

  private startPatrol(): void {
    if (this.patrolTween || this.discovered) {
      return;
    }

    this.patrolTween = this.scene.tweens.add({
      targets: this,
      x: this.x + PATROL_DISTANCE,
      duration: PATROL_DURATION_MS,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  public markDiscovered(): void {
    this.discovered = true;
    this.patrolTween?.remove();
    this.patrolTween = undefined;
    this.setAlpha(0.3);
  }
}
