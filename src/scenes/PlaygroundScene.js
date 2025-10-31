// PlaygroundScene.js — interactive speech per tap, stationary speech bubble.
// Build the sandcastle step-by-step by tapping the sand. After the last step,
// Kiko walks toward the school door and transitions to SchoolBathroomScene.

/* global Phaser, CONFIG */

const KI = CONFIG.assets.kiko;

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const SAND_KEY  = "school_yard";
const SAND_PATH = "assets/images/background/school-yard.png";

// Kiko textures
const KIKO_BASE_KEY   = "kiko_base";
const KIKO_CHEER_KEY  = "kiko_cheer";
const KIKO_CHEER_PATH = KI.cheer;

// Enter-school sprite (side-jump)
const KIKO_ENTER_KEY  = "kiko_side_jump";
const KIKO_ENTER_PATH = "assets/images/Kiko/WashEd_kiko_sprite_side-jump.png";

// Speech bubble texture (tail points downward)
const BUBBLE_KEY  = "bubble_box";
const BUBBLE_PATH = "assets/images/UI/washed_kikos-day_UI-dialogue-box-v2.png";

// Draw layers
const LAYERS = { BG: 0, OBJECTS: 9, KIKO: 10, UI: 20 };

// Castle frames
const CASTLE_FRAMES = [
    { key: "sandcastle01", path: "assets/images/sandground/sandcastle01.png" },
    { key: "sandcastle02", path: "assets/images/sandground/sandcastle02.png" },
    { key: "sandcastle03", path: "assets/images/sandground/sandcastle03.png" },
    { key: "sandcastle04", path: "assets/images/sandground/sandcastle04.png" },
];

const CASTLE_SIZE   = 0.6;
const DOOR_X_FRAC   = 0.65;
const DOOR_Y_OFFSET = 0;

/** ----------------------------------------------------------------------------
 * Stationary speech bubble (placed once, does not follow on update/resize)
 * -------------------------------------------------------------------------- */
class SpeechBubble extends Phaser.GameObjects.Container {
    constructor(scene, anchor, opts = {}) {
        super(scene, 0, 0);
        scene.add.existing(this);

        this.maxWidth = opts.maxWidth ?? 640;
        this.padding  = 22;
        this.gap      = opts.gap ?? 28;

        this.bg = scene.add.image(0, 0, BUBBLE_KEY).setOrigin(0.5);
        const nativeW = this.bg.width || 1435;
        this.bg.setScale(this.maxWidth / nativeW);

        this.label = scene.add.text(0, 0, "", {
            fontFamily: (window.CONFIG?.ui?.fontFamily),
            fontSize: 34,
            color: "#073B4C",
            wordWrap: { width: this.maxWidth - this.padding * 2 },
            align: "left",
        }).setOrigin(0.5);

        this.add([this.bg, this.label]);
        this.setDepth(LAYERS.UI).setAlpha(1);

        // Position once (use WORLD coordinates if anchor is a child of a container)
        if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
            this.setPosition(opts.x, opts.y);
        } else if (anchor) {
            // Get anchor world position (works for both sprites and container children)
            let worldX = anchor.x, worldY = anchor.y;
            if (typeof anchor.getWorldTransformMatrix === "function") {
                const m = anchor.getWorldTransformMatrix();
                worldX = m.tx; // world translation X
                worldY = m.ty; // world translation Y (feet because origin is 0.5,1)
            }

            // Compute bubble position above the head using displayHeight
            const anchorH = (anchor.displayHeight ?? anchor.height ?? 0) || 200;
            const headTop = worldY - anchorH; // origin (0.5,1) ⇒ anchor.y is feet
            const bubbleHalfH = (this.bg.height * (this.bg.scaleY || this.bg.scaleX)) / 2;

            this.setPosition(worldX, headTop - this.gap - bubbleHalfH);
        } else {
            this.setPosition(scene.scale.width * 0.5, scene.scale.height * 0.25);
        }
    }

    /** Typewriter + optional auto-hide (pass null/0 to keep visible). */
    say(text, duration = 0) {
        if (this._typeEvt) this._typeEvt.remove(false);

        const chars = [...text];
        let i = 0;
        this.label.setText("");
        this._typeEvt = this.scene.time.addEvent({
            delay: 20, // typewriter speed (ms per char)
            loop: true,
            callback: () => {
                this.label.setText(chars.slice(0, ++i).join(""));
                if (i >= chars.length) this._typeEvt.remove(false);
            },
        });

        if (this._hideEvt) this._hideEvt.remove(false);
        if (duration && duration > 0) {
            this._hideEvt = this.scene.time.delayedCall(duration, () => this.hide());
        } else {
            this.setAlpha(1);
        }
    }

    hide() {
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 180, ease: "Sine.easeOut" });
    }
}




export default class PlaygroundScene extends Phaser.Scene {
    constructor() {
        super("PlaygroundScene");
        this._castleStage = -1;
        this._castleImage = null;
        this.sandArea = null;
        this.speech = null;
        this.canTap = true;
        this._dlgTimers = []; // queued dialogue timers

        // Kiko references
        this._kiko = null;     // sprite
        this._kikoRig = null;  // container that moves/scales
    }

    preload() {
        if (!this.textures.exists(SAND_KEY))       this.load.image(SAND_KEY, SAND_PATH);
        if (!this.textures.exists(KIKO_CHEER_KEY)) this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
        if (!this.textures.exists(KIKO_ENTER_KEY)) this.load.image(KIKO_ENTER_KEY, KIKO_ENTER_PATH);
        if (!this.textures.exists(BUBBLE_KEY))     this.load.image(BUBBLE_KEY, BUBBLE_PATH);
        for (const f of CASTLE_FRAMES) {
            if (!this.textures.exists(f.key)) this.load.image(f.key, f.path);
        }
    }

    create() {
        const { width, height } = this.scale;

        // ---- HARD RESET so replays start clean ----
        this._leaving = false;
        this._dialogStep = 0;
        this._castleStage = -1;
        this.canTap = true;
        if (this._castleImage) { this._castleImage.destroy(); this._castleImage = null; }
        this.input.enabled = true;
        this.tweens.killAll();
        this.cameras.main.resetFX();
        this.input.topOnly = false;

        systems.ui.placeLogo(this);
        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        // === BGM keep-alive from Menu (NO RESTART) ============================
        try {
            AudioManager.stopGroup?.("game");     // stop any minigame tracks
            AudioManager.resumeGroup?.("global"); // keep/resume global bgm group
        } catch {}

        // Prefer the exact instance that MenuScene started
        let bgm =
            (typeof window !== "undefined" && window.__GLOBAL_BGM__) ||
            this.sound.get("kikos_day");

        // Cache it globally for later scenes
        if (bgm && typeof window !== "undefined") window.__GLOBAL_BGM__ = bgm;

        // If audio context got suspended (tab switch), just resume the context.
        try { this.sound.context?.resume?.(); } catch {}

        if (bgm) {
            if (bgm.isPaused) {
                try { bgm.resume(); } catch {}
            }
            // if (bgm.isPlaying) do nothing
        }
        // =====================================================================

        this.scene.get("MenuScene")?.scene.stop(); // ensure menu isn't running
        this.registry.remove("playground_done");

        // Sand area
        this.sandArea = new Phaser.Geom.Rectangle(width * 0.15, height * 0.65, width * 0.70, height * 0.25);

        // Background
        const bg = this.add.image(width / 2, height / 2, SAND_KEY).setOrigin(0.5).setDepth(LAYERS.BG);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // Baseline
        const centerY = this.sandArea.bottom - 10;
        const centerX = this.sandArea.centerX;

        // Castle (left)
        const castleX = centerX - 220;
        const castleY = centerY;

        // --- Kiko: sprite + rig container to avoid y tween conflicts -----------
        if (this.textures.exists(KIKO_BASE_KEY)) {
            this._kiko = this.add.image(0, 0, KIKO_BASE_KEY)
                .setDisplaySize(600, 600)
                .setOrigin(0.5, 1);
        } else {
            const g = this.add.graphics({ x: 0, y: 0 });
            g.fillStyle(0x2a4cff, 1).fillCircle(0, 0, 60);
            this._kiko = g;
        }
        // rig holds the sprite and is the only thing that moves/scales
        this._kikoRig = this.add.container(centerX + 220, centerY, [this._kiko]).setDepth(LAYERS.KIKO);

        // Idle bounce on the child only
        this.tweens.add({
            targets: this._kiko,
            y: -10,                // bob 10px above its local baseline (0)
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Speech bubble anchored to the Kiko sprite (not the rig)
        this.speech = new SpeechBubble(this, this._kiko, { maxWidth: 700, fontSize: 30, gap: -10 });
        const name = (this.registry.get("playerName") || "friend");
        this.speech.say(`Hello, ${name}! My name is Kiko.\nLook! Let's make a sandcastle!\nTap the sand!`);

        // Build handler
        const buildNext = () => {
            this._castleStage = Math.min(this._castleStage + 1, CASTLE_FRAMES.length - 1);
            const { key } = CASTLE_FRAMES[this._castleStage];

            if (!this._castleImage) {
                this._castleImage = this.add.image(castleX, castleY, key)
                    .setOrigin(0.5, 1)
                    .setDepth(LAYERS.OBJECTS)
                    .setScale(CASTLE_SIZE);
            } else {
                this._castleImage.setTexture(key).setPosition(castleX, castleY);
            }

            // Pop feedback
            this._castleImage.setScale(CASTLE_SIZE - 0.1);
            this.tweens.add({ targets: this._castleImage, scale: CASTLE_SIZE, duration: 180, ease: "Back.Out" });

            if (this._castleStage === 0) {
                this.speech.say(`It's so much fun! Tap again!`);
            } else if (this._castleStage === 1) {
                this.speech.say(`Again!`);
            } else if (this._castleStage === 2) {
                this.speech.say(`Last one!`);
            }

            // Stage 3: queued lines with fixed 2s gaps, then start walking
            if (this._castleStage === 3) {
                // no more tapping while dialog/transition is in progress
                this.canTap = false;

                // queue helper: estimate typewriter time + 2s gap
                const typeMsPerChar = 20;  // keep in sync with SpeechBubble.say()
                const padMs        = 2000; // 2s gap between lines
                let t = 0;

                const queueLine = (text) => {
                    const ms = Math.max(800, text.length * typeMsPerChar + padMs);
                    const h = this.time.delayedCall(t, () => this.speech.say(text, 0 /* keep visible */));
                    this._dlgTimers.push(h);
                    t += ms;
                };

                // lines
                queueLine(`Oh no... my hands have gotten dirty.`);
                queueLine(`Hmm, what should we do? \nOf course — it's hand washing time!`);
                queueLine(`Washing our hands keeps us clean and healthy.`);
                queueLine(`Come with me! \nWill you help me wash my hands?`);

                // begin walking after the final line
                this.time.delayedCall(t, () => this._enterDoor());
            }
        };

        // Pointer tap handler
        const onPointer = (pointer) => {
            const { worldX: x, worldY: y } = pointer;
            if (!this.canTap) return;
            if (!Phaser.Geom.Rectangle.Contains(this.sandArea, x, y)) return;

            this.canTap = false;

            // temporary cheer swap on tap
            if (this._castleStage < CASTLE_FRAMES.length - 1 &&
                this.textures.exists(KIKO_CHEER_KEY) && this._kiko.setTexture) {
                this._kiko.setTexture(KIKO_CHEER_KEY).setDisplaySize(600, 600);
                this.time.delayedCall(220, () =>
                    (this.textures.exists(KIKO_BASE_KEY) && this._kiko.setTexture)
                        ? this._kiko.setTexture(KIKO_BASE_KEY).setDisplaySize(600, 600)
                        : null
                );
            }

            buildNext();

            if (this._castleStage < CASTLE_FRAMES.length - 1) {
                this.time.delayedCall(220, () => (this.canTap = true));
            }
        };

        // Reflow
        const reflow = (w, h) => {
            bg.setPosition(w / 2, h / 2).setScale(Math.max(w / bg.width, h / bg.height));
            this.sandArea.setTo(w * 0.15, h * 0.65, w * 0.70, h * 0.25);

            const cx = this.sandArea.centerX;
            const cy = this.sandArea.bottom - 10;

            if (this._kikoRig) this._kikoRig.setPosition(cx + 220, cy);
            if (this._castleImage) this._castleImage.setPosition(cx - 220, cy);
        };
        const onResize = ({ width: w, height: h }) => reflow(w, h);

        this.input.on("pointerdown", onPointer);
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        reflow(width, height);

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.off("pointerdown", onPointer);
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this.speech?.destroy();
            this._castleImage?.destroy();
            this.speech = null;
            this._castleImage = null;
            this.canTap = true;
            this._castleStage = -1;
            // optional: clear any delayed calls owned by this scene
            // this.time.removeAllEvents();
        });
    }

    /** Move toward the door, then go to bathroom scene. */
    _enterDoor() {
        this.canTap = false;

        // one-shot guard
        if (this._leaving) return;
        this._leaving = true;

        // stop any queued dialogue before moving
        if (this._dlgTimers) {
            for (const h of this._dlgTimers) { try { h.remove(false); } catch {} }
            this._dlgTimers.length = 0;
        }

        // hide & destroy speech bubble
        if (this.speech) {
            try { this.speech.hide(); } catch {}
            this.time.delayedCall(220, () => { try { this.speech.destroy(); } catch {} this.speech = null; });
        }

        // switch to side-jump pose
        if (this._kiko.setTexture && this.textures.exists(KIKO_ENTER_KEY)) {
            this._kiko.setTexture(KIKO_ENTER_KEY).setDisplaySize(600, 600);
            this._kiko.setFlipX(true).setAngle(8).setOrigin(0.5, 1);
        }

        // bobbing on the child sprite only (no y conflict with rig)
        const walkBob = this.tweens.add({
            targets: this._kiko,
            y: -10,
            yoyo: true,
            duration: 180,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        const doorX = this.scale.width * DOOR_X_FRAC;
        const doorY = this.sandArea.bottom - 150 + DOOR_Y_OFFSET;

        const startScale = this._kikoRig.scale || 1;
        const endScale   = startScale * 0.55;

        // move/scale the rig container only
        this.tweens.add({
            targets: this._kikoRig,
            x: doorX,
            y: doorY,
            scale: endScale,
            duration: 2800,
            ease: "Sine.easeInOut",
            onComplete: () => {
                // stop bobbing and snap child y to baseline to avoid “drop”
                try { walkBob.stop(); } catch {}
                if (this._kiko) this._kiko.y = 0;

                this.input.enabled = false;
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    this.scene.start("SchoolBathroomScene");
                });
                this.cameras.main.fadeOut(300, 0, 0, 0);
            },
        });
    }
}
