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
        const data = this.cache.json.get("WordBank") || {};
        const rows = Array.isArray(data.WordBank) ? data.WordBank : [];

        // Flat lists for Clean Catch
        const goodFlat = rows.filter(r => r.type === "Good").map(r => r.word);
        const badFlat  = rows.filter(r => r.type === "Bad").map(r => r.word);
        CONFIG.cleanCatch.words = { good: goodFlat, bad: badFlat };

        // Group good words by difficulty for Soap Splash
        const byDiff = { 1: [], 2: [], 3: [] };
        for (const r of rows) {
            if (r.type === "Good") {
                const d = (Number(r.difficulty) || 1);
                (byDiff[d] ?? byDiff[1]).push(r.word);
            }
        }

        // Make it available to scenes
        CONFIG.soapSplash.wordsByDifficulty = byDiff;

        // Non-repeating deck per level
        const decks = { 1: [], 2: [], 3: [] };
        const refill = (lvl) => {
            const pool = (byDiff[lvl] || []).slice();
            // Phaser shuffle if available; otherwise fallback
            decks[lvl] = (window.Phaser?.Utils?.Array?.Shuffle)
                ? Phaser.Utils.Array.Shuffle(pool)
                : pool.sort(() => Math.random() - 0.5);
        };

        // Install strict supplier used by systems.soapsplash.pickWord(...)
        CONFIG.soapSplash.nextWordFn = () => {
            const lvl = CONFIG.soapSplash.activeDifficulty || 1;
            if (!decks[lvl] || decks[lvl].length === 0) refill(lvl);
            return decks[lvl].pop() || "wash";
        };

        // (Optional) legacy fallback list so helpers.words.soapSplashWords() still returns something
        CONFIG.soapSplash.words = byDiff[1].concat(byDiff[2], byDiff[3]);

        this.scene.start("MenuScene");
    }






}
