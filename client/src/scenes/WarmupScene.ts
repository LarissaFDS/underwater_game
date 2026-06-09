import Phaser from "phaser";
import { getGameServiceUrl } from "../config/gameService";

const MAX_HEALTH_ATTEMPTS = 20;
const RETRY_DELAY_MS = 2500;

export class WarmupScene extends Phaser.Scene {
  private statusText?: Phaser.GameObjects.Text;
  private attemptText?: Phaser.GameObjects.Text;
  private retryButton?: Phaser.GameObjects.Text;
  private isChecking = false;
  private isShutdown = false;

  constructor() {
    super("WarmupScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.isShutdown = false;
    this.cameras.main.setBackgroundColor("#0a1628");

    this.add
      .text(width / 2, height / 2 - 120, "OCEAN GAME", {
        fontSize: "48px",
        color: "#38bdf8",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(
        width / 2,
        height / 2 - 10,
        [
          "Inicializando o sistema...",
          "Aquecendo servidor no Render...",
          "Isso pode levar alguns segundos no primeiro acesso.",
        ],
        {
          fontSize: "24px",
          color: "#ffffff",
          align: "center",
          lineSpacing: 8,
        }
      )
      .setOrigin(0.5);

    this.attemptText = this.add
      .text(width / 2, height / 2 + 110, "", {
        fontSize: "18px",
        color: "#bae6fd",
        align: "center",
      })
      .setOrigin(0.5);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isShutdown = true;
    });

    void this.waitForBackend();
  }

  private async waitForBackend(): Promise<void> {
    if (this.isChecking) {
      return;
    }

    this.isChecking = true;
    this.retryButton?.destroy();
    this.retryButton = undefined;

    let serviceUrl: string;

    try {
      serviceUrl = getGameServiceUrl();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "URL do backend invalida.");
      return;
    }

    for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt += 1) {
      if (this.isShutdown) {
        return;
      }

      this.attemptText?.setText(`Tentativa ${attempt}/${MAX_HEALTH_ATTEMPTS}`);

      if (await this.checkHealth(serviceUrl)) {
        this.scene.start("NicknameScene");
        return;
      }

      if (attempt < MAX_HEALTH_ATTEMPTS) {
        await this.delay(RETRY_DELAY_MS);
      }
    }

    this.showError("Nao foi possivel conectar ao servidor do jogo.");
  }

  private async checkHealth(serviceUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${serviceUrl}/health`, {
        method: "GET",
        cache: "no-store",
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private showError(message: string): void {
    this.isChecking = false;
    this.statusText?.setText([
      "Servidor indisponivel.",
      message,
      "Verifique a URL do backend e tente novamente.",
    ]);
    this.statusText?.setColor("#fca5a5");
    this.attemptText?.setText("");
    this.createRetryButton();
  }

  private createRetryButton(): void {
    if (this.retryButton) {
      return;
    }

    const { width, height } = this.scale;

    this.retryButton = this.add
      .text(width / 2, height / 2 + 120, "Tentar novamente", {
        fontSize: "22px",
        color: "#ffffff",
        backgroundColor: "#0369a1",
        padding: { x: 18, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    this.retryButton.on("pointerdown", () => {
      this.statusText?.setColor("#ffffff");
      this.statusText?.setText([
        "Inicializando o sistema...",
        "Aquecendo servidor no Render...",
        "Isso pode levar alguns segundos no primeiro acesso.",
      ]);
      void this.waitForBackend();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.time.delayedCall(ms, resolve);
    });
  }
}
