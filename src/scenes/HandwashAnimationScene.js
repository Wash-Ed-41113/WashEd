const WASH1_KEY  = "wash_step_bg_1";
const Menu = CONFIG.assets.menu;
const WASH2_KEY  = "wash_step_bg_2";
const ARROW_RIGHT_KEY  = "ui_arrow_right";
const KIKOS_KEY   = "kikos_day";

import systems from "../systems.js";
import { AudioManager } from "../systems.js";




export default class HandwashAnimationScene extends Phaser.Scene {
    constructor() {
        super("HandwashAnimationScene");
        this._armed = false;
    }



    preload() {
        this.load.image(WASH1_KEY, Menu.WASH1_PATH);
        this.load.image(WASH2_KEY, Menu.WASH2_PATH);
        this.load.image(ARROW_RIGHT_KEY, Menu.ARROW_RIGHT_PATH);
        this.load.audio(KIKOS_KEY, CONFIG.audio.menuAudio);
        this.load.audio("magic_sparkle", CONFIG.assets.magic_sparkle);
    }


    create() {
        const { width, height } = this.scale;
        try { this.sound.context?.resume?.(); } catch {}
        this.sound.pauseOnBlur = false;
        this.sound.mute = false;

        try { AudioManager.resumeGroup?.("global"); } catch {}


        const ensureGlobalBgm = () => {
            let inst = this.sound.get(KIKOS_KEY);

            const reallyPlay = () => {
                try {
                    AudioManager.play(this, KIKOS_KEY, { group: "global", loop: true, volume: 0.7 });
                    inst = this.sound.get(KIKOS_KEY);
                } catch {
                    if (!inst) inst = this.sound.add(KIKOS_KEY, { loop: true, volume: 0.7 });
                    if (!inst.isPlaying) inst.play();
                }
                inst?.setMute?.(false);
                inst?.setVolume?.(0.7);
            };

            if (inst) {
                if (inst.isPaused) inst.resume();
                else if (!inst.isPlaying) reallyPlay();
            } else if (this.cache.audio.exists(KIKOS_KEY)) {
                if (this.sound.locked) this.sound.once("unlocked", reallyPlay);
                else reallyPlay();
            } else {
                this.load.once(Phaser.Loader.Events.COMPLETE, reallyPlay);
                if (!this.cache.audio.exists(KIKOS_KEY)) {
                    this.load.audio(KIKOS_KEY, KIKOS_PATHS).start();
                }
            }
        };

        ensureGlobalBgm();

        if (!this._armed) {
            this._armed = true;
            const fire = () => ensureGlobalBgm();
            this.input.once("pointerdown", fire);
            this.input.keyboard?.once("keydown", fire);
            window.addEventListener("mousedown", fire, { once: true, passive: true });
            window.addEventListener("touchstart", fire, { once: true, passive: true });
        }


        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

     systems.ui.placeLogo(this);
        const fitScreen = (key) => {
            const img = this.add.image(width / 2, height / 2, key).setOrigin(0.5);
            img.setScale(Math.max(width / img.width, height / img.height));
            return img;
        };
        const first = fitScreen(WASH1_KEY);

        this.time.delayedCall(5000, () => {
            AudioManager.stopGroup?.("game");
            first.destroy();

            const sparkle = this.sound.add("magic_sparkle", { volume: 30 });
            sparkle.play();
            this.time.delayedCall(850, () => sparkle.stop());

            const arrow = this.add.image(width * 0.78, height * 0.50, ARROW_RIGHT_KEY)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            const arrowMax = Math.min(width, height) * 0.12;
            arrow.setScale(arrowMax / Math.max(arrow.width, arrow.height));

            arrow.on("pointerdown", () => {
                ensureGlobalBgm();
                this.scene.start("EndingScene", { skipIntro: true });
            });
        });

        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                try { this.sound.context?.resume?.(); } catch {}
                ensureGlobalBgm();
            }
        });

    }
}


