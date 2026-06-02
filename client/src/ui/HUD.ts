import Phaser from "phaser";
import { SPRITE_KEYS } from "../assets/assetsMap";

const OXYGEN_BAR_WIDTH = 200;
const OXYGEN_BAR_HEIGHT = 16;
const OXYGEN_BAR_PADDING = 2;
const HEART_COUNT = 3;
const OXYGEN_HEADER_Y = -28;
const HEART_SIZE = 22;

/**
 * Fixed-screen player status display.
 *
 * GameScene creates one HUD for the local player and a scaled HUD for the
 * partner. Both are updated from backend `state:update` snapshots.
 */
export class HUD extends Phaser.GameObjects.Container {
  private readonly oxygenFill: Phaser.GameObjects.Rectangle;
  private readonly hearts: Phaser.GameObjects.Image[];
  private oxygenTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    scene.add.existing(this);
    this.setScrollFactor(0);
    this.setDepth(1000);

    const oxygenIcon = scene.add.image(
      0,
      OXYGEN_HEADER_Y,
      SPRITE_KEYS.oxygenBubble
    );
    oxygenIcon.setOrigin(0, 0.5);
    oxygenIcon.setDisplaySize(22, 22);

    const oxygenLabel = scene.add.text(28, OXYGEN_HEADER_Y, "Oxigênio", {
      fontSize: "14px",
      color: "#e0f2fe",
      fontFamily: "Arial, sans-serif",
    });
    oxygenLabel.setOrigin(0, 0.5);

    const oxygenBackground = scene.add.rectangle(
      0,
      0,
      OXYGEN_BAR_WIDTH,
      OXYGEN_BAR_HEIGHT,
      0xffffff,
      0.9
    );
    oxygenBackground.setOrigin(0, 0);

    this.oxygenFill = scene.add.rectangle(
      OXYGEN_BAR_PADDING,
      OXYGEN_BAR_PADDING,
      OXYGEN_BAR_WIDTH - OXYGEN_BAR_PADDING * 2,
      OXYGEN_BAR_HEIGHT - OXYGEN_BAR_PADDING * 2,
      0x2d9cff,
      1
    );
    this.oxygenFill.setOrigin(0, 0);

    this.hearts = this.createHearts(scene);

    this.add([
      oxygenIcon,
      oxygenLabel,
      oxygenBackground,
      this.oxygenFill,
      ...this.hearts,
    ]);
  }

  /**
   * Updates the oxygen bar with a small tween for backend state changes.
   */
  setOxygen(value: number): void {
    const clampedValue = Phaser.Math.Clamp(value, 0, 100);
    const targetWidth =
      ((OXYGEN_BAR_WIDTH - OXYGEN_BAR_PADDING * 2) * clampedValue) / 100;

    this.oxygenTween?.stop();
    this.oxygenTween = this.scene.tweens.add({
      targets: this.oxygenFill,
      displayWidth: targetWidth,
      duration: 250,
      ease: "Sine.easeOut",
    });
  }

  /**
   * Updates the visible heart count for the player represented by this HUD.
   */
  setHearts(count: number): void {
    const clampedCount = Phaser.Math.Clamp(Math.floor(count), 0, HEART_COUNT);

    this.hearts.forEach((heart, index) => {
      const isActive = index < clampedCount;
      heart.setAlpha(isActive ? 1 : 0.3);
    });
  }

  /**
   * Creates the fixed number of heart indicators used by the game rules.
   */
  private createHearts(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
    return Array.from({ length: HEART_COUNT }, (_, index) => {
      const heart = scene.add.image(12 + index * 28, 34, SPRITE_KEYS.heart);
      heart.setDisplaySize(HEART_SIZE, HEART_SIZE);
      return heart;
    });
  }
}
