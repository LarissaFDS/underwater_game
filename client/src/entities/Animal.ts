import Phaser from "phaser";

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

  constructor(scene: Phaser.Scene, config: AnimalConfig) {
    super(scene, config.x, config.y);

    this.id = config.id;
    this.discovered = config.discovered ?? false;
    this.createVisuals(config.color ?? 0xf97316);

    scene.add.existing(this);
  }

  /**
   * Radius used by GameScene to decide when the local player approached it.
   */
  public getDetectionRadius(): number {
    return this.detectionRadius;
  }

  /**
   * Draws the visible animal marker and its translucent detection area.
   */
  private createVisuals(color: number): void {
    const detectionArea = this.scene.add.circle(
      0,
      0,
      this.detectionRadius,
      color,
      0.08
    );
    detectionArea.setStrokeStyle(2, color, 0.35);

    const body = this.scene.add.circle(0, 0, 22, color, 0.95);
    body.setStrokeStyle(3, 0xffffff, 0.35);

    this.add([detectionArea, body]);
    this.setDepth(20);
  }
}
