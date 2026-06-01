import Phaser from "phaser";

/**
 * Animal placement and discovery state provided by the backend or fallback map.
 */
export interface AnimalConfig {
  id: string;
  x: number;
  y: number;
  discovered?: boolean;
}

const DETECTION_RADIUS = 80;

/** Maps animal id to the texture key preloaded in GameScene.preload(). */
const TEXTURE_MAP: Record<string, string> = {
  "peixe-palhaco": "animal-peixe-palhaco",
  tartaruga: "animal-tartaruga",
  polvo: "animal-polvo",
  "tubarao-martelo": "animal-tubarao-martelo",
  arraia: "animal-arraia",
};

/**
 * Interactive animal marker in the map.
 *
 * GameScene checks the local submarine against the detection radius and emits
 * `animal:approach` when an undiscovered animal is reached.
 *
 * The detection radius is kept as pure logic — it is no longer rendered as a
 * visible circle placeholder. The animal body is a PNG sprite whose size is
 * normalised to 100×100 px for visual consistency across species.
 */
export class Animal extends Phaser.GameObjects.Container {
  public readonly id: string;
  public readonly detectionRadius = DETECTION_RADIUS;
  public discovered: boolean;

  private readonly sprite: Phaser.GameObjects.Image;
  private patrolTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: AnimalConfig) {
    super(scene, config.x, config.y);

    this.id = config.id;
    this.discovered = config.discovered ?? false;

    const textureKey = TEXTURE_MAP[config.id] ?? "animal-peixe-palhaco";
    this.sprite = scene.add.image(0, 0, textureKey);
    this.sprite.setDisplaySize(100, 100);
    this.add(this.sprite);

    this.setDepth(20);
    scene.add.existing(this);

    if (this.discovered) {
      // Already discovered on scene init: dim immediately, no patrol.
      this.setAlpha(0.45);
    } else {
      this.startPatrolTween();
    }
  }

  /**
   * Radius used by GameScene to decide when the local player approached it.
   */
  public getDetectionRadius(): number {
    return this.detectionRadius;
  }

  /**
   * Horizontal patrol that gives undiscovered animals a sense of life.
   * The tween targets the container so the whole animal moves, keeping the
   * sprite centred within its collision footprint.
   */
  private startPatrolTween(): void {
    this.patrolTween = this.scene.tweens.add({
      targets: this,
      x: `+=${40}`,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  /**
   * Marks the animal as discovered: dims it, stops movement and keeps it
   * visible in the scene. Called by GameScene.markAnimalDiscovered().
   */
  public markDiscovered(): void {
    if (this.discovered) {
      return;
    }

    this.discovered = true;

    if (this.patrolTween) {
      this.patrolTween.stop();
      this.patrolTween.remove();
      this.patrolTween = undefined;
    }

    this.setAlpha(0.45);
  }
}
