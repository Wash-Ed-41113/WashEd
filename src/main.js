import Phaser from "phaser";
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";

const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: 1920, //1920 X 1000
    height: 1000,
    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [PreloadScene, MenuScene, GameScene],
};

new Phaser.Game(config);
