// this file defines the preload scene
// its job is to load all global assets before the game starts
// after loading it immediately switches to the menu scene

export default class PreloadScene extends Phaser.Scene {
    // constructor registers this scene with key PreloadScene
    constructor() { super("PreloadScene"); }

    // preload runs first and loads required images
    preload() {
        // short names for asset sections from CONFIG
        const KI = CONFIG.assets.kiko;
        const BG = CONFIG.assets.backgrounds;
        const UI = CONFIG.assets.ui;

        // load background image for the front page
        this.load.image("frontpage_background", BG.frontpage);
        // load base kiko sprite
        this.load.image("kiko_base", KI.base);

        // load shared ui icons used across the game
        this.load.image("ui_pause", UI.pauseBut);
        this.load.image("ui_settings", UI.settingsBut);
        this.load.image("ui_home", UI.homeBut);
        // conditionally load start button if path is defined
        if (UI.startBut)    this.load.image("ui_start", UI.startBut);
        // conditionally load dialog panel if path is defined
        if (UI.dialogPanel) this.load.image("ui_dialog", UI.dialogPanel);

        // optionally load kiko cheer pose if available
        if (KI.cheer) this.load.image("kiko_cheer", KI.cheer);

        // additionally load in json as single source of truth for litrature.
        this.load.json("WordBank", "WordBank.json");

    }

    create() {
        const wordsData = this.cache.json.get("WordBank") || {};
        const all = Array.isArray(wordsData.WordBank) ? wordsData.WordBank : [];
        CONFIG.words = all;


        const good = all.filter(w => w.type === "Good").map(w => w.word);
        const bad  = all.filter(w => w.type === "Bad").map(w => w.word);

        CONFIG.soapSplash.words = good;
        CONFIG.cleanCatch.words = { good, bad };

        this.scene.start("MenuScene");
    }





}
