// src/scenes/CleanCatchScene.js
import systems from "../systems.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._teardown = null;
        this._setPaused = null;
        this._paused = false;
        this._pauseUi = null;
        this._dom = null;
    }

    create() {
        const CC = CONFIG.cleanCatch;
        const { width: LOG_W, height: LOG_H } = CC;

        // backdrop (full scene)
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1520, 1).setOrigin(0);

        // Canvas host
        const html = `
      <div id="ccWrap"
           style="display:flex;align-items:center;justify-content:center;
                  width:${this.scale.width}px;height:${this.scale.height}px;">
        <canvas id="cleanCatchCanvas" width="${LOG_W}" height="${LOG_H}"
                style="outline:none;pointer-events:auto;"></canvas>
      </div>`;
        this._dom = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html);
        this._dom.setOrigin(0.5);

        const canvas = this._dom.getChildByID("cleanCatchCanvas");
        const wrap = this._dom.getChildByID("ccWrap");
        canvas.style.touchAction = "none";

        // Run the mini-game and keep handles
        const controls = systems.cleancatcher.create(canvas);
        this._teardown = controls.destroy;
        this._setPaused = controls.setPaused || (() => {});

        // --- Topbar (same as Soap Splash)
        systems.ui.topbar(this, {
            onHome: () => {
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
            // onSettings: () => {} // inert for now
        });

        // ESC → back
        this.input.keyboard.once("keydown-ESC", () => {
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });

        // --- Fit the canvas to the screen WITHOUT stretching (letterbox/pillarbox)
        const fitCanvas = () => {
            const viewW = this.scale.width;
            const viewH = this.scale.height;
            const aspect = LOG_W / LOG_H;

            // size wrapper to the scene canvas
            wrap.style.width = `${viewW}px`;
            wrap.style.height = `${viewH}px`;

            // compute CSS display size for the game canvas
            let dispW = viewW;
            let dispH = Math.round(dispW / aspect);
            if (dispH > viewH) {
                dispH = viewH;
                dispW = Math.round(dispH * aspect);
            }
            canvas.style.width = `${dispW}px`;
            canvas.style.height = `${dispH}px`;
            // NOTE: logical resolution stays LOG_W x LOG_H (no distortion).
        };

        fitCanvas();
        this.scale.on(Phaser.Scale.Events.RESIZE, fitCanvas);
        window.addEventListener("resize", fitCanvas, { passive: true });

        // Clean up listeners + the mini-game
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._teardown?.();
            this.scale.off(Phaser.Scale.Events.RESIZE, fitCanvas);
            window.removeEventListener("resize", fitCanvas);
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this._teardown?.();
            this.scale.off(Phaser.Scale.Events.RESIZE, fitCanvas);
            window.removeEventListener("resize", fitCanvas);
        });
    }

    togglePause() {
        if (this._paused) {
            this._paused = false;
            this._pauseUi?.destroy();
            this._pauseUi = null;
            this._setPaused(false);
        } else {
            this._paused = true;
            this._pauseUi = systems.ui.pauseOverlay(this, () => this.togglePause());
            this._setPaused(true);
        }
    }
}
