import "./config.js";
import "./systems.js";

import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import PlaygroundScene from "./scenes/PlaygroundScene.js";
import SoapSplash from "./SoapSplash.js";
import CleanCatchScene from "./scenes/CleanCatchScene.js";

const config = {
    type: Phaser.AUTO,
    parent: "game",

    // Logical size; Phaser scales it below
    width: window.CONFIG.width,
    height: window.CONFIG.height,

    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false
    },

    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [PreloadScene, MenuScene, GameScene, PlaygroundScene, SoapSplash, CleanCatchScene],
    dom: { createContainer: true },
};

new Phaser.Game(config);
