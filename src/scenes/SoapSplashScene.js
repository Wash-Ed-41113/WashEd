// src/scenes/SoapSplashScene.js
import systems from "../systems.js";
import { DB } from "../db.js";

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");

        // core state1
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this.gameStartAt = null; //kn

        // ui / pause
        this._paused = false;
        this._pauseUi = null;

        // spawner geometry (corner ring)
        this.rOuter = 0;
        this.rInner = 0;
        this.angleMinDeg = 0;
        this.angleMaxDeg = 90;

        // backgrounds
        this.bgSprite = null;
        this._bgKeys = [];

        // db round id
        this.roundId = null;

        // wave control
        this._waveActive = false;
        this._pendingSpawns = 0;
        this._nextSpawnAt = 0;
        this._betweenWaveDelayMs = 900;

        // kiko toasts trackers
        this._lastSadAtBreaches = 0;
        this._lastEncouragementAt = 0;

        // bg music handle
        this._bgm = null;
    }

    // --- BG MUSIC HELPERS ---
    _ensureBGMusic(autoplay = true) {
        if (!this.sound) return;

        // reuse existing sound if present
        this._bgm = this.sound.get("BG_Music") || this.sound.add("BG_Music", {
            loop: true,
            volume: 0.45
        });

        const savedMute = this.registry.get("mute") === true;
        this._bgm.setMute(!!savedMute);

        if (autoplay && !this._bgm.isPlaying && !this._bgm.isPaused) {
            this._bgm.play();
        }
    }
    _pauseBGMusic()  { if (this._bgm?.isPlaying) this._bgm.pause(); }
    _resumeBGMusic() { if (this._bgm?.isPaused)  this._bgm.resume(); }
    _stopBGMusic()   { if (this._bgm) { this._bgm.stop(); this._bgm.destroy(); this._bgm = null; } }

    togglePause() {
        if (this._paused) {
            this._paused = false;
            this._pauseUi?.destroy();
            this._pauseUi = null;

            // resume bgm when resuming gameplay
            this._resumeBGMusic();

        } else {
            this._paused = true;

            // pause bgm when opening pause overlay
            this._pauseBGMusic();

            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
                    // stop music when leaving to main menu
                    this._stopBGMusic();
                    this.finalizeRound?.("Paused → Main Menu");
                    const playerName = this.registry.get("playerName");
                    this.scene.start("GameScene", { playerName });
                }
            });
        }
    }

    preload() {
        const set = CONFIG.assets.soapSplash.backgrounds;
        this._bgKeys = set.map((path, i) => {
            const key = `SS_BG_${i}`;
            this.load.image(key, path);
            return key;
        });

        const vids = CONFIG.assets?.soapSplash?.backgroundVid;
        if (vids) {
            const sources = Array.isArray(vids) ? vids : [vids];
            this.load.video("SS_BG_VIDEO", sources, "loadeddata", false, true);
        }

        const frames = CONFIG.assets?.soapSplash?.handsFrames;
        if (frames?.dir && frames?.count) {
            const z = frames.zeroPad ?? 3;
            for (let i = 1; i <= frames.count; i++) {
                const n = String(i).padStart(z, "0");
                this.load.image(`HANDS_${n}`, `${frames.dir}/hands_${n}.png`);
            }
        }

        // game sprites
        this.load.image("Germ", CONFIG.assets.soapSplash.germ);

        // Background music
        this.load.audio("BG_Music", CONFIG.assets.soapSplash.backgroundAud);

        // kiko sprites for toasts (optional; code safely falls back if missing)
        if (CONFIG.assets?.kiko?.jump) this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        if (CONFIG.assets?.kiko?.cheer) this.load.image("KikoCheer", CONFIG.assets.kiko.cheer);
        if (CONFIG.assets?.kiko?.sad) this.load.image("KikoSad", CONFIG.assets.kiko.sad);

        // optional dialog panel (not required by the toasts)
        if (CONFIG.assets?.ui?.dialogPanel) this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
    }

    create() {
        const SS = CONFIG.soapSplash;

        // ---- DIFFICULTY SETUP ----
        const level = Phaser.Math.Clamp(Number(this.registry.get("difficulty") || 2), 1, 3);
        const WB = CONFIG.words || [];

        const matchDiff = (d, lvl) => {
            if (d == null) return (lvl === 2);
            if (typeof d === "number") return d === lvl;
            if (typeof d === "string") {
                const m = { easy: 1, normal: 2, hard: 3 }[d.toLowerCase()];
                return (m || 2) === lvl;
            }
            return false;
        };

        const wordsByLevel = WB
            .filter(w => w.type === "Good" && matchDiff(w.difficulty, level))
            .map(w => w.word);

        SS.words = wordsByLevel.length ? wordsByLevel : (WB.filter(w => w.type === "Good").map(w => w.word));

        switch (level) {
            case 1:
                SS.spawnEveryMs = 1600;
                SS.spawnJitterMs = 120;
                SS.germBaseSpeed = 70;
                SS.maxGerms = 5;
                SS.waveCap = 4;
                break;
            case 3:
                SS.spawnEveryMs = 900;
                SS.spawnJitterMs = 160;
                SS.germBaseSpeed = 120;
                SS.maxGerms = 10;
                SS.waveCap = 6;
                break;
            default:
                SS.spawnEveryMs = 1200;
                SS.spawnJitterMs = 140;
                SS.germBaseSpeed = 100;
                SS.maxGerms = 8;
                SS.waveCap = 5;
                break;
        }
        SS.spawnIntervalMs = SS.spawnEveryMs;

        // audio
        const savedMute = this.registry.get("mute") === true;
        if (this.sound) this.sound.mute = savedMute;

        // ensure bgm starts and loops (will continue under Explain overlay)
        this._ensureBGMusic(true);

        // sink position & radius
        const sinkCenter = {
            x: SS.width * SS.sinkHitRel.x,
            y: SS.height * SS.sinkHitRel.y,
        };
        this.sinkPosition = { ...sinkCenter };
        this.getSinkHitPoint = () => sinkCenter;
        this.rSink = (SS.rSinkRel != null) ? Math.round(SS.height * SS.rSinkRel) : (SS.rSinkPx ?? 70);

        if (SS.debug?.showSinkCircle) {
            this._sinkMarker = this.add.circle(
                sinkCenter.x, sinkCenter.y, this.rSink,
                SS.debug?.sinkColor ?? 0x00ff00,
                SS.debug?.sinkAlpha ?? 0.2
            ).setDepth(2);
        }

        // background fallback
        const firstKey = this._bgKeys[0];
        this.bgSprite = firstKey
            ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey).setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0).setDepth(0);

        // === VIDEO LAYER (transparent hands_alpha.webm) ===
        {
            const W = SS.width, H = SS.height;
            const key = "SS_BG_VIDEO";

            if (this.cache.video.exists(key)) {
                const targetW = W * 0.18;

                this.bgVideo = this.add.video(W * 0.53, H * 0.15, key)
                    .setOrigin(0.5)
                    .setDepth(3)
                    .setLoop(true)
                    .setMute(true);

                this.bgVideo.play(true);

                const setScale = () => {
                    const vw = this.bgVideo.video?.videoWidth || 640;
                    const scale = targetW / vw;
                    this.bgVideo.setScale(scale * 1.4);
                };

                if (this.bgVideo.video?.readyState >= 2) setScale();
                else {
                    this.bgVideo.once("play", setScale);
                    this.bgVideo.once("loadeddata", setScale);
                }
            } else {
                console.warn("[SoapSplash] SS_BG_VIDEO not found in cache.video");
            }
        }

        // corner-ring spawner geometry (for systems.soapsplash.spawn)
        if (SS.useSpawner) {
            const cornerDist = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
            this.rOuter = Math.max(0, cornerDist - SS.cornerMargin);
            this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);

            const centerDeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, centerDeg - SS.angleSpreadDeg);
            this.angleMaxDeg = Math.min(90, centerDeg + SS.angleSpreadDeg);
            if (this.angleMinDeg > this.angleMaxDeg) {
                const t = this.angleMinDeg; this.angleMinDeg = this.angleMaxDeg; this.angleMaxDeg = t;
            }
        }

        // reset round state
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this._waveActive = false;
        this._pendingSpawns = 0;
        this._nextSpawnAt = 0;
        this._lastSadAtBreaches = 0;
        this._lastEncouragementAt = 0;

        // DB round
        const difficulty = this.registry.get("difficulty");
        this.roundId = DB.beginRound(window.__SESSION_ID__, "SoapSplash", String(difficulty));

        // topbar
        this.topbar = systems.ui.topbar(this, {
            onHome: () => {
                // stop music when leaving to main menu
                this._stopBGMusic();
                this.finalizeRound?.("Home button");
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
        });

        // timer + typing will be initialized after Explain screen resumes us
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            systems.soapsplash.timer.init(this);
            this.gameStartAt = this.time.now;
            systems.soapsplash.typing.init(this);
        });

        // launch explain overlay then pause ourselves
        console.log("[SoapSplash] launching Explain overlay");
        if (this.scene.getIndex("SoapSplashExplain") !== -1) {
            this.scene.launch("SoapSplashExplain", { parentKey: "SoapSplash" });
            this.scene.bringToTop("SoapSplashExplain");
            this.scene.pause("SoapSplash"); // music keeps playing
        }

        // background stage swapper2
        this.setSoapSplashBackground = (breaches) => {
            const i = Math.min(breaches, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // optional blur effect support
        this.initSpotBlur?.();

        // finalize on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            // safety: ensure music is stopped if the scene is killed
            this._stopBGMusic();
            if (!this.gameOver) this.finalizeRound("Scene shutdown");
        });

        // (optional) dev mute toggle with "M"
        this.input.keyboard?.on("keydown-M", () => {
            const newMute = !this._bgm?.mute;
            this._bgm?.setMute(newMute);
            this.registry.set("mute", newMute);
        });
    }

    finalizeRound(reason = "Time up", overrides = {}) {
        if (this.gameOver) return;
        this.gameOver = true;
        if (!this.roundId) return;

        // stop music when round ends
        this._stopBGMusic();

        DB.finalizeRound(this.roundId, {
            score: overrides.score ?? this.streakSys?.totalScore ?? this.typing?.score ?? 0,
            bestStreak: overrides.bestStreak ?? this.streakSys?.bestStreak ?? this.typing?.bestStreak ?? 0,
            breaches: overrides.breaches ?? this.breaches ?? 0,
            baseScore: overrides.baseScore ?? this.streakSys?.baseScore ?? 0,
            multiplier: overrides.multiplier ?? (this.streakSys?.multiplier?.() || 0),
            reason,
        });
    }

    // ---- encouragement toast (bottom-right) ----
    showKikoEncouragement(messageOverride = null) {
        const wants = '40px "Chewy"';
        if (document.fonts?.check && !document.fonts.check(wants)) {
            document.fonts.load(wants).then(() => {
                if (this.scene && this.scene.systems && this.scene.isActive()) {
                    this.showKikoEncouragement(messageOverride);
                }
            });
            return;
        }

        const { width: W, height: H } = this.scale;

        if (this._encourageGroup) {
            const kids = this._encourageGroup.list || [];
            this.tweens.add({ targets: kids, alpha: 0, y: '+=16', duration: 100,
                onComplete: () => this._encourageGroup?.destroy(true)
            });
            this._encourageGroup = null;
        }

        const messages = [
            "Keep going!",
            "Good job!",
            "Keep up with the scrubbing! Bye bye, Germs!",
            "Awesome typing — you’re winning!"
        ];
        const msg = messageOverride || messages[Math.floor(Math.random() * messages.length)];

        const g = this.add.container(0, 0).setDepth(500);
        this._encourageGroup = g;

        const text = this.add.text(0, 0, msg, {
            fontFamily: '"Chewy"',
            fontSize: '40px',
            color: '#000000',
            align: 'right'
        })
            .setOrigin(1, 1)
            .setShadow(0, 3, 'rgba(246,231,231,0.56)', 8, true, true)
            .setAlpha(0);

        let kiko = null;
        let kikoKey = null;
        if (this.textures.exists("KikoJump")) kikoKey = "KikoJump";
        else if (this.textures.exists("KikoCheer")) kikoKey = "KikoCheer";
        if (kikoKey) {
            kiko = this.add.sprite(0, 0, kikoKey).setOrigin(0, 1).setScale(0.30).setAlpha(0);
        }

        g.add([text]); if (kiko) g.add(kiko);

        const margin = 20;
        const baseX = W - margin;
        const baseY = H - margin;

        text.setPosition(baseX - (kiko ? 70 : 0), baseY);
        if (kiko) kiko.setPosition(baseX, baseY - 6);

        const items = kiko ? [text, kiko] : [text];
        this.tweens.add({ targets: items, y: '-=12', alpha: 1, duration: 200, ease: 'Back.Out' });
        if (kiko) {
            this.tweens.add({ targets: kiko, y: '-=6', duration: 500, yoyo: true, repeat: 1, ease: 'Sine.inOut' });
        }

        this.time.delayedCall(1600, () => {
            this.tweens.add({
                targets: items, y: '+=12', alpha: 0, duration: 250, ease: 'Cubic.In',
                onComplete: () => {
                    g.destroy(true);
                    if (this._encourageGroup === g) this._encourageGroup = null;
                }
            });
        });
    }

    // ---- sad toast (bottom-right, Chewy only, matches encouragement) ----
    showKikoSad(messageOverride = null) {
        if (this._sadCooldownUntil && this.time.now < this._sadCooldownUntil) return;
        this._sadCooldownUntil = this.time.now + 400;

        const wants = '40px "Chewy"';
        if (document.fonts?.check && !document.fonts.check(wants)) {
            document.fonts.load(wants).then(() => {
                if (this.scene && this.scene.systems && this.scene.isActive()) {
                    this.showKikoSad(messageOverride);
                }
            });
            return;
        }

        const { width: W, height: H } = this.scale;

        if (this._sadGroup) {
            const kids = this._sadGroup.list || [];
            this.tweens.add({
                targets: kids, alpha: 0, y: '+=10', duration: 100,
                onComplete: () => this._sadGroup?.destroy(true)
            });
            this._sadGroup = null;
        }

        const msgs = [
            "Stop the germs from spreading!",
            "Oops, type faster next time!",
            "Watch out — we need to scrub faster",
            "Don’t give up, you can still do it!"
        ];
        const msg = messageOverride || msgs[Math.floor(Math.random() * msgs.length)];

        const g = this.add.container(0, 0).setDepth(500);
        this._sadGroup = g;

        const text = this.add.text(0, 0, msg, {
            fontFamily: '"Chewy"',
            fontSize: '40px',
            color: '#000000',
            align: 'right',
            wordWrap: { width: Math.min(560, W * 0.7) }
        })
            .setOrigin(1, 1)
            .setShadow(0, 3, 'rgba(246,231,231,0.56)', 8, true, true)
            .setAlpha(0);

        g.add([text]);

        const margin = 20;
        const baseX = W - margin;
        const baseY = H - margin;

        text.setPosition(baseX, baseY);

        this.tweens.add({ targets: [text], y: '-=12', alpha: 1, duration: 200, ease: 'Back.Out' });

        this.time.delayedCall(1600, () => {
            this.tweens.add({
                targets: [text],
                y: '+=12',
                alpha: 0,
                duration: 250,
                ease: 'Cubic.In',
                onComplete: () => {
                    g.destroy(true);
                    if (this._sadGroup === g) this._sadGroup = null;
                }
            });
        });
    }

    // -------------------------------
    // WAVE-BASED UPDATE LOOP (+ toasts)
    // -------------------------------
    update(time, delta) {
        const SS = CONFIG.soapSplash;
        if (this._paused || this.gameOver) return;
        if (this.gameStartAt == null) this.gameStartAt = time;

        const base = SS.spawnIntervalMs ?? 1200;
        const jitter = SS.spawnJitterMs ?? 0;
        const cap = SS.waveCap ?? SS.maxGerms ?? 5;

        // start a new wave if none active and field is clear
        if (!this._waveActive && this.germs.length === 0) {
            this._waveActive = true;
            this._pendingSpawns = cap;
            this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 900);
        }

        // spawn germs one by one
        if (this._waveActive && time >= this._nextSpawnAt && this._pendingSpawns > 0) {
            try { systems.soapsplash.spawn.spawnGerm(this); }
            catch (err) { console.error("Spawn error:", err); }
            this._pendingSpawns--;
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        // finish wave when all spawned and cleared
        if (this._waveActive && this._pendingSpawns <= 0 && this.germs.length === 0) {
            this._waveActive = false;
        }

        // movement + collisions + HUD
        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);
        systems.soapsplash.timer.updateHUD(this, this.time.now);

        // toasts:
        if (this.breaches > this._lastSadAtBreaches) {
            this._lastSadAtBreaches = this.breaches;
            this.showKikoSad();
        }
        const curStreak = this.streakSys?.streak ?? this.typing?.streak ?? 0;
        if (curStreak > (this._lastEncouragementAt ?? 0) && curStreak >= 1) {
            this._lastEncouragementAt = curStreak;
            this.showKikoEncouragement();
        }

        if (this.germs.length) {
            const active = this.germs.find(g => g.id === this.typing?.activeId);

            const W = CONFIG.soapSplash.width, H = CONFIG.soapSplash.height;
            const isOn = (x, y, m = 0) => (x >= -m && y >= -m && x <= W + m && y <= H + m);

            const activeVisible = active && isOn(active.sprite.x, active.sprite.y, 0);
            if (!active || !activeVisible) {
                systems.soapsplash.typing.pickNearest(this);
            }
        }
    }
}
