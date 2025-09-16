// --- Assets & layout constants ---
const SAND_KEY   = "sand";
const SAND_PATH  = "assets/images/backgrounds/sand.png";

const SCHOOL_KEY = "school";
const SCHOOL_PATH = "assets/images/backgrounds/school.png";
const SCHOOL_OFFSET_X = 160; // pull left from the right edge
const SCHOOL_OFFSET_Y = 20;  // push down from the top edge

const KIKO_BASE_KEY   = "kiko_base"; // assumed preloaded in PreloadScene
const KIKO_CHEER_KEY  = "kiko_cheer";
const KIKO_CHEER_PATH = "assets/images/WashEd_kiko_sprite/WashEd_kiko_sprite_cheer.png";

// Optional: simple layer ordering (higher depth = in front)
const LAYERS = { BG: 0, SCHOOL: 2, KIKO: 10, UI: 20 };

export default class PlaygroundScene extends Phaser.Scene {
    constructor() {
        super("PlaygroundScene");
        this._idleTween = null;
        this._moveTween = null;
    }

    preload() {
        // Load textures if not already present
        if (!this.textures.exists(SAND_KEY))   this.load.image(SAND_KEY, SAND_PATH);
        if (!this.textures.exists(SCHOOL_KEY)) this.load.image(SCHOOL_KEY, SCHOOL_PATH);
        if (!this.textures.exists(KIKO_CHEER_KEY)) this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
    }

    create(data) {
        const { width, height } = this.scale;

        // 1) Background: cover the whole screen while keeping aspect ratio
        const bg = this.add.image(width / 2, height / 2, SAND_KEY)
            .setOrigin(0.5, 0.5)
            .setDepth(LAYERS.BG);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // 1.5) School image at top-right with offset, auto-fit within 30% of viewport
        const margin = 24;
        const school = this.add.image(width - margin, margin, SCHOOL_KEY)
            .setOrigin(1, 0)
            .setDepth(LAYERS.SCHOOL);

        const fitSchool = (w, h) => {
            const src = this.textures.get(SCHOOL_KEY)?.getSourceImage();
            if (!src) return;
            const maxW = w * 0.30;
            const maxH = h * 0.30;
            const scale = Math.min(maxW / src.width, maxH / src.height);
            school.setScale(scale);
            school.setPosition(w - margin - SCHOOL_OFFSET_X, margin + SCHOOL_OFFSET_Y);
        };
        fitSchool(width, height);

        // 2) Kiko (with fallback placeholder if base texture is missing)
        let kiko;
        if (this.textures.exists(KIKO_BASE_KEY)) {
            kiko = this.add.image(width * 0.32, height * 0.8, KIKO_BASE_KEY)
                .setDisplaySize(600, 600)
                .setOrigin(0.5, 1)
                .setDepth(LAYERS.KIKO)
                .setFlipX(false); // default: facing left-to-right (no mirror)
        } else {
            const r = 60;
            const g = this.add.graphics({ x: width * 0.32, y: height * 0.8 });
            g.fillStyle(0x2a4cff, 1).fillCircle(0, 0, r);
            g.setDepth(LAYERS.KIKO);
            kiko = g; // note: Graphics doesn't support flipX (that's fine)
        }

        // Helper: (re)start a gentle idle bobbing tween around Kiko's *current* Y
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

        // 3) Texture switch helper that preserves the current flipX state
        const applyTexture = (key) => {
            if (!kiko.setTexture || !this.textures.exists(key)) return;
            const keepFlip = !!kiko.flipX;
            kiko.setTexture(key).setDisplaySize(600, 600);
            kiko.setFlipX?.(keepFlip);
        };
        const switchToCheer = () => applyTexture(KIKO_CHEER_KEY);
        const switchToBase  = () => applyTexture(KIKO_BASE_KEY);

        // 4) UI labels
        const difficulty = data?.difficulty ?? "normal";
        const playerName = this.registry.get("playerName") || "Player";
        this.add.text(24, 20, `Difficulty: ${difficulty}`, {
            fontFamily: "Arial", fontSize: "28px", color: "#111",
        }).setShadow(1, 1, "#fff", 1).setDepth(LAYERS.UI);

        this.add.text(24, 54, `Player: ${playerName}`, {
            fontFamily: "Arial", fontSize: "24px", color: "#222",
        }).setDepth(LAYERS.UI);

        // 5) Click-to-move:
        //    - Decide direction by comparing click X with Kiko.x
        //    - Flip horizontally when moving to the right
        //    - Use cheer texture while moving, revert to base after
        this.input.on("pointerdown", (pointer) => {
            const targetX = Phaser.Math.Clamp(pointer.worldX, 0, this.scale.width);
            const targetY = Phaser.Math.Clamp(pointer.worldY, 0, this.scale.height);

            // Direction: mirror when moving to the right side of current Kiko.x
            if (kiko.setFlipX && typeof kiko.x === "number") {
                kiko.setFlipX(targetX > kiko.x);
            }

            // Stop any previous move tween
            if (this._moveTween) {
                this._moveTween.stop();
                this._moveTween = null;
            }

            // Switch to cheer texture and pause idle
            switchToCheer();
            this._idleTween?.stop();
            this._idleTween = null;

            // Move tween
            this._moveTween = this.tweens.add({
                targets: kiko,
                x: targetX,
                y: targetY,
                duration: 600,
                ease: "Sine.easeInOut",
                onComplete: () => {
                    switchToBase();   // restore base texture
                    this._moveTween = null;
                    startIdleTween(); // restart idle around the new position
                }
            });
        });

        // 6) ESC to go back to GameScene
        this.input.keyboard?.on("keydown-ESC", () => {
            this.scene.start("GameScene");
        });

        // 7) Handle window resize
        this.scale.on("resize", ({ width: w, height: h }) => {
            // Background
            bg.setPosition(w / 2, h / 2);
            bg.setScale(Math.max(w / bg.width, h / bg.height));

            // School
            fitSchool(w, h);

            // Re-anchor Kiko near bottom-left (optional).
            // If you prefer to keep Kiko's relative position, remove the following block.
            if (kiko && kiko.setPosition) {
                kiko.setPosition(w * 0.32, h * 0.8);
                startIdleTween(); // restart idle around the refreshed position
            }
        });
    }
}
