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
                A.background || "assets/images/CleanCatcher/washed_kikos-day_LEVEL_01_scene_04_action_01_soap-splasher_start.png"
            );
        }

        // Safety net: load the same audio file under a fallback key
        // In most flows, explain scene has already loaded/started "cleanCatchExplainMusic".
        // If user jumps directly here, we still have something to play ("cleanCatchMusic").
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
        // Try to re-use the explain-scene BGM instance so playback continues seamlessly.
        // Primary key used by explain scene: "cleanCatchExplainMusic"
        // Fallback to "cleanCatchMusic" if coming directly here.
        const reuse =
            this.sound.get("cleanCatchExplainMusic") ||
            this.sound.get("cleanCatchMusic");

        if (reuse) {
            // Reuse the already-playing instance; do NOT restart so the timeline continues.
            this._bgm = reuse;
            // Sync mute state to registry if needed
            const wantMute = !!this.registry.get("mute");
            if (this._bgm.mute !== wantMute) this._bgm.setMute(wantMute);
            // If for some reason it's not playing, start it
            if (!this._bgm.isPlaying) this._bgm.play({ loop: true });
        } else {
            // Extremely rare: no instance found and nothing loaded/playing — create one now
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

        // DOM canvas host for the mini-game's offscreen canvas runtime
        const rootEl = document.createElement("div");
        const root = this.add.dom(0, 0, rootEl).setOrigin(0, 0).setDepth(1);

        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        root.node.appendChild(canvas);

        const difficulty = this.registry.get("difficulty") || "easy";
        this._runtime = systems.cleancatcher.create(this, canvas, difficulty);

        // Top bar (home / pause)
        systems.ui.topbar(this, {
            onHome: () => {
                // If going home, it's OK to stop BGM
                this._runtime?.destroy?.();
                if (this._bgm) { this._bgm.stop(); /* destroy is optional here */ }
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
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

        // Cleanup (do NOT force-stop music here to allow continuity into a results scene, etc.)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
            // Intentionally NOT stopping/destroying this._bgm on shutdown,
            // so the next scene can continue the same track if desired.
        });
    }

    togglePause() {
        this._paused = !this._paused;
        this._runtime?.setPaused?.(this._paused);

        if (this._paused) {
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
                    // If returning home from pause, stop BGM
                    this._runtime?.destroy?.();
                    if (this._bgm) { this._bgm.stop(); /* destroy optional */ }
                    const playerName = this.registry.get("playerName");
                    this.scene.start("GameScene", { playerName });
                }
            });
        } else {
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
        }
    }
}
