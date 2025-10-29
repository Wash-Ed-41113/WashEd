// this file defines the preload scene
// its job is to load all global assets before the game starts
// after loading it waits for CONFIG.wordsReady then switches to the menu scene
import systems from "../systems.js";

export default class PreloadScene extends Phaser.Scene {
    // constructor registers this scene with key PreloadScene
    constructor() { super("PreloadScene"); }

    // preload runs first and loads required images
    preload() {
        // short names for asset sections from CONFIG
        const KI = CONFIG.assets.kiko;
        const BG = CONFIG.assets.backgrounds;
        const UI = CONFIG.assets.ui;

        // PreloadScene.js → preload()
        this.load.audio("global_bg",        "assets/sounds/kikos_day.mp3");   // overall bg
        this.load.audio("clean_catch_music","assets/sounds/cleanCatcher.mp3");     // game
        this.load.audio("soap_splash_music","assets/sounds/germ-scrubber.mp3");   // game


        // preload the global logo
        this.load.image("app_logo", CONFIG.assets.logo);

        // load background image for the front page
        this.load.image("frontpage_background", BG.frontpage);
        // load base kiko sprite
        this.load.image("kiko_base", KI.base);

        // load shared ui icons used across the game
        this.load.image("ui_pause", UI.pauseBut);
        this.load.image("ui_settings", UI.settingsBut);
        this.load.image("ui_home", UI.homeBut);
        this.load.image("ui_close", UI.closeBut);

        // conditionally load start button if path is defined
        if (UI.startBut)    this.load.image("ui_start", UI.startBut);
        // conditionally load dialog panel if path is defined
        if (UI.dialogPanel) this.load.image("ui_dialog", UI.dialogPanel);

        // optionally load kiko cheer pose if available
        if (KI.cheer) this.load.image("kiko_cheer", KI.cheer);

        // IMPORTANT: do NOT load or parse WordBank.json here anymore.
        // Single source of truth is in main.js (loadWordBankOnce).
    }

    create() {
        // place logo (keeps your existing visual)
        systems.ui.placeLogo(this);

        // wait until main.js marks words as ready, then continue flow
        const goNext = () => this.scene.start("MenuScene");

        // If words are already ready, go immediately
        if (window.CONFIG?.wordsReady) {
            goNext();
            return;
        }

        // Otherwise, poll briefly until ready
        this._wordsWaitEvt = this.time.addEvent({
            delay: 50,
            loop: true,
            callback: () => {
                if (window.CONFIG?.wordsReady) {
                    this._wordsWaitEvt?.remove(false);
                    goNext();
                }
            }
        });
    }
}
