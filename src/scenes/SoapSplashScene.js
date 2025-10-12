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

        this._lastSadAtBreaches = 0;   // remember the last breach count we showed “sad Kiko” for

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

        this.load.image("Germ", CONFIG.assets.soapSplash.germ);
        this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("KikoSad", CONFIG.assets.kiko.sad);


    }


    // create sets up geometry ui timer typing and visual effects
    create() {
        // short name for soap splash config
        const SS = CONFIG.soapSplash;

        // wave (config-only)
        this._waveActive = false;
        this._pendingSpawns = 0;
        this._nextSpawnAt = 0;

        this._waveSize = SS.wave.size;
        this._spawnStaggerMs = SS.wave.staggerMs;
        this._betweenWaveDelayMs = SS.wave.betweenMs;

        // === Streak + Encouragement state ===
        this.streak = 0;
        this._lastEncouragementAt = 0;   // remembers the last streak we showed a bubble for
        this._encourageTimer = null;


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


        // quick-test hotkey: press J to show Kiko encouragement now
        this.input.keyboard.on("keydown-J", () => this.showKikoEncouragement());




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
        // remember where the last-removed germ was (for chaining selection)
        this._lastRemovedPos = null;


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


        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            systems.soapsplash.timer.init(this);
            this.gameStartAt = this.time.now;
            systems.soapsplash.typing.init(this);
        });

        this.scene.launch("SoapSplashExplain");
        this.scene.pause();


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

        // // set up the blurred background reveal effect under germs
        // this.initSpotBlur();

        // ── Wave spawner state ─────────────────────────────────────────────
        const S = CONFIG.soapSplash;
        this._waveActive = false;
        this._pendingSpawns = 0;
        this._waveSize = Math.max(1, S.waveSize ?? 5);
        this._betweenWaveDelayMs = Math.max(0, S.betweenWaveDelayMs ?? 900);

        this._nextSpawnAt = 0;      // timestamp (ms) of the next allowed spawn
        this._lastSpawnAt = 0;      // bookkeeping


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

    showKikoEncouragement(messageOverride = null) {
        const { width: W, height: H } = this.scale;

        // remove existing popup if one exists
        if (this._encourageGroup) {
            const kids = this._encourageGroup.list || [];
            this.tweens.add({
                targets: kids,
                alpha: 0,
                y: '+=16',
                duration: 100,
                onComplete: () => this._encourageGroup?.destroy(true)
            });
            this._encourageGroup = null;
        }

        // pick message
        const messages = [
            "Keep going!",
            "Good job!",
            "Keep up with the scrubbing! Bye bye, Germs!",
            "Awesome typing — you’re winning!"
        ];
        const msg = messageOverride || messages[Math.floor(Math.random() * messages.length)];

        const g = this.add.container(0, 0).setDepth(500);
        this._encourageGroup = g;

        // text only — Chewy font
        const text = this.add.text(0, 0, msg, {
            fontFamily: 'Chewy, Arial, sans-serif',
            fontSize: '42px',
            color: '#ffffff',
            align: 'right'
        })
            .setOrigin(1, 1)
            .setShadow(0, 3, '#00000090', 6, true, true)
            .setAlpha(0);

        // optional Kiko sprite beside text
        let kiko = null;
        let kikoKey = null;
        if (this.textures.exists("KikoJump")) kikoKey = "KikoJump";
        else if (this.textures.exists("KikoCheer")) kikoKey = "KikoCheer";
        if (kikoKey) {
            kiko = this.add.sprite(0, 0, kikoKey)
                .setOrigin(0, 1)
                .setScale(0.30)
                .setAlpha(0);
        }

        g.add([text]);
        if (kiko) g.add(kiko);

        // bottom-right placement
        const margin = 20;
        const baseX = W - margin;
        const baseY = H - margin;

        // position text and kiko close together
        text.setPosition(baseX - (kiko ? 70 : 0), baseY);
        if (kiko) kiko.setPosition(baseX, baseY - 6);

        // fade/slide in
        const items = [text].concat(kiko ? [kiko] : []);
        this.tweens.add({
            targets: items,
            y: '-=12',
            alpha: 1,
            duration: 200,
            ease: 'Back.Out'
        });

        // tiny bounce for Kiko
        if (kiko) {
            this.tweens.add({
                targets: kiko,
                y: '-=6',
                duration: 500,
                yoyo: true,
                repeat: 1,
                ease: 'Sine.inOut'
            });
        }

        // disappear after delay
        this.time.delayedCall(1600, () => {
            this.tweens.add({
                targets: items,
                y: '+=12',
                alpha: 0,
                duration: 250,
                ease: 'Cubic.In',
                onComplete: () => {
                    g.destroy(true);
                    if (this._encourageGroup === g) this._encourageGroup = null;
                }
            });
        });
    }
    showKikoSad(messageOverride = null) {
        if (this._sadCooldownUntil && this.time.now < this._sadCooldownUntil) return;
        this._sadCooldownUntil = this.time.now + 400;

        const { width: W, height: H } = this.scale;



        // clear any existing toast
        if (this._sadGroup) {
            const kids = this._sadGroup.list || [];
            this.tweens.add({
                targets: kids, alpha: 0, y: '+=10', duration: 100,
                onComplete: () => this._sadGroup?.destroy(true)
            });
            this._sadGroup = null;
        }

        // default messages (loss prompts)
        const msgs = [
            "Stop the germs from spreading!",
            "Oops, type faster next time!",
            "Watch out — we need to scrub faster",
            "Don’t give up, you can still do it!"
        ];
        const msg = messageOverride || msgs[Math.floor(Math.random() * msgs.length)];

        const g = this.add.container(0, 0).setDepth(501);
        this._sadGroup = g;

        // text only — Chewy font, no dialog panel
        const text = this.add.text(0, 0, msg, {
            fontFamily: 'Chewy, Arial, sans-serif',
            fontSize: '36px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: Math.min(560, W * 0.7) }
        })
            .setOrigin(0, 1)
            .setShadow(0, 3, '#00000090', 6, true, true)
            .setAlpha(0);

        // small Kiko on the left (slightly desaturated)
        let kiko = null;
        let kikoKey = null;

        // prefer your sad sprite, then fall back
        if (this.textures.exists("KikoSad"))      kikoKey = "KikoSad";
        else if (this.textures.exists("KikoJump")) kikoKey = "KikoJump";
        else if (this.textures.exists("KikoCheer"))kikoKey = "KikoCheer";

        if (kikoKey) {
            kiko = this.add.image(0, 0, kikoKey)
                .setOrigin(0, 1)
                .setScale(0.18)
                .setAngle(-4)
                .setAlpha(0)
                .setScrollFactor(0);
        }


        g.add(kiko ? [kiko, text] : [text]);

        // bottom-left placement
        const margin = 22;
        const baseX = margin;
        const baseY = H - margin;

        if (kiko) {
            kiko.setPosition(baseX, baseY);
            text.setPosition(baseX + 140, baseY - 6);
        } else {
            text.setPosition(baseX, baseY);
        }

        // slide/appear
        const items = kiko ? [kiko, text] : [text];
        items.forEach(it => it.setY(it.y + 14));
        this.tweens.add({ targets: items, y: '-=14', alpha: 1, duration: 220, ease: 'Back.Out' });

        // tiny bob on Kiko
        if (kiko) {
            this.tweens.add({
                targets: kiko, y: '-=5', duration: 420, yoyo: true, repeat: 2, ease: 'Sine.inOut'
            });
        }

        // auto-hide
        this.time.delayedCall(1800, () => {
            this.tweens.add({
                targets: items, y: '+=12', alpha: 0, duration: 240, ease: 'Cubic.In',
                onComplete: () => {
                    g.destroy(true);
                    if (this._sadGroup === g) this._sadGroup = null;
                }
            });
        });
    }





    // update runs every frame handles spawn movement rules and timer display
    update(time, delta) {
        const SS = CONFIG.soapSplash;

        if (this._paused || this.gameOver) return;

        // initialize timer and typing once
        if (this.gameStartAt == null) {
            this.gameStartAt = time;
            systems.soapsplash.timer.init(this);
            systems.soapsplash.typing.init(this);
        }

        // handle germ movement and breaches
        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);
        systems.soapsplash.timer.updateHUD(this, time);

        // --- SPAWNING LOGIC (wave-aware) ---
        const S = CONFIG.soapSplash;

// hard ceiling on simultaneous germs
        const cap = (S.maxGerms ?? S.waveCap ?? 5);

// wave behaviour knobs (with safe defaults)
        const waveSize = Math.max(1, S.waveSize ?? 5);        // how many per wave
        const resumeAt = Math.max(0, S.resumeAt ?? 1);        // start next wave when <= this many remain
        const base    = S.spawnIntervalMs ?? 1200;            // fallback trickle period
        const jitter  = S.spawnJitterMs ?? 0;                 // +/- ms jitter
        const stagger = S.wave?.staggerMs ?? 250;             // gap between spawns *within a wave*
        const between = S.betweenWaveDelayMs ?? S.wave?.betweenMs ?? 900; // gap before a new wave starts

// initialise a next-spawn time if missing
        if (!this._nextSpawnAt) {
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

// if no wave in progress and the field is “low”, start a new wave
        if (!this._waveActive && this.germs.length <= resumeAt) {
            this._waveActive = true;
            // don’t exceed the cap with this wave
            this._pendingSpawns = Math.min(waveSize, Math.max(0, cap - this.germs.length));
            // small breather before the wave begins
            this._nextSpawnAt = time + between;
        }

// emit members of the current wave with a stagger
        if (this._waveActive &&
            this._pendingSpawns > 0 &&
            this.germs.length < cap &&
            time >= this._nextSpawnAt) {
            systems.soapsplash.spawn.spawnGerm(this);
            this._pendingSpawns--;
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + stagger + j;

            // wave finished
            if (this._pendingSpawns <= 0) {
                this._waveActive = false;
            }
        }

// safety net: if not in a wave but we’re below cap, trickle-spawn on the base timer
        if (!this._waveActive && this.germs.length < cap && time >= this._nextSpawnAt) {
            systems.soapsplash.spawn.spawnGerm(this);
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }


        // when it’s time to spawn next germ
        if (time >= this._nextSpawnAt && this.germs.length < cap) {
            systems.soapsplash.spawn.spawnGerm(this);
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }
    }




}
