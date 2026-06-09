import Phaser from "phaser";
import { WarmupScene } from "./scenes/WarmupScene";
import { NicknameScene } from "./scenes/NicknameScene";
import { MenuScene } from "./scenes/MenuScene";
import { GameScene } from "./scenes/GameScene";
import { PuzzleScene } from "./scenes/PuzzleScene";
import { EndScene } from "./scenes/EndScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS, 
  width: 1280,
  height: 720,
  backgroundColor: "#0a1628",
  parent: "app",
  scene: [WarmupScene, NicknameScene, MenuScene, GameScene, PuzzleScene, EndScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);