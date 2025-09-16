import Phaser from "phaser";
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import PlaygroundScene from "./scenes/PlaygroundScene.js";

const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: 1920,
    height: 1000,
    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [PreloadScene, MenuScene, GameScene, PlaygroundScene],
    dom: { createContainer: true },
};
new Phaser.Game(config);
