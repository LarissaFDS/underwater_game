import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");

    this.add.text(640, 260, "Aguardando segundo jogador...", {
      fontSize: "32px",
      color: "#ffffff",
    }).setOrigin(0.5);

    const startText = this.add.text(640, 360, "Iniciar", {
      fontSize: "28px",
      color: "#00ffcc",
      backgroundColor: "#102a44",
      padding: {
        x: 20,
        y: 10,
      },
    }).setOrigin(0.5);

    startText.setInteractive({ useHandCursor: true });

    startText.on("pointerdown", () => {
      this.scene.start("GameScene");
    });
  }
}