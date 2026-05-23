import Phaser from "phaser";
import { PlayerSubmarine } from "../entities/PlayerSubmarine";
import { MovementSystem } from "../systems/MovementSystem";
import { HUD } from "../ui/HUD";

export class GameScene extends Phaser.Scene {
  private player!: PlayerSubmarine;
  private movementSystem!: MovementSystem;
  private localHud!: HUD;
  private partnerHud!: HUD;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");

    this.createWorld();

    this.player = new PlayerSubmarine(this, 1200, 800);
    this.movementSystem = new MovementSystem();

    this.cameras.main.setBounds(0, 0, 2400, 1600);
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
  }

  private createWorld(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0a1628, 1);
    graphics.fillRect(0, 0, 2400, 1600);

    graphics.lineStyle(2, 0x123456, 0.5);

    for (let x = 0; x <= 2400; x += 120) {
      graphics.lineBetween(x, 0, x, 1600);
    }

    for (let y = 0; y <= 1600; y += 120) {
      graphics.lineBetween(0, y, 2400, y);
    }
  }
}
