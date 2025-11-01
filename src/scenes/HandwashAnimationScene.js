// src/scenes/HandwashAnimationScene.js
/* global Phaser */

const WASH1_KEY  = "wash_step_bg_1";
const WASH1_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_02_bathroom_wash-hands.png";

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const WASH2_KEY  = "wash_step_bg_2";
const WASH2_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_03_bathroom_sparkle.png";

const ARROW_RIGHT_KEY  = "ui_arrow_right";
const ARROW_RIGHT_PATH = "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png";

// Global background music key (main story BGM)
const KIKOS_KEY   = "kikos_day";
// Optional fallback paths if this track was not preloaded by an earlier scene
const KIKOS_PATHS = ["assets/sounds/kikos_day.mp3", "./assets/sounds/kikos_day.mp3"];

export default class HandwashAnimationScene extends Phaser.Scene {
    constructor() {
        super("HandwashAnimationScene");
        this._armed = false; // one-gesture fallback for browsers that require user interaction
    }

    preload() {
        // Images
        if (!this.textures.exists(WASH1_KEY))       this.load.image(WASH1_KEY, WASH1_PATH);
        if (!this.textures.exists(WASH2_KEY))       this.load.image(WASH2_KEY, WASH2_PATH);
        if (!this.textures.exists(ARROW_RIGHT_KEY)) this.load.image(ARROW_RIGHT_KEY, ARROW_RIGHT_PATH);

        // Ensure kikos_day is present in the cache (usually preloaded by the menu)
        if (!this.cache.audio.exists(KIKOS_KEY)) {
            this.load.audio(KIKOS_KEY, KIKOS_PATHS);
        }

        if (!this.cache.audio.exists("magic_sparkle")) {
            this.load.audio("magic_sparkle", "assets/sounds/magic-sparkle-190030.mp3");
        }
    }

    create() {
        const { width, height } = this.scale;

        // --- AUDIO: stop any mini-game music and bring back the global story BGM ---
        try { this.sound.context?.resume?.(); } catch {}
        this.sound.pauseOnBlur = false;
        this.sound.mute = false;

        // Stop the "game" group (mini-games) and resume the "global" group
        // try { AudioManager.stopGroup?.("game"); } catch {}
        try { AudioManager.resumeGroup?.("global"); } catch {}

        // Function that guarantees kikos_day is playing on the global channel
        const ensureGlobalBgm = () => {
            let inst = this.sound.get(KIKOS_KEY);

            const reallyPlay = () => {
                try {
                    // Prefer the project AudioManager so the sound is tracked in the "global" group
                    AudioManager.play(this, KIKOS_KEY, { group: "global", loop: true, volume: 0.7 });
                    inst = this.sound.get(KIKOS_KEY);
                } catch {
                    // Fallback: play directly via Phaser Sound
                    if (!inst) inst = this.sound.add(KIKOS_KEY, { loop: true, volume: 0.7 });
                    if (!inst.isPlaying) inst.play();
                }
                // Make sure it is audible and at the intended volume
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
                // Rare: if not yet loaded, load now and start after complete
                this.load.once(Phaser.Loader.Events.COMPLETE, reallyPlay);
                if (!this.cache.audio.exists(KIKOS_KEY)) {
                    this.load.audio(KIKOS_KEY, KIKOS_PATHS).start();
                }
            }
        };

        // Try to start immediately
        ensureGlobalBgm();

        // Also arm a single-gesture fallback for autoplay-restricted environments
        if (!this._armed) {
            this._armed = true;
            const fire = () => ensureGlobalBgm();
            this.input.once("pointerdown", fire);
            this.input.keyboard?.once("keydown", fire);
            window.addEventListener("mousedown", fire, { once: true, passive: true });
            window.addEventListener("touchstart", fire, { once: true, passive: true });
        }

        // Make sure any leftover mini scenes are stopped
        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        systems.ui.placeLogo(this);

        // Utility to add a full-screen image while preserving aspect ratio
        const fitScreen = (key) => {
            const img = this.add.image(width / 2, height / 2, key).setOrigin(0.5);
            img.setScale(Math.max(width / img.width, height / img.height));
            return img;
        };

        // Step 1: show the first background for 5 seconds
        const first = fitScreen(WASH1_KEY);

        // Automatically stop it when transitioning to sparkle scene
        this.time.delayedCall(5000, () => {
            this.handwashingSfx?.stop();
        });

        this.time.delayedCall(5000, () => {
            AudioManager.stopGroup?.("game"); // <--- prevents audio leak
            first.destroy();
            const second = fitScreen(WASH2_KEY);

            // Play sparkle sound for 0.85s
            const sparkle = this.sound.add("magic_sparkle", { volume: 30 });
            sparkle.play();
            this.time.delayedCall(850, () => sparkle.stop());

            // Add the "Next" arrow to continue to the EndingScene
            const arrow = this.add.image(width * 0.78, height * 0.50, ARROW_RIGHT_KEY)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // Scale the arrow based on the shortest screen edge
            const arrowMax = Math.min(width, height) * 0.12;
            arrow.setScale(arrowMax / Math.max(arrow.width, arrow.height));

            // On click: ensure BGM is alive and move to the EndingScene
            arrow.on("pointerdown", () => {
                ensureGlobalBgm();
                this.scene.start("EndingScene", { skipIntro: true });
            });
        });

        // If the tab becomes visible again, make sure audio is resumed
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                try { this.sound.context?.resume?.(); } catch {}
                ensureGlobalBgm();
            }
        });
    }
}
