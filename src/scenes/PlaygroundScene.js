// this file defines the playground scene with sand background a school image and a kiko character
// it uses CONFIG assets for images and places simple ui text
// it supports idle animation movement to pointer and resize handling

// cache asset paths from CONFIG for short names
const KI = CONFIG.assets.kiko;
const BG = CONFIG.assets.backgrounds;

// define keys and paths for the sand background
const SAND_KEY   = "sand";
const SAND_PATH  = BG.sand;

// define keys and paths and layout offsets for the school image
const SCHOOL_KEY = "school";
const SCHOOL_PATH = BG.school;
const SCHOOL_OFFSET_X = 160;
const SCHOOL_OFFSET_Y = 20;

// define texture keys for kiko base and kiko cheer and the cheer path
const KIKO_BASE_KEY   = "kiko_base";
const KIKO_CHEER_KEY  = "kiko_cheer";
const KIKO_CHEER_PATH = KI.cheer;

// set draw order layers lower numbers draw behind higher numbers draw in front
const LAYERS = { BG: 0, SCHOOL: 2, KIKO: 10, UI: 20 };

// declare the scene class
export default class PlaygroundScene extends Phaser.Scene {
    // constructor sets the scene key and placeholders for tweens
    constructor() {
        super("PlaygroundScene");
        this._idleTween = null;
        this._moveTween = null;
    }

    // preload ensures textures exist before use
    preload() {
        // load sand if not already cached
        if (!this.textures.exists(SAND_KEY))   this.load.image(SAND_KEY, SAND_PATH);
        // load school if not already cached
        if (!this.textures.exists(SCHOOL_KEY)) this.load.image(SCHOOL_KEY, SCHOOL_PATH);
        // load kiko cheer sprite if not already cached base may be packed elsewhere
        if (!this.textures.exists(KIKO_CHEER_KEY)) this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
    }

    // create builds the scene visuals and input logic
    create(data) {
        // get the current view size
        const { width, height } = this.scale;

        // draw the sand background centered and scaled to cover the view
        const bg = this.add.image(width / 2, height / 2, SAND_KEY)
            .setOrigin(0.5, 0.5)
            .setDepth(LAYERS.BG);
        // scale the background to cover both width and height while keeping aspect ratio
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // add the school image near top right with a margin then scale it to fit a fraction of the view
        const margin = 24;
        const school = this.add.image(width - margin, margin, SCHOOL_KEY)
            .setOrigin(1, 0)
            .setDepth(LAYERS.SCHOOL);

        // helper to scale and position the school when the window size changes
        const fitSchool = (w, h) => {
            const src = this.textures.get(SCHOOL_KEY);
            if (!src) return;
            const maxW = w * 0.30;
            const maxH = h * 0.30;
            const scale = Math.min(maxW / src.width, maxH / src.height);
            school.setScale(scale);
            // position with small offsets so it sits slightly inward
            school.setPosition(w - margin - SCHOOL_OFFSET_X, margin + SCHOOL_OFFSET_Y);
        };
        // apply the initial sizing
        fitSchool(width, height);

        // create kiko as an image if base texture exists otherwise draw a circle as a fallback
        let kiko;
        if (this.textures.exists(KIKO_BASE_KEY)) {
            // add kiko image anchored at feet with a fixed display size so it looks consistent
            kiko = this.add.image(width * 0.32, height * 0.8, KIKO_BASE_KEY)
                .setDisplaySize(600, 600)
                .setOrigin(0.5, 1)
                .setDepth(LAYERS.KIKO)
                .setFlipX(false);
        } else {
            // fallback graphic so the scene still works without the sprite
            const r = 60;
            const g = this.add.graphics({ x: width * 0.32, y: height * 0.8 });
            g.fillStyle(0x2a4cff, 1).fillCircle(0, 0, r);
            g.setDepth(LAYERS.KIKO);
            kiko = g;
        }

        // start a gentle idle tween that moves kiko up and down in place
        const startIdleTween = () => {
            this._idleTween?.stop();
            this._idleTween = this.tweens.add({
                targets: kiko,
                y: (kiko.y ?? height * 0.8) - 10,
                duration: 1500,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut",
            });
        };
        startIdleTween();

        // helper to change the kiko texture safely and preserve facing direction
        const applyTexture = (key) => {
            if (!kiko.setTexture || !this.textures.exists(key)) return;
            const keepFlip = !!kiko.flipX;
            kiko.setTexture(key).setDisplaySize(600, 600);
            kiko.setFlipX?.(keepFlip);
        };
        // quick helpers to switch between cheer and base textures
        const switchToCheer = () => applyTexture(KIKO_CHEER_KEY);
        const switchToBase  = () => applyTexture(KIKO_BASE_KEY);

        // read ui config and player data for labels
        const UI = CONFIG.ui; // <-- fixed
        const difficulty = data?.difficulty ?? "normal";
        const playerName = this.registry.get("playerName") || "Player";
        // draw a small label to show selected difficulty
        this.add.text(24, 20, `Difficulty: ${difficulty}`, {
            fontFamily: UI.fontFamily, fontSize: "28px", color: "#111",
        }).setShadow(1, 1, "#fff", 1).setDepth(20);

        // pointer click moves kiko to the clicked position
        this.input.on("pointerdown", (pointer) => {
            // clamp target to the visible area
            const targetX = Phaser.Math.Clamp(pointer.worldX, 0, this.scale.width);
            const targetY = Phaser.Math.Clamp(pointer.worldY, 0, this.scale.height);

            // flip kiko to face the direction of travel when supported by image sprite
            if (kiko.setFlipX && typeof kiko.x === "number") {
                kiko.setFlipX(targetX > kiko.x);
            }

            // stop any running move tween to avoid overlap
            if (this._moveTween) {
                this._moveTween.stop();
                this._moveTween = null;
            }

            // show cheer while moving and stop the idle bounce
            switchToCheer();
            this._idleTween?.stop();
            this._idleTween = null;

            // create a move tween to the target position with a soft ease
            this._moveTween = this.tweens.add({
                targets: kiko,
                x: targetX,
                y: targetY,
                duration: 600,
                ease: "Sine.easeInOut",
                onComplete: () => {
                    // restore base pose then restart idle bounce
                    switchToBase();
                    this._moveTween = null;
                    startIdleTween();
                }
            });
        });

        // escape key returns to the game hub scene
        this.input.keyboard?.on("keydown-ESC", () => {
            this.scene.start("GameScene");
        });

        // keep layout correct when the game view is resized
        this.scale.on("resize", ({ width: w, height: h }) => {
            // center and rescale the background
            bg.setPosition(w / 2, h / 2);
            bg.setScale(Math.max(w / bg.width, h / bg.height));

            // resize and reposition the school image
            fitSchool(w, h);

            // reposition kiko baseline and restart idle so motion uses the new y
            if (kiko && kiko.setPosition) {
                kiko.setPosition(w * 0.32, h * 0.8);
                startIdleTween();
            }
        });
    }
}
