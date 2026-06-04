import Phaser from "phaser";
import { socketManager, type GameStartPayload } from "../socket/SocketManager";
import {
  PLAYER_NICKNAMES_REGISTRY_KEY,
  getPlayerIdentityState,
  normalizeNickname,
  resolveNicknameForPlayerId,
} from "../state/playerIdentity";
import {
  type AnimalScoreEntry,
  type GameResultPayload,
  type PlayerScoreSummary,
} from "../socket/ScoreSocketManager";

type ScoreCellValue = string | number | null | undefined;

const PANEL_WIDTH = 1080;
const PANEL_HEIGHT = 620;

/**
 * Final result scene shown after the score-service emits `game:result`.
 *
 * EndScene is a visual-only component: it does not calculate scores or decide
 * winners. It renders the backend result produced centrally by score-service
 * so both clients display the same final match outcome.
 */
export class EndScene extends Phaser.Scene {
  private result: GameResultPayload = {};
  private unsubscribeGameStart?: () => void;
  private restartButton?: Phaser.GameObjects.Rectangle;
  private restartButtonLabel?: Phaser.GameObjects.Text;
  private restartStatus?: Phaser.GameObjects.Text;
  private isRestartRequested = false;

  constructor() {
    super("EndScene");
  }

  /**
   * Receives the raw `game:result` payload from score-service.
   */
  init(data: GameResultPayload = {}): void {
    this.result = data ?? {};
    this.isRestartRequested = false;
    this.unsubscribeGameStart?.();
    this.unsubscribeGameStart = undefined;
  }

  create(): void {
    const { width, height } = this.scale;
    const panelX = width / 2;
    const panelY = height / 2;

    this.cameras.main.setBackgroundColor("rgba(0, 0, 0, 0)");

    this.add
      .rectangle(0, 0, width, height, 0x020617, 0.74)
      .setOrigin(0)
      .setScrollFactor(0);

    this.add
      .rectangle(panelX, panelY, PANEL_WIDTH, PANEL_HEIGHT, 0x0f172a, 0.96)
      .setStrokeStyle(3, 0x38bdf8, 0.72);

    const headerBand = this.add.rectangle(
      panelX,
      panelY - PANEL_HEIGHT / 2 + 56,
      PANEL_WIDTH - 34,
      86,
      0x082f49,
      0.72
    );
    headerBand.setStrokeStyle(1, 0x7dd3fc, 0.35);

    this.add
      .text(panelX, panelY - PANEL_HEIGHT / 2 + 38, this.getTitle(), {
        fontSize: "34px",
        color: "#f8fafc",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(panelX, panelY - PANEL_HEIGHT / 2 + 76, this.getReasonText(), {
        fontSize: "18px",
        color: "#bae6fd",
        align: "center",
        wordWrap: { width: PANEL_WIDTH - 120 },
      })
      .setOrigin(0.5);

    this.createWinnerBlock(panelX, panelY);
    this.createPlayerSummary(panelX, panelY);
    this.createAnimalScoreTable(panelX, panelY);
    this.createFooter(panelX, panelY);

    this.unsubscribeGameStart = socketManager.onGameStart((payload) => {
      this.startRestartedGame(payload);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeGameStart?.();
      this.unsubscribeGameStart = undefined;
    });
  }

  private createWinnerBlock(panelX: number, panelY: number): void {
    const winner = this.getWinnerId();
    const winnerText = winner
      ? this.formatPlayerName(winner, this.getWinnerNickname())
      : "Empate ou vencedor não informado";
    const animalsText = this.getDiscoveredAnimalsSummary();

    const box = this.add
      .rectangle(panelX - 315, panelY - 160, 420, 118, 0x020617, 0.58)
      .setStrokeStyle(2, 0x1e40af, 0.72);

    this.add
      .text(box.x - 185, box.y - 42, "Resultado final", {
        fontSize: "18px",
        color: "#93c5fd",
      })
      .setOrigin(0, 0.5);

    this.add
      .text(box.x - 185, box.y - 10, `Vencedor: ${winnerText}`, {
        fontSize: "20px",
        color: "#f8fafc",
        wordWrap: { width: 370 },
      })
      .setOrigin(0, 0.5);

    this.add
      .text(box.x - 185, box.y + 28, animalsText, {
        fontSize: "16px",
        color: "#cbd5e1",
        wordWrap: { width: 370 },
      })
      .setOrigin(0, 0.5);
  }

  private createPlayerSummary(panelX: number, panelY: number): void {
    const summaries = this.getPlayerSummaries();
    const x = panelX - 315;
    const y = panelY + 10;

    this.add
      .rectangle(x, y, 420, 210, 0x020617, 0.58)
      .setStrokeStyle(2, 0x1e40af, 0.72);

    this.add
      .text(x - 185, y - 80, "Resumo dos jogadores", {
        fontSize: "18px",
        color: "#93c5fd",
      })
      .setOrigin(0, 0.5);

    if (summaries.length === 0) {
      this.add
        .text(x - 185, y - 22, "Sem resumo de jogadores no resultado.", {
          fontSize: "17px",
          color: "#cbd5e1",
          wordWrap: { width: 370 },
        })
        .setOrigin(0, 0.5);
      return;
    }

    summaries.slice(0, 4).forEach((summary, index) => {
      const rowY = y - 38 + index * 42;
      const playerId = this.getSummaryPlayerId(summary);

      this.add
        .text(
          x - 185,
          rowY,
          this.formatPlayerName(playerId, this.getSummaryNickname(summary)),
          {
            fontSize: "16px",
            color: "#f8fafc",
            wordWrap: { width: 210 },
          }
        )
        .setOrigin(0, 0.5);

      this.add
        .text(
          x + 48,
          rowY,
          `${this.formatValue(summary.totalPoints)} pts`,
          {
            fontSize: "17px",
            color: "#facc15",
          }
        )
        .setOrigin(0, 0.5);

      this.add
        .text(
          x + 156,
          rowY,
          `${this.formatValue(summary.animalsFound)} animais`,
          {
            fontSize: "15px",
            color: "#cbd5e1",
          }
        )
        .setOrigin(0, 0.5);
    });

    if (summaries.length > 4) {
      this.add
        .text(x - 185, y + 82, `+${summaries.length - 4} jogador(es)`, {
          fontSize: "14px",
          color: "#94a3b8",
        })
        .setOrigin(0, 0.5);
    }
  }

  private createAnimalScoreTable(panelX: number, panelY: number): void {
    const animalScores = this.getAnimalScores();
    const x = panelX + 235;
    const y = panelY - 32;
    const tableWidth = 590;
    const tableHeight = 392;

    this.add
      .rectangle(x, y, tableWidth, tableHeight, 0x020617, 0.58)
      .setStrokeStyle(2, 0x1e40af, 0.72);

    this.add
      .text(
        x - tableWidth / 2 + 24,
        y - tableHeight / 2 + 32,
        "Pontuação por animal",
        {
          fontSize: "18px",
          color: "#93c5fd",
        }
      )
      .setOrigin(0, 0.5);

    const header = this.buildTableLine(
      "Animal",
      "Base",
      "Tempo",
      "Penal.",
      "Total"
    );
    this.add
      .text(x - tableWidth / 2 + 24, y - tableHeight / 2 + 72, header, {
        fontSize: "15px",
        color: "#bae6fd",
        fontFamily: "monospace",
      })
      .setOrigin(0, 0.5);

    this.add
      .rectangle(
        x,
        y - tableHeight / 2 + 94,
        tableWidth - 48,
        1,
        0x334155,
        0.95
      )
      .setOrigin(0.5);

    if (animalScores.length === 0) {
      this.add
        .text(
          x - tableWidth / 2 + 24,
          y - tableHeight / 2 + 132,
          "Sem pontuação por animal no resultado.",
          {
            fontSize: "17px",
            color: "#cbd5e1",
            wordWrap: { width: tableWidth - 70 },
          }
        )
        .setOrigin(0, 0.5);
      return;
    }

    const maxRows = 8;
    animalScores.slice(0, maxRows).forEach((score, index) => {
      const rowY = y - tableHeight / 2 + 124 + index * 30;
      const line = this.buildTableLine(
        score.animalId ?? "animal",
        this.formatValue(score.pointsBase),
        this.formatValue(score.timeBonus),
        this.formatValue(score.wrongPenalty),
        this.formatValue(score.totalPoints)
      );

      this.add
        .text(x - tableWidth / 2 + 24, rowY, line, {
          fontSize: "15px",
          color: index % 2 === 0 ? "#f8fafc" : "#cbd5e1",
          fontFamily: "monospace",
        })
        .setOrigin(0, 0.5);
    });

    if (animalScores.length > maxRows) {
      this.add
        .text(
          x - tableWidth / 2 + 24,
          y + tableHeight / 2 - 30,
          `+${animalScores.length - maxRows} animal(is) no resultado`,
          {
            fontSize: "14px",
            color: "#94a3b8",
          }
        )
        .setOrigin(0, 0.5);
    }
  }

  private createFooter(panelX: number, panelY: number): void {
    const buttonY = panelY + PANEL_HEIGHT / 2 - 62;

    this.restartButton = this.add
      .rectangle(panelX, buttonY, 238, 52, 0x22c55e, 0.96)
      .setStrokeStyle(2, 0xbbf7d0, 0.95)
      .setInteractive({ useHandCursor: true });

    this.restartButtonLabel = this.add
      .text(panelX, buttonY, "Jogar novamente", {
        fontSize: "20px",
        color: "#052e16",
      })
      .setOrigin(0.5);

    this.restartStatus = this.add
      .text(panelX, buttonY + 40, "", {
        fontSize: "15px",
        color: "#bae6fd",
      })
      .setOrigin(0.5);

    this.restartButton.on("pointerover", () => {
      if (!this.isRestartRequested) {
        this.restartButton?.setFillStyle(0x4ade80, 1);
      }
    });
    this.restartButton.on("pointerout", () => {
      if (!this.isRestartRequested) {
        this.restartButton?.setFillStyle(0x22c55e, 0.96);
      }
    });
    this.restartButton.on("pointerdown", () => this.requestRestart());
  }

  private requestRestart(): void {
    if (this.isRestartRequested) {
      return;
    }

    this.isRestartRequested = true;
    this.restartButton?.disableInteractive();
    this.restartButton?.setFillStyle(0x64748b, 0.8);
    this.restartButtonLabel?.setText("Aguardando...");
    this.restartButtonLabel?.setColor("#e2e8f0");
    this.restartStatus?.setText("Solicitando nova partida ao game-service");

    // Restart changes the gameplay room state, so it is emitted to the
    // game-service socket. The score-service remains read-only for results.
    socketManager.emitGameRestart();
  }

  private startRestartedGame(payload: GameStartPayload): void {
    if (!this.canStartGame(payload)) {
      console.warn(
        "[EndScene] Ignoring restart game:start without two players and a valid seed",
        payload
      );
      this.restartStatus?.setText("Aguardando game:start válido do backend");
      return;
    }

    this.unsubscribeGameStart?.();
    this.unsubscribeGameStart = undefined;
    this.scene.stop("PuzzleScene");
    this.scene.stop("GameScene");
    this.scene.start("GameScene", payload);
  }

  private getTitle(): string {
    const reason = this.result.reason;

    if (reason === "exploration") {
      return "Exploração concluída!";
    }

    if (reason === "elimination") {
      const winner = this.getWinnerId();
      return winner
        ? `${this.formatPlayerName(winner, this.getWinnerNickname())} venceu!`
        : "Fim de jogo";
    }

    return "Fim de jogo";
  }

  private getReasonText(): string {
    if (this.isScoreServiceUnavailable()) {
      return (
        this.readStringField("message", "statusMessage") ??
        "Pontuação indisponível no momento."
      );
    }

    if (this.result.reason === "exploration") {
      return "Todos os animais foram descobertos";
    }

    if (this.result.reason === "elimination") {
      return this.getEliminationDetail() ?? "Eliminação";
    }

    return this.readStringField("reason") ?? "Resultado final recebido";
  }

  private isScoreServiceUnavailable(): boolean {
    return this.result.scoreServiceUnavailable === true;
  }

  private getEliminationDetail(): string | undefined {
    const value = this.readStringField(
      "eliminationReason",
      "eliminationCause",
      "cause",
      "detail",
      "message"
    );
    const normalized = value
      ?.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (!normalized) {
      return undefined;
    }

    const eliminatedPlayer = this.getEliminatedPlayerName();

    if (
      normalized.includes("o2") ||
      normalized.includes("oxygen") ||
      normalized.includes("oxigen")
    ) {
      return `${eliminatedPlayer} teve o O2 esgotado`;
    }

    if (
      normalized.includes("vida") ||
      normalized.includes("heart") ||
      normalized.includes("life")
    ) {
      return `${eliminatedPlayer} teve a vida esgotada`;
    }

    return value;
  }

  private getEliminatedPlayerName(): string {
    const eliminatedPlayerId =
      typeof this.result.eliminatedPlayerId === "string"
        ? this.result.eliminatedPlayerId
        : undefined;

    if (eliminatedPlayerId) {
      return this.formatPlayerName(
        eliminatedPlayerId,
        this.readStringField("eliminatedPlayerNickname", "eliminatedPlayerName")
      );
    }

    const winnerId = this.getWinnerId();
    const eliminatedSummary = this.getPlayerSummaries().find(
      (summary) => this.getSummaryPlayerId(summary) !== winnerId
    );

    return this.formatPlayerName(
      this.getSummaryPlayerId(eliminatedSummary),
      eliminatedSummary ? this.getSummaryNickname(eliminatedSummary) : undefined
    );
  }

  private getWinnerId(): string | null {
    return this.result.winner ?? this.result.winnerId ?? null;
  }

  private getWinnerNickname(): string | undefined {
    return this.readStringField(
      "winnerNickname",
      "winnerName",
      "winnerDisplayName"
    );
  }

  private getDiscoveredAnimalsSummary(): string {
    const animalScores = this.getAnimalScores();
    const found = this.result.animalsFound;

    if (typeof found === "number") {
      return `Animais descobertos: ${found}`;
    }

    if (Array.isArray(found) && found.length > 0) {
      return `Animais descobertos: ${found.length}`;
    }

    return `Animais descobertos: ${animalScores.length}`;
  }

  private getAnimalScores(): AnimalScoreEntry[] {
    if (Array.isArray(this.result.animalScores)) {
      return this.result.animalScores;
    }

    if (Array.isArray(this.result.animalsFound)) {
      return this.result.animalsFound.map((animal) =>
        typeof animal === "string" ? { animalId: animal } : animal
      );
    }

    return [];
  }

  private getPlayerSummaries(): PlayerScoreSummary[] {
    if (Array.isArray(this.result.playerSummaries)) {
      return this.result.playerSummaries;
    }

    if (Array.isArray(this.result.scores)) {
      return this.result.scores.filter(
        (score): score is PlayerScoreSummary =>
          typeof score === "object" && score !== null
      );
    }

    if (this.result.scores && typeof this.result.scores === "object") {
      return Object.entries(this.result.scores as Record<string, unknown>).map(
        ([playerId, score]) => {
          if (typeof score === "number") {
            return { playerId, totalPoints: score };
          }

          if (score && typeof score === "object") {
            return { playerId, ...(score as PlayerScoreSummary) };
          }

          return { playerId };
        }
      );
    }

    return [];
  }

  private formatPlayerName(
    playerId?: ScoreCellValue,
    explicitNickname?: unknown
  ): string {
    const trustedNickname = normalizeNickname(explicitNickname);

    if (trustedNickname) {
      return trustedNickname;
    }

    if (playerId === null || playerId === undefined || playerId === "") {
      return "Jogador não informado";
    }

    const rawId = String(playerId);
    const registryNicknames = this.getRegistryNicknames();
    const nickname = resolveNicknameForPlayerId(rawId, registryNicknames);

    if (nickname) {
      return nickname;
    }

    const identityState = getPlayerIdentityState(registryNicknames);
    const isLocalPlayer =
      rawId === socketManager.currentSocket?.id ||
      rawId === identityState.localPlayerId;

    if (isLocalPlayer) {
      return identityState.localNickname ?? "Você";
    }

    const isKnownPartner =
      rawId === identityState.partnerPlayerId ||
      (identityState.playerIds.includes(rawId) &&
        rawId !== identityState.localPlayerId);

    if (isKnownPartner) {
      return identityState.partnerNickname ?? "Parceiro";
    }

    return "Jogador não informado";
  }

  private getSummaryPlayerId(
    summary?: PlayerScoreSummary
  ): string | undefined {
    if (!summary) {
      return undefined;
    }

    return normalizeNickname(
      summary.playerId ??
        summary.id ??
        (typeof summary.socketId === "string" ? summary.socketId : undefined) ??
        summary.name
    );
  }

  private getSummaryNickname(
    summary: PlayerScoreSummary
  ): string | undefined {
    const explicitNickname = normalizeNickname(
      summary.nickname ??
        summary.playerNickname ??
        summary.displayName ??
        summary.playerName
    );

    if (explicitNickname) {
      return explicitNickname;
    }

    const fallbackName = normalizeNickname(summary.name);
    const summaryHasExplicitId = Boolean(summary.playerId ?? summary.id);

    return !summaryHasExplicitId && this.isLikelyDisplayName(fallbackName)
      ? fallbackName
      : undefined;
  }

  private getRegistryNicknames(): unknown {
    return this.registry.get(PLAYER_NICKNAMES_REGISTRY_KEY);
  }

  private isLikelyDisplayName(value?: string): value is string {
    if (!value) {
      return false;
    }

    const normalized = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    if (value.length > 16 || /^\d+$/.test(value)) {
      return false;
    }

    return !/^(voce|parceiro|jogador\s*\d*)$/.test(normalized);
  }

  private canStartGame(payload: GameStartPayload): boolean {
    const players = payload.playerIds ?? payload.ids ?? payload.players;

    return (players?.length ?? 0) >= 2 && Number.isFinite(Number(payload.seed));
  }

  private formatValue(value: ScoreCellValue): string {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    return String(value);
  }

  private buildTableLine(
    animal: ScoreCellValue,
    base: ScoreCellValue,
    time: ScoreCellValue,
    penalty: ScoreCellValue,
    total: ScoreCellValue
  ): string {
    return [
      this.truncate(this.formatValue(animal), 22).padEnd(23, " "),
      this.formatValue(base).padStart(5, " "),
      this.formatValue(time).padStart(6, " "),
      this.formatValue(penalty).padStart(7, " "),
      this.formatValue(total).padStart(7, " "),
    ].join(" ");
  }

  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }

  private readStringField(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.result[key];

      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }
}
