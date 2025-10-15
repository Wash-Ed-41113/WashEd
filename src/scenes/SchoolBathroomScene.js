// SchoolBathroomScene.js

const BG_KEY = "washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";
const BG_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";

const TAP_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";
const TAP_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";

const SOAPBAR_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";
const SOAPBAR_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";

const SOAPBOTTLE_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";
const SOAPBOTTLE_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";

export default class SchoolBathroomScene extends Phaser.Scene {
    constructor() {
        super("SchoolBathroomScene");
        this.nextSceneKey = null;
    }

    preload() {
        if (!this.textures.exists(BG_KEY)) this.load.image(BG_KEY, BG_PATH);
        if (!this.textures.exists(TAP_KEY)) this.load.image(TAP_KEY, TAP_PATH);
        if (!this.textures.exists(SOAPBAR_KEY)) this.load.image(SOAPBAR_KEY, SOAPBAR_PATH);
        if (!this.textures.exists(SOAPBOTTLE_KEY)) this.load.image(SOAPBOTTLE_KEY, SOAPBOTTLE_PATH);
    }

    create() {
        const { width, height } = this.scale;

        // Background
        const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5, 0.5);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // Layout
        const pos = {
            tap:        { x: width * 0.35, y: height * 0.74, h: height * 0.50 },
            soapBar:    { x: width * 0.75, y: height * 0.85, h: height * 0.35 },
            soapBottle: { x: width * 0.18, y: height * 0.80, h: height * 0.34 },
        };

        const fitH = (img, targetH) => img.setScale(targetH / img.height);

        // Tap → CleanCatch
        const tap = this.add.image(pos.tap.x, pos.tap.y, TAP_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(tap, pos.tap.h);

        // Soap bar → SoapSplash
        const soapBar = this.add.image(pos.soapBar.x, pos.soapBar.y, SOAPBAR_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(soapBar, pos.soapBar.h);

        // Soap bottle → SoapSplash
        const soapBottle = this.add.image(pos.soapBottle.x, pos.soapBottle.y, SOAPBOTTLE_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(soapBottle, pos.soapBottle.h);

        // Hover pulse
        const hover = (img) => {
            img.on("pointerover", () => this.tweens.add({ targets: img, scale: img.scale * 1.06, duration: 120 }));
            img.on("pointerout",  () => this.tweens.add({ targets: img, scale: img.scale / 1.06, duration: 120 }));
        };
        hover(tap); hover(soapBar); hover(soapBottle);

        // Click routing
        tap.on("pointerdown",        () => this._fadeTo("CleanCatch"));
        soapBar.on("pointerdown",    () => this._fadeTo("SoapSplash"));
        soapBottle.on("pointerdown", () => this._fadeTo("SoapSplash"));

        // Title
        this.add.text(width / 2, height * 0.15, "Kiko is washing hands...", {
            fontFamily: "Arial", fontSize: "36px", color: "#ffffff", stroke: "#000000", strokeThickness: 4
        }).setOrigin(0.5);

        // Single fadeout handler — goes only where you clicked
        this.cameras.main.once("camerafadeoutcomplete", () => {
            if (this.nextSceneKey) {
                this.scene.start(this.nextSceneKey);
            } else {
                this.cameras.main.fadeIn(300, 0, 0, 0); // safety
            }
        });

        this.cameras.main.fadeIn(300, 0, 0, 0);
    }

    _fadeTo(sceneKey) {
        this.nextSceneKey = sceneKey; // must match your scene keys
        this.cameras.main.fadeOut(300, 0, 0, 0);
    }
}
