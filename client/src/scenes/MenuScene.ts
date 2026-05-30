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

    const statusText = this.add
      .text(640, 260, "Aguardando segundo jogador...", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    socketManager.connect();

    // Matchmaking remains backend-driven: the client only reacts to either a
    // game start payload or the room-full rejection.
    this.unsubscribeSocketEvents.push(
      socketManager.onGameStart((payload: GameStartPayload) => {
        if (this.roomIsFull) {
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

    return payload?.message ?? "Sala cheia. Tente novamente mais tarde.";
  }
}
