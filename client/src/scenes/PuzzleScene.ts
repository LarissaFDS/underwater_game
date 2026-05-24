import Phaser from "phaser";
import {
  socketManager,
  type PuzzleHintPayload,
  type PuzzleResultPayload,
  type PuzzleStartPayload,
  type StateUpdatePayload,
} from "../socket/SocketManager";

type HiddenNameValue = string | Array<string | null | undefined>;

type PuzzleScenePayload = PuzzleStartPayload & {
  hidden_name?: PuzzleStartPayload["hiddenName"];
  maskedName?: PuzzleStartPayload["hiddenName"];
  nameMask?: PuzzleStartPayload["hiddenName"];
};

export class PuzzleScene extends Phaser.Scene {
  private puzzleData?: PuzzleScenePayload;
  private animalId = "";
  private wordSlots: string[] = [];
  private readonly attemptedLetters = new Set<string>();
  private readonly hints: string[] = [];
  private nextHintIndex = 1;
  private oxygen = 100;
  private isClosing = false;
  private unsubscribeSocketEvents: Array<() => void> = [];

  private panel!: Phaser.GameObjects.Rectangle;
  private flashOverlay!: Phaser.GameObjects.Rectangle;
  private wordContainer!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private attemptsText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private oxygenText!: Phaser.GameObjects.Text;
  private oxygenFill!: Phaser.GameObjects.Rectangle;
  private waterFill!: Phaser.GameObjects.Rectangle;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.closePuzzle(true);
      return;
    }

    if (!/^[a-z]$/i.test(event.key)) {
      return;
    }

    this.submitLetter(event.key.toLowerCase());
  };

  constructor() {
    super("PuzzleScene");
  }

  init(data: PuzzleScenePayload): void {
    console.log("PuzzleScene data:", data);
    this.puzzleData = data;
    this.animalId = data.animalId;
    this.wordSlots = this.parseHiddenName();
    this.attemptedLetters.clear();
    this.hints.splice(0, this.hints.length, data.hint1);
    this.nextHintIndex = 1;
    this.oxygen = 100;
    this.isClosing = false;
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .rectangle(0, 0, width, height, 0x020617, 0.82)
      .setOrigin(0)
      .setScrollFactor(0);

    this.flashOverlay = this.add
      .rectangle(0, 0, width, height, 0xef4444, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(20);

    this.createPanel(width, height);
    this.createSubmarineStatus(width, height);
    this.createPuzzleContent(width, height);
    this.createHintButton(width, height);

    this.input.keyboard?.on("keydown", this.handleKeyDown);
    this.unsubscribeSocketEvents.push(
      socketManager.onPuzzleResult((payload) => this.handlePuzzleResult(payload)),
      socketManager.onPuzzleHint((payload) => this.handlePuzzleHint(payload)),
      socketManager.onStateUpdate((payload) => this.handleStateUpdate(payload)),
      socketManager.onPlayerGameOver(() => this.closePuzzle(false)),
      socketManager.onGameOver(() => this.closePuzzle(false))
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", this.handleKeyDown);
      this.unsubscribeSocketEvents.forEach((unsubscribe) => unsubscribe());
      this.unsubscribeSocketEvents = [];
    });
  }

  private createPanel(width: number, height: number): void {
    this.panel = this.add
      .rectangle(width / 2, height / 2, 980, 560, 0x071827, 0.94)
      .setStrokeStyle(3, 0x94a3b8, 0.9);

    this.add
      .text(width / 2, height / 2 - 238, "Forca submarina", {
        fontSize: "34px",
        color: "#f8fafc",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 244, "ESC fecha temporariamente para teste", {
        fontSize: "15px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);
  }

  private createSubmarineStatus(width: number, height: number): void {
    const leftX = width / 2 - 360;
    const centerY = height / 2;

    this.add
      .ellipse(leftX, centerY - 46, 190, 128, 0x0f172a, 1)
      .setStrokeStyle(3, 0x94a3b8, 0.8);
    this.add.rectangle(leftX + 80, centerY - 46, 44, 72, 0x071827, 1);
    this.add.circle(leftX - 38, centerY - 54, 22, 0x38bdf8, 0.22);

    this.waterFill = this.add
      .rectangle(leftX, centerY + 14, 150, 1, 0x0ea5e9, 0.55)
      .setOrigin(0.5, 1);

    this.add
      .rectangle(leftX, centerY - 46, 150, 104, 0xffffff, 0)
      .setStrokeStyle(2, 0x38bdf8, 0.45);

    this.add
      .text(leftX, centerY + 60, "COMPARTIMENTO", {
        fontSize: "13px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.add
      .rectangle(leftX, centerY + 124, 176, 20, 0x020617, 1)
      .setStrokeStyle(2, 0x94a3b8, 0.8);
    this.oxygenFill = this.add
      .rectangle(leftX - 86, centerY + 124, 172, 16, 0x38bdf8, 1)
      .setOrigin(0, 0.5);
    this.oxygenText = this.add
      .text(leftX, centerY + 154, "O2 100%", {
        fontSize: "18px",
        color: "#e0f2fe",
      })
      .setOrigin(0.5);

    this.updateOxygenVisuals();
  }

  private createPuzzleContent(width: number, height: number): void {
    this.wordContainer = this.add.container(width / 2 + 90, height / 2 - 92);
    this.renderWord();

    this.hintText = this.add
      .text(width / 2 + 90, height / 2 - 8, this.formatHints(), {
        fontSize: "20px",
        color: "#facc15",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2 + 90, height / 2 + 80, "Digite uma letra", {
        fontSize: "22px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5);

    this.attemptsText = this.add
      .text(width / 2 + 90, height / 2 + 124, "Tentativas: -", {
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.feedbackText = this.add
      .text(width / 2 + 90, height / 2 + 166, "Aguardando letra...", {
        fontSize: "20px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);
  }

  private createHintButton(width: number, height: number): void {
    const buttonX = width / 2 + 90;
    const buttonY = height / 2 + 214;
    const button = this.add
      .rectangle(buttonX, buttonY, 180, 44, 0xfacc15, 0.95)
      .setStrokeStyle(2, 0xfef9c3, 0.9)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(buttonX, buttonY, "Pedir dica", {
        fontSize: "20px",
        color: "#0f172a",
      })
      .setOrigin(0.5);

    button.on("pointerdown", () => this.requestHint());
  }

  private submitLetter(letter: string): void {
    if (!this.animalId || this.attemptedLetters.has(letter)) {
      return;
    }

    this.attemptedLetters.add(letter);
    this.updateAttemptsText();
    this.setFeedback(`Letra enviada: ${letter.toUpperCase()}`, 0x94a3b8);
    socketManager.emitPuzzleGuess({ animalId: this.animalId, letter });
  }

  private requestHint(): void {
    if (!this.animalId) {
      return;
    }

    this.applyOxygenDelta(-5);
    this.setFeedback("Dica solicitada", 0xfacc15);
    socketManager.emitPuzzleHint({
      animalId: this.animalId,
      hintIndex: this.nextHintIndex,
    });
    this.nextHintIndex += 1;
  }

  private handlePuzzleResult(payload: PuzzleResultPayload): void {
    this.attemptedLetters.add(payload.letter.toLowerCase());
    this.updateAttemptsText();
    this.applyServerHiddenName(payload);

    if (payload.correct) {
      this.revealLetter(payload.letter, payload.positions);
      this.setFeedback("Acerto!", 0x22c55e);
    } else {
      this.setFeedback("Erro! O2 reduzido.", 0xef4444);
      this.flashError();
      this.applyOxygenDelta(-10);
    }

    if (typeof payload.oxygen === "number") {
      this.setOxygen(payload.oxygen);
    }

    if (this.isWordComplete()) {
      this.setFeedback("Animal identificado!", 0x22c55e);
      this.time.delayedCall(800, () => this.closePuzzle(true));
    }
  }

  private handlePuzzleHint(payload: PuzzleHintPayload): void {
    if (payload.hint) {
      this.hints.push(payload.hint);
      this.hintText.setText(this.formatHints());
    }

    if (typeof payload.oxygen === "number") {
      this.setOxygen(payload.oxygen);
    }
  }

  private handleStateUpdate(payload: StateUpdatePayload): void {
    const oxygenValues = Object.values(payload)
      .map((player) => player.oxygen)
      .filter((oxygen) => Number.isFinite(oxygen));

    if (oxygenValues.length > 0) {
      this.setOxygen(Math.min(...oxygenValues));
    }
  }

  private revealLetter(letter: string, positions: number[]): void {
    const changedPositions: number[] = [];

    positions.forEach((position) => {
      if (position < 0) {
        return;
      }

      while (position >= this.wordSlots.length) {
        this.wordSlots.push("_");
      }

      if (this.wordSlots[position] !== letter.toUpperCase()) {
        this.wordSlots[position] = letter.toUpperCase();
        changedPositions.push(position);
      }
    });

    this.renderWord(changedPositions);
  }

  private applyServerHiddenName(payload: PuzzleResultPayload): void {
    const hiddenName =
      payload.hiddenName ??
      payload.hidden_name ??
      payload.maskedName ??
      payload.nameMask;

    if (hiddenName !== undefined) {
      this.wordSlots = this.parseHiddenNameValue(hiddenName);
      this.renderWord();
    }
  }

  private renderWord(highlightPositions: number[] = []): void {
    this.wordContainer.removeAll(true);
    const spacing = 38;
    const totalWidth = Math.max(0, (this.wordSlots.length - 1) * spacing);

    this.wordSlots.forEach((character, index) => {
      const text = this.add
        .text(index * spacing - totalWidth / 2, 0, character, {
          fontSize: "42px",
          color: "#f8fafc",
          fontFamily: "monospace",
        })
        .setOrigin(0.5);

      this.wordContainer.add(text);

      if (highlightPositions.includes(index)) {
        text.setScale(1.35);
        this.tweens.add({
          targets: text,
          scale: 1,
          duration: 220,
          ease: "Back.Out",
        });
      }
    });
  }

  private parseHiddenName(): string[] {
    return this.parseHiddenNameValue(this.getHiddenNameValue());
  }

  private parseHiddenNameValue(hiddenName?: HiddenNameValue): string[] {
    if (Array.isArray(hiddenName)) {
      const parsed = hiddenName.map((character) => this.formatSlot(character));
      return parsed.length > 0 ? parsed : ["_"];
    }

    if (typeof hiddenName !== "string" || hiddenName.length === 0) {
      return ["_"];
    }

    const compactTokens = hiddenName.trim().split(/\s+/);
    if (
      compactTokens.length > 1 &&
      compactTokens.every((token) => token.length <= 1)
    ) {
      return compactTokens.map((token) => this.formatSlot(token));
    }

    return [...hiddenName].map((character) => this.formatSlot(character));
  }

  private formatSlot(character: string | null | undefined): string {
    if (character === null || character === undefined || character === "") {
      return "_";
    }

    if (character === "-" || character === " ") {
      return character;
    }

    return character === "_" ? "_" : character.toUpperCase();
  }

  private getHiddenNameValue(): HiddenNameValue | undefined {
    return (
      this.puzzleData?.hiddenName ??
      this.puzzleData?.hidden_name ??
      this.puzzleData?.maskedName ??
      this.puzzleData?.nameMask
    );
  }

  private formatHints(): string {
    return this.hints
      .filter((hint) => hint.length > 0)
      .map((hint, index) => `Dica ${index + 1}: ${hint}`)
      .join("\n");
  }

  private updateAttemptsText(): void {
    const attempts = Array.from(this.attemptedLetters)
      .map((letter) => letter.toUpperCase())
      .sort()
      .join(", ");

    this.attemptsText.setText(`Tentativas: ${attempts || "-"}`);
  }

  private setFeedback(message: string, color: number): void {
    this.feedbackText.setText(message);
    this.feedbackText.setColor(`#${color.toString(16).padStart(6, "0")}`);
  }

  private flashError(): void {
    this.flashOverlay.setAlpha(0.36);
    this.panel.setStrokeStyle(4, 0xef4444, 1);

    this.tweens.add({
      targets: this.flashOverlay,
      alpha: 0,
      duration: 260,
      ease: "Quad.Out",
    });
    this.time.delayedCall(280, () => {
      this.panel.setStrokeStyle(3, 0x94a3b8, 0.9);
    });
  }

  private applyOxygenDelta(delta: number): void {
    this.setOxygen(this.oxygen + delta);
  }

  private setOxygen(value: number): void {
    this.oxygen = Phaser.Math.Clamp(value, 0, 100);
    this.updateOxygenVisuals();
  }

  private updateOxygenVisuals(): void {
    const oxygenRatio = this.oxygen / 100;
    this.oxygenFill.displayWidth = 172 * oxygenRatio;
    this.oxygenText.setText(`O2 ${Math.round(this.oxygen)}%`);

    const waterHeight = 104 * (1 - oxygenRatio);
    this.waterFill.setVisible(waterHeight > 0);
    this.waterFill.displayHeight = Math.max(1, waterHeight);
  }

  private isWordComplete(): boolean {
    return this.wordSlots.every((character) => character !== "_");
  }

  private closePuzzle(emitPuzzleEnd: boolean): void {
    if (this.isClosing) {
      return;
    }

    this.isClosing = true;

    if (emitPuzzleEnd && this.animalId) {
      socketManager.emitPuzzleEnd({ animalId: this.animalId });
    }

    this.scene.resume("GameScene");
    this.scene.stop();
  }
}
