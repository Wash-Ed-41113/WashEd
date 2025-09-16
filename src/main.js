import "./config.js";
import "./systems.js";

import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import PlaygroundScene from "./scenes/PlaygroundScene.js";
import SoapSplash from "./SoapSplash.js";
const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: window.CONFIG?.width ?? 1920,
    height: window.CONFIG?.height ?? 1000,
    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [PreloadScene, MenuScene, GameScene, PlaygroundScene, SoapSplash],
    dom: { createContainer: true },
};

new Phaser.Game(config);
