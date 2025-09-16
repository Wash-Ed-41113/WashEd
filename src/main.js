import Phaser from "phaser";
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import LoadingScene from "./scenes/LoadingScene.js";

const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: 800,
    height: 600,
    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [PreloadScene, MenuScene, GameScene, LoadingScene],
};

new Phaser.Game(config);