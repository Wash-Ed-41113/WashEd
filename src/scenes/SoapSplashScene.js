// src/scenes/SoapSplashScene.js
import systems from "../systems.js";

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this.gameStartAt = null;

        this._paused = false;
        this._pauseUi = null;

        this.rOuter = 0;
        this.rInner = 0;
        this.angleMinDeg = 0;
        this.angleMaxDeg = 90;

        this.bgSprite = null;
        this._bgKeys = [];
    }

    togglePause() {
        if (this._paused) {
            this._paused = false;
            this._pauseUi?.destroy();
            this._pauseUi = null;
        } else {
            this._paused = true;
            this._pauseUi = systems.ui.pauseOverlay(this, () => this.togglePause());
        }
    }

    preload() {
        // Load the background set based on # of breaches
        const set = CONFIG.assets.soapSplash.backgrounds || [];
        this._bgKeys = set.map((path, i) => {
            const key = `SS_BG_${i}`;
            this.load.image(key, path);
            return key;
        });

        this.load.image("Germ", CONFIG.assets.soapSplash.germ);
    }

    create() {
        const SS = CONFIG.soapSplash;

// 1) Sink position from config
        const sinkCenter = {
            x: SS.width  * SS.sinkHitRel.x,
            y: SS.height * SS.sinkHitRel.y,
        };
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;   // used by movement/rules

// 2) Sink radius: prefer relative % if provided, else pixels, else a safe default
        this.rSink = (SS.rSinkRel != null)
            ? Math.round(SS.height * SS.rSinkRel)
            : (SS.rSinkPx ?? 70);

// 3) Optional debug circle (translucent green) — toggled by config
        if (SS.debug?.showSinkCircle) {
            this._sinkMarker = this.add.circle(
                sinkCenter.x, sinkCenter.y,
                this.rSink,
                SS.debug?.sinkColor ?? 0x00ff00,
                SS.debug?.sinkAlpha ?? 0.20
            ).setDepth(2);
        }

        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;

        // Background
        const firstKey = this._bgKeys[0] || null;
        this.bgSprite = firstKey
            ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey)
                .setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0);

        // Spawn geometry (top-right cone relative to sink)
        if (SS.useSpawner) {
            const cornerDist = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
            this.rOuter = Math.max(0, cornerDist - SS.cornerMargin);
            this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);

            const centerDeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, centerDeg - SS.angleSpreadDeg);
            this.angleMaxDeg = Math.min(90, centerDeg + SS.angleSpreadDeg);

            if (this.angleMinDeg > this.angleMaxDeg) {
                const t = this.angleMinDeg;
                this.angleMinDeg = this.angleMaxDeg;
                this.angleMaxDeg = t;
            }
        }

        // Game state
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;

        // HUDs (with safe fallbacks to avoid NaN)
        const maxBreaches = SS.maxBreaches ?? SS.breachesAllowed ?? 5;
        const breachesFontPx = `${SS.breachesFontSize || 24}px`;
        this.hud = this.add.text(15, 15, `Breaches: 0/${maxBreaches}`, {
            fontFamily: "monospace",
            fontSize: breachesFontPx,
            color: "#fff",
        }).setDepth(10);

        // Shared topbar (Home + Pause wired; Settings inert)
        systems.ui.topbar(this, {
            onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") }),
            onPause: () => this.togglePause(),
            // onSettings: () => {} // intentionally inert
        });

        // Timer + typing systems (namespaced in systems.js)
        systems.soapsplash.timer.init(this);
        this.gameStartAt = this.time.now;
        systems.soapsplash.typing.init(this);

        // ✅ Single, consistent background switcher (matches SS_BG_* keys)
        this.setSoapSplashBackground = (breaches) => {
            const i = Math.min(breaches, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // ESC → back
        this.input.keyboard.once("keydown-ESC", () => {
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });
    }

    update(time, delta) {
        const SS = CONFIG.soapSplash;
        if (this._paused || this.gameOver) return;
        if (this.gameStartAt == null) this.gameStartAt = time;

        const cap = SS.waveCap ?? SS.maxGerms ?? 5;
        const base = SS.spawnIntervalMs ?? SS.spawnEveryMs ?? 1200;
        const jitter = SS.spawnJitterMs ?? 0;

        if (!this._nextSpawnAt) {
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        if (time >= this._nextSpawnAt && this.germs.length < cap) {
            systems.soapsplash.spawn.spawnGerm(this);
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);
        systems.soapsplash.timer.updateHUD(this, this.time.now);
    }

}
