// this file defines the preload scene
// its job is to load all global assets before the game starts
// after loading it waits for CONFIG.wordsReady then switches to the menu scene
import systems from "../systems.js";


// this scene runs first at app boot and prepares core audio art and ui so later scenes can assume presence
// it keeps logic tiny and defers game text to mainjs which becomes the single source of truth for words
export default class PreloadScene extends Phaser.Scene {
    // constructor registers this scene with key PreloadScene
    constructor() { super("PreloadScene"); }

    // preload runs first and loads required images
    preload() {
        // short names for asset sections from CONFIG
        const KI = CONFIG.assets.kiko;
        const BG = CONFIG.assets.backgrounds;
        const UI = CONFIG.assets.ui;

        // these audio keys are global so other scenes can just play by key without reloading
        // global_bg is the menu and story track clean_catch_music and soap_splash_music are per mini game
        // phaser caches by key so duplicate loads are skipped at runtime
        // PreloadScene.js → preload()
        this.load.audio("global_bg",        "assets/sounds/kikos_day.mp3");   // overall bg
        this.load.audio("clean_catch_music","assets/sounds/cleanCatcher.mp3");     // game
        this.load.audio("soap_splash_music","assets/sounds/germ-scrubber.mp3");   // game


        // the logo is placed by systemsuiplacelogo and is shown across multiple scenes
        // preloading here guarantees it exists before any scene tries to render it
        // preload the global logo
        this.load.image("app_logo", CONFIG.assets.logo);

        // load background image for the front page
        // this is used by the menu scene so we keep it global to avoid stutters on first show
        this.load.image("frontpage_background", BG.frontpage);
        // load base kiko sprite
        // kiko_base is the default neutral pose used in early screens and dialogs
        this.load.image("kiko_base", KI.base);

        // load shared ui icons used across the game
        // these are small controls used by the systemsui helpers for topbar and dialogs
        this.load.image("ui_pause", UI.pauseBut);
        this.load.image("ui_settings", UI.settingsBut);
        this.load.image("ui_home", UI.homeBut);
        this.load.image("ui_close", UI.closeBut);

        // conditionally load start button if path is defined
        // optional keys let teams swap art via config without code edits
        if (UI.startBut)    this.load.image("ui_start", UI.startBut);
        // conditionally load dialog panel if path is defined
        if (UI.dialogPanel) this.load.image("ui_dialog", UI.dialogPanel);

        // optionally load kiko cheer pose if available
        // used in name dialog and celebration moments for delight
        if (KI.cheer) this.load.image("kiko_cheer", KI.cheer);

        // IMPORTANT: do NOT load or parse WordBank.json here anymore.
        // Single source of truth is in main.js (loadWordBankOnce).
    }

    create() {
        // place logo (keeps your existing visual)
        // safe to call in any scene and it anchors the brand at bottom right
        systems.ui.placeLogo(this);

        // wait until main.js marks words as ready, then continue flow
        // this scene does not parse words it only blocks until CONFIGwordsReady is true
        // this decouples content loading from core art and keeps a single authoritative loader
        const goNext = () => this.scene.start("MenuScene");

        // If words are already ready, go immediately
        // covers hot reload or quick cache paths where mainjs completed first
        if (window.CONFIG?.wordsReady) {
            goNext();
            return;
        }

        // Otherwise, poll briefly until ready
        // a tiny timer checks a flag rather than listening to cross scene events
        // once ready we clear the timer and hand control to MenuScene
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
