// entry point for the game
// loads global CONFIG and shared SYSTEMS modules first so scenes can read them
import "./config.js";
import "./systems.js";

// import all scenes used by the game flow
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import PlaygroundScene from "./scenes/PlaygroundScene.js";
import SoapSplashScene from "./scenes/SoapSplashScene.js";
import CleanCatchScene from "./scenes/CleanCatchScene.js";
import { DB } from "./db.js";
DB.init();



// phaser game configuration object
// this controls renderer type canvas parent size scale physics scenes and dom support
const config = {
    // renderer type AUTO lets phaser choose WEBGL when available and fall back to CANVAS
    type: Phaser.AUTO,

    // attach the canvas to an element with id "game" in index html
    parent: "game",

    // logical game size comes from CONFIG so everything uses a single source of truth
    width: window.CONFIG.width,
    height: window.CONFIG.height,

    // scale manager settings control how the game fits inside the browser window
    scale: {
        // FIT scales to fit inside the available area while preserving aspect ratio
        mode: Phaser.Scale.FIT,
        // CENTER_BOTH centers the canvas horizontally and vertically
        autoCenter: Phaser.Scale.CENTER_BOTH,
        // expandParent false means do not change the parent element size
        expandParent: false
    },

    // default canvas background color while scenes render their own content
    backgroundColor: "#1e1e1e",

    // enable arcade physics with no gravity since these scenes do not need falling bodies
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },

    // list of scenes in the order phaser will understand and can switch between
    // preload runs first then menu then game hub and the two mini games and the playground
    scene: [PreloadScene, MenuScene, GameScene, PlaygroundScene, SoapSplashScene, CleanCatchScene],

    // enable phaser DOM plugin so scenes can create html elements like input fields
    dom: { createContainer: true },
};

// create and start the phaser game with the given configuration
// phaser will boot the first scene in the array which is PreloadScene
new Phaser.Game(config);
