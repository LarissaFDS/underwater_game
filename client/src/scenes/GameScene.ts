import Phaser from "phaser";
import {
  DEPTH_OVERLAY_MAX_ALPHA,
  MAP_HEIGHT,
  MAP_WIDTH,
} from "../data/mapConfig";
import { Animal } from "../entities/Animal";
import { PlayerSubmarine } from "../entities/PlayerSubmarine";
import {
  socketManager,
  type AnimalStatePayload,
  type GameStartPayload,
  type GameOverPayload,
  type PlayerGameOverPayload,
  type PlayerIdentity,
  type PlayerMovedPayload,
  type PuzzleStartPayload,
  type StateUpdatePayload,
} from "../socket/SocketManager";
import {
  scoreSocketManager,
  type GameResultPayload,
} from "../socket/ScoreSocketManager";
import { MapGenerationSystem } from "../systems/MapGenerationSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { HUD } from "../ui/HUD";

// ── Asset imports (Vite-compatible) ─────────────────────────────────────────
import submarineUrl from "../assets/submarines/submarine.png";
import peixePalhaco from "../assets/animals/peixe-palhaco.png";
import tartaruga from "../assets/animals/tartaruga.png";
import polvo from "../assets/animals/polvo.png";
import tubaraoMartelo from "../assets/animals/tubarao-martelo.png";
import arraia from "../assets/animals/arraia.png";
import heartUrl from "../assets/ui/heart.png";
import o2BubbleUrl from "../assets/ui/o2-bubble.png";

/**
 * Data passed by MenuScene when the backend starts a room.
 */
type GameSceneData = Partial<GameStartPayload>;

/**
 * Local fallback used only when the backend does not include animal positions.
 */
const FALLBACK_ANIMALS: AnimalStatePayload[] = [
  { id: "peixe-palhaco", x: 400, y: 500, discovered: false },
  { id: "tartaruga", x: 1000, y: 500, discovered: false },
  { id: "polvo", x: 1600, y: 500, discovered: false },
  { id: "tubarao-martelo", x: 2200, y: 500, discovered: false },
  { id: "arraia", x: 400, y: 900, discovered: false },
];
const SPAWN_X = 0;
const SPAWN_Y = 0;
const OBSTACLE_HIT_COOLDOWN_MS = 1000;
const SCORE_RESULT_TIMEOUT_MS = 12000;

/**
 * Main gameplay scene.
 *
 * GameScene owns the visible world: generated map, local submarine, remote
 * partner representation, animal triggers, HUDs, and camera follow. Local
 * input is emitted to the game-service, while score-service results are only
 * displayed by EndScene and never calculated in the frontend.
 */
export class GameScene extends Phaser.Scene {
  private player!: PlayerSubmarine;
  private partner!: PlayerSubmarine;
  private movementSystem!: MovementSystem;
  private mapGenerationSystem!: MapGenerationSystem;
  private animals: Animal[] = [];
  private depthOverlay!: Phaser.GameObjects.Rectangle;
  private localHud!: HUD;
  private partnerHud!: HUD;
  private sceneData: GameSceneData = {};
  private playerIds: string[] = [];
  private localPlayerId?: string;
  private partnerTarget = new Phaser.Math.Vector2(
    MAP_WIDTH / 2 + 120,
    MAP_HEIGHT / 2
  );
  private animalsInRange = new Set<string>();
  private triggeredAnimalIds = new Set<string>();
  private lastMoveEmissionTime = 0;
  private unsubscribeSocketEvents: Array<() => void> = [];
  private unsubscribeScoreResult?: () => void;
  private scoreResultTimeoutId?: ReturnType<typeof setTimeout>;
  private scoreStatusOverlay?: Phaser.GameObjects.Container;
  private finalGameOverPayload?: GameOverPayload;
  private isPuzzleActive = false;
  private pendingPuzzleAnimalId?: string;
  private pendingPuzzleTimeout?: Phaser.Time.TimerEvent;
  private lastObstacleHitTime = -OBSTACLE_HIT_COOLDOWN_MS;
  private isGameOver = false;
  private hasOpenedEndScene = false;
  private hasWindowFocus = true;
  private isPageVisible = true;
  private isPointerInsideCanvas = true;
  private readonly handleAnimalDiscovered = (animalId: string): void => {
    this.markAnimalDiscovered(animalId);
  };
  private readonly handleWindowBlur = (): void => {
    this.hasWindowFocus = false;
  };
  private readonly handleWindowFocus = (): void => {
    this.hasWindowFocus = true;
    this.isPageVisible = !document.hidden;
  };
  private readonly handleVisibilityChange = (): void => {
    this.isPageVisible = !document.hidden;
  };
  private readonly handlePointerEnterCanvas = (): void => {
    this.isPointerInsideCanvas = true;
  };
  private readonly handlePointerLeaveCanvas = (): void => {
    this.isPointerInsideCanvas = false;
  };

  constructor() {
    super("GameScene");
  }

  /**
   * Loads all PNG sprite assets used by PlayerSubmarine, Animal and HUD.
   * Vite resolves each import to a content-hashed URL at build time, so the
   * raw string paths are never embedded in the bundle directly.
   */
  preload(): void {
    this.load.image("submarine", submarineUrl);
    this.load.image("animal-peixe-palhaco", peixePalhaco);
    this.load.image("animal-tartaruga", tartaruga);
    this.load.image("animal-polvo", polvo);
    this.load.image("animal-tubarao-martelo", tubaraoMartelo);
    this.load.image("animal-arraia", arraia);
    this.load.image("ui-heart", heartUrl);
    this.load.image("ui-o2-bubble", o2BubbleUrl);
  }

  /**
   * Resets transient scene state before Phaser creates the world objects.
   */
  init(data: GameSceneData = {}): void {
    this.sceneData = data;
    this.animalsInRange.clear();
    this.triggeredAnimalIds.clear();
    this.isPuzzleActive = false;
    this.isGameOver = false;
    this.hasOpenedEndScene = false;
    this.finalGameOverPayload = undefined;
    this.lastObstacleHitTime = -OBSTACLE_HIT_COOLDOWN_MS;
    this.clearScoreResultTimeout();
    this.destroyScoreStatusOverlay();
    this.clearPendingPuzzle();
  }

  /**
   * Builds the playable scene and binds all backend events used during a match.
   */
  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");
    this.mapGenerationSystem = new MapGenerationSystem(this);
    this.playerIds = this.getPlayerIds();
    // Socket.IO assigns the local id; GameScene uses it to separate local
    // player updates from the partner's remote representation.
    this.localPlayerId = socketManager.currentSocket?.id;

    const mapSeed = this.getMapSeed();
    this.mapGenerationSystem.generate(mapSeed);

    this.createDepthOverlay();
    this.createAnimals();

    this.player = new PlayerSubmarine(this, MAP_WIDTH / 2, MAP_HEIGHT / 2);
    // The partner submarine is visual-only on this client. It is positioned by
    // backend updates rather than by local input.
    this.partner = new PlayerSubmarine(
      this,
      this.partnerTarget.x,
      this.partnerTarget.y,
      {
        isPartner: true,
      }
    );
    this.movementSystem = new MovementSystem();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    this.localHud = new HUD(this, 24, this.scale.height - 58);
    const partnerHudScale = 0.85;
    this.partnerHud = new HUD(
      this,
      this.scale.width - 24 - 200 * partnerHudScale,
      this.scale.height - 58
    );
    this.partnerHud.setScale(partnerHudScale);

    this.localHud.setOxygen(100);
    this.localHud.setHearts(3);
    this.partnerHud.setOxygen(100);
    this.partnerHud.setHearts(3);

    this.setupActivityListeners();
    this.game.events.on("animal:discovered", this.handleAnimalDiscovered);

    this.unsubscribeSocketEvents.push(
      socketManager.onPlayerMoved((payload: PlayerMovedPayload) => {
        const currentSocketId = socketManager.currentSocket?.id;

        // Ignore echoed local movement so the local submarine stays controlled
        // by immediate input instead of network interpolation.
        if (
          payload.id === this.localPlayerId ||
          payload.id === currentSocketId
        ) {
          return;
        }

        this.partnerTarget.set(
          Phaser.Math.Clamp(payload.x, 0, MAP_WIDTH),
          Phaser.Math.Clamp(payload.y, 0, MAP_HEIGHT)
        );
      }),
      socketManager.onPuzzleStart((payload: PuzzleStartPayload) => {
        if (
          this.isPuzzleActive ||
          this.isGameOver ||
          !this.scene.isActive("GameScene")
        ) {
          return;
        }

        this.isPuzzleActive = true;
        this.clearPendingPuzzle();
        this.triggeredAnimalIds.add(payload.animalId);
        this.animalsInRange.clear();
        this.releasePuzzleLockOnShutdown();
        // PuzzleScene is launched as an overlay and GameScene pauses so local
        // movement does not continue while the player answers the minigame.
        this.scene.launch("PuzzleScene", payload);
        this.pauseGameSceneIfActive();
      }),
      socketManager.onStateUpdate((payload: StateUpdatePayload) => {
        this.applyStateUpdate(payload);
      }),
      socketManager.onPlayerGameOver((payload: PlayerGameOverPayload) => {
        this.handlePlayerGameOver(payload);
      }),
      socketManager.onGameOver((payload: GameOverPayload) => {
        this.handleGameOver(payload);
      })
    );
    this.unsubscribeScoreResult = scoreSocketManager.onGameResult(
      (payload: GameResultPayload) => {
        this.handleGameResult(payload);
      }
    );

    if (socketManager.currentState) {
      // A scene may start after the backend has already sent a snapshot.
      this.applyStateUpdate(socketManager.currentState);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeActivityListeners();
      this.game.events.off("animal:discovered", this.handleAnimalDiscovered);
      this.clearPendingPuzzle();
      this.clearScoreResultTimeout();
      this.destroyScoreStatusOverlay();
      this.removeAllSocketEventListeners();
    });
  }

  /**
   * Advances local input, proximity checks, partner interpolation, and depth UI.
   */
  update(time: number, delta: number): void {
    if (this.canControlPlayer()) {
      const pointer = this.input.activePointer;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      this.movementSystem.moveToPointer(
        this.player,
        worldPoint.x,
        worldPoint.y,
        delta
      );

      // Only the local submarine emits local actions. The partner is updated
      // from server events and never sends input from this client.
      this.player.x = Phaser.Math.Clamp(this.player.x, 0, MAP_WIDTH);
      this.player.y = Phaser.Math.Clamp(this.player.y, 0, MAP_HEIGHT);
      this.emitPlayerPosition(time);
      this.checkObstacleCollision(time);
      this.checkAnimalProximity();
    }

    this.updatePartnerPosition(delta);
    this.updateDepthOverlay();
  }

  private getMapSeed(): number {
    const serverSeed = Number(this.sceneData.seed);

    if (Number.isFinite(serverSeed)) {
      sessionStorage.setItem("mapSeed", String(serverSeed));
      return serverSeed;
    }

    const storedSeed = sessionStorage.getItem("mapSeed");
    const storedSeedNumber = storedSeed ? Number(storedSeed) : NaN;
    const fallbackSeed = Number.isFinite(storedSeedNumber)
      ? storedSeedNumber
      : Date.now();

    sessionStorage.setItem("mapSeed", String(fallbackSeed));

    return fallbackSeed;
  }

  private setupActivityListeners(): void {
    this.hasWindowFocus = document.hasFocus();
    this.isPageVisible = !document.hidden;
    this.isPointerInsideCanvas = this.isCanvasHovered();

    window.addEventListener("blur", this.handleWindowBlur);
    window.addEventListener("focus", this.handleWindowFocus);
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    this.game.canvas.addEventListener(
      "pointerenter",
      this.handlePointerEnterCanvas
    );
    this.game.canvas.addEventListener(
      "pointerleave",
      this.handlePointerLeaveCanvas
    );
  }

  private removeActivityListeners(): void {
    window.removeEventListener("blur", this.handleWindowBlur);
    window.removeEventListener("focus", this.handleWindowFocus);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange
    );
    this.game.canvas.removeEventListener(
      "pointerenter",
      this.handlePointerEnterCanvas
    );
    this.game.canvas.removeEventListener(
      "pointerleave",
      this.handlePointerLeaveCanvas
    );
  }

  private canControlPlayer(): boolean {
    return (
      !this.isGameOver &&
      this.hasWindowFocus &&
      this.isPageVisible &&
      this.isPointerInsideCanvas
    );
  }

  private isCanvasHovered(): boolean {
    try {
      return this.game.canvas.matches(":hover");
    } catch {
      return true;
    }
  }

  private getPlayerIds(): string[] {
    const ids = this.sceneData.playerIds ?? this.sceneData.ids;

    if (ids) {
      return ids;
    }

    return (
      this.sceneData.players
        ?.map((player: string | PlayerIdentity) =>
          typeof player === "string" ? player : player.id
        )
        .filter(Boolean) ?? []
    );
  }

  private createAnimals(): void {
    this.animals = this.getAnimalData().map(
      (animalData) =>
        new Animal(this, animalData)
    );
  }

  private getAnimalData(): AnimalStatePayload[] {
    return this.sceneData.animals?.length
      ? this.sceneData.animals
      : FALLBACK_ANIMALS;
  }

  /**
   * Reports the first local entry into each undiscovered animal radius.
   */
  private checkAnimalProximity(): void {
    if (this.isGameOver) {
      return;
    }

    if (this.hasPuzzleLock()) {
      return;
    }

    this.animals.forEach((animal) => {
      if (animal.discovered || this.triggeredAnimalIds.has(animal.id)) {
        this.animalsInRange.delete(animal.id);
        return;
      }

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        animal.x,
        animal.y
      );
      const isInsideRange = distance <= animal.getDetectionRadius();

      if (!isInsideRange) {
        this.animalsInRange.delete(animal.id);
        return;
      }

      if (this.animalsInRange.has(animal.id)) {
        return;
      }

      this.animalsInRange.add(animal.id);
      this.setPendingPuzzle(animal.id);
      // The backend decides whether proximity should open a puzzle; the
      // frontend only reports that the local player reached an animal radius.
      // Debug
      console.log("Emitting animal:approach", animal.id);
      socketManager.emitAnimalApproach({ animalId: animal.id });
    });
  }

  /**
   * Detects local obstacle contact and reports hits to the backend.
   */
  private checkObstacleCollision(time: number): void {
    if (time - this.lastObstacleHitTime < OBSTACLE_HIT_COOLDOWN_MS) {
      return;
    }

    const playerBounds = this.player.getBounds();
    const obstacle = this.mapGenerationSystem
      .getObstacleBounds()
      .find(({ bounds }) =>
        Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, bounds)
      );

    if (!obstacle) {
      return;
    }

    this.lastObstacleHitTime = time;
    this.flashSubmarine(this.player);
    // Obstacle damage is emitted as a local action; O2/hearts changes still
    // come back through backend state events.
    socketManager.emitPlayerHit({ obstacleType: obstacle.obstacleType });
  }

  private hasPuzzleLock(): boolean {
    return this.isPuzzleActive || this.pendingPuzzleAnimalId !== undefined;
  }

  private releasePuzzleLockOnShutdown(): void {
    const puzzleScene = this.scene.get("PuzzleScene");

    puzzleScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.isPuzzleActive = false;
      this.clearPendingPuzzle();
      this.animalsInRange.clear();
    });
  }

  private setPendingPuzzle(animalId: string): void {
    this.clearPendingPuzzle();
    this.pendingPuzzleAnimalId = animalId;
    this.pendingPuzzleTimeout = this.time.delayedCall(2000, () => {
      if (this.pendingPuzzleAnimalId === animalId) {
        this.clearPendingPuzzle();
      }
    });
  }

  private clearPendingPuzzle(): void {
    this.pendingPuzzleTimeout?.remove(false);
    this.pendingPuzzleTimeout = undefined;
    this.pendingPuzzleAnimalId = undefined;
  }

  /**
   * Sends throttled local movement to the backend.
   */
  private emitPlayerPosition(time: number): void {
    if (this.isGameOver) {
      return;
    }

    if (time - this.lastMoveEmissionTime < 50) {
      return;
    }

    // Position emission is throttled so normal pointer movement does not flood
    // the Socket.IO channel.
    socketManager.emitPlayerMove({
      x: this.player.x,
      y: this.player.y,
    });
    this.lastMoveEmissionTime = time;
  }

  /**
   * Smooths the remote partner toward the latest backend-provided target.
   */
  private updatePartnerPosition(delta: number): void {
    // Remote movement is interpolated toward the latest backend target to hide
    // network update gaps without taking ownership of partner control.
    const lerpFactor = Phaser.Math.Clamp(delta / 120, 0.08, 0.22);
    const previousX = this.partner.x;

    this.partner.x = Phaser.Math.Linear(
      this.partner.x,
      this.partnerTarget.x,
      lerpFactor
    );
    this.partner.y = Phaser.Math.Linear(
      this.partner.y,
      this.partnerTarget.y,
      lerpFactor
    );
    this.partner.x = Phaser.Math.Clamp(this.partner.x, 0, MAP_WIDTH);
    this.partner.y = Phaser.Math.Clamp(this.partner.y, 0, MAP_HEIGHT);

    if (this.partner.x > previousX) {
      this.partner.setDirection("right");
    } else if (this.partner.x < previousX) {
      this.partner.setDirection("left");
    }
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

  /**
   * Applies the authoritative backend snapshot to HUDs and partner target data.
   */
  private applyStateUpdate(payload: StateUpdatePayload): void {
    const localPlayerId = this.getLocalPlayerId();

    // `state:update` is the source of truth for player resources. It updates
    // the local HUD and the partner HUD separately based on the socket id.
    Object.entries(payload).forEach(([id, playerState]) => {
      const playerId = playerState.id || id;
      const isLocalPlayer =
        localPlayerId !== undefined &&
        (playerId === localPlayerId || id === localPlayerId);

      if (isLocalPlayer) {
        this.localHud.setOxygen(playerState.oxygen);
        this.localHud.setHearts(playerState.hearts);
        return;
      }

      this.partnerHud.setOxygen(playerState.oxygen);
      this.partnerHud.setHearts(playerState.hearts);

      if (Number.isFinite(playerState.x) && Number.isFinite(playerState.y)) {
        this.partnerTarget.set(
          Phaser.Math.Clamp(playerState.x, 0, MAP_WIDTH),
          Phaser.Math.Clamp(playerState.y, 0, MAP_HEIGHT)
        );
      }
    });
  }

  /**
   * Handles a single-player oxygen/heart loss flow without ending the match.
   */
  private handlePlayerGameOver(payload: PlayerGameOverPayload): void {
    // Player-level game over can respawn one submarine without ending the
    // entire match. The affected socket id decides which visual object moves.
    this.applyStateUpdate(payload.state ?? payload.players ?? {});

    const affectedPlayerId = this.getPayloadPlayerId(payload);
    const localPlayerId = this.getLocalPlayerId();
    const eventState = payload.state ?? payload.players;
    const affectedPlayerState = affectedPlayerId
      ? this.findPlayerState(eventState ?? {}, affectedPlayerId)
      : undefined;
    const spawn = this.getSpawnPosition(payload, affectedPlayerState);

    if (affectedPlayerId && affectedPlayerId === localPlayerId) {
      this.player.setPosition(spawn.x, spawn.y);
      this.partnerTarget.set(this.partner.x, this.partner.y);
      this.cameras.main.flash(260, 239, 68, 68);
      this.flashSubmarine(this.player);
      return;
    }

    if (!affectedPlayerId || affectedPlayerId !== localPlayerId) {
      this.partner.setPosition(spawn.x, spawn.y);
      this.partnerTarget.set(spawn.x, spawn.y);
      this.flashSubmarine(this.partner);
    }
  }

  /**
   * Freezes local control while the score-service calculates the final result.
   *
   * The game-service only tells the frontend that the match is definitely
   * over. Final score and winner presentation wait for `game:result`, because
   * score-service is the source of truth for match scoring.
   */
  private handleGameOver(payload: GameOverPayload): void {
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.finalGameOverPayload = payload;
    this.closePuzzleForFinalGameOver();
    this.removeGameplaySocketEventListeners();
    this.showScoreStatusOverlay(
      "Calculando pontuação...",
      "Aguardando resultado do score-service."
    );
    this.startScoreResultTimeout();
    //sscoreSocketManager.requestLatestResult();
  }

  /**
   * Opens EndScene with the backend-calculated result from score-service.
   *
   * GameScene transitions the visual flow only; it does not calculate or
   * mutate scoring fields, which keeps both clients aligned with score-service.
   */
  private handleGameResult(payload: GameResultPayload): void {
    if (this.hasOpenedEndScene) return;
  
    // ✅ Descarta resultado antigo se o reason não bate com o jogo atual
    if (!payload.scoreServiceUnavailable && this.finalGameOverPayload?.reason) {
      if (payload.reason && payload.reason !== this.finalGameOverPayload.reason) {
        console.warn("[GameScene] game:result com reason diferente — resultado antigo descartado");
        return;
      }
    }
  
    this.hasOpenedEndScene = true;
    this.isGameOver = true;
    this.closePuzzleForFinalGameOver();
    this.clearScoreResultTimeout();
    this.destroyScoreStatusOverlay();
    this.removeAllSocketEventListeners();
    this.scene.launch("EndScene", payload);
    this.pauseGameSceneIfActive();
  }

  private startScoreResultTimeout(): void {
    this.clearScoreResultTimeout();
    let attempts = 0;
    const maxAttempts = 4; // 4 × 3s = 12s total
  
    const tryFetch = () => {
      attempts++;
      console.log(`[GameScene] score:getLatest tentativa ${attempts}/${maxAttempts}`);
      scoreSocketManager.requestLatestResult();
  
      if (attempts < maxAttempts) {
        // ✅ window.setTimeout nunca é pausado pelo Phaser
        this.scoreResultTimeoutId = window.setTimeout(tryFetch, 3000);
      } else {
        this.openScoreUnavailableEndScene();
      }
    };
  
    // Espera 2s antes da primeira tentativa:
    // dá tempo do game:result chegar naturalmente pelo WebSocket
    this.scoreResultTimeoutId = window.setTimeout(tryFetch, 2000);
  }

  private clearScoreResultTimeout(): void {
    if (this.scoreResultTimeoutId !== undefined) {
      clearTimeout(this.scoreResultTimeoutId);
      this.scoreResultTimeoutId = undefined;
    }
  }

  // DEPOIS — tenta HTTP antes de exibir fallback
  private async openScoreUnavailableEndScene(): Promise<void> {
    if (this.hasOpenedEndScene) {
      return;
    }

    console.warn("[GameScene] score-service timeout: tentando fallback HTTP...");

    try {
      const httpResult = await scoreSocketManager.fetchLatestResultHttp();

      if (httpResult && !this.hasOpenedEndScene) {
        console.log("[GameScene] resultado obtido via HTTP fallback");
        this.handleGameResult(httpResult);
        return;
      }
    } catch (err) {
      console.error("[GameScene] HTTP fallback falhou", err);
    }

    // Só chega aqui se o HTTP também falhou
    console.warn("[GameScene] abrindo EndScene sem pontuação");
    this.handleGameResult({
      ...this.finalGameOverPayload,
      scoreServiceUnavailable: true,
      message:
        "Pontuação indisponível no momento. O resultado do score-service não chegou.",
      animalScores: [],
      playerSummaries: [],
    });
  }

  private showScoreStatusOverlay(title: string, message: string): void {
    this.destroyScoreStatusOverlay();

    const { width, height } = this.scale;
    const overlay = this.add.container(width / 2, height / 2);
    overlay.setScrollFactor(0);
    overlay.setDepth(1300);

    const panel = this.add
      .rectangle(0, 0, 540, 160, 0x020617, 0.9)
      .setStrokeStyle(2, 0x38bdf8, 0.86);
    const titleText = this.add
      .text(0, -28, title, {
        fontSize: "28px",
        color: "#f8fafc",
        align: "center",
      })
      .setOrigin(0.5);
    const messageText = this.add
      .text(0, 32, message, {
        fontSize: "18px",
        color: "#bae6fd",
        align: "center",
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5);

    overlay.add([panel, titleText, messageText]);
    this.scoreStatusOverlay = overlay;
  }

  private destroyScoreStatusOverlay(): void {
    this.scoreStatusOverlay?.destroy(true);
    this.scoreStatusOverlay = undefined;
  }

  private pauseGameSceneIfActive(): void {
    if (this.scene.isActive("GameScene")) {
      this.scene.pause("GameScene");
    }
  }

  private removeGameplaySocketEventListeners(): void {
    this.unsubscribeSocketEvents.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeSocketEvents = [];
  }

  private removeAllSocketEventListeners(): void {
    this.removeGameplaySocketEventListeners();
    this.unsubscribeScoreResult?.();
    this.unsubscribeScoreResult = undefined;
  }

  private closePuzzleForFinalGameOver(): void {
    this.clearPendingPuzzle();
    this.isPuzzleActive = false;
    this.animalsInRange.clear();
  
    if (this.scene.isActive("PuzzleScene") || this.scene.isPaused("PuzzleScene")) {
      this.scene.stop("PuzzleScene");
    }
  
    // ✅ Se GameScene estava pausada pela PuzzleScene, retoma para o timer funcionar
    if (this.scene.isPaused("GameScene")) {
      this.scene.resume("GameScene");
    }
  }

  private getLocalPlayerId(): string | undefined {
    this.localPlayerId = this.localPlayerId ?? socketManager.currentSocket?.id;
    return this.localPlayerId;
  }

  private getPayloadPlayerId(payload: PlayerGameOverPayload): string | undefined {
    return (
      payload.playerId ??
      payload.id ??
      payload.socketId ??
      payload.affectedPlayerId ??
      payload.deadPlayerId ??
      payload.player?.id ??
      payload.player?.playerId ??
      payload.socket?.id
    );
  }

  private findPlayerState(
    payload: StateUpdatePayload,
    playerId: string
  ): StateUpdatePayload[string] | undefined {
    return (
      payload[playerId] ??
      Object.values(payload).find((playerState) => playerState.id === playerId)
    );
  }

  private getSpawnPosition(
    payload: PlayerGameOverPayload,
    playerState?: StateUpdatePayload[string]
  ): Phaser.Math.Vector2 {
    const x = payload.spawn?.x ?? payload.x ?? playerState?.x ?? SPAWN_X;
    const y = payload.spawn?.y ?? payload.y ?? playerState?.y ?? SPAWN_Y;

    return new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x, 0, MAP_WIDTH),
      Phaser.Math.Clamp(y, 0, MAP_HEIGHT)
    );
  }

  private flashSubmarine(submarine: PlayerSubmarine): void {
    this.tweens.killTweensOf(submarine);
    submarine.setAlpha(0.35);
    this.tweens.add({
      targets: submarine,
      alpha: 1,
      duration: 130,
      repeat: 3,
      yoyo: true,
      ease: "Sine.InOut",
    });
  }

  /**
   * Marks an animal as discovered: stops its patrol tween, dims it to 0.45
   * alpha and removes it from proximity tracking. The animal stays visible.
   */
  private markAnimalDiscovered(animalId: string): void {
    const animal = this.animals.find(
      (currentAnimal) => currentAnimal.id === animalId
    );

    if (!animal) {
      return;
    }

    animal.markDiscovered();
    this.triggeredAnimalIds.add(animalId);
    this.animalsInRange.delete(animalId);
  }
}
