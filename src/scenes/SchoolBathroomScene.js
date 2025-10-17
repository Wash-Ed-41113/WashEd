// SchoolBathroomScene.js

const BG_KEY = "washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";
const BG_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";

const TAP_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";
const TAP_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";

const SOAPBAR_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";
const SOAPBAR_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";

const SOAPBOTTLE_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";
const SOAPBOTTLE_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";

const ARROW_RIGHT_KEY = "ui_arrow_right";
const ARROW_RIGHT_PATH = "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png";

export default class SchoolBathroomScene extends Phaser.Scene {
    constructor() {
        super("SchoolBathroomScene");
        this.nextSceneKey = null;
        this._dialogRoot = null;
    }

    preload() {
        if (!this.textures.exists(BG_KEY)) this.load.image(BG_KEY, BG_PATH);
        if (!this.textures.exists(TAP_KEY)) this.load.image(TAP_KEY, TAP_PATH);
        if (!this.textures.exists(SOAPBAR_KEY)) this.load.image(SOAPBAR_KEY, SOAPBAR_PATH);
        if (!this.textures.exists(SOAPBOTTLE_KEY)) this.load.image(SOAPBOTTLE_KEY, SOAPBOTTLE_PATH);
        if (!this.textures.exists(ARROW_RIGHT_KEY)) this.load.image(ARROW_RIGHT_KEY, ARROW_RIGHT_PATH);
        if (!this.textures.exists("dialog_skin")) this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        if (!this.textures.exists("kiko_dialog")) this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
    }

    create() {
        const { width, height } = this.scale;

        const onlyIfNoDialog = (fn) => () => {
            if (this._dialogRoot) return; // block clicks if dialog still open
            fn();
        };

        // Background
        const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5, 0.5);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // Layout
        const pos = {
            tap:        { x: width * 0.35, y: height * 0.73, h: height * 0.51 },
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
        const makeHover = (img, factor = 1.06, dur = 120) => {
            const baseX = img.scaleX;
            const baseY = img.scaleY;
            img.setData("baseScaleX", baseX);
            img.setData("baseScaleY", baseY);

            img.on("pointerover", () => {
                this.tweens.killTweensOf(img);
                this.tweens.add({
                    targets: img,
                    scaleX: baseX * factor,
                    scaleY: baseY * factor,
                    duration: dur,
                    ease: "Sine.easeOut"
                });
            });

            img.on("pointerout", () => {
                this.tweens.killTweensOf(img);
                this.tweens.add({
                    targets: img,
                    scaleX: baseX,
                    scaleY: baseY,
                    duration: dur,
                    ease: "Sine.easeOut"
                });
            });
        };

        makeHover(tap); makeHover(soapBar); makeHover(soapBottle);

        // Click routing (blocked until dialog closes)
        tap.on("pointerdown",        onlyIfNoDialog(() => this._fadeTo("CleanCatch")));
        soapBar.on("pointerdown",    onlyIfNoDialog(() => this._fadeTo("SoapSplash")));
        soapBottle.on("pointerdown", onlyIfNoDialog(() => this._fadeTo("SoapSplash")));

        // Single fadeout handler — goes only where you clicked
        this.cameras.main.once("camerafadeoutcomplete", () => {
            if (this.nextSceneKey) {
                this.scene.start(this.nextSceneKey);
            } else {
                this.cameras.main.fadeIn(300, 0, 0, 0); // safety
            }
        });

        this.cameras.main.fadeIn(300, 0, 0, 0);
        this._showEntryDialog();
    }

    _fadeTo(sceneKey) {
        this.nextSceneKey = sceneKey; // must match your scene keys
        this.cameras.main.fadeOut(300, 0, 0, 0);
    }

    _showEntryDialog() {
        const { width, height } = this.scale;

        this._dialogRoot = this.add.container(0, 0).setDepth(9999);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.4)
            .setOrigin(0, 0)
            .setInteractive();            // blocks background clicks
        this._dialogRoot.add(overlay);

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setOrigin(0.5);
        const s = Math.min((width * 0.8) / panel.width, (height * 0.5) / panel.height);
        panel.setScale(s);
        this._dialogRoot.add(panel);

        const panelW = panel.displayWidth;
        const panelH = panel.displayHeight;

        const kiko = this.add.image(panel.x - panelW / 2 - 200, panel.y + panelH * 0.45, "kiko_dialog")
            .setOrigin(0.5, 1);
        kiko.setScale((panelH * 0.90) / kiko.height);
        this._dialogRoot.add(kiko);

        this._dialogRoot.add(
            this.add.text(panel.x, panel.y - panelH * 0.25, "Let's Wash!", {
                fontFamily: "Chewy", fontSize: "42px", color: "#000000"
            }).setOrigin(0.5)
        );

        this._dialogRoot.add(
            this.add.text(panel.x, panel.y, "We're here in the bathroom and it’s time to wash our hands! What should I do first?\nCan you help me choose? Click on the best choice!", {
                fontFamily: "Arial", fontSize: "24px", color: "#2a4155", align: "center"
            }).setOrigin(0.5)
        );

        // Green arrow (only closer)
        const arrowSize = Math.min(panelH * 0.22, 140);
        const arrow = this.add.image(
            panel.x + panelW * 0.35,
            panel.y + panelH * 0.25,
            ARROW_RIGHT_KEY
        ).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const scaleTo = arrowSize / Math.max(arrow.width, arrow.height);
        arrow.setScale(scaleTo);

        // IMPORTANT: Add arrow INTO the dialog container (so it appears above overlay)
        this._dialogRoot.add(arrow);

        // Close the dialog ONLY when arrow is clicked
        arrow.on("pointerdown", () => {
            this._dialogRoot.destroy(true);
            this._dialogRoot = null;
        });
    }
}
