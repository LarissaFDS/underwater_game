import Phaser from "phaser";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");

    this.add.text(40, 40, "Cena do jogo", {
      fontSize: "24px",
      color: "#ffffff",
    });
  }
}