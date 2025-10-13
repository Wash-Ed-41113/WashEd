// import the shared systems module
// this provides ui helpers and the cleancatcher mini game
import systems from "../systems.js";

// define a new Phaser scene class called CleanCatchScene
export default class CleanCatchScene extends Phaser.Scene {
    // constructor runs first when scene is created
    constructor() {
        // call the parent constructor and register this scene with key "CleanCatch"
        super("CleanCatch");

        // _runtime will hold the running mini game object with destroy and setPaused functions
        this._runtime = null;

        // _paused keeps track of whether the game is paused
        this._paused = false;

        // _pauseUi will hold the pause overlay ui when pause is active
        this._pauseUi = null;
    }
    preload() {
        // Only load if not already in cache (safe and avoids duplicates)
        if (!this.textures.exists("dialog_skin")) {
            this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        }

        if (!this.textures.exists("kiko_dialog")) {
            this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        }

        if (!this.textures.exists("cc_sink_bg")) {
            const A = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
            this.load.image("cc_sink_bg", A.background || "assets/images/CleanCatcher/washed_kikos-day_LEVEL_01_scene_04_action_01_soap-splasher_start.png");
        }
    }

    // create method sets up everything on screen
    create(data) {
        // store data into registry if passed in
        if (data?.difficulty) this.registry.set("difficulty", data.difficulty);
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        // get the width and height of the current game canvas
        const { width, height } = this.scale;

        // create a dom container at top left to hold a custom html canvas
        // setDepth(1) makes sure it appears above the background
        const rootEl = document.createElement("div");
        const root = this.add.dom(0, 0, rootEl).setOrigin(0, 0).setDepth(1);

        // create a plain html canvas element that the clean catch mini game will draw into
        const canvas = document.createElement("canvas");
        canvas.style.display = "block";       // removes gaps
        canvas.style.width = `${width}px`;    // set css width
        canvas.style.height = `${height}px`;  // set css height
        root.node.appendChild(canvas);        // attach canvas into the dom container

        // start the clean catch mini game inside the canvas
        // this returns an object with destroy and setPaused methods
        const difficulty = this.registry.get("difficulty") || "easy";
        this._runtime = systems.cleancatcher.create(this, canvas, difficulty);

        // build a top bar with home and pause buttons
        systems.ui.topbar(this, {
            // home button callback
            onHome: () => {
                // stop the mini game and clean up
                this._runtime?.destroy?.();
                // get player name stored in registry so it can be passed forward
                const playerName = this.registry.get("playerName");
                // switch back to GameScene
                this.scene.start("GameScene", { playerName });
            },
            // pause button callback
            onPause: () => this.togglePause(),
        });

        // set up keyboard shortcuts for pause
        this.input.keyboard.on("keydown-ESC", () => this.togglePause());
        this.input.keyboard.on("keydown-P",   () => this.togglePause());

        // resize handler so canvas fits new screen size
        const onResize = (gameSize) => {
            const w = gameSize.width, h = gameSize.height;
            canvas.width = w;
            canvas.style.width = `${w}px`;
            canvas.height = h;
            canvas.style.height = `${h}px`;
        };
        // listen for resize events
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // clean up everything when scene shuts down
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
        });
    }

    // togglePause method switches between paused and running states
    togglePause() {
        // flip the paused flag
        this._paused = !this._paused;

        // tell the mini game runtime to pause or resume
        this._runtime?.setPaused?.(this._paused);

        if (this._paused) {
            // if now paused, show a pause overlay with a resume button
            this._pauseUi = systems.ui.pauseOverlay(this, () => this.togglePause());
        } else {
            // if resuming, destroy the pause overlay
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
        }
    }
}
