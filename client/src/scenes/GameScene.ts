import Phaser from "phaser";
import {
  DEPTH_OVERLAY_MAX_ALPHA,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../data/mapConfig";
import { PlayerSubmarine } from "../entities/PlayerSubmarine";
import { MapGenerationSystem } from "../systems/MapGenerationSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { HUD } from "../ui/HUD";

export class GameScene extends Phaser.Scene {
  private player!: PlayerSubmarine;
  private movementSystem!: MovementSystem;
  private mapGenerationSystem!: MapGenerationSystem;
  private depthOverlay!: Phaser.GameObjects.Rectangle;
  private localHud!: HUD;
  private partnerHud!: HUD;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");
    this.mapGenerationSystem = new MapGenerationSystem(this);
    
    const storedSeed = sessionStorage.getItem("mapSeed");
    const mapSeed = storedSeed ? Number(storedSeed) : Date.now();

    sessionStorage.setItem("mapSeed", String(mapSeed));
   
    // Teste de seeds fixas para ver se o mapa se mantém
    //const mapSeed = 12345;
    //const mapSeed = 67890;
    this.mapGenerationSystem.generate(mapSeed);

    this.createDepthOverlay();

    this.player = new PlayerSubmarine(this, MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.movementSystem = new MovementSystem();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.localHud = new HUD(this, 24, this.scale.height - 58);
    // HUD do parceiro com escala menor 
    const partnerHudScale = 0.85;
    this.partnerHud = new HUD(
    this,
    this.scale.width - 24 - 200 * partnerHudScale,
    this.scale.height - 58
    );
    this.partnerHud.setScale(partnerHudScale);
    // TESTE DE ANIMAÇÃO DE OXIGÊNIO (Temporário enquanto o Backend não estiver pronto.)
    // Isso será modificado depois, integração com o backend para atualizar o HUD de acordo com os dados do jogador
    this.localHud.setOxygen(100);
    this.localHud.setHearts(2);

    this.time.delayedCall(1000, () => {
    this.localHud.setOxygen(50);
    });

    this.partnerHud.setOxygen(100);
    this.partnerHud.setHearts(3);
  }

  update(_time: number, delta: number): void {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    this.movementSystem.moveToPointer(
      this.player,
      worldPoint.x,
      worldPoint.y,
      delta
    );

    this.player.x = Phaser.Math.Clamp(this.player.x, 0, MAP_WIDTH);
    this.player.y = Phaser.Math.Clamp(this.player.y, 0, MAP_HEIGHT);
    this.updateDepthOverlay();
  }

  private createDepthOverlay(): void {
    this.depthOverlay = this.add.rectangle(
      0,
      0,
      this.scale.width,
      this.scale.height,
      0x000000,
      1
    );
    this.depthOverlay.setOrigin(0, 0);
    this.depthOverlay.setAlpha(0);
    this.depthOverlay.setScrollFactor(0);
    this.depthOverlay.setDepth(900);
  }

  private updateDepthOverlay(): void {
    const depthStart = 800;
    const depthRange = 500;
    const depthProgress = Phaser.Math.Clamp(
      (this.player.y - depthStart) / depthRange,
      0,
      1
    );
    this.depthOverlay.setAlpha(depthProgress * DEPTH_OVERLAY_MAX_ALPHA);
  }
}
