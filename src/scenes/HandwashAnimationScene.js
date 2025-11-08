const WASH1_KEY  = "wash_step_bg_1";
// const Menu = CONFIG.assets.menu;
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
        const A   = CONFIG?.assets || {};
        const Aud = CONFIG?.audio  || {};
        const Menu = A.menu || {};

        if (typeof Menu.WASH1_PATH === "string") this.load.image(WASH1_KEY, Menu.WASH1_PATH);
        if (typeof Menu.WASH2_PATH === "string") this.load.image(WASH2_KEY, Menu.WASH2_PATH);
        if (typeof Menu.ARROW_RIGHT_PATH === "string") this.load.image(ARROW_RIGHT_KEY, Menu.ARROW_RIGHT_PATH);

        if (typeof Aud.menuAudio === "string") this.load.audio(KIKOS_KEY, Aud.menuAudio);

        // ✅ sparkle: try assets first, then audio fallback
        if (typeof A.magic_sparkle === "string") {
            this.load.audio("magic_sparkle", A.magic_sparkle);
        } else if (typeof Aud.magic_sparkle === "string") {
            this.load.audio("magic_sparkle", Aud.magic_sparkle);
        } else if (typeof Aud.sparkle === "string") {
            this.load.audio("magic_sparkle", Aud.sparkle);
        } else {
            console.warn("[HandwashAnimationScene] sparkle path not found in CONFIG.assets.magic_sparkle or CONFIG.audio.{magic_sparkle|sparkle} — skipping");
        }

        this.load.on("loaderror", (file) => {
            console.warn("[HandwashAnimationScene] loaderror:", file?.key, file?.src || file?.url);
        });
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
            if (!this.textures.exists(key)) {
                console.warn("[HandwashAnimationScene] texture missing:", key, "— using solid fallback bg");
                const bg = this.add.rectangle(width/2, height/2, width, height, 0x90CAF9, 1)
                    .setOrigin(0.5);
                return bg; // rectangle still returned so caller can "destroy" without error
            }
            const img = this.add.image(width / 2, height / 2, key).setOrigin(0.5);
            const s = Math.max(width / img.width, height / img.height);
            img.setScale(s);
            return img;
        };

        const first = fitScreen(WASH1_KEY);


        this.time.delayedCall(5000, () => {
            AudioManager.stopGroup?.("game");

            // Crossfade: keep first visible while fading the second in
            const hasSecond = this.textures.exists(WASH2_KEY);
            let second = null;

            if (hasSecond) {
                second = fitScreen(WASH2_KEY);
                second.setAlpha(0);

                // fade in WASH2 and fade out WASH1 together
                this.tweens.add({ targets: second, alpha: 1, duration: 600, ease: "Sine.Out" });
                this.tweens.add({
                    targets: first,
                    alpha: 0,
                    duration: 600,
                    ease: "Sine.In",
                    onComplete: () => { first.destroy(); }
                });
            } else {
                // no second background; just keep first and warn
                console.warn("[HandwashAnimationScene] WASH2 not loaded — skipping crossfade");
            }

            // Sparkle SFX (guarded + valid volume)
            if (this.cache.audio.exists("magic_sparkle")) {
                const sparkle = this.sound.add("magic_sparkle", { volume: 0.7 });
                sparkle.play();
                this.time.delayedCall(850, () => sparkle.stop());
            } else {
                console.warn("[HandwashAnimationScene] 'magic_sparkle' not in cache — skipping SFX");
            }

            // Arrow (guard against missing texture; otherwise draw a simple button)
            let arrow;
            if (this.textures.exists(ARROW_RIGHT_KEY)) {
                arrow = this.add.image(width * 0.78, height * 0.50, ARROW_RIGHT_KEY)
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true });
                const arrowMax = Math.min(width, height) * 0.12;
                arrow.setScale(arrowMax / Math.max(arrow.width, arrow.height));
            } else {
                console.warn("[HandwashAnimationScene] arrow texture missing — drawing fallback");
                const W = Math.min(260, width * 0.2), H = 96;
                const rect = this.add.rectangle(width * 0.78, height * 0.50, W, H, 0x2ecc71, 1)
                    .setOrigin(0.5).setStrokeStyle(3, 0x1b8f52)
                    .setInteractive({ useHandCursor: true });
                const txt = this.add.text(rect.x, rect.y, "Continue", {
                    fontFamily: "Chewy", color: "#fff", fontSize: "36px"
                }).setOrigin(0.5);
                arrow = rect; // treat rect as the clickable target
            }

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


