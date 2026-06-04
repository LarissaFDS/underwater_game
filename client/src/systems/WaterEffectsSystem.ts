import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH } from "../data/mapConfig";

const BUBBLE_MIN_SIZE = 4;
const BUBBLE_MAX_SIZE = 8;
const BUBBLE_INTERVAL_MS = 1100;
const BUBBLE_RISE_MIN = 90;
const BUBBLE_RISE_MAX = 170;
const BUBBLE_DURATION_MIN_MS = 3200;
const BUBBLE_DURATION_MAX_MS = 5200;
const BUBBLE_DEPTH = 8;
const VIGNETTE_DEPTH = 850;
const VIGNETTE_TEXTURE_KEY = "water-effects-vignette";

/**
 * Adds atmospheric-only water visuals to GameScene.
 *
 * This system deliberately avoids gameplay, sockets, HUD, puzzle flow, and the
 * existing lighting/depth overlay. Bubbles are world decoration, while the
 * vignette is a camera-fixed screen effect.
 */
export class WaterEffectsSystem {
  private readonly bubbles = new Set<Phaser.GameObjects.Arc>();
  private readonly vignette: Phaser.GameObjects.Image;
  private bubbleTimer?: Phaser.Time.TimerEvent;

  constructor(private readonly scene: Phaser.Scene) {
    this.vignette = this.createVignette();
    this.seedInitialBubbles();
    this.startBubbleTimer();
  }

  /**
   * Stops timers/tweens and removes all visual objects created by this system.
   */
  public destroy(): void {
    this.bubbleTimer?.remove(false);
    this.bubbleTimer = undefined;

    this.bubbles.forEach((bubble) => {
      this.scene.tweens.killTweensOf(bubble);
      bubble.destroy();
    });
    this.bubbles.clear();

    this.vignette.destroy();
  }

  /**
   * Creates a screen-fixed vignette. It uses scrollFactor 0 because the darkened
   * edges belong to the camera view, not to the scrolling world map.
   */
  private createVignette(): Phaser.GameObjects.Image {
    const width = Math.max(1, this.scene.scale.width);
    const height = Math.max(1, this.scene.scale.height);
    const textureKey = `${VIGNETTE_TEXTURE_KEY}-${width}x${height}`;

    this.ensureVignetteTexture(textureKey, width, height);

    const vignette = this.scene.add.image(0, 0, textureKey);
    vignette.setOrigin(0, 0);
    vignette.setScrollFactor(0);
    vignette.setDepth(VIGNETTE_DEPTH);

    return vignette;
  }

  /**
   * Draws a radial edge vignette so no horizontal depth bands are introduced.
   */
  private ensureVignetteTexture(
    textureKey: string,
    width: number,
    height: number
  ): void {
    if (this.scene.textures.exists(textureKey)) {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const innerRadius = Math.min(width, height) * 0.34;
    const outerRadius = Math.sqrt(width * width + height * height) * 0.52;
    const gradient = context.createRadialGradient(
      centerX,
      centerY,
      innerRadius,
      centerX,
      centerY,
      outerRadius
    );

    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.72, "rgba(0, 0, 0, 0.18)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.48)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    this.scene.textures.addCanvas(textureKey, canvas);
  }

  private startBubbleTimer(): void {
    this.bubbleTimer = this.scene.time.addEvent({
      delay: BUBBLE_INTERVAL_MS,
      loop: true,
      callback: () => this.spawnBubble(),
    });
  }

  private seedInitialBubbles(): void {
    for (let index = 0; index < 7; index += 1) {
      this.spawnBubble(true);
    }
  }

  /**
   * Creates one bubble in world space. Bubbles use scrollFactor 1 because they
   * belong to the map and should move naturally with camera scrolling.
   */
  private spawnBubble(seedAcrossView = false): void {
    const cameraView = this.scene.cameras.main.worldView;
    const size = this.randomFloat(BUBBLE_MIN_SIZE, BUBBLE_MAX_SIZE);
    const x = Phaser.Math.Clamp(
      this.randomFloat(cameraView.left + 24, cameraView.right - 24),
      size,
      MAP_WIDTH - size
    );
    const yRangeTop = seedAcrossView ? cameraView.top : cameraView.bottom + 20;
    const yRangeBottom = seedAcrossView
      ? cameraView.bottom
      : cameraView.bottom + 100;
    const y = Phaser.Math.Clamp(
      this.randomFloat(yRangeTop, yRangeBottom),
      size,
      MAP_HEIGHT - size
    );

    const bubble = this.scene.add.circle(x, y, size / 2, 0xdff7ff, 0.34);
    bubble.setStrokeStyle(1, 0xffffff, 0.36);
    bubble.setScrollFactor(1);
    bubble.setDepth(BUBBLE_DEPTH);

    this.bubbles.add(bubble);

    const riseDistance = this.randomFloat(BUBBLE_RISE_MIN, BUBBLE_RISE_MAX);
    const drift = this.randomFloat(-28, 28);

    this.scene.tweens.add({
      targets: bubble,
      x: bubble.x + drift,
      y: Math.max(size, bubble.y - riseDistance),
      alpha: 0,
      duration: this.randomFloat(BUBBLE_DURATION_MIN_MS, BUBBLE_DURATION_MAX_MS),
      ease: "Sine.easeOut",
      onComplete: () => {
        this.bubbles.delete(bubble);
        bubble.destroy();
      },
    });
  }

  private randomFloat(min: number, max: number): number {
    return min + (max - min) * Math.random();
  }
}
