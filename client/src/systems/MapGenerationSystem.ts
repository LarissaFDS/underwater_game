import Phaser from "phaser";
import {
  MAP_HEIGHT,
  MAP_TILE_SIZE,
  MAP_WIDTH,
  ROCK_CONFIG,
  SEAWEED_CONFIG,
} from "../data/mapConfig";

export interface MapObstacleBounds {
  obstacleType: string;
  bounds: Phaser.Geom.Rectangle;
}

export class MapGenerationSystem {
  private seed = 1;
  private readonly obstacles: Array<{
    obstacleType: string;
    object: Phaser.GameObjects.Rectangle;
  }> = [];

  constructor(private readonly scene: Phaser.Scene) {}

  public generate(seed: number): void {
    this.seed = seed || 1;
    this.obstacles.length = 0;
    this.createBaseGrid();
    this.createRocks();
    this.createSeaweed();
  }

  public getObstacleBounds(): MapObstacleBounds[] {
    return this.obstacles.map((obstacle) => ({
      obstacleType: obstacle.obstacleType,
      bounds: obstacle.object.getBounds(),
    }));
  }

  private createBaseGrid(): void {
    const graphics = this.scene.add.graphics();

    graphics.fillStyle(0x0a1628, 1);
    graphics.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    graphics.lineStyle(2, 0x123456, 0.5);

    for (let x = 0; x <= MAP_WIDTH; x += MAP_TILE_SIZE) {
      graphics.lineBetween(x, 0, x, MAP_HEIGHT);
    }

    for (let y = 0; y <= MAP_HEIGHT; y += MAP_TILE_SIZE) {
      graphics.lineBetween(0, y, MAP_WIDTH, y);
    }
  }

  private createRocks(): void {
    const count = this.randomInt(ROCK_CONFIG.minCount, ROCK_CONFIG.maxCount);

    for (let index = 0; index < count; index += 1) {
      const width = this.randomInt(ROCK_CONFIG.minWidth, ROCK_CONFIG.maxWidth);
      const height = this.randomInt(ROCK_CONFIG.minHeight, ROCK_CONFIG.maxHeight);
      const x = this.randomInt(width / 2, MAP_WIDTH - width / 2);
      const y = this.randomInt(height / 2, MAP_HEIGHT - height / 2);

      const rock = this.scene.add.rectangle(x, y, width, height, 0x5f6b75, 1);
      rock.setStrokeStyle(3, 0x39434d, 0.8);
      rock.setRotation(this.randomFloat(-0.35, 0.35));
      rock.setDepth(1);
      this.obstacles.push({ obstacleType: "rock", object: rock });

      const highlight = this.scene.add.rectangle(
        x - width * 0.18,
        y - height * 0.15,
        width * 0.28,
        height * 0.18,
        0x8a98a5,
        0.45
      );
      highlight.setRotation(rock.rotation);
      highlight.setDepth(2);
    }
  }

  private createSeaweed(): void {
    const count = this.randomInt(
      SEAWEED_CONFIG.minCount,
      SEAWEED_CONFIG.maxCount
    );

    for (let index = 0; index < count; index += 1) {
      const width = this.randomInt(
        SEAWEED_CONFIG.minWidth,
        SEAWEED_CONFIG.maxWidth
      );
      const height = this.randomInt(
        SEAWEED_CONFIG.minHeight,
        SEAWEED_CONFIG.maxHeight
      );
      const x = this.randomInt(width, MAP_WIDTH - width);
      const y = this.randomInt(height, MAP_HEIGHT - height / 2);

      const stem = this.scene.add.rectangle(x, y, width, height, 0x14532d, 1);
      stem.setOrigin(0.5, 1);
      stem.setDepth(3);

      const leaf = this.scene.add.rectangle(
        x + width * 0.7,
        y - height * 0.45,
        width * 0.65,
        height * 0.48,
        0x166534,
        0.9
      );
      leaf.setOrigin(0.5, 1);
      leaf.setRotation(this.randomFloat(-0.45, 0.45));
      leaf.setDepth(4);
    }
  }

  private random(): number {
    this.seed = (1664525 * this.seed + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.randomFloat(min, max + 1));
  }

  private randomFloat(min: number, max: number): number {
    return min + (max - min) * this.random();
  }
}
