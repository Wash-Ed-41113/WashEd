// PlaygroundScene.js — castle on left, Kiko on right, no speech bubble.
// After final castle stage, Kiko switches to side-jump sprite, flips toward door,
// bounces while moving, SHRINKS into the door, then transitions to SchoolBathroomScene.

const KI = CONFIG.assets.kiko;
const BG = CONFIG.assets.backgrounds;

const SAND_KEY  = "school_yard";
const SAND_PATH = "assets/images/background/school-yard.png";

// Kiko textures
const KIKO_BASE_KEY   = "kiko_base";
const KIKO_CHEER_KEY  = "kiko_cheer";
const KIKO_CHEER_PATH = KI.cheer;

// Enter-school sprite (side-jump)
const KIKO_ENTER_KEY  = "kiko_side_jump";
const KIKO_ENTER_PATH = "assets/images/Kiko/WashEd_kiko_sprite_side-jump.png";

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
// Door horizontal position as a fraction of screen width (≈ center-right)
const DOOR_X_FRAC = 0.65;
const DOOR_Y_OFFSET = 0;

export default class PlaygroundScene extends Phaser.Scene {
    constructor() {
        super("PlaygroundScene");
        this._idleTween = null;
        this._castleStage = -1;
        this._castleImage = null;
        this.sandArea = null;
    }

    preload() {
        if (!this.textures.exists(SAND_KEY))   this.load.image(SAND_KEY, SAND_PATH);
        if (!this.textures.exists(KIKO_CHEER_KEY)) this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
        if (!this.textures.exists(KIKO_ENTER_KEY)) this.load.image(KIKO_ENTER_KEY, KIKO_ENTER_PATH);

        for (const f of CASTLE_FRAMES) {
            if (!this.textures.exists(f.key)) this.load.image(f.key, f.path);
        }
    }

    create() {
        const { width, height } = this.scale;

        // Sand area
        this.sandArea = new Phaser.Geom.Rectangle(width * 0.15, height * 0.65, width * 0.70, height * 0.25);

        // Background
        const bg = this.add.image(width / 2, height / 2, SAND_KEY)
            .setOrigin(0.5)
            .setDepth(LAYERS.BG);
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
        this._idleTween = this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        const showNextCastleStage = () => {
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

            // Pop animation
            this._castleImage.setScale(CASTLE_SIZE - 0.10);
            this.tweens.add({
                targets: this._castleImage,
                scale: CASTLE_SIZE,
                duration: 180,
                ease: "Back.Out"
            });

            // Final stage → Kiko enters door
            if (this._castleStage === CASTLE_FRAMES.length - 1) {
                this.time.delayedCall(1200, () => {
                    this._idleTween?.stop();

                    // Switch to side-jump & face left (toward door)
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

                    // Compute door target (center-right, on the sand baseline)
                    const doorX = this.scale.width * DOOR_X_FRAC;
                    const doorY = this.sandArea.bottom - 150;

                    const startScale = kiko.scale;
                    const endScale   = startScale * 0.55;

                    // Move + shrink into the door
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
                });
            }
        };

        // Click to build castle
        this.input.on("pointerdown", (pointer) => {
            const { worldX: x, worldY: y } = pointer;
            if (!Phaser.Geom.Rectangle.Contains(this.sandArea, x, y)) return;

            if (this._castleStage < CASTLE_FRAMES.length - 1) {
                if (this.textures.exists(KIKO_CHEER_KEY) && kiko.setTexture) {
                    kiko.setTexture(KIKO_CHEER_KEY).setDisplaySize(600, 600);
                    this.time.delayedCall(250, () => kiko.setTexture(KIKO_BASE_KEY).setDisplaySize(600, 600));
                }
                showNextCastleStage();
            }
        });

        // Resize
        const reflow = (w, h) => {
            bg.setPosition(w / 2, h / 2);
            bg.setScale(Math.max(w / bg.width, h / bg.height));
            this.sandArea.setTo(w * 0.15, h * 0.65, w * 0.70, h * 0.25);

            const cx = this.sandArea.centerX;
            const cy = this.sandArea.bottom - 10;

            if (kiko?.setPosition) kiko.setPosition(cx + 220, cy);
            if (this._castleImage) this._castleImage.setPosition(cx - 220, cy);
        };
        this.scale.on("resize", ({ width: w, height: h }) => reflow(w, h));
        reflow(width, height);
    }
}
