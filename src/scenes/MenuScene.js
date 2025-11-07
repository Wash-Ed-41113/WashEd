/**
 * MODULE.md — MenuScene
 *
 * Document
 * Purpose in the system (one paragraph).
 * - MenuScene is the entry point and main launcher UI for Kiko’s Day. It boots/guards WebAudio,
 *   renders the animated landing background, captures the player name and difficulty, opens the
 *   mini-game hub (PlaygroundScene), and creates a DB session when play begins. It also manages
 *   one-shot gesture gates required by browsers before audio can play.
 *
 * Public surface: exported symbols (functions/classes/types).
 * - default export class MenuScene extends Phaser.Scene
 *   Public-ish methods (used by other scenes/helpers): goToPlaygroundSmooth(), openNameDialog(),
 *   openDifficultyDialog(), createStartButton(), layoutUI(), calcButtonScale(), ensureAudioStartOnce()
 *
 * Invariants this module maintains.
 * - At most one audio “gesture gate” (_uiBlocker) is armed at a time; it’s always cleared on leave.
 * - Scene transition is single-shot: _leaving prevents double navigation.
 * - Global BGM ownership: when menu starts playing the “global” track, any “game” group tracks are paused.
 * - Registry keys (“playerName”, “difficulty”, “mute”) reflect the latest UI state.
 *
 * Dependencies (internal + external) and why they’re chosen.
 * - Phaser 3 Scene lifecycle: rendering, input, tweens, DOM elements.
 * - systems.js (AudioManager, systems.ui helpers) to centralize audio fade/ducking and shared UI widgets.
 * - db.js (DB) to start sessions before launching gameplay so rounds can be recorded consistently.
 * - CONFIG for assets/layout so art and positions can be swapped without code edits.
 *
 * Performance notes (big-O, hot paths, memory gotchas).
 * - All UI builds are O(1) relative to screen size; the heaviest element is a single looping video.
 * - Video is resized on “loadeddata” and on resize events; work is trivial vs. frame budget.
 * - No per-frame polling; only a small fade/tween on show/hide. Avoid leaking _uiBlocker/video by always
 *   destroying on transition (done in goToPlaygroundSmooth()).
 *
 * Concurrency model (threads, async, locks, queues) and reentrancy caveats.
 * - Phaser is single-threaded; “concurrency” is via event callbacks and timers/tweens.
 * - Reentrancy is guarded with _gateArmed (audio unlock) and _leaving (navigation). Input handlers use
 *   once() when appropriate to avoid duplicate fires.
 *
 * Error model (exceptions/errors thrown; retryability).
 * - All critical platform calls (AudioContext resume/unlock, scene.stop, etc.) are wrapped in try/catch.
 *   Failures log a console.warn and continue with sensible fallbacks (e.g., muted audio or static bg).
 * - Missing assets fall back to vector/solid-color UI.
 *
 * Security/Privacy concerns (input trust level, data classification).
 * - Player name is free-text, stored in Phaser registry and used to seed DB session; treat as low-risk PII.
 * - Session id is kept on window.__SESSION_ID__ for handoff; no sensitive tokens are persisted.
 * - No network calls from this module; DB wrapper is expected to handle privacy/storage policy.
 *
 * Example usage snippet covering 80% use case.
 *   // In main boot flow:
 *   game.scene.add("MenuScene", MenuScene, true); // autostart after PreloadScene
 *   // From any other scene to return to menu:
 *   this.scene.start("MenuScene", { resetSession: true });
 *
 * Where
 * - This documentation sits as a top-of-file header. If it grows, mirror it to MODULE.md next to the file.
 */

/* ------------------------------
 * Class / Type — MenuScene
 * Responsibility:
 *   Orchestrate the landing UI, capture player metadata, unlock WebAudio, and route to the hub.
 * Collaborators & invariants:
 *   Uses systems.ui (logo), AudioManager (bgm), DB (session), CONFIG (assets/layout), Phaser video/audio.
 * Construction & lifecycle:
 *   new MenuScene() → preload() → create() → (user presses Start) → goToPlaygroundSmooth() → PlaygroundScene.
 * Thread-safety / mutability:
 *   All mutable state (_leaving, _gateArmed, _uiBlocker) is scene-scoped; not shared across threads.
 * Complexity hotspots:
 *   None significant; input gating and video resize are the trickiest event flows.
 * Serialization/format:
 *   N/A.
 * Smell to call out:
 *   If this class accumulates additional dialogs/menus, split into UI helpers or a MenuUI sub-module.
 * ------------------------------ */

// this block imports shared helpers used by the menu and game flow and audio systems and the client side db layer
import systems from "../systems.js";
import { DB } from "../db.js";
import { AudioManager } from "../systems.js";

// these ui constants define dialog sizing as a fraction of the screen and a small helper to read the font family from CONFIG
const DLG = { W_FRAC: 0.80, H_FRAC: 0.60 };
const getUIFont = () => CONFIG.ui?.fontFamily || "Montserrat";

// this scene is the entry menu that shows the animated background handles name and difficulty capture and routes to the hub
export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
        this.video = null;
        this.fallback = null;

        this.startButton = null;
        this.startShadow = null;
        this.startLabel = null;

        this._leaving = false;
        this._audioEnsured = false;
        this._gateArmed = false;
        this._uiBlocker = null;
    }

    /**
     * Function / Method — preload
     * What it does (one line):
     *   Load minimal art/audio for the menu (bg image, looping video, dialog chrome, bgm).
     *
     * Parameters:
     *   (none) — uses CONFIG for asset paths.
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Populates Phaser caches (image, video, audio).
     *
     * Preconditions / postconditions:
     *   CONFIG.assets.* paths exist or safe fallbacks are used. After preload, create() can reference keys.
     *
     * Errors/exceptions:
     *   Asset load failures are handled by Phaser; video/audio missing fall back to static image / muted state.
     *
     * Performance characteristics:
     *   O(1) loads; no heavy decoding in JS land.
     *
     * Determinism & idempotency:
     *   Deterministic given CONFIG; safe to reenter on hot-reload, as caches de-duplicate by key.
     */
    // preload loads the light assets needed by the menu including bg image looping video dialog art and bgm
    preload() {
        const BG = (typeof CONFIG !== "undefined" && CONFIG.assets && CONFIG.assets.backgrounds) || {};
        this.load.image("frontpage_background", BG.frontpage || "assets/images/backgrounds/frontpage.png");

        this.load.video(
            "menu_bg_video",
            "assets/videos/washed_kikos-day_LEVEL_01_scene_01_action_01_launcher.mp4",
            "loadeddata",
            false,
            true
        );

        this.load.image("dialog_skin", "assets/images/UI/washed_kikos-day_UI-dialogue-box-v1.png");
        this.load.image("ui_exit", "assets/images/UI/washed_kikos-day_UI-Button_EXIT.png");
        this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        this.load.image("ui_continue", "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png");

        this.load.audio("kikos_day", "assets/sounds/kikos_day.mp3");
    }

    /**
     * Function / Method — create
     * What it does (one line):
     *   Arm WebAudio unlock, build background/video, place Start, then run name→difficulty flow and enter the hub.
     *
     * Parameters:
     *   data?: {
     *     resetSession?: boolean — if true, clears window.__SESSION_ID__ before starting.
     *     quickRestart?: boolean — skip dialogs and go straight to PlaygroundScene.
     *     restartName?: string   — name to use on quick restart (default "Kiko").
     *   }
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Starts/controls global BGM; attaches one-shot input gates; may create a DB session; writes to registry.
     *
     * Preconditions / postconditions:
     *   Assumes CONFIG and systems are initialized. After success, either stays in menu or transitions away.
     *
     * Errors/exceptions:
     *   Audio unlock/resume is best-effort; failures log warnings but do not block navigation.
     *
     * Determinism & idempotency:
     *   Deterministic given user input; guarded by _gateArmed and event .once() to avoid double fires.
     */
    // create wires audio bootstrapping global bgm and builds the background video and start button then opens name and difficulty flow or quick restart
    create(data) {
        if (data?.resetSession) {
            window.__SESSION_ID__ = null;
        }

        // safety stop for any running minigame scenes to ensure a clean return to menu
        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        // audio bootstrap ensures menu bgm plays once after a first user gesture and stores a global handle for later scenes
        try {
            const KEY = "kikos_day";
            const VOL = 0.6;

            const playNow = () => {
                try { AudioManager.stopGroup?.("game"); } catch {}
                try { AudioManager.resumeGroup?.("global"); } catch {}

                let s = this.sound.get(KEY);
                if (!(s?.isPlaying)) {
                    s = s || this.sound.add(KEY, { loop: true, volume: VOL });
                    s.play();
                }

                if (typeof window !== "undefined") {
                    window.__GLOBAL_BGM__ = s;
                    s.once?.("destroy", () => {
                        if (window.__GLOBAL_BGM__ === s) window.__GLOBAL_BGM__ = null;
                    });
                }
            };

            if (!this._gateArmed) {
                this._gateArmed = true;

                this._uiBlocker = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
                    .setOrigin(0, 0)
                    .setScrollFactor(0)
                    .setDepth(9999)
                    .setInteractive({ useHandCursor: true });

                const safeKillGate = () => {
                    const g = this._uiBlocker;
                    this._uiBlocker = null;
                    if (g && g.scene) {
                        try { g.removeInteractive?.(); } catch {}
                        try { g.destroy?.(); } catch {}
                    }
                };

                const onFirstGesture = () => {
                    if (!this._gateArmed) return;
                    this._gateArmed = false;

                    try { if (this.sound.locked) this.sound.unlock(); } catch {}
                    try { this.sound.context?.resume?.(); } catch {}

                    playNow();
                    safeKillGate();
                };

                this._uiBlocker.once("pointerup", onFirstGesture);
                this.input.keyboard?.once("keydown", onFirstGesture);

                this.events.once("menu:startPressed", onFirstGesture);

                if (!this.sound.locked) this.time.delayedCall(0, onFirstGesture);
            }

            this.sound.pauseOnBlur = false;
            this.sound.mute = this.registry.get("mute") === true;
        } catch (e) {
            console.warn("[MenuScene] audio bootstrap error:", e);
        }

        // this call adds a one time global gesture listener that fires menu start to wake audio contexts on browsers with gesture guards
        this.ensureAudioStartOnce();

        // place the brand logo pinned to screen using systems ui helper
        systems.ui.placeLogo(this);

        const { width, height } = this.scale;

        // reset transition state and clear visual fx for a clean entry each time
        this._leaving = false;
        this.input.enabled = true;
        this.tweens.killAll();
        this.cameras.main.resetFX();

        // background still image used as a fallback under the video
        this.fallback = this.add
            .image(0, 0, "frontpage_background")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setDepth(-3);

        // looping muted background video centered and scaled to cover the screen
        this.video = this.add
            .video(width / 2, height / 2, "menu_bg_video")
            .setOrigin(0.5)
            .setDepth(-2)
            .setLoop(true);
        this.video.setMute(true).play(true);

        // this function scales the video to cover while keeping aspect and also resizes the fallback image
        const resizeVideo = () => {
            const W = this.scale.width;
            const H = this.scale.height;
            const vw = this.video.video?.videoWidth || 1280;
            const vh = this.video.video?.videoHeight || 720;
            const vr = vw / vh;
            const sr = W / H;

            let dw, dh;
            if (vr > sr) { dh = H; dw = H * vr; }
            else { dw = W; dh = W / vr; }
            this.video.setSize(dw, dh).setPosition(W / 2, H / 2);
            this.fallback.setDisplaySize(W, H).setPosition(0, 0);
        };
        this.video.on("loadeddata", resizeVideo);
        resizeVideo();

        // startFlow collects player name then opens difficulty picker and begins a session before entering the hub
        const startFlow = () => {
            const cachedName = this.registry.get("playerName");

            const proceedAfterName = (rawName) => {
                const name = (rawName || "").trim() || "Player";
                this.registry.set("playerName", name);

                // open difficulty picker then ensure session and navigate smoothly
                this.openDifficultyDialog((lvl) => {
                    window.__SESSION_ID__ = window.__SESSION_ID__ ?? DB.beginSession(name);
                    this.registry.set("difficulty", lvl);
                    this.goToPlaygroundSmooth(name, lvl, 600);
                });
            };

            if (!cachedName) this.openNameDialog(proceedAfterName);
            else proceedAfterName(cachedName);
        };

        // quick restart path used for developer or instant retry flows to skip dialogs
        this._quickRestart = !!data?.quickRestart;
        this._qrName = data?.restartName || "Kiko";

        const onStartPressed = () => {
            this.events.emit("menu:startPressed");

            if (this._quickRestart) {
                const currentName = this.registry.get("playerName") ?? this._qrName;
                const difficulty = 1;

                if (!this.registry.get("playerName")) this.registry.set("playerName", currentName);
                if (!this.registry.get("difficulty")) this.registry.set("difficulty", difficulty);

                if (typeof this.goToPlaygroundSmooth === "function") {
                    this.goToPlaygroundSmooth(currentName, difficulty, 400);
                } else {
                    this.scene.start("PlaygroundScene", { playerName: currentName, difficulty });
                }
                return;
            }
            startFlow();
        };

        // build start button using art if present or a drawn fallback then hook to onStartPressed
        this.createStartButton(onStartPressed);

        // keep layout responsive on resize including bg video and button placement
        this.scale.on("resize", () => {
            resizeVideo();
            this.layoutUI();
        });

        // gentle fade in for a polished entrance
        this.cameras.main.fadeIn(800, 0, 0, 0);
    }

    /**
     * Function / Method — goToPlaygroundSmooth
     * What it does (one line):
     *   Performs a guarded fade-out and switches to PlaygroundScene, ensuring input gates are cleared.
     *
     * Parameters:
     *   playerName: string — name to pass forward.
     *   difficulty: number — 1..3 difficulty value.
     *   dur?: number — fade-out duration in ms (default 600).
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Disables input, stops video, clears _uiBlocker, flips _leaving guard, performs scene transition.
     *
     * Preconditions / postconditions:
     *   Should only be called once per button press; after completion, MenuScene is stopped.
     *
     * Errors/exceptions:
     *   None thrown; all internals are guarded.
     *
     * Determinism & idempotency:
     *   Idempotent per call thanks to _leaving guard.
     */
    // this helper performs a guarded fade out transition to PlaygroundScene and prevents double navigation and also removes the audio gate blocker
    goToPlaygroundSmooth(playerName, difficulty, dur = 600) {

        if (this._uiBlocker) {
            try { this._uiBlocker.removeInteractive?.(); this._uiBlocker.destroy?.(); } catch {}
            this._uiBlocker = null;
        }
        this._gateArmed = false;

        if (this._leaving) return;
        this._leaving = true;

        this.input.enabled = false;
        this.tweens.killAll();
        this.video?.stop();

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PlaygroundScene", { playerName, difficulty });
        });
        this.cameras.main.fadeOut(dur, 0, 0, 0);
    }

    /**
     * Function / Method — openNameDialog
     * What it does (one line):
     *   Render a modal dialog to capture player name and invoke a continuation on submit.
     *
     * Parameters:
     *   onOk: (name: string) => void — callback invoked with validated name.
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Creates Phaser display objects and a DOM form; installs temporary input listeners.
     *
     * Preconditions / postconditions:
     *   Requires “dialog_skin”, “kiko_dialog” textures present (fallbacks are applied if missing elsewhere).
     *   Post: cleans up all objects/listeners before invoking onOk.
     *
     * Errors/exceptions:
     *   None thrown; minor layout operations wrapped defensively.
     *
     * Determinism & idempotency:
     *   Deterministic UI; can be reopened after close.
     */
    // openNameDialog draws a modal dialog with a dom input captures a validated name and calls back then disposes all listeners and nodes
    openNameDialog(onOk) {
        const { width, height } = this.scale;
        const dialogRoot = this.add.container(0, 0).setDepth(20);

        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        const innerPad = Math.round(60 * s);
        const innerLeft = panel.x - panelW / 2 + innerPad;
        const innerRight = panel.x + panelW / 2 - innerPad;
        const innerW = innerRight - innerLeft;

        const gutter = Math.round(28 * s);
        const leftColW = Math.round(innerW * 0.3);
        const rightX = innerLeft + leftColW + gutter;
        const rightW = innerW - leftColW - gutter;

        if (this.textures.exists("kiko_dialog")) {
            const kd = this.add
                .image(innerLeft + leftColW / 2, panel.y + panelH * 0.35, "kiko_dialog")
                .setOrigin(0.5, 1);
            const targetH = panelH * 0.70;
            kd.setScale(targetH / kd.height);
            dialogRoot.add(kd);
        }

        const uiFont = getUIFont();

        const title = this.add
            .text(rightX, panel.y - panelH * 0.12, "Hey, I’m Kiko. What’s your name?", {
                fontFamily: uiFont,
                color: "#000000",
            })
            .setOrigin(0, 0.5);
        title.setFontSize(Math.max(40, Math.round(40 * s)));
        title.setWordWrapWidth(rightW, true);
        dialogRoot.add(title);

        const html = `
          <div id="wrap" style="font-family:${uiFont}">
            <input id="nameInput" type="text" placeholder="Type your name..." style="font-family:${uiFont}" />
            <button id="okBtn">Continue</button>
          </div>
        `;
        const form = this.add.dom(rightX + 110, panel.y + panelH * 0.02).createFromHTML(html).setOrigin(0.5);
        dialogRoot.add(form);

        const wrap = form.getChildByID("wrap");
        const input = form.getChildByID("nameInput");
        const ok = form.getChildByID("okBtn");

        wrap.style.width = `${Math.floor(rightW)}px`;
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.alignItems = "stretch";
        wrap.style.gap = `${Math.max(10, Math.round(10 * s))}px`;

        input.style.boxSizing = "border-box";
        input.style.flex = "1 1 auto";
        input.style.width = "60%";
        input.style.height = `${Math.round(120 * s)}px`;
        input.style.padding = `0 ${Math.round(14 * s)}px`;
        input.style.fontSize = `${Math.round(50 * s)}px`;
        input.style.border = `${Math.max(2, Math.round(2 * s))}px solid #9EDCFF`;
        input.style.borderRadius = `${Math.round(10 * s)}px`;
        input.style.outline = "none";

        ok.style.display = "none";

        const btnSize = Math.round(170 * s);
        const continueBtn = this.add
            .image(panel.x, panel.y + panelH * 0.27, "ui_continue")
            .setOrigin(0.5)
            .setDisplaySize(btnSize, btnSize)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(continueBtn);

        const base = { s: continueBtn.scale, y: continueBtn.y };
        continueBtn.on("pointerover", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s * 1.06, y: base.y - 3, duration: 120, ease: "Sine.easeOut" });
        });
        continueBtn.on("pointerout", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s, y: base.y, duration: 120, ease: "Sine.easeOut" });
        });

        const submit = () => {
            const value = (input.value || "").trim();
            if (value) {
                destroyDialog();
                onOk?.(value);
            } else {
                const bx = form.x;
                this.tweens.add({
                    targets: form,
                    x: bx + Math.round(8 * s),
                    duration: 50,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => form.setX(bx),
                });
            }
        };
        const onKey = (e) => { if (e.key === "Enter") submit(); };

        continueBtn.on("pointerdown", () => {
            this.tweens.add({
                targets: continueBtn,
                scale: base.s * 0.97,
                duration: 80,
                yoyo: true,
                ease: "Quad.easeOut",
                onComplete: () => submit(),
            });
        });

        form.node.addEventListener("keydown", onKey);

        const closeBtn = this.add
            .image(
                panel.x + panelW / 2 - Math.round(46 * s),
                panel.y - panelH / 2 + Math.round(46 * s),
                "ui_exit"
            )
            .setOrigin(0.5)
            .setScale(0.12)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(closeBtn);

        const baseScale = 0.12;
        closeBtn.on("pointerover", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale * 1.15, duration: 120, ease: "Sine.easeOut" });
        });
        closeBtn.on("pointerout", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale, duration: 120, ease: "Sine.easeOut" });
        });

        const destroyDialog = () => {
            form.node.removeEventListener?.("keydown", onKey);
            this.tweens.killTweensOf(closeBtn);
            this.tweens.killTweensOf(form);
            this.tweens.killTweensOf(continueBtn);
            dialogRoot.destroy(true);
            this.events.off("shutdown", destroyDialog);
        };

        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);

        // ensure audio gesture is armed while dialog is active on locked browsers
        this.ensureAudioStartOnce();
    }

    /**
     * Function / Method — openDifficultyDialog
     * What it does (one line):
     *   Show Easy/Normal/Hard choices and resolve to a numeric 1..3 difficulty.
     *
     * Parameters:
     *   onPick: (level: number) => void — callback with 1|2|3.
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Creates a modal container and interactive buttons; writes “difficulty” to registry on pick.
     *
     * Preconditions / postconditions:
     *   Requires “dialog_skin” texture; cleans up all listeners and tweens on close.
     *
     * Errors/exceptions:
     *   None thrown; safe guards around tweens and destruction.
     *
     * Determinism & idempotency:
     *   Deterministic UI; idempotent cleanup.
     */
    // openDifficultyDialog renders three large buttons easy normal hard and returns a numeric level to the caller while cleaning up listeners and tweens on close
    openDifficultyDialog(onPick) {
        const { width, height } = this.scale;

        const dialogRoot = this.add.container(0, 0).setDepth(20);

        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        const lvlMap = { easy: 1, normal: 2, hard: 3 };

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        const innerPad = Math.round(60 * s);
        const left = panel.x - panelW / 2 + innerPad;
        const right = panel.x + panelW / 2 - innerPad;
        const innerW = right - left;

        const uiFont = getUIFont();

        const title = this.add
            .text(panel.x, panel.y - panelH * 0.18, "Choose Difficulty", {
                fontFamily: "Chewy", color: "#000000", align: "center"
            })
            .setOrigin(0.5, 0.5);
        title.setFontSize(Math.max(85, Math.round(85 * s)));
        title.setFontStyle("bold");
        title.setWordWrapWidth(innerW, true);
        dialogRoot.add(title);

        const rowY = panel.y + Math.round(panelH * 0.10);
        const btnW = Math.min(width * 0.22, 360);
        const btnH = Math.min(height * 0.12, 120);
        const radius = Math.round(btnH * 0.28);
        const gap = Math.round(22 * s);

        const makeBtnTex = (key, fill) => {
            const g = this.add.graphics();
            g.fillStyle(fill, 1);
            g.fillRoundedRect(0, 0, btnW, btnH, radius);
            g.lineStyle(Math.max(3, Math.round(3 * s)), 0x073b4c, 0.35);
            g.strokeRoundedRect(0, 0, btnW, btnH, radius);
            g.generateTexture(key, btnW, btnH);
            g.destroy();
        };

        if (!this.textures.exists("btn_diff_easy")) makeBtnTex("btn_diff_easy", 0xB9FBC0);
        if (!this.textures.exists("btn_diff_norm")) makeBtnTex("btn_diff_norm", 0xBEE1FF);
        if (!this.textures.exists("btn_diff_hard")) makeBtnTex("btn_diff_hard", 0xFFD6A5);

        const cx = panel.x;
        const x1 = cx - btnW - gap;
        const x2 = cx;
        const x3 = cx + btnW + gap;

        const buttons = [
            { key: "btn_diff_easy", label: "Easy", value: "easy" },
            { key: "btn_diff_norm", label: "Normal", value: "normal" },
            { key: "btn_diff_hard", label: "Hard", value: "hard" },
        ];
        const bx = [x1, x2, x3];
        const phaserBtns = [];

        buttons.forEach((b, i) => {
            const img = this.add.image(bx[i], rowY, b.key).setOrigin(0.5).setInteractive({ useHandCursor: true });
            img.setDepth(1);
            const lab = this.add.text(bx[i], rowY, b.label, { fontFamily: uiFont, color: "#073B4C" }).setOrigin(0.5, 0.55);
            lab.setFontSize(Math.round(btnH * 0.35));
            lab.setDepth(2);

            const base = { y: img.y, ly: lab.y };
            img.on("pointerover", () => {
                this.tweens.add({ targets: img, scale: 1.04, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: lab, scale: 1.04, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerout", () => {
                this.tweens.add({ targets: img, scale: 1, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: lab, scale: 1, y: base.ly, duration: 120, ease: "Sine.easeOut" });
            });

            img.on("pointerdown", () => {
                this.tweens.add({
                    targets: [img, lab],
                    scale: 0.98,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => {
                        const raw = b.value ?? "normal";
                        const lvl = lvlMap[String(raw).toLowerCase()] ?? 2;
                        this.registry.set("difficulty", lvl);
                        destroyDialog();
                        onPick?.(lvl);
                    },
                });
            });

            phaserBtns.push(img, lab);
            dialogRoot.add(img);
            dialogRoot.add(lab);
        });

        const closeBtn = this.add
            .image(
                panel.x + panelW / 2 - Math.round(46 * s),
                panel.y - panelH / 2 + Math.round(46 * s),
                "ui_exit"
            )
            .setOrigin(0.5)
            .setScale(0.12)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(closeBtn);

        const baseScale = 0.12;
        closeBtn.on("pointerover", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale * 1.15, duration: 120, ease: "Sine.easeOut" });
        });
        closeBtn.on("pointerout", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale, duration: 120, ease: "Sine.easeOut" });
        });

        const destroyDialog = () => {
            phaserBtns.forEach(b => this.tweens.killTweensOf(b));
            dialogRoot.destroy(true);
            this.events.off("shutdown", destroyDialog);
        };
        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);
    }

    /**
     * Function / Method — createStartButton
     * What it does (one line):
     *   Build the “Start” CTA (sprite or drawn fallback), wire hover/click tweens, and remember refs for layout.
     *
     * Parameters:
     *   onStart: () => void — invoked when the button is clicked/activated.
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Creates display objects; writes this.startButton/shadow/label; installs pointer handlers.
     *
     * Preconditions / postconditions:
     *   Requires either “ui_start” texture or generates a vector fallback.
     *
     * Performance characteristics:
     *   O(1) draw; textures are cached.
     */
    // createStartButton draws either a sprite based start button or a vector fallback wires hover and click tweens and stores references for responsive layout
    createStartButton(onStart) {
        const { width, height } = this.scale;
        const bx = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
        const BTN_X = width * bx;
        const BTN_Y = height * by;

        this.startButton?.destroy();
        this.startShadow?.destroy();
        this.startLabel?.destroy();

        if (this.textures.exists("ui_start")) {
            const img = this.add
                .image(BTN_X, BTN_Y, "ui_start")
                .setOrigin(0.5)
                .setDepth(2)
                .setInteractive({ useHandCursor: true });

            const s = this.calcButtonScale(img.width, img.height);
            img.setScale(s);

            const shadow = this.add
                .image(img.x + 6, img.y + 8, "ui_start")
                .setOrigin(0.5)
                .setDepth(1)
                .setScale(s)
                .setTint(0x000000)
                .setAlpha(0.25);

            const base = { s, y: img.y, sy: shadow.y };
            img.on("pointerover", () => {
                this.tweens.add({ targets: img, scale: base.s * 1.05, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: base.s * 1.05, y: base.sy - 4, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerout", () => {
                this.tweens.add({ targets: img, scale: base.s, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: base.s, y: base.sy, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerdown", () => {
                this.tweens.add({
                    targets: [img, shadow],
                    scale: base.s * 0.97,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => onStart(),
                });
            });

            this.startButton = img;
            this.startShadow = shadow;
            this.startLabel = null;
        } else {
            const bw = Math.min(width * 0.5, 520);
            const bh = Math.min(height * 0.2, 140);
            const radius = Math.min(24, bh * 0.25);

            const g = this.add.graphics();
            g.fillStyle(0xff8a00, 1);
            g.fillRoundedRect(0, 0, bw, bh, radius);
            g.fillStyle(0xffa733, 0.35);
            g.fillRoundedRect(8, 8, bw - 16, bh * 0.5, radius * 0.7);
            g.lineStyle(6, 0xcc5f00, 1);
            g.strokeRoundedRect(0, 0, bw, bh, radius);
            g.generateTexture("btn_big_orange", bw, bh);
            g.destroy();

            const btn = this.add
                .image(BTN_X, BTN_Y, "btn_big_orange")
                .setOrigin(0.5)
                .setDepth(2)
                .setInteractive({ useHandCursor: true });
            const shadow = this.add
                .image(btn.x + 6, btn.y + 8, "btn_big_orange")
                .setOrigin(0.5)
                .setDepth(1)
                .setTint(0x000000)
                .setAlpha(0.25);
            const label = this.add
                .text(BTN_X, BTN_Y, "START", { fontFamily: getUIFont(), color: "#ffffff" })
                .setOrigin(0.5)
                .setDepth(3);
            label.setFontSize(Math.round(bh * 0.42));
            label.setStroke("#6b2600", Math.max(2, Math.round(bh * 0.05)));

            const base = { y: BTN_Y, sy: shadow.y, ly: label.y };
            btn.on("pointerover", () => {
                this.tweens.add({ targets: btn, scale: 1.05, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: 1.05, y: base.sy - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: label, scale: 1.05, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
            });
            btn.on("pointerout", () => {
                this.tweens.add({ targets: btn, scale: 1, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: 1, y: base.sy, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: label, scale: 1, y: base.ly, duration: 120, ease: "Sine.easeOut" });
            });
            btn.on("pointerdown", () => {
                this.tweens.add({
                    targets: [btn, shadow, label],
                    scale: 0.97,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => onStart(),
                });
            });

            this.startButton = btn;
            this.startShadow = shadow;
            this.startLabel = label;
        }

        this.layoutUI();
    }

    /**
     * Function / Method — layoutUI
     * What it does (one line):
     *   Reposition/scale the start button cluster to remain responsive to viewport changes and CONFIG.
     *
     * Parameters:
     *   (none) — uses current scale and CONFIG.menu.buttonsX/Y.
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Mutates positions/scales of existing button/shadow/label.
     *
     * Determinism & idempotency:
     *   Pure relative to current scale/CONFIG and current textures.
     */
    // layoutUI repositions and rescales the start button and its shadow and label when the screen size or config positioning changes
    layoutUI() {
        const { width, height } = this.scale;
        const bx = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
        const BTN_X = width * bx;
        const BTN_Y = height * by;

        if (!this.startButton) return;

        this.startButton.setPosition(BTN_X, BTN_Y);
        this.startShadow?.setPosition(BTN_X + 6, BTN_Y + 8);
        this.startLabel?.setPosition(BTN_X, BTN_Y);

        if (this.textures.exists("ui_start") && this.startButton.texture.key === "ui_start") {
            const tex = this.textures.get("ui_start").getSourceImage();
            const s = this.calcButtonScale(tex.width, tex.height);
            this.startButton.setScale(s);
            this.startShadow?.setScale(s);
        } else if (this.startButton.texture.key === "btn_big_orange") {
            const bh = Math.min(height * 0.2, 140);
            this.startLabel?.setFontSize(Math.round(bh * 0.42));
            this.startLabel?.setStroke("#6b2600", Math.max(2, Math.round(bh * 0.05)));
        }
    }

    /**
     * Function / Method — calcButtonScale
     * What it does (one line):
     *   Compute a sprite scale so the Start button fits a target fraction of the viewport.
     *
     * Parameters:
     *   nativeW: number — source texture width in px.
     *   nativeH: number — source texture height in px.
     *
     * Return value:
     *   number — uniform scale factor.
     *
     * Determinism & idempotency:
     *   Pure calculation from current viewport and provided native size.
     */
    // calcButtonScale computes a scale factor for the start button sprite so it fits a target fraction of the viewport
    calcButtonScale(nativeW, nativeH) {
        const { width, height } = this.scale;
        const sW = (width * 0.38) / nativeW;
        const sH = (height * 0.22) / nativeH;
        return Math.min(sW, sH);
    }

    /**
     * Function / Method — ensureAudioStartOnce
     * What it does (one line):
     *   Arm one-shot global gesture listeners that emit “menu:startPressed” to unlock WebAudio contexts.
     *
     * Parameters:
     *   (none)
     *
     * Return value:
     *   void.
     *
     * Side effects:
     *   Adds window/document event listeners (once) to trigger audio resume/unlock via create()’s gate.
     *
     * Preconditions / postconditions:
     *   Safe to call multiple times; guarded by _audioEnsured flag.
     *
     * Determinism & idempotency:
     *   Idempotent; installs listeners exactly once per scene lifetime.
     */
    // ensureAudioStartOnce adds one shot global gesture listeners that emit menu start to unlock web audio on platforms with user gesture requirements
    ensureAudioStartOnce() {
        if (this._audioEnsured) return;
        this._audioEnsured = true;

        const fire = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            this.events.emit("menu:startPressed");
        };

        window.addEventListener("mousedown", fire, { once: true, passive: true });
        window.addEventListener("touchstart", fire, { once: true, passive: true });
        document.addEventListener("keydown", fire, { once: true });
    }
}
