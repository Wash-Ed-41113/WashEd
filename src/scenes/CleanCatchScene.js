// src/scenes/CleanCatchScene.js
// import the shared systems module
import systems from "../systems.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._runtime = null;
        this._paused = false;
        this._pauseUi = null;
        this._bgm = null; // mini-game BGM handle (may be re-used from explain scene)
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
            this.load.image(
                "cc_sink_bg",
                A.background || "assets/images/CleanCatcher/1.jpg"
            );
        }

        // Safety net BGM
        if (!this.cache.audio.exists("cleanCatchMusic")) {
            this.load.audio("cleanCatchMusic", "assets/sounds/soap splasher.mp3");
        }

        // SFX
        if (!this.cache.audio.exists("sfx_goodCatch"))
            this.load.audio("sfx_goodCatch", "assets/sounds/bubble pop Soap Splasher.wav");
        if (!this.cache.audio.exists("sfx_badCatch"))
            this.load.audio("sfx_badCatch", "assets/sounds/germ touch Soap Splasher.mp3");
        if (!this.cache.audio.exists("sfx_beep"))
            this.load.audio("sfx_beep", "assets/sounds/timerSound.mp3");
    }

    create(data) {
        // Persist basic data
        if (data?.difficulty) this.registry.set("difficulty", data.difficulty);
        if (data?.playerName) this.registry.set("playerName", data.playerName);
        console.log("[CleanCatchScene] Final difficulty:", this.registry.get("difficulty"));

        const { width, height } = this.scale;

        // Ensure any main/menu BGM is stopped
        this.sound.get("bgm_kiko")?.stop();
        this.sound.get("kikos_day")?.stop();

        // === BGM CONTINUITY LOGIC ===
        const reuse =
            this.sound.get("cleanCatchExplainMusic") ||
            this.sound.get("cleanCatchMusic");

        if (reuse) {
            this._bgm = reuse;
            const wantMute = !!this.registry.get("mute");
            if (this._bgm.mute !== wantMute) this._bgm.setMute(wantMute);
            if (!this._bgm.isPlaying) this._bgm.play({ loop: true });
        } else {
            const playMiniBgm = () => {
                if (!this._bgm) {
                    this._bgm = this.sound.add("cleanCatchMusic", {
                        loop: true,
                        volume: 0.55,
                        mute: !!this.registry.get("mute"),
                    });
                }
                if (!this._bgm.isPlaying) this._bgm.play();
            };
            if (this.sound.locked) {
                this.sound.once(Phaser.Sound.Events.UNLOCKED, playMiniBgm);
            } else {
                playMiniBgm();
            }
        }
        // === END BGM CONTINUITY LOGIC ===

        // === WORD SUPPLIERS (single source from main.js) =======================
        // Fresh no-repeat decks every time this scene starts/restarts.
        if (CONFIG?.cleanCatch?.resetDecks && CONFIG?.cleanCatch?.nextGood && CONFIG?.cleanCatch?.nextBad) {
            CONFIG.cleanCatch.resetDecks();
            // expose convenience suppliers on the scene (optional – handy if your runtime reads from scene)
            this.nextGoodLabel = () => CONFIG.cleanCatch.nextGood() || "clean";
            this.nextBadLabel  = () => CONFIG.cleanCatch.nextBad() || "germ";
        } else {
            console.warn("[CleanCatch] Deck APIs missing; falling back to static labels.");
            this.nextGoodLabel = () => "clean";
            this.nextBadLabel  = () => "germ";
        }
        // ======================================================================

        // DOM canvas host for the mini-game's offscreen canvas runtime
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

        // If your cleancatcher runtime supports passing suppliers, you can hand them in:
        // systems.cleancatcher.create(this, canvas, difficulty, {
        //   nextGood: this.nextGoodLabel,
        //   nextBad: this.nextBadLabel
        // });
        // Otherwise it can read CONFIG.cleanCatch.nextGood/nextBad directly.
        this._runtime = systems.cleancatcher.create(this, canvas, difficulty);

        // Top bar (home / pause)
        systems.ui.topbar(this, {
            onHome: () => {
                const playerName = this.registry.get("playerName") || "Player";
                this._runtime?.destroy?.();
                this._bgm?.stop?.();
                this.scene.start("GameScene", { playerName }); // hub
            },
            onPause: () => this.togglePause(),
            showMute: true,
        });

        // Pause shortcuts
        this.input.keyboard.on("keydown-ESC", () => this.togglePause());
        this.input.keyboard.on("keydown-P",   () => this.togglePause());

        // Responsive canvas
        const onResize = (gameSize) => {
            const w = gameSize.width, h = gameSize.height;
            canvas.width = w;  canvas.style.width = `${w}px`;
            canvas.height = h; canvas.style.height = `${h}px`;
        };
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // Cleanup (do NOT force-stop music here to allow continuity)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
            // Intentionally not stopping this._bgm
        });
    }

    // === Unified pause overlay (no Home inside the overlay) ===
    togglePause() {
        if (this._paused) {
            // resume
            this._paused = false;
            this._pauseUi?.destroy?.();
            this._pauseUi = null;

            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            this.physics?.world?.resume?.();

            // resume the game's audio world (BGM/SFX)
            this.sound?.resumeAll?.();

            // let the runtime tick again
            this._runtime?.setPaused?.(false);
        } else {
            // pause
            this._paused = true;

            // build shared pause overlay with only Resume (no Home)
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause()
            });

            this.time.timeScale = 0;
            this.tweens.timeScale = 0;
            this.physics?.world?.pause?.();

            // pause the game's audio world (BGM/SFX)
            this.sound?.pauseAll?.();

            // pause the runtime update/render
            this._runtime?.setPaused?.(true);
        }
    }
}
