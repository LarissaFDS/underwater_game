import Phaser from "phaser";
import {
  DEPTH_OVERLAY_MAX_ALPHA,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../data/mapConfig";

const BUBBLE_TEXTURE_KEY = "depth-effects-bubble";
const DEPTH_OVERLAY_DEPTH = 720;
const BUBBLE_DEPTH = 70;
const VIGNETTE_DEPTH = 880;
const DEPTH_LAYER_COUNT = 96;
const BUBBLE_ZONE_COUNT = 4;

/**
 * Visual-only atmosphere system for depth, water bubbles, and camera vignette.
 *
 * It creates static graphics once and relies on lightweight Phaser particle
 * emitters so the gameplay scene can keep targeting 60fps without allocating
 * new Graphics objects during update ticks.
 */
export class DepthEffectsSystem {
  private readonly depthOverlay: Phaser.GameObjects.Graphics;
  private readonly vignette: Phaser.GameObjects.Graphics;
  private readonly bubbleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] =
    [];
  private readonly handleResize = (): void => {
    this.redrawVignette();
  };

  constructor(private readonly scene: Phaser.Scene) {
    this.ensureBubbleTexture();
    this.depthOverlay = this.createDepthOverlay();
    this.vignette = this.createVignette();
    this.createBubbleEmitters();

    this.scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize);
  }

  /**
   * Releases particles and graphics when GameScene shuts down.
   */
  public destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize);
    this.bubbleEmitters.forEach((emitter) => emitter.destroy());
    this.bubbleEmitters.length = 0;
    this.depthOverlay.destroy();
    this.vignette.destroy();
  }

  /**
   * Draws a world-space depth gradient in many low-alpha bands.
   *
   * The overlay follows the map with scrollFactor(1), because it represents
   * darker water at deeper world coordinates instead of a camera filter.
   */
  private createDepthOverlay(): Phaser.GameObjects.Graphics {
    const overlay = this.scene.add.graphics();
    const layerHeight = Math.ceil(MAP_HEIGHT / DEPTH_LAYER_COUNT);
    const maxAlpha = Math.min(DEPTH_OVERLAY_MAX_ALPHA, 0.48);

    for (let index = 0; index < DEPTH_LAYER_COUNT; index += 1) {
      const progress = index / (DEPTH_LAYER_COUNT - 1);
      const easedProgress = Phaser.Math.Easing.Sine.InOut(progress);
      const alpha = 0.025 + easedProgress * maxAlpha;
      const y = index * layerHeight;

      overlay.fillStyle(0x020817, alpha);
      overlay.fillRect(0, y, MAP_WIDTH, layerHeight + 1);
    }

    overlay.setScrollFactor(1);
    overlay.setDepth(DEPTH_OVERLAY_DEPTH);

    return overlay;
  }

  /**
   * Creates sparse world-space bubbles that rise through the map.
   *
   * Bubbles use scrollFactor(1) so they stay attached to map coordinates while
   * the camera follows the submarine. Emitter pools and maxAliveParticles keep
   * the effect bounded for performance.
   */
  private createBubbleEmitters(): void {
    const zoneWidth = MAP_WIDTH / BUBBLE_ZONE_COUNT;

    for (let zoneIndex = 0; zoneIndex < BUBBLE_ZONE_COUNT; zoneIndex += 1) {
      const minX = zoneIndex * zoneWidth + 48;
      const maxX = (zoneIndex + 1) * zoneWidth - 48;
      const emitter = this.scene.add.particles(0, 0, BUBBLE_TEXTURE_KEY, {
        x: { min: minX, max: maxX },
        y: { min: MAP_HEIGHT * 0.15, max: MAP_HEIGHT - 40 },
        lifespan: { min: 4600, max: 7200 },
        speedY: { min: -34, max: -18 },
        speedX: { min: -8, max: 8 },
        accelerationX: { min: -3, max: 3 },
        alpha: { start: 0.44, end: 0 },
        scale: { start: 1, end: 0.5 },
        tint: [0xffffff, 0xbdefff],
        frequency: 2200 + zoneIndex * 180,
        quantity: 1,
        maxAliveParticles: 5,
        reserve: 5,
        blendMode: Phaser.BlendModes.ADD,
      });

      emitter.setScrollFactor(1);
      emitter.setDepth(BUBBLE_DEPTH);
      this.bubbleEmitters.push(emitter);
    }
  }

  /**
   * Creates a fixed camera-space vignette that stays aligned to the canvas.
   *
   * It uses scrollFactor(0) because the edge darkening is a screen effect, not
   * a map object. Its depth stays below HUD and modal overlays.
   */
  private createVignette(): Phaser.GameObjects.Graphics {
    const vignette = this.scene.add.graphics();
    vignette.setScrollFactor(0);
    vignette.setDepth(VIGNETTE_DEPTH);
    this.redrawVignette(vignette);

    return vignette;
  }

  private redrawVignette(target: Phaser.GameObjects.Graphics = this.vignette): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const layerCount = 16;
    const edgeSize = Math.min(width, height) * 0.22;
    const step = edgeSize / layerCount;

    target.clear();

    for (let index = 0; index < layerCount; index += 1) {
      const progress = 1 - index / layerCount;
      const alpha = 0.014 * progress * progress;
      const inset = index * step;
      const bandSize = Math.ceil(step) + 1;

      target.fillStyle(0x000000, alpha);
      target.fillRect(inset, inset, width - inset * 2, bandSize);
      target.fillRect(
        inset,
        height - inset - bandSize,
        width - inset * 2,
        bandSize
      );
      target.fillRect(inset, inset, bandSize, height - inset * 2);
      target.fillRect(
        width - inset - bandSize,
        inset,
        bandSize,
        height - inset * 2
      );
    }
  }

  private ensureBubbleTexture(): void {
    if (this.scene.textures.exists(BUBBLE_TEXTURE_KEY)) {
      return;
    }

    const bubble = this.scene.add.graphics();

    bubble.fillStyle(0xdff8ff, 0.65);
    bubble.fillCircle(4, 4, 3.6);
    bubble.lineStyle(1, 0xffffff, 0.75);
    bubble.strokeCircle(4, 4, 3.4);
    bubble.fillStyle(0xffffff, 0.8);
    bubble.fillCircle(2.8, 2.6, 0.9);
    bubble.generateTexture(BUBBLE_TEXTURE_KEY, 8, 8);
    bubble.destroy();
  }
}
