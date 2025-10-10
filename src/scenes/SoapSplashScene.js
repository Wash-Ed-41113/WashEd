// this file defines the typing game scene for soap splash
// the scene manages germs spawning movement breaches timer ui and pause state
// comments are in simple language with no punctuation and only code names use caps

// src/scenes/SoapSplashScene.js
// import shared systems for ui helpers typing logic spawn and movement logic
import systems from "../systems.js";
// add simple in memory db
import { DB } from "../db.js";

// declare the scene class for soap splash
export default class SoapSplashScene extends Phaser.Scene {
    // setup scene key and initial state containers
    constructor() {
        super("SoapSplash");
        // array of current germs on screen
        this.germs = [];
        // time of last spawn in ms
        this.lastSpawn = 0;
        // sequence id for unique germ ids
        this.germSeq = 0;
        // number of breaches when germs reach the sink
        this.breaches = 0;
        // game over flag
        this.gameOver = false;
        // game start timestamp
        this.gameStartAt = null;

        // pause state and overlay reference
        this._paused = false;
        this._pauseUi = null;

        // spawn ring geometry values for corner spawner
        this.rOuter = 0;
        this.rInner = 0;
        this.angleMinDeg = 0;
        this.angleMaxDeg = 90;

        // background sprite and keys used for breach stages
        this.bgSprite = null;
        this._bgKeys = [];

        // db round id
        this.roundId = null;
    }

    // toggle the pause state and show or hide pause overlay
    togglePause() {
        if (this._paused) {
            this._paused = false;
            this._pauseUi?.destroy();
            this._pauseUi = null;
        } else {
            this._paused = true;
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
                    this.finalizeRound?.("Paused → Main Menu");
                    const playerName = this.registry.get("playerName");
                    this.scene.start("GameScene", { playerName });
                }
            });
        }
    }


    // preload background images for breach stages and the germ sprite
    // preload background images for breach stages and the germ sprite
    preload() {
        const set = CONFIG.assets.soapSplash.backgrounds;
        this._bgKeys = set.map((path, i) => {
            const key = `SS_BG_${i}`;
            this.load.image(key, path);
            return key;
        });

        // video sources can be a string or an array from config
        const vids = CONFIG.assets?.soapSplash?.backgroundVid;
        if (vids) {
            const sources = Array.isArray(vids) ? vids : [vids];
            // load video with alpha webm first then mp4 fallback
            // wait for loadeddata no audio to avoid autoplay block
            this.load.video("SS_BG_VIDEO", sources, "loadeddata", false, true);
        }

        // optional png frames fallback config
        // expects { dir: "assets/hands_frames", count: 90, zeroPad: 3 }
        const frames = CONFIG.assets?.soapSplash?.handsFrames;
        if (frames?.dir && frames?.count) {
            const z = frames.zeroPad ?? 3;
            for (let i = 1; i <= frames.count; i++) {
                const n = String(i).padStart(z, "0");
                this.load.image(`HANDS_${n}`, `${frames.dir}/hands_${n}.png`);
            }
        }

        this.load.image("Germ", CONFIG.assets.soapSplash.germ);
    }


    // create sets up geometry ui timer typing and visual effects
    create() {
        // short name for soap splash config
        const SS = CONFIG.soapSplash;


        // // TEMP: quick keys to test difficulty without the menu wiring
        // this.input.keyboard.on("keydown-ONE", () => { this.registry.set("difficulty", 1); this.scene.restart(); });
        // this.input.keyboard.on("keydown-TWO", () => { this.registry.set("difficulty", 2); this.scene.restart(); });
        // this.input.keyboard.on("keydown-THREE", () => { this.registry.set("difficulty", 3); this.scene.restart(); });


        // ---- DIFFICULTY (numeric: 1,2,3) ----
        const level = Phaser.Math.Clamp(Number(this.registry.get("difficulty") || 2), 1, 3);

        // accept both numeric and legacy string difficulty in WordBank
        const matchDiff = (d, lvl) => {
            if (d == null) return (lvl === 2);                 // only show untagged words on Normal
            if (typeof d === "number") return d === lvl;       // numeric 1/2/3
            if (typeof d === "string") {                        // legacy: "easy|normal|hard"
                const m = { easy: 1, normal: 2, hard: 3 }[d.toLowerCase()];
                return (m || 2) === lvl;
            }
            return false;
        };

        // prefer the full JSON we cached in PreloadScene
        const WB = (CONFIG.words || []);

        // SoapSplash only uses "Good" words to type
        const wordsByLevel = WB
            .filter(w => w.type === "Good" && matchDiff(w.difficulty, level))
            .map(w => w.word);

        // if nothing matched for this level, fall back to all "Good"
        SS.words = wordsByLevel.length ? wordsByLevel : (WB.filter(w => w.type === "Good").map(w => w.word));

        // gameplay scaling by numeric level
        switch (level) {
            case 1: // easy
                SS.spawnEveryMs   = 1600;   // slower spawns
                SS.spawnIntervalMs = SS.spawnEveryMs; // keep both names happy
                SS.spawnJitterMs  = 120;
                SS.germBaseSpeed  = 70;     // slower movement
                SS.maxGerms       = 5;
                break;
            case 3: // hard
                SS.spawnEveryMs   = 900;
                SS.spawnIntervalMs = SS.spawnEveryMs;
                SS.spawnJitterMs  = 160;
                SS.germBaseSpeed  = 120;
                SS.maxGerms       = 10;
                break;
            default: // 2 normal
                SS.spawnEveryMs   = 1200;
                SS.spawnIntervalMs = SS.spawnEveryMs;
                SS.spawnJitterMs  = 140;
                SS.germBaseSpeed  = 100;
                SS.maxGerms       = 8;
                break;
        }



        // restore persisted mute setting
        const savedMute = this.registry.get("mute") === true;
        if (this.sound) this.sound.mute = savedMute;


        // compute sink hit point in pixels from relative config values
        const sinkCenter = {
            x: SS.width * SS.sinkHitRel.x,
            y: SS.height * SS.sinkHitRel.y,
        };
        // store sink position helpers so other systems can read it
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;

        // compute sink radius in pixels either from relative or absolute config
        this.rSink =
            SS.rSinkRel != null ? Math.round(SS.height * SS.rSinkRel) : SS.rSinkPx ?? 70;

        // optional visible sink circle for debugging
        if (SS.debug?.showSinkCircle) {
            this._sinkMarker = this.add
                .circle(
                    sinkCenter.x,
                    sinkCenter.y,
                    this.rSink,
                    SS.debug?.sinkColor ?? 0x00ff00,
                    SS.debug?.sinkAlpha ?? 0.2
                )
                .setDepth(2);
        }

        // keep sink accessors consistent
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;

        // add the initial background image or a solid fallback rectangle
        const firstKey = this._bgKeys[0] || null;
        // bgSprite is your static fallback image
        this.bgSprite = firstKey
            ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey)
                .setDepth(0) // fallback stays below video
                .setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0).setDepth(0);


        // === VIDEO LAYER (transparent hands_alpha.webm, small inset) ===
        {
            const SS = CONFIG.soapSplash;
            const W = SS.width, H = SS.height;

            // add the transparent webm directly
            this.bgVideo = this.add.video(W * 0.53, H * 0.15, "SS_BG_VIDEO")
                .setOrigin(0.5)
                .setDepth(3)
                .setLoop(true)
                .setMute(true)
                .setScale(0.30)
                .play(true);

            // force it to stay small and never resize
            const targetW = W * 0.18; // 18% of scene width
            this.bgVideo.on("loadeddata", () => {
                const vw = this.bgVideo.video?.videoWidth || 640;
                const scale = targetW / vw;
                this.bgVideo.setScale(scale);
            });

            // make sure no auto-fit logic resizes it again
            this.bgVideo.removeAllListeners("resize");
            this.scale?.off("resize");
        }



        // set up spawn ring in the top right corner if the spawner mode is enabled
        if (SS.useSpawner) {
            // distance from sink to the top right corner minus a margin forms the outer radius
            const cornerDist = Math.hypot(
                SS.width - this.sinkPosition.x,
                0 - this.sinkPosition.y
            );
            this.rOuter = Math.max(0, cornerDist - SS.cornerMargin);
            this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);

            // pick an angular sector centered toward the corner based on spread
            const centerDeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, centerDeg - SS.angleSpreadDeg);
            this.angleMaxDeg = Math.min(90, centerDeg + SS.angleSpreadDeg);

            // ensure min is not greater than max
            if (this.angleMinDeg > this.angleMaxDeg) {
                const t = this.angleMinDeg;
                this.angleMinDeg = this.angleMaxDeg;
                this.angleMaxDeg = t;
            }
        }

        // reset runtime state for a new round
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;

        // --- begin DB round here using difficulty from registry ---
        const difficulty = this.registry.get("difficulty") || "normal";
        this.roundId = DB.beginRound(
            window.__SESSION_ID__,
            "SoapSplash",
            String(difficulty)
        );


        // add a top bar with home and pause
        this.topbar = systems.ui.topbar(this, {
            onHome: () => {
                this.finalizeRound?.("Home button");
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
            onSettings: () => { /* optional */ }
        });


        // start the shared round timer and typing systems
        systems.soapsplash.timer.init(this);
        this.gameStartAt = this.time.now;
        systems.soapsplash.typing.init(this);

        // function to update background based on number of breaches
        this.setSoapSplashBackground = (breaches) => {
            const i = Math.min(breaches, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // allow quick exit to the game hub with escape
        this.input.keyboard.once("keydown-ESC", () => {
            // optional: treat as early exit finalize without score changes
            this.finalizeRound("Escaped to hub");
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });

        // set up the blurred background reveal effect under germs
        this.initSpotBlur();

        // finalize round automatically if the scene shuts down without explicit finalize
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this.gameOver) this.finalizeRound("Scene shutdown");
        });
    }

    // helper to finalize the round to the db
    finalizeRound(reason = "Time up", overrides = {}) {
        if (this.gameOver) return;
        this.gameOver = true;
        if (!this.roundId) return;

        DB.finalizeRound(this.roundId, {
            score:
                overrides.score ??
                this.streakSys?.totalScore ??
                this.typing?.score ??
                0,
            bestStreak:
                overrides.bestStreak ??
                this.streakSys?.bestStreak ??
                this.typing?.bestStreak ??
                0,
            breaches: overrides.breaches ?? this.breaches ?? 0,
            baseScore: overrides.baseScore ?? this.streakSys?.baseScore ?? 0,
            multiplier:
                overrides.multiplier ?? (this.streakSys?.multiplier?.() || 0),
            reason,
        });
    }

    // update runs every frame handles spawn movement rules and timer display
    update(time, delta) {
        const SS = CONFIG.soapSplash;
        // stop updates when paused or game over
        if (this._paused || this.gameOver) return;
        // if first frame capture the start time
        if (this.gameStartAt == null) this.gameStartAt = time;



        // spawn pacing parameters from config
        const cap = SS.waveCap ?? SS.maxGerms ?? 5;
        const base = SS.spawnIntervalMs ?? SS.spawnEveryMs ?? 1200;
        const jitter = SS.spawnJitterMs ?? 0;

        // schedule the first spawn with random jitter
        if (!this._nextSpawnAt) {
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        // spawn a new germ when time has come and under the cap
        if (time >= this._nextSpawnAt && this.germs.length < cap) {
            systems.soapsplash.spawn.spawnGerm(this);
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        // move all germs toward the sink update labels and caret and offscreen cleanup
        systems.soapsplash.movement.moveGerms(this, delta);
        // redraw blurred reveal mask under each germ
        this.redrawSpotBlurMask();
        // check collisions with the sink and update breaches and background
        systems.soapsplash.rules.checkBreaches(this);
        // update round timer hud
        systems.soapsplash.timer.updateHUD(this, this.time.now);

        if (this.gameOver) return;
        if (this._paused) return;
    }

    // setup a blurred duplicate background that is revealed in soft spots under germs
    initSpotBlur() {
        const SS = CONFIG.soapSplash,
            S = SS.spotBlur || {};
        if (!S.enabled || !this.bgSprite?.texture?.key) return;

        // make a blur layer using the same texture as the background
        this.bgBlur = this.add
            .image(SS.width / 2, SS.height / 2, this.bgSprite.texture.key, this.bgSprite.frame.name)
            .setDisplaySize(SS.width, SS.height)
            .setDepth(1);

        // add a postprocessing blur effect if available
        if (this.bgBlur.postFX?.addBlur) {
            this._blurFx = this.bgBlur.postFX.addBlur(S.strength ?? 0.9, S.strength ?? 0.9);
        }

        // create a render texture and a graphics object to draw soft circles as a bitmap mask
        this._spotRT = this.make.renderTexture({
            x: 0,
            y: 0,
            width: SS.width,
            height: SS.height,
            add: false,
        });
        this._spotGfx = this.add.graphics().setScrollFactor(0).setVisible(false);
        const bm = new Phaser.Display.Masks.BitmapMask(this, this._spotRT);
        this.bgBlur.setMask(bm);
        this._spotMask = bm;

        // keep sizes in sync on resize and clean up on shutdown
        const onResize = () => {
            this.bgBlur?.setDisplaySize(SS.width, SS.height);
        };
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._spotGfx?.destroy();
            this._spotGfx = null;
            this._spotRT?.destroy();
            this._spotRT = null;
        });
    }

    // draw the soft circular mask where germs are so the blur layer shows through there
    redrawSpotBlurMask() {
        const SS = CONFIG.soapSplash,
            S = SS.spotBlur || {};
        if (!S.enabled || !this._spotRT || !this._spotGfx) return;

        // parameters for circle feathering and padding
        const radiusPad = S.radiusPad ?? 22;
        const feather = S.feather ?? 28;
        const steps = Math.max(3, S.steps ?? 7);

        // clear previous mask drawing
        this._spotRT.clear();
        this._spotGfx.clear();

        // for each germ draw multiple circles with decreasing alpha to create a soft edge
        for (const g of this.germs) {
            if (!g?.sprite?.active) continue;

            const baseR = (g.hitRadius ?? Math.max(16, g.sprite.displayWidth * 0.3)) + radiusPad;

            for (let s = 0; s < steps; s++) {
                const t = s / (steps - 1);
                const r = baseR + feather * t;
                const a = (1 - t) * (1 - t);
                this._spotGfx.fillStyle(0xffffff, a);
                this._spotGfx.fillCircle(g.sprite.x, g.sprite.y, r);
            }
        }

        // copy the graphics onto the render texture so the bitmap mask updates
        this._spotRT.draw(this._spotGfx);
    }
}
