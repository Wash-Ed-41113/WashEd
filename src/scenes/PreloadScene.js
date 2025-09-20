import systems from "../systems.js";

export default class PreloadScene extends Phaser.Scene {
    constructor() { super("PreloadScene"); }

    preload() {
        const KI = CONFIG.assets.kiko;
        const BG = CONFIG.assets.backgrounds;
        const UI = CONFIG.assets.ui;

        // Menu / base
        this.load.image("frontpage_background", BG.frontpage);
        this.load.image("kiko_base", KI.base);

        // Shared UI icons (used by SoapSplash top bar)
        this.load.image("ui_pause", UI.pauseBut);
        this.load.image("ui_settings", UI.settingsBut);
        this.load.image("ui_home", UI.homeBut);
    }

    create() { this.scene.start("MenuScene"); }
}
