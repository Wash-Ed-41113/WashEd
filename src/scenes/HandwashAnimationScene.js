// src/scenes/HandwashAnimationScene.js
const WASH1_KEY = "wash_step_bg_1";
const WASH1_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_02_bathroom_wash-hands.png";

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const WASH2_KEY = "wash_step_bg_2";
const WASH2_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_03_bathroom_sparkle.png";

const ARROW_RIGHT_KEY = "ui_arrow_right";
const ARROW_RIGHT_PATH = "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png";

export default class HandwashAnimationScene extends Phaser.Scene {
    constructor() { super("HandwashAnimationScene"); }

    preload() {
        if (!this.textures.exists(WASH1_KEY)) this.load.image(WASH1_KEY, WASH1_PATH);
        if (!this.textures.exists(WASH2_KEY)) this.load.image(WASH2_KEY, WASH2_PATH);
        if (!this.textures.exists(ARROW_RIGHT_KEY)) this.load.image(ARROW_RIGHT_KEY, ARROW_RIGHT_PATH);
    }

    create() {
        const { width, height } = this.scale;


        AudioManager.stopGroup("game");     // ← ensures Soap/CC are OFF before story bg
        AudioManager.resumeGroup("global");
        AudioManager.play(this, "global_bg", { group: "global", volume: 0.6 });

        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
        } catch {}

        systems.ui.placeLogo(this);


        // helper to add a full-screen image (keeps aspect)
        const fitScreen = (key) => {
            const img = this.add.image(width / 2, height / 2, key).setOrigin(0.5);
            img.setScale(Math.max(width / img.width, height / img.height));
            return img;
        };

        // 1) show first background for 5 seconds (no interaction)
        const first = fitScreen(WASH1_KEY);

        this.time.delayedCall(5000, () => {
            // swap to the second background
            first.destroy();
            const second = fitScreen(WASH2_KEY);

            // add the green NEXT arrow on top-right area
            const arrow = this.add.image(
                width * 0.78,             // position can be tweaked
                height * 0.50,
                ARROW_RIGHT_KEY
            )
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // scale arrow nicely relative to screen
            const arrowMax = Math.min(width, height) * 0.12;
            arrow.setScale(arrowMax / Math.max(arrow.width, arrow.height));

            // // pulse a bit
            // this.tweens.add({
            //     targets: arrow,
            //     scaleX: { from: arrow.scaleX, to: arrow.scaleX * 1.06 },
            //     scaleY: { from: arrow.scaleY, to: arrow.scaleY * 1.06 },
            //     duration: 900,
            //     ease: "Sine.inOut",
            //     yoyo: true,
            //     repeat: -1
            // });

            // clicking NEXT returns to the bathroom (skip the intro bubble)
            arrow.on("pointerdown", () => {
                this.scene.start("EndingScene", { skipIntro: true });
            });
        });
    }
}
