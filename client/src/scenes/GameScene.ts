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
  type PlayerIdentity,
  type PlayerMovedPayload,
  type PuzzleStartPayload,
} from "../socket/SocketManager";
import { MapGenerationSystem } from "../systems/MapGenerationSystem";
import { MovementSystem } from "../systems/MovementSystem";
import { HUD } from "../ui/HUD";

type GameSceneData = Partial<GameStartPayload>;

const FALLBACK_ANIMALS: AnimalStatePayload[] = [
  { id: "peixe-palhaco", x: 400, y: 500, discovered: false },
  { id: "tartaruga", x: 1000, y: 500, discovered: false },
  { id: "polvo", x: 1600, y: 500, discovered: false },
  { id: "tubarao-martelo", x: 2200, y: 500, discovered: false },
  { id: "arraia", x: 400, y: 900, discovered: false },
];

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
  private isPuzzleActive = false;
  private pendingPuzzleAnimalId?: string;
  private pendingPuzzleTimeout?: Phaser.Time.TimerEvent;
  private hasWindowFocus = true;
  private isPageVisible = true;
  private isPointerInsideCanvas = true;
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

  init(data: GameSceneData = {}): void {
    this.sceneData = data;
    this.animalsInRange.clear();
    this.triggeredAnimalIds.clear();
    this.isPuzzleActive = false;
    this.clearPendingPuzzle();
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#0a1628");
    this.mapGenerationSystem = new MapGenerationSystem(this);
    this.playerIds = this.getPlayerIds();
    this.localPlayerId = socketManager.currentSocket?.id;

    const mapSeed = this.getMapSeed();
    this.mapGenerationSystem.generate(mapSeed);

    this.createDepthOverlay();
    this.createAnimals();

    this.player = new PlayerSubmarine(this, MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.partner = new PlayerSubmarine(
      this,
      this.partnerTarget.x,
      this.partnerTarget.y,
      {
        body: 0x9ca3af,
        tail: 0x6b7280,
        cabin: 0xd1d5db,
        window: 0x111827,
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
    this.localHud.setHearts(2);

    this.time.delayedCall(1000, () => {
      this.localHud.setOxygen(50);
    });

    this.partnerHud.setOxygen(100);
    this.partnerHud.setHearts(3);

    this.setupActivityListeners();

    this.unsubscribeSocketEvents.push(
      socketManager.onPlayerMoved((payload: PlayerMovedPayload) => {
        const currentSocketId = socketManager.currentSocket?.id;

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
        if (this.isPuzzleActive) {
          return;
        }

        this.isPuzzleActive = true;
        this.clearPendingPuzzle();
        this.triggeredAnimalIds.add(payload.animalId);
        this.animalsInRange.clear();
        this.releasePuzzleLockOnShutdown();
        this.scene.launch("PuzzleScene", payload);
        this.scene.pause("GameScene");
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.removeActivityListeners();
      this.clearPendingPuzzle();
      this.unsubscribeSocketEvents.forEach((unsubscribe) => unsubscribe());
      this.unsubscribeSocketEvents = [];
    });
  }

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

      this.player.x = Phaser.Math.Clamp(this.player.x, 0, MAP_WIDTH);
      this.player.y = Phaser.Math.Clamp(this.player.y, 0, MAP_HEIGHT);
      this.emitPlayerPosition(time);
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
      (animalData, index) =>
        new Animal(this, {
          ...animalData,
          color: this.getAnimalColor(index),
        })
    );
  }

  private getAnimalData(): AnimalStatePayload[] {
    return this.sceneData.animals?.length
      ? this.sceneData.animals
      : FALLBACK_ANIMALS;
  }

  private getAnimalColor(index: number): number {
    const colors = [0xf97316, 0x22c55e, 0xa855f7, 0xef4444, 0x38bdf8];
    return colors[index % colors.length];
  }

  private checkAnimalProximity(): void {
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
      // Debug
      console.log("Emitting animal:approach", animal.id);
      socketManager.emitAnimalApproach({ animalId: animal.id });
    });
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

  private emitPlayerPosition(time: number): void {
    if (time - this.lastMoveEmissionTime < 50) {
      return;
    }

    socketManager.emitPlayerMove({
      x: this.player.x,
      y: this.player.y,
    });
    this.lastMoveEmissionTime = time;
  }

  private updatePartnerPosition(delta: number): void {
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
}
