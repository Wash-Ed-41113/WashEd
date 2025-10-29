// src/scenes/CleanCatchScene.js
// Clean Catch mini-game scene
import systems from "../systems.js";
import { AudioManager } from "../systems.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._runtime = null;
        this._paused = false;
        this._pauseUi = null;
    }

    // ---- helper: ALWAYS use this to leave CleanCatch ----
    leaveTo(targetKey, data) {
        try {
            // 1) stop any sounds owned by THIS scene, and the whole "game" group
            AudioManager.stop(this);
            AudioManager.stopGroup("game");
            // 2) bring back story/global bg if it was paused
            AudioManager.resumeGroup("global");
        } catch (_) {}

        // 3) stop THIS scene before starting the next one
        this.scene.stop(this.scene.key);

        // 4) now start the next scene (FIX: don't recurse!)
        if (targetKey) this.scene.start(targetKey, data);
    }

    preload() {
        // Dialog art
        if (!this.textures.exists("dialog_skin")) {
            this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        }
        if (!this.textures.exists("kiko_dialog")) {
            this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        }

        // Background image for the sink area
        if (!this.textures.exists("cc_sink_bg")) {
            const A = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
            this.load.image("cc_sink_bg", A.background || "assets/images/CleanCatcher/1.jpg");
        }

        // Safety-net SFX
        if (!this.cache.audio.exists("sfx_goodCatch"))
            this.load.audio("sfx_goodCatch", "assets/sounds/bubble pop Soap Splasher.wav");
        if (!this.cache.audio.exists("sfx_badCatch"))
            this.load.audio("sfx_badCatch", "assets/sounds/germ touch Soap Splasher.mp3");
        if (!this.cache.audio.exists("sfx_beep"))
            this.load.audio("sfx_beep", "assets/sounds/timerSound.mp3");
    }

    create(data) {
        // Persist basics
        if (data?.difficulty) this.registry.set("difficulty", data.difficulty);
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        const { width, height } = this.scale;

        // --- AUDIO: kill stale game BGM then start Clean Catch music under "game" ---
        AudioManager.stopGroup("game");                         // nuke leftovers from any previous game
        AudioManager.play(this, "clean_catch_music", {          // start this scene's bgm in "game"
            group: "game",
            volume: 0.6,
            loop: true
        });

        // --- AUDIO: menus off, game on ---
        AudioManager.pauseGroup("global");
        AudioManager.stopGroup("game");
        AudioManager.play(this, "clean_catch_music", {
            group: "game",
            volume: 0.6,
            loop: true
        });

// Safety hooks – stop this scene’s sounds + game group; resume global on exit
        const killGameAudio = () => {
            try {
                AudioManager.stop(this);
                AudioManager.stopGroup("game");
                AudioManager.resumeGroup("global");
            } catch (_) {}
        };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, killGameAudio);
        this.events.once(Phaser.Scenes.Events.SLEEP,    killGameAudio);
        this.events.once(Phaser.Scenes.Events.DESTROY,  killGameAudio);
// NOTE: no PAUSE handler – pausing shouldn't kill BGM

        // --- DOM canvas host for the mini-game runtime ---
        const rootEl = document.createElement("div");
        const root = this.add.dom(0, 0, rootEl).setOrigin(0, 0).setDepth(1);

        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width;
        canvas.height = height;
        root.node.appendChild(canvas);

        const difficulty = this.registry.get("difficulty") || "easy";

        // Word suppliers (single source from CONFIG.cleanCatch)
        if (CONFIG?.cleanCatch?.resetDecks && CONFIG?.cleanCatch?.nextGood && CONFIG?.cleanCatch?.nextBad) {
            CONFIG.cleanCatch.resetDecks();
            this.nextGoodLabel = () => CONFIG.cleanCatch.nextGood() || "clean";
            this.nextBadLabel  = () => CONFIG.cleanCatch.nextBad()  || "germ";
        } else {
            console.warn("[CleanCatch] Deck APIs missing; falling back to static labels.");
            this.nextGoodLabel = () => "clean";
            this.nextBadLabel  = () => "germ";
        }

        // If runtime supports suppliers, pass them; else create with default path
        const opts = { nextGood: this.nextGoodLabel, nextBad: this.nextBadLabel };
        const rt = systems.cleancatcher.create?.(this, canvas, difficulty, opts)
            || systems.cleancatcher.create?.(this, canvas, difficulty);
        this._runtime = rt;

        // Responsive canvas
        const onResize = (gameSize) => {
            const w = gameSize.width, h = gameSize.height;
            canvas.width = w;  canvas.style.width = `${w}px`;
            canvas.height = h; canvas.style.height = `${h}px`;
        };
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
        });

        // EXAMPLE: wherever you previously did scene.start(...), call leaveTo(...)
        // e.g.
        // someButton.on("pointerup", () => this.leaveTo("SchoolBathroomScene"));
        // handwashBtn.on("pointerup", () => this.leaveTo("HandwashAnimationScene", { skipIntro: true }));
        // endBtn.on("pointerup", () => this.leaveTo("EndingScene"));
    }
}
