import Phaser from "phaser";
import {
  socketManager,
  type PuzzleStartPayload,
} from "../socket/SocketManager";

type PuzzleScenePayload = PuzzleStartPayload & {
  hidden_name?: PuzzleStartPayload["hiddenName"];
  maskedName?: PuzzleStartPayload["hiddenName"];
  nameMask?: PuzzleStartPayload["hiddenName"];
};

export class PuzzleScene extends Phaser.Scene {
  private puzzleData?: PuzzleScenePayload;

  constructor() {
    super("PuzzleScene");
  }

  init(data: PuzzleScenePayload): void {
    console.log("PuzzleScene data:", data);
    this.puzzleData = data;
  }

  create(): void {
    const { width, height } = this.scale;
    const hiddenName = this.formatHiddenName();

    this.add
      .rectangle(0, 0, width, height, 0x000000, 0.72)
      .setOrigin(0)
      .setScrollFactor(0);

    this.add
      .text(width / 2, height / 2 - 96, "Puzzle iniciado", {
        fontSize: "36px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 - 24,
        `animalId: ${this.puzzleData?.animalId ?? ""}`,
        {
          fontSize: "22px",
          color: "#d1e7ff",
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 24, `hiddenName: ${hiddenName}`, {
        fontSize: "22px",
        color: "#d1e7ff",
      })
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height / 2 + 72,
        `hint1: ${this.puzzleData?.hint1 ?? ""}`,
        {
          fontSize: "20px",
          color: "#f8fafc",
          align: "center",
          wordWrap: { width: width - 160 },
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 140, "Pressione ESC para fechar teste", {
        fontSize: "16px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown-ESC", () => {
      // Fechamento e puzzle:end temporarios para validar a issue #9 ate a forca real da issue #10.
      if (this.puzzleData?.animalId) {
        socketManager.emitPuzzleEnd({ animalId: this.puzzleData.animalId });
      }

      this.scene.stop();
      this.scene.resume("GameScene");
    });
  }

  private formatHiddenName(): string {
    const hiddenName = this.getHiddenNameValue();

    if (typeof hiddenName === "string") {
      return hiddenName.length > 0 ? hiddenName : "_";
    }

    if (!Array.isArray(hiddenName)) {
      return "_";
    }

    return hiddenName
      .map((character) => {
        if (character === null || character === undefined || character === "") {
          return "_";
        }

        return String(character);
      })
      .join(" ");
  }

  private getHiddenNameValue():
    | string
    | Array<string | null | undefined>
    | undefined {
    return (
      this.puzzleData?.hiddenName ??
      this.puzzleData?.hidden_name ??
      this.puzzleData?.maskedName ??
      this.puzzleData?.nameMask
    );
  }
}
