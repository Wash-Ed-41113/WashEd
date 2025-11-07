/*
 * Purpose:
 *  Tutorial scene for the Clean Catch aka “Soap Splasher” mini-game.
 *  It safely loads a small art+audio set, pauses any global menu/hub BGM,
 *  defers starting its own BGM until the first user gesture (browser policy),
 *  presents a short, personalized copy deck with a Next arrow,
 *  then fades out and `scene.start("CleanCatch", { difficulty })`.
 *
 * Public surface:
 *  export default class CleanCatchExplain extends Phaser.Scene  (key: "CleanCatchExplain")
 *
 * Invariants:
 *  - Failed BGM load only warns; scene continues.  // see loaderror wiring
 *  - If menu/hub BGM is playing, it is paused when this tutorial begins,
 *    and the tutorial's own looping BGM becomes the active handle.
 *  - BGM playback begins only after first input (pointer/key) due to autoplay rules.
 *
 * Dependencies:
 *  - Phaser 3 (scene lifecycle, display, tweens, input)
 *  - CONFIG (asset & audio paths)
 *  - Global BGM handles (window.__GLOBAL_BGM__, window.__MINI_BGM__) shared across scenes
 *
 * Performance:
 *  - Minimal loads (panel, Kiko poses, one background, one audio key).
 *  - No game loop; event-driven UI and a single exit tween.
 *
 * Concurrency:
 *  - Single-threaded Phaser model.
 *  - Audio start guarded by once() listeners to prevent duplicate starts.
 *
 * Error model:
 *  - Missing BGM logs a warning via the loader’s "loaderror" event; and keeps running.
 *  - Panel has a rectangle fallback if skin texture is missing.
 *
 * Security/Privacy:
 *  - Reads player name from registry for personalization.
 *  - Does not persist additional data; no external network calls.
 *
 * Example:
 *  this.scene.start("CleanCatchExplain", { difficulty: 2 });
 *
 * Where:
 *  - Kept as this top-of-file header for quick onboarding.
 */

/* ===========================
 * Module constants / config
 * ===========================
 * Notes:
 * - BGM_KEY is a stable key across the project for this scene’s tutorial loop.
 * - CA, assets, CC, ui are read from CONFIG to avoid hardcoding paths.
 */
const BGM_KEY  = "cleanCatcher_bgm";
const CA = CONFIG.audio;
const assets = CONFIG.assets.kiko;
const CC  = CONFIG.assets.cleanCatch;
const ui = CONFIG.assets.ui;

/**
 * Class: CleanCatchExplain
 * Responsibility: show a short, input-gated tutorial and handoff to "CleanCatch".
 * Collaborators: Phaser loader/display/input/tweens; CONFIG; global BGM handles.
 * Lifecycle:
 *   - preload(): load lightweight art+audio, add warn-only loaderror
 *   - create(data): build UI, adopt BGM ownership, transition to CleanCatch
 * Thread-safety: Phaser single-threaded; event-driven; guarded once() audio start.
 * Smell guard: if tutorial steps grow a lot, extract to a small "TutorialPlayer".
 */
export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain"); // scene key registration
    }

    /**
     * preload()
     * What: Loads minimal art + BGM and installs a one-time loaderror guard so audio failure
     *       never blocks the tutorial.
     * Side effects: Populates texture/audio caches; registers loader error handler.
     * Errors: Warn-only on BGM load failure; scene remains usable without audio.
     * Determinism: Deterministic loads; cached assets reused across runs.
     */
    preload() {
        // ---- artwork (safe: textures cache de-dupes duplicates) ----
        this.load.image("KikoBase", assets.base);
        this.load.image("KikoCheer", assets.cheer);
        this.load.image("DialogPanel", ui.dialogPanel);
        this.load.image("UI_Next", ui.next);
        this.load.image("backgroundFullLives", CC.backgroundFullLives);

        // ---- audio (local tutorial loop) ----
        this.load.audio(BGM_KEY, CA.cleanCatch);

        // Warn-only; keep running even if audio fails
        this.load.on("loaderror", (f) => { if (f?.key === BGM_KEY) console.warn("[CleanCatchExplain] BGM load failed:", f.src || f.url); });
    }

    /**
     * create(data)
     * What (one line): Builds the tutorial UI, manages audio handoff, and transitions into the game.
     * Params:
     *   - data.difficulty (number|string): requested difficulty; falls back to registry.
     * Returns: void
     * Side effects: Pauses global BGM, starts local BGM on first gesture, displays copy, transitions.
     * Preconditions: CONFIG assets/audio available; Phaser sound system present.
     * Postconditions: On completion, scene key becomes "CleanCatch".
     * Performance: Light; single fade tween on exit; no hot loops.
     * Determinism & idempotency: Input-gated BGM via once(); Enter key mirrors Next.
     */
    create(data) {
        const { width: W, height: H } = this.scale;
        const username   = this.registry.get("playerName") || "friend";
        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";

        // Global BGM → pause if active; this scene owns its own loop.
        try {
            const g = window.__GLOBAL_BGM__;
            if (g?.isPlaying) g.pause(); // BGM from main menu stops playing when this tutorial scene strats
        } catch {}

        // Local helper to safely start this scene’s BGM exactly once.
        // Error model: silent no-op on audio subsystem issues; music is optional.
        const playBgmNow = () => {
            /*This codeblock guaranteesm clean cathcer tutorial music starst exactly once,playes on loop and replaces any previous global music*/
            try { if (this.sound.locked) this.sound.unlock(); } catch {} //in some browsers phaser's audio is initially locked.. this unlocks it
            let inst = this.sound.get(BGM_KEY); // gets the existing sound interface
            if (!inst) inst = this.sound.add(BGM_KEY, { loop: true, volume: CA.cleanCatchBGAudio }); // to be safe, check if not addes and re adds BGM key
            if (!inst.isPlaying) inst.play();
            window.__MINI_BGM__ = inst;
            window.__GLOBAL_BGM__ = undefined;
        };

        // Concurrency/Autoplay policy: first gesture wins; once() avoids duplicate starts.
        this.input.once("pointerdown", playBgmNow);
        this.input.keyboard?.once("keydown", playBgmNow);

        // Stage background + vignette to focus attention on dialog panel
        this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(1);

        // Dialog panel with skin (fallback rectangle preserves layout if texture missing)
        let panel;
        const maxPanelW = Math.min(W * 1.5, 1500);
        const maxPanelH = Math.min(H * 2, 520);

        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H * 0.50, "DialogPanel")
                .setOrigin(0.5)
                .setDepth(2);
            const scale = Math.min(maxPanelW / panel.width, maxPanelH / panel.height);
            panel.setScale(scale);
        } else {
            panel = this.add.rectangle(W / 2, H * 0.55, maxPanelW, maxPanelH, 0xffffff)
                .setStrokeStyle(4, 0x7ec8ff)
                .setOrigin(0.5)
                .setDepth(2);
        }

        const panelW = panel.displayWidth;
        const panelH = panel.displayHeight;

        // Kiko avatar anchored near panel corner; scaled to fit panel height budget
        this.kiko = this.add.sprite(
            panel.x - panelW * 0.70,
            panel.y + panelH * 0.47,
            "KikoBase"
        )
            .setOrigin(0.5, 1)
            .setDepth(3);

        const kikoMaxH = panelH * 0.95;
        this.kiko.setScale(kikoMaxH / this.kiko.height);

        // Tutorial copy deck (ordered lines; toggles Kiko pose every other step)
        const lines = [
            `${username}! Are you ready for the Soap Splasher game? Let’s play!`,
            `Here’s how it works!`,
            `Catch the clean WATER droplets and SOAP bubbles — they’re good for us!`,
            `But be careful — you have 3 LIVES. Avoid the germs from spreading! Don’t let them touch your hands.`,
            `You have 30 SECONDS to catch as much clean WATER and SOAP as you can!\nUse your MOUSE to move my hands.`,
            `Let’s see how many you can CATCH!`,
            `When you’re ready, click the green ARROW!`
        ];

        let i = 0;

        // Text: sized from panel height, centered, wrapped to panel width
        const style = {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: Math.max(30, panelH * 0.10) + "px",
            color: "#000000",
            wordWrap: { width: panelW * 0.85 },
            align: "center"
        };

        const text = this.add.text(
            panel.x,
            panel.y,
            lines[i],
            style
        ).setOrigin(0.5).setDepth(4);

        // Next button (green arrow), consistent on-screen size via scale
        const nx = panel.x + panelW * 0.60;
        const ny = panel.y + panelH * 0.02;
        const nextBtn = this.add.image(nx, ny, "UI_Next")
            .setOrigin(0.5)
            .setDepth(4)
            .setInteractive({ useHandCursor: true });

        const btnScale = Math.min(120, H * 0.12) / nextBtn.height;
        nextBtn.setScale(btnScale);

        // Advance logic:
        // - step text through lines[]
        // - swap Kiko pose on even steps
        // - on last step, fade out all UI and start CleanCatch
        nextBtn.on("pointerdown", () => {
            playBgmNow(); // also ensures audio if user skipped earlier
            i++;
            if (i < lines.length) {
                text.setText(lines[i]);
                if (i % 2 === 0 && this.textures.exists("KikoCheer"))
                    this.kiko.setTexture("KikoCheer");
                else
                    this.kiko.setTexture("KikoBase");
            } else {
                this.tweens.add({
                    targets: [this.kiko, text, panel, nextBtn],
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        this.scene.start("CleanCatch", { difficulty });
                    }
                });
            }
        });

        // Accessibility & keyboard parity: Enter = Next
        this.input.keyboard.on("keydown-ENTER", () => nextBtn.emit("pointerdown"));
    }

}
