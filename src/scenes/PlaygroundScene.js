// PlaygroundScene.js — interactive speech per tap, stationary speech bubble.
// Build the sandcastle step-by-step by tapping the sand. After the last step,
// Kiko walks toward the school door and transitions to SchoolBathroomScene.

/* global Phaser, CONFIG */

const KI = CONFIG.assets.kiko;

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

const CASTLE_SIZE = 0.6;
const DOOR_X_FRAC = 0.65;
const DOOR_Y_OFFSET = 0;

/** ----------------------------------------------------------------------------
 * Stationary speech bubble:
 * - Positioned once above the anchor's head at creation time.
 * - Does NOT follow on update/resize.
 * -------------------------------------------------------------------------- */
class SpeechBubble extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {Phaser.GameObjects.GameObject} anchor  Used only to compute initial position.
     * @param {{maxWidth?:number, fontSize?:number, gap?:number, x?:number, y?:number}} opts
     */
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
            fontFamily: (window.CONFIG?.ui?.fontFamily) || "Arial",
            fontSize: (opts.fontSize ?? 28),
            color: "#073B4C",
            wordWrap: { width: this.maxWidth - this.padding * 2 },
            align: "left",
        }).setOrigin(0.5);

        this.add([this.bg, this.label]);
        this.setDepth(LAYERS.UI).setAlpha(1);

        // Position once
        if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
            this.setPosition(opts.x, opts.y);
        } else if (anchor) {
            const anchorH = (anchor.displayHeight ?? anchor.height ?? 0) || 200;
            const headTop = anchor.y - anchorH; // origin (0.5, 1) ⇒ y is feet
            const bubbleHalfH = (this.bg.height * (this.bg.scaleY || this.bg.scaleX)) / 2;
            this.setPosition(anchor.x, headTop - this.gap - bubbleHalfH);
        } else {
            this.setPosition(scene.scale.width * 0.5, scene.scale.height * 0.25);
        }
    }

    /** Typewriter + optional auto-hide (pass null/0 to keep visible). */
    say(text, duration = 0) {
        // Clear previous typewriter
        if (this._typeEvt) this._typeEvt.remove(false);

        const chars = [...text];
        let i = 0;
        this.label.setText("");
        this._typeEvt = this.scene.time.addEvent({
            delay: 20, loop: true,
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
        this.scene.tweens.add({
            targets: this, alpha: 0, duration: 180, ease: "Sine.easeOut",
        });
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
    }

    preload() {
        if (!this.textures.exists(SAND_KEY))         this.load.image(SAND_KEY, SAND_PATH);
        if (!this.textures.exists(KIKO_CHEER_KEY))   this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
        if (!this.textures.exists(KIKO_ENTER_KEY))   this.load.image(KIKO_ENTER_KEY, KIKO_ENTER_PATH);
        if (!this.textures.exists(BUBBLE_KEY))       this.load.image(BUBBLE_KEY, BUBBLE_PATH);
        for (const f of CASTLE_FRAMES) {
            if (!this.textures.exists(f.key)) this.load.image(f.key, f.path);
        }
    }

    create() {
        const { width, height } = this.scale;

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

        // Kiko (right)
        let kiko;
        if (this.textures.exists(KIKO_BASE_KEY)) {
            kiko = this.add.image(centerX + 220, centerY, KIKO_BASE_KEY)
                .setDisplaySize(600, 600)
                .setOrigin(0.5, 1)
                .setDepth(LAYERS.KIKO);
        } else {
            const g = this.add.graphics({ x: centerX + 220, y: centerY });
            g.fillStyle(0x2a4cff, 1).fillCircle(0, 0, 60);
            g.setDepth(LAYERS.KIKO);
            kiko = g;
        }

        // Idle bounce
        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Stationary speech bubble: pinned once above Kiko's head
        this.speech = new SpeechBubble(this, kiko, { maxWidth: 680, fontSize: 30, gap: -10 });

        // Intro line – waits for user tap (no auto-advance)
        const name = (this.registry.get("playerName") || "friend");
        this.speech.say(`Hello, ${name}! My name is Kiko.\nLook! Let's make sandcastle!\nTap the sand!`);

        // --- typewriter tuning ---
        const TYPE_BASE_MS   = (CONFIG?.ui?.typeSpeedMs ?? 85);   // default 85 ms/char (raise to slow more)
        const PUNCT_PAUSE_MS = { ",": 140, ".": 280, "!": 280, "?": 280, "…": 320, ";": 160, ":": 160 };



        // Build handler
        const buildNext = () => {
            // advance stage index (0..3)
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

            // Stage-specific prompt for the NEXT action
            if (this._castleStage === 0) {
                this.speech.say(`It's so much fun! Tap again!`);
            } else if (this._castleStage === 1) {
                this.speech.say(`Again!`);
            } else if (this._castleStage === 2) {
                this.speech.say(`Last one!`);
            } else if (this._castleStage === 3) {
                // Completed
                this.speech.say(`Oh no... my hands have gotten dirty.`);
                // Small pause before walking animation
                this.time.delayedCall(900, () => this._enterDoor(kiko));
            }
        };

        // Tap to build (debounced)
        this.input.on("pointerdown", (pointer) => {
            const { worldX: x, worldY: y } = pointer;
            if (!this.canTap) return;
            if (!Phaser.Geom.Rectangle.Contains(this.sandArea, x, y)) return;

            this.canTap = false;

            // Cheer swap (quick)
            if (this._castleStage < CASTLE_FRAMES.length - 1) {
                if (this.textures.exists(KIKO_CHEER_KEY) && kiko.setTexture) {
                    kiko.setTexture(KIKO_CHEER_KEY).setDisplaySize(600, 600);
                    this.time.delayedCall(220, () =>
                        kiko.setTexture(KIKO_BASE_KEY).setDisplaySize(600, 600)
                    );
                }
            }

            buildNext();

            // Re-enable tap after short feedback window unless finished
            if (this._castleStage < CASTLE_FRAMES.length - 1) {
                this.time.delayedCall(220, () => (this.canTap = true));
            }
        });

        // Resize: keep background/sand aligned; bubble stays fixed by design
        const reflow = (w, h) => {
            bg.setPosition(w / 2, h / 2).setScale(Math.max(w / bg.width, h / bg.height));
            this.sandArea.setTo(w * 0.15, h * 0.65, w * 0.70, h * 0.25);

            const cx = this.sandArea.centerX;
            const cy = this.sandArea.bottom - 10;

            if (kiko?.setPosition) kiko.setPosition(cx + 220, cy);
            if (this._castleImage) this._castleImage.setPosition(cx - 220, cy);
        };
        this.scale.on("resize", ({ width: w, height: h }) => reflow(w, h));
        reflow(width, height);
    }

    /** Move toward the door with bounce + shrink, then go to bathroom scene. */
    _enterDoor(kiko) {
        // Disable further taps
        this.canTap = false;

        // Switch to side-jump & face left (toward the door)
        if (kiko.setTexture && this.textures.exists(KIKO_ENTER_KEY)) {
            kiko.setTexture(KIKO_ENTER_KEY).setDisplaySize(600, 600);
            kiko.setFlipX(true);
            kiko.setAngle(8);
        }

        // Walking bounce
        const walkBob = this.tweens.add({
            targets: kiko,
            y: '+=10',
            yoyo: true,
            duration: 180,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // Door target (center-right, near baseline)
        const doorX = this.scale.width * DOOR_X_FRAC;
        const doorY = this.sandArea.bottom - 150 + DOOR_Y_OFFSET;

        const startScale = kiko.scale;
        const endScale   = startScale * 0.55;

        this.tweens.add({
            targets: kiko,
            x: doorX,
            y: doorY,
            scale: endScale,
            duration: 2800,
            ease: "Sine.easeInOut",
            onComplete: () => {
                walkBob.stop();
                this.scene.start("SchoolBathroomScene");
            },
        });
    }
}
