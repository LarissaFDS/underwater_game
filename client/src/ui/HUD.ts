import Phaser from "phaser";

const OXYGEN_BAR_WIDTH = 200;
const OXYGEN_BAR_HEIGHT = 16;
const OXYGEN_BAR_PADDING = 2;
const HEART_COUNT = 3;
const HEART_SIZE = 22;
const HEART_SPACING = 28;
const O2_ICON_SIZE = 18;

/**
 * Fixed-screen player status display.
 *
 * GameScene creates one HUD for the local player and a scaled HUD for the
 * partner. Both are updated from backend `state:update` snapshots.
 *
 * Hearts are rendered as PNG icons (texture "ui-heart") instead of Phaser
 * circles. An O2 bubble icon (texture "ui-o2-bubble") sits to the left of the
 * oxygen bar as a visual label. The oxygen fill tween is unchanged.
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

    // ── Oxygen bar ────────────────────────────────────────────────────────────
    // O2 bubble icon sits to the left of the bar as a label.
    const o2Icon = scene.add.image(
      -O2_ICON_SIZE / 2 - 4,
      OXYGEN_BAR_HEIGHT / 2,
      "ui-o2-bubble"
    );
    o2Icon.setDisplaySize(O2_ICON_SIZE, O2_ICON_SIZE);
    o2Icon.setOrigin(1, 0.5);

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

    // ── Heart icons ───────────────────────────────────────────────────────────
    this.hearts = this.createHearts(scene);

    this.add([o2Icon, oxygenBackground, this.oxygenFill, ...this.hearts]);
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
   * Active hearts are fully opaque; inactive hearts are dimmed.
   */
  setHearts(count: number): void {
    const clampedCount = Phaser.Math.Clamp(Math.floor(count), 0, HEART_COUNT);

    this.hearts.forEach((heart, index) => {
      if (index < clampedCount) {
        heart.setAlpha(1).clearTint();
      } else {
        heart.setAlpha(0.25).setTint(0x888888);
      }
    });
  }

  /**
   * Creates the fixed number of heart image icons used by the game rules.
   */
  private createHearts(scene: Phaser.Scene): Phaser.GameObjects.Image[] {
    return Array.from({ length: HEART_COUNT }, (_, index) => {
      const heart = scene.add.image(
        HEART_SIZE / 2 + index * HEART_SPACING,
        34,
        "ui-heart"
      );
      heart.setDisplaySize(HEART_SIZE, HEART_SIZE);
      return heart;
    });
  }
}
