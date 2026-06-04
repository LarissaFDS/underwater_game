import Phaser from "phaser";
import {
  socketManager,
  type GameStartPayload,
  type RoomFullPayload,
} from "../socket/SocketManager";

/**
 * Initial matchmaking scene.
 *
 * The scene opens the socket connection, keeps the player on a waiting screen
 * until the backend emits `game:start`, and blocks the transition when the
 * backend reports that the room is already full.
 */
export class MenuScene extends Phaser.Scene {
  private unsubscribeSocketEvents: Array<() => void> = [];
  private roomIsFull = false;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.roomIsFull = false;
    this.cameras.main.setBackgroundColor("#0a1628");

    const nickname = sessionStorage.getItem("ocean_nickname") || "Jogador";
    const statusText = this.add
      .text(640, 260, `Olá, ${nickname}!\nAguardando parceiro...`, {
        fontSize: "32px",
        color: "#ffffff",
        align: "center"
      })
      .setOrigin(0.5);

    console.log("[MenuScene] socketManager.connect()");
    socketManager.connect();

    // Matchmaking remains backend-driven: the client only reacts to either a
    // game start payload or the room-full rejection.
    this.unsubscribeSocketEvents.push(
      socketManager.onGameStart((payload: GameStartPayload) => {
        if (this.roomIsFull) {
          return;
        }

        if (!this.canStartGame(payload)) {
          console.warn(
            "[MenuScene] Ignoring game:start without two players and a valid seed",
            payload
          );
          statusText.setText(`Olá, ${nickname}!\nAguardando partida válida...`);
          statusText.setColor("#bae6fd");
          return;
        }

        this.scene.start("GameScene", payload);
      }),
      socketManager.onRoomFull((payload?: RoomFullPayload) => {
        this.roomIsFull = true;
        statusText.setText(this.getRoomFullMessage(payload));
        statusText.setColor("#ffb4b4");
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeSocketEvents.forEach((unsubscribe) => unsubscribe());
      this.unsubscribeSocketEvents = [];
    });
  }

  /**
   * Normalizes backend room-full payload variations into user-facing text.
   */
  private getRoomFullMessage(payload?: RoomFullPayload): string {
    if (typeof payload === "string") {
      return payload;
    }

    return payload?.message ?? payload?.error ?? "Sala cheia. Tente novamente mais tarde.";
  }

  private getPlayerCount(payload: GameStartPayload): number {
    const players = payload.playerIds ?? payload.ids ?? payload.players;

    return players?.length ?? 0;
  }

  private canStartGame(payload: GameStartPayload): boolean {
    return this.getPlayerCount(payload) >= 2 && Number.isFinite(Number(payload.seed));
  }
}
