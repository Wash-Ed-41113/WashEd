// this file defines the typing game scene for soap splash
// the scene manages germs spawning movement breaches timer ui and pause state
// comments are in simple language with no punctuation and only code names use caps

// src/scenes/SoapSplashScene.js
// import shared systems for ui helpers typing logic spawn and movement logic
import systems from "../systems.js";

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
    }

    // toggle the pause state and show or hide pause overlay
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

    // preload background images for breach stages and the germ sprite
    preload() {
        // get the list of background paths from CONFIG soap splash
        const set = CONFIG.assets.soapSplash.backgrounds || [];
        // register each image with a generated key and keep the keys array for later swapping
        this._bgKeys = set.map((path, i) => {
            const key = `SS_BG_${i}`;
            this.load.image(key, path);
            return key;
        });

        // load the germ sprite used for all germs
        this.load.image("Germ", CONFIG.assets.soapSplash.germ);
    }

    // create sets up geometry ui timer typing and visual effects
    create() {
        // short name for soap splash config
        const SS = CONFIG.soapSplash;

        // compute sink hit point in pixels from relative config values
        const sinkCenter = {
            x: SS.width  * SS.sinkHitRel.x,
            y: SS.height * SS.sinkHitRel.y,
        };
        // store sink position helpers so other systems can read it
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;

        // compute sink radius in pixels either from relative or absolute config
        this.rSink = (SS.rSinkRel != null)
            ? Math.round(SS.height * SS.rSinkRel)
            : (SS.rSinkPx ?? 70);

        // optional visible sink circle for debugging
        if (SS.debug?.showSinkCircle) {
            this._sinkMarker = this.add.circle(
                sinkCenter.x, sinkCenter.y,
                this.rSink,
                SS.debug?.sinkColor ?? 0x00ff00,
                SS.debug?.sinkAlpha ?? 0.20
            ).setDepth(2);
        }

        // keep sink accessors consistent
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;

        // add the initial background image or a solid fallback rectangle
        const firstKey = this._bgKeys[0] || null;
        this.bgSprite = firstKey
            ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey)
                .setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0);

        // set up spawn ring in the top right corner if the spawner mode is enabled
        if (SS.useSpawner) {
            // distance from sink to the top right corner minus a margin forms the outer radius
            const cornerDist = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
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

        // draw a simple breaches hud in the top left
        const maxBreaches = SS.maxBreaches ?? SS.breachesAllowed ?? 5;
        const breachesFontPx = `${SS.breachesFontSize || 24}px`;
        this.hud = this.add.text(15, 15, `Breaches: 0/${maxBreaches}`, {
            fontFamily: "monospace",
            fontSize: breachesFontPx,
            color: "#fff",
        }).setDepth(10);

        // add a top bar with home and pause
        systems.ui.topbar(this, {
            onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") }),
            onPause: () => this.togglePause(),
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
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });

        // set up the blurred background reveal effect under germs
        this.initSpotBlur();
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
    }

    // setup a blurred duplicate background that is revealed in soft spots under germs
    initSpotBlur() {
        const SS = CONFIG.soapSplash, S = SS.spotBlur || {};
        if (!S.enabled || !this.bgSprite?.texture?.key) return;

        // make a blur layer using the same texture as the background
        this.bgBlur = this.add.image(SS.width/2, SS.height/2, this.bgSprite.texture.key, this.bgSprite.frame.name)
            .setDisplaySize(SS.width, SS.height)
            .setDepth(1);

        // add a postprocessing blur effect if available
        if (this.bgBlur.postFX?.addBlur) {
            this._blurFx = this.bgBlur.postFX.addBlur(S.strength ?? 0.9, S.strength ?? 0.9);
        }

        // create a render texture and a graphics object to draw soft circles as a bitmap mask
        this._spotRT  = this.make.renderTexture({ x:0, y:0, width: SS.width, height: SS.height, add:false });
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
            this._spotGfx?.destroy(); this._spotGfx=null;
            this._spotRT?.destroy();  this._spotRT=null;
        });
    };

    // draw the soft circular mask where germs are so the blur layer shows through there
    redrawSpotBlurMask() {
        const SS = CONFIG.soapSplash, S = SS.spotBlur || {};
        if (!S.enabled || !this._spotRT || !this._spotGfx) return;

        // parameters for circle feathering and padding
        const radiusPad = S.radiusPad ?? 22;
        const feather   = S.feather   ?? 28;
        const steps     = Math.max(3, S.steps ?? 7);

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
    };
}
