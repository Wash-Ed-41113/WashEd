// src/scenes/HandwashAnimationScene.js
// overview of this scene
//  shows a short two step handwashing animation then hands off to EndingScene
// it also restores the main story background music using project AudioManager and resilient fallbacks
// the scope is self contained presentation only no gameplay here and it safely stops any mini game scenes still running
// a reader new to the codebase should know that SchoolBathroomScene routes here after a mini game and that EndingScene shows the final scoreboard



const WASH1_KEY  = "wash_step_bg_1";
const WASH1_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_02_bathroom_wash-hands.png";

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const WASH2_KEY  = "wash_step_bg_2";
const WASH2_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_03_bathroom_sparkle.png";

const ARROW_RIGHT_KEY  = "ui_arrow_right";
const ARROW_RIGHT_PATH = "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png";

const KIKOS_KEY   = "kikos_day";
const KIKOS_PATHS = ["assets/sounds/kikos_day.mp3"];

// constants section
// the image and audio keys are declared here for clarity and reuse
// KIKOS_KEY is the global bgm used across the story flow and KIKOS_PATHS provide a resilient pair of paths
// keep keys stable because other scenes assume the same strings



export default class HandwashAnimationScene extends Phaser.Scene {
    constructor() {
        super("HandwashAnimationScene");
        this._armed = false;
    }

    // constructor notes
    // the scene key is HandwashAnimationScene and _armed is a one shot guard used to satisfy browsers that require a user gesture before audio playback
    // there is no external state stored here beyond audio and simple timers



    preload() {
        if (!this.textures.exists(WASH1_KEY))       this.load.image(WASH1_KEY, WASH1_PATH);
        if (!this.textures.exists(WASH2_KEY))       this.load.image(WASH2_KEY, WASH2_PATH);
        if (!this.textures.exists(ARROW_RIGHT_KEY)) this.load.image(ARROW_RIGHT_KEY, ARROW_RIGHT_PATH);

        if (!this.cache.audio.exists(KIKOS_KEY)) {
            this.load.audio(KIKOS_KEY, KIKOS_PATHS);
        }

        if (!this.cache.audio.exists("magic_sparkle")) {
            this.load.audio("magic_sparkle", "assets/sounds/magic_sparkle.mp3");
        }
    }

    // preload section
    // loads two background plates and a next arrow if they are not already in cache to avoid double loads
    // ensures KIKOS_KEY and magic_sparkle audio are available so create can play them without race conditions
    // scope is local to this scene and safe to call multiple times because of the texture and audio cache guards



    create() {
        const { width, height } = this.scale;

        try { this.sound.context?.resume?.(); } catch {}
        this.sound.pauseOnBlur = false;
        this.sound.mute = false;

        try { AudioManager.resumeGroup?.("global"); } catch {}

        // audio bootstrap
        // make sure the web audio context is resumed then unmute and unpause global audio
        // prefer AudioManager group control since other scenes use it and it keeps bgm consistent



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

        // ensureGlobalBgm function
        // guarantees that KIKOS_KEY is actively playing on the global audio group using AudioManager when possible
        // falls back to raw phaser sound if the manager is unavailable handles locked audio contexts and even late loading
        // this centralizes bgm logic so other parts can just call ensureGlobalBgm without worrying about state



        ensureGlobalBgm();

        if (!this._armed) {
            this._armed = true;
            const fire = () => ensureGlobalBgm();
            this.input.once("pointerdown", fire);
            this.input.keyboard?.once("keydown", fire);
            window.addEventListener("mousedown", fire, { once: true, passive: true });
            window.addEventListener("touchstart", fire, { once: true, passive: true });
        }

        // autoplay fallback arming
        // some browsers block audio until a gesture occurs so we arm a single use handler on pointer and key and window events
        // when any of these fire we re run ensureGlobalBgm to start or resume playback
        // _armed prevents multiple registrations in case create runs again



        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        // cleanup of mini game scenes
        // this scene is a visual handoff so it proactively stops any lingering mini game or explain scenes to prevent resource leaks and conflicting audio
        // if a scene is not present the try catch keeps it safe



        systems.ui.placeLogo(this);

        // ui stamp
        // places the sticky logo using systems.ui so branding remains consistent across scenes and resizes with the viewport



        const fitScreen = (key) => {
            const img = this.add.image(width / 2, height / 2, key).setOrigin(0.5);
            img.setScale(Math.max(width / img.width, height / img.height));
            return img;
        };

        // fitScreen helper
        // creates a centered image and scales it to cover the screen while preserving aspect ratio
        // returns the image so callers can manipulate or destroy it later



        const first = fitScreen(WASH1_KEY);

        // first plate
        // show the wash hands background first this fills the whole stage using fitScreen
        // the next step happens after a short delay to simulate a simple animation beat






        this.time.delayedCall(5000, () => {
            AudioManager.stopGroup?.("game");
            first.destroy();
            const second = fitScreen(WASH2_KEY);

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

        // second plate and continue ui
        // after five seconds we stop any game group audio destroy the first plate show the sparkle plate and play a short sparkle sfx
        // a right arrow is added as the continue button scaled proportionally to the shorter screen edge
        // clicking the arrow ensures bgm is alive then starts EndingScene with skipIntro true for a snappy handoff



        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) {
                try { this.sound.context?.resume?.(); } catch {}
                ensureGlobalBgm();
            }
        });

        // tab visibility resilience
        // if the tab becomes visible again we resume the web audio context and re-run ensureGlobalBgm to keep music consistent after tab switches
        // this protects against browsers that auto pause or mute background tabs
    }
}


