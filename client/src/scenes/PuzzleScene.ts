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
  private isHintPending = false;
  private hasNoMoreHints = false;
  private oxygenBeforeHint?: number;
  private unsubscribeSocketEvents: Array<() => void> = [];

  private panelContainer!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Rectangle;
  private flashOverlay!: Phaser.GameObjects.Rectangle;
  private wordContainer!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private attemptsText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private oxygenText!: Phaser.GameObjects.Text;
  private oxygenFill!: Phaser.GameObjects.Rectangle;
  private waterFill!: Phaser.GameObjects.Rectangle;
  private hintButton!: Phaser.GameObjects.Rectangle;
  private hintButtonLabel!: Phaser.GameObjects.Text;

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      this.closePuzzle(true);
      return;
    }

    const letter = this.normalizeLetter(event.key);

    if (!/^[a-z]$/.test(letter)) {
      return;
    }

    this.submitLetter(letter);
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
    this.oxygen = this.getInitialOxygen();
    this.isClosing = false;
    this.isHintPending = false;
    this.hasNoMoreHints = false;
    this.oxygenBeforeHint = undefined;
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .rectangle(0, 0, width, height, 0x020617, 0.68)
      .setOrigin(0)
      .setScrollFactor(0);

    this.flashOverlay = this.add
      .rectangle(0, 0, width, height, 0xef4444, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(20);

    this.panelContainer = this.add.container(0, 0);
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
    this.panel = this.add.rectangle(width / 2, height / 2, 980, 560, 0x11133a, 0.88);
    this.panel.setStrokeStyle(3, 0x67e8f9, 0.78);
    this.panelContainer.add(this.panel);

    const title = this.add
      .text(width / 2, height / 2 - 238, "Forca submarina", {
        fontSize: "34px",
        color: "#f8fafc",
      })
      .setOrigin(0.5);
    this.panelContainer.add(title);

    const closeText = this.add
      .text(width / 2, height / 2 + 244, "ESC fecha temporariamente para teste", {
        fontSize: "15px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);
    this.panelContainer.add(closeText);
  }

  private createSubmarineStatus(width: number, height: number): void {
    const leftX = width / 2 - 360;
    const centerY = height / 2;

    const hull = this.add
      .ellipse(leftX, centerY - 48, 210, 132, 0x172554, 1)
      .setStrokeStyle(3, 0x94a3b8, 0.8);
    const nose = this.add
      .ellipse(leftX + 86, centerY - 48, 64, 98, 0x0f172a, 1)
      .setStrokeStyle(2, 0x67e8f9, 0.45);
    const rearRing = this.add
      .ellipse(leftX - 84, centerY - 48, 34, 92, 0x020617, 1)
      .setStrokeStyle(2, 0x67e8f9, 0.35);
    const viewport = this.add
      .circle(leftX - 42, centerY - 58, 27, 0x082f49, 1)
      .setStrokeStyle(3, 0x67e8f9, 0.85);
    const viewportGlow = this.add.circle(leftX - 48, centerY - 64, 9, 0x7dd3fc, 0.36);

    this.waterFill = this.add
      .rectangle(leftX + 8, centerY + 10, 146, 1, 0x0ea5e9, 0.62)
      .setOrigin(0.5, 1);

    const chamber = this.add
      .rectangle(leftX + 8, centerY - 48, 146, 112, 0xffffff, 0)
      .setStrokeStyle(2, 0x38bdf8, 0.52);
    const chamberTop = this.add.rectangle(leftX + 8, centerY - 104, 120, 6, 0x67e8f9, 0.24);
    const chamberBottom = this.add.rectangle(leftX + 8, centerY + 10, 120, 6, 0x67e8f9, 0.18);

    const label = this.add
      .text(leftX, centerY + 60, "COMPARTIMENTO", {
        fontSize: "13px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    const o2Track = this.add
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

    this.panelContainer.add([
      hull,
      nose,
      rearRing,
      viewport,
      viewportGlow,
      this.waterFill,
      chamber,
      chamberTop,
      chamberBottom,
      label,
      o2Track,
      this.oxygenFill,
      this.oxygenText,
    ]);

    this.updateOxygenVisuals();
  }

  private createPuzzleContent(width: number, height: number): void {
    this.wordContainer = this.add.container(width / 2 + 90, height / 2 - 92);
    this.renderWord();
    this.panelContainer.add(this.wordContainer);

    const hintBox = this.add
      .rectangle(width / 2 + 90, height / 2 - 4, 590, 116, 0x020617, 0.58)
      .setStrokeStyle(2, 0x475569, 0.72);
    this.panelContainer.add(hintBox);

    this.hintText = this.add
      .text(width / 2 + 90, height / 2 - 4, this.formatHints(), {
        fontSize: "17px",
        color: "#facc15",
        align: "left",
        lineSpacing: 4,
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5);
    this.panelContainer.add(this.hintText);

    const promptText = this.add
      .text(width / 2 + 90, height / 2 + 80, "Digite uma letra", {
        fontSize: "22px",
        color: "#e2e8f0",
      })
      .setOrigin(0.5);
    this.panelContainer.add(promptText);

    this.attemptsText = this.add
      .text(width / 2 + 90, height / 2 + 124, "Tentativas: -", {
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);
    this.panelContainer.add(this.attemptsText);

    this.feedbackText = this.add
      .text(width / 2 + 90, height / 2 + 166, "Aguardando letra...", {
        fontSize: "20px",
        color: "#94a3b8",
      })
      .setOrigin(0.5);
    this.panelContainer.add(this.feedbackText);
  }

  private createHintButton(width: number, height: number): void {
    const buttonX = width / 2 + 90;
    const buttonY = height / 2 + 214;
    this.hintButton = this.add
      .rectangle(buttonX, buttonY, 180, 44, 0xfacc15, 0.96)
      .setStrokeStyle(2, 0xfef9c3, 0.9)
      .setInteractive({ useHandCursor: true });

    this.hintButtonLabel = this.add
      .text(buttonX, buttonY, "Pedir dica", {
        fontSize: "20px",
        color: "#0f172a",
      })
      .setOrigin(0.5);

    this.panelContainer.add([this.hintButton, this.hintButtonLabel]);
    this.hintButton.on("pointerdown", () => this.requestHint());
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
    if (!this.animalId || this.isHintPending || this.hasNoMoreHints) {
      return;
    }

    this.isHintPending = true;
    this.oxygenBeforeHint = this.oxygen;
    this.updateHintButtonState();
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
    this.isHintPending = false;

    if (payload.hint) {
      if (this.isNoMoreHintsMessage(payload.hint)) {
        this.hasNoMoreHints = true;
        if (!this.hints.some((hint) => this.isNoMoreHintsMessage(hint))) {
          this.hints.push("Sem mais dicas");
        }
      } else if (!this.hints.includes(payload.hint)) {
        this.hints.push(payload.hint);
        if (
          typeof payload.oxygen !== "number" &&
          this.oxygen === this.oxygenBeforeHint
        ) {
          this.applyOxygenDelta(-5);
        }
      }
      this.hintText.setText(this.formatHints());
    }

    if (typeof payload.oxygen === "number") {
      this.setOxygen(payload.oxygen);
    }

    this.updateHintButtonState();
    this.oxygenBeforeHint = undefined;
  }

  private handleStateUpdate(payload: StateUpdatePayload): void {
    const oxygenValues = Object.values(payload)
      .map((player) => player.oxygen)
      .filter((oxygen) => Number.isFinite(oxygen));

    if (oxygenValues.length > 0) {
      this.setOxygen(Math.min(...oxygenValues));
    }
  }

  private getInitialOxygen(): number {
    const state = socketManager.currentState;
    const localPlayerId = socketManager.currentSocket?.id;
    const localOxygen = localPlayerId ? state?.[localPlayerId]?.oxygen : undefined;

    if (typeof localOxygen === "number") {
      return Phaser.Math.Clamp(localOxygen, 0, 100);
    }

    const oxygenValues = Object.values(state ?? {})
      .map((player) => player.oxygen)
      .filter((oxygen) => Number.isFinite(oxygen));

    return oxygenValues.length > 0
      ? Phaser.Math.Clamp(Math.min(...oxygenValues), 0, 100)
      : 100;
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
    const uniqueHints = this.hints
      .filter((hint) => hint.length > 0)
      .filter((hint, index, allHints) => allHints.indexOf(hint) === index);
    const visibleHints = uniqueHints.slice(-3);
    const hiddenCount = uniqueHints.length - visibleHints.length;
    const prefix = hiddenCount > 0 ? [`+${hiddenCount} dica(s) anterior(es)`] : [];

    return [...prefix, ...visibleHints]
      .map((hint, index) => {
        if (hint.startsWith("+")) {
          return hint;
        }

        const visibleIndex = prefix.length > 0 ? index - 1 : index;
        return `Dica ${hiddenCount + visibleIndex + 1}: ${hint}`;
      })
      .join("\n");
  }

  private isNoMoreHintsMessage(hint: string): boolean {
    return this.normalizeText(hint).includes("sem mais dicas");
  }

  private normalizeText(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private normalizeLetter(value: string): string {
    return this.normalizeText(value).charAt(0);
  }

  private updateHintButtonState(): void {
    const isDisabled = this.isHintPending || this.hasNoMoreHints;
    this.hintButton.disableInteractive();

    if (!isDisabled) {
      this.hintButton.setInteractive({ useHandCursor: true });
    }

    this.hintButton.setFillStyle(
      isDisabled ? 0x64748b : 0xfacc15,
      isDisabled ? 0.72 : 0.96
    );
    this.hintButtonLabel.setText(this.hasNoMoreHints ? "Sem dicas" : "Pedir dica");
    this.hintButtonLabel.setColor(isDisabled ? "#cbd5e1" : "#0f172a");
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
    this.shakePanel();

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

  private shakePanel(): void {
    this.tweens.killTweensOf(this.panelContainer);
    this.panelContainer.setPosition(0, 0);
    this.tweens.add({
      targets: this.panelContainer,
      x: { from: -8, to: 0 },
      y: { from: 3, to: 0 },
      duration: 42,
      repeat: 4,
      yoyo: true,
      ease: "Sine.InOut",
      onComplete: () => this.panelContainer.setPosition(0, 0),
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
