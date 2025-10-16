// import the shared systems module
import systems from "../systems.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._runtime = null;
        this._paused = false;
        this._pauseUi = null;
        this._bgm = null;          // <- music handle
    }

    preload() {
        // dialog art
        if (!this.textures.exists("dialog_skin")) {
            this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        }
        if (!this.textures.exists("kiko_dialog")) {
            this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        }
        if (!this.textures.exists("cc_sink_bg")) {
            const A = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
            this.load.image(
                "cc_sink_bg",
                A.background || "assets/images/CleanCatcher/washed_kikos-day_LEVEL_01_scene_04_action_01_soap-splasher_start.png"
            );
        }

        // Clean Catch music (only loaded/played in this scene)
        if (!this.cache.audio.exists("cleanCatchMusic")) {
            this.load.audio("cleanCatchMusic", "assets/sounds/soap splasher.mp3");
        }
    }

    create(data) {
        // store data (optional)
        if (data?.difficulty) this.registry.set("difficulty", data.difficulty);
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        const { width, height } = this.scale;

        // start music here (only in Clean Catch)
        if (!this._bgm) {
            this._bgm = this.sound.add("cleanCatchMusic", {
                loop: true,
                volume: 0.5,
                mute: !!this.registry.get("mute")
            });
        }
        if (!this._bgm.isPlaying) this._bgm.play();

        // DOM canvas host
        const rootEl = document.createElement("div");
        const root = this.add.dom(0, 0, rootEl).setOrigin(0, 0).setDepth(1);

        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        root.node.appendChild(canvas);

        const difficulty = this.registry.get("difficulty") || "easy";
        this._runtime = systems.cleancatcher.create(this, canvas, difficulty);

        // top bar (home/pause)
        systems.ui.topbar(this, {
            onHome: () => {
                this._runtime?.destroy?.();
                if (this._bgm) { this._bgm.stop(); this._bgm.destroy(); this._bgm = null; } // ✅ stop music
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
        });

        // pause shortcuts
        this.input.keyboard.on("keydown-ESC", () => this.togglePause());
        this.input.keyboard.on("keydown-P",   () => this.togglePause());

        // responsive canvas
        const onResize = (gameSize) => {
            const w = gameSize.width, h = gameSize.height;
            canvas.width = w;  canvas.style.width = `${w}px`;
            canvas.height = h; canvas.style.height = `${h}px`;
        };
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;

            // make sure music is stopped/destroyed when leaving this scene
            if (this._bgm) { this._bgm.stop(); this._bgm.destroy(); this._bgm = null; }
        });
    }

    togglePause() {
        this._paused = !this._paused;
        this._runtime?.setPaused?.(this._paused);

        if (this._paused) {
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
                    this._runtime?.destroy?.();
                    if (this._bgm) { this._bgm.stop(); this._bgm.destroy(); this._bgm = null; } // stop music
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
