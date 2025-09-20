import systems from "../systems.js";

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");
        // counters/state (kept here for clarity; also (re)initialised in create)
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this.gameStartAt = null;

        // spawn geometry (computed in create when CONFIG/useSpawner available)
        this.rOuter = 0;
        this.rInner = 0;
        this.angleMinDeg = 0;
        this.angleMaxDeg = 90;
    }

    preload() {
        this.load.image("Background", "assets/images/created/background.png");
        this.load.image("Sink", "assets/images/created/Sink.png");
        this.load.image("Germ", "assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png");
    }

    create() {
        // --- sink anchor ---
        this.sinkPosition = { x: 0, y: CONFIG.soapSplash.height };

        // --- background & sink ---
        this.add
            .sprite(CONFIG.soapSplash.width / 2, CONFIG.soapSplash.height / 2, "Background")
            .setDepth(0)
            .setScale(2);

        this.sinkSprite = this.add
            .sprite(this.sinkPosition.x, this.sinkPosition.y, "Sink")
            .setOrigin(0, 1)
            .setScale(4)
            .setDepth(4);

        // Centralized point to test for breaches (TODO: upgrade to circle hit test)
        this.getSinkHitPoint = () => ({
            x: this.sinkSprite.x + this.sinkSprite.displayWidth * 0.5,
            y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5,
        });

        // --- spawn geometry (cone-band in the top-right corner) ---
        if (CONFIG.soapSplash.useSpawner) {
            // Distance from sink anchor to top-right corner
            const cornerDist = Math.hypot(
                CONFIG.soapSplash.width - this.sinkPosition.x,
                0 - this.sinkPosition.y
            );
            this.rOuter = Math.max(0, cornerDist - CONFIG.soapSplash.cornerMargin);
            this.rInner = Math.max(0, this.rOuter - CONFIG.soapSplash.cornerBandWidth);

            // Angle window centred on vector from sink -> top-right
            const centerDeg = Phaser.Math.RadToDeg(
                Math.atan2(CONFIG.soapSplash.height, CONFIG.soapSplash.width)
            );
            this.angleMinDeg = Math.max(0, centerDeg - CONFIG.soapSplash.angleSpreadDeg);
            this.angleMaxDeg = Math.min(90, centerDeg + CONFIG.soapSplash.angleSpreadDeg);
        }

        // --- game state ---
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;

        // --- HUD: breaches ---
        this.hud = this.add.text(15, 15, "Breaches: 0/5", {
            fontFamily: "monospace",
            fontSize: CONFIG.soapSplash.breachesFontSize + "px",
            color: "#fff",
        });

        // --- timer & typing systems ---
        systems.soapsplash.timer.init(this);
        this.gameStartAt = this.time.now;
        systems.soapsplash.typing.init(this);

        // If germs already exist (e.g., resume), pick a target
        if (!this.typing?.activeId && this.germs.length > 0) {
            systems.soapsplash.typing.pickRandom(this);
        }

        // --- Back to Menu button ---
        const backBtn = this.add
            .text(CONFIG.soapSplash.width - 20, 20, "↩ Menu", {
                fontFamily: "Arial",
                fontSize: "22px",
                color: "#ff6b6b",
                fontStyle: "bold",
                backgroundColor: "#222",
            })
            .setOrigin(1, 0)
            .setPadding(6)
            .setInteractive({ useHandCursor: true });

        backBtn.on("pointerup", () => {
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });
    }

    update(time, delta) {
        // Ensure start time set even if create() was skipped
        if (this.gameStartAt == null) this.gameStartAt = time;

        // Spawner: cooldown + population cap
        if (!this.gameOver && time - this.lastSpawn > CONFIG.soapSplash.spawnIntervalMs) {
            if (this.germs.length < CONFIG.soapSplash.maxGerms) {
                systems.soapsplash.spawn.spawnGerm(this);
                this.lastSpawn = time;
            }
        }

        // Movement & breach rules while game is active
        if (!this.gameOver) {
            systems.soapsplash.movement.moveGerms(this, delta);
            systems.soapsplash.rules.checkBreaches(this);
        }

        // HUD: timer
        systems.soapsplash.timer.updateHUD(this, this.time.now);
    }
}
