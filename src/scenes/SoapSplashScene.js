// this file defines the typing game scene for soap splash
// the scene manages germs spawning movement breaches timer ui and pause state
// comments are in simple language with no punctuation and only code names use caps

// src/scenes/SoapSplashScene.js
import systems from "../systems.js";
import { DB } from "../db.js";

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");

        // NEW: boot guard so we install teardown hooks once
        this._booted = false;

        // NEW: tearing-down guard to freeze update during reset/stop
        this._tearingDown = false;

        // core state
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this.gameStartAt = null;

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

        // countdown (visual only, 100 → 0)
        this._countdownMsTotal = 100 * 1000;
        this._countdownMsLeft  = this._countdownMsTotal;
        this._lastShownSec     = 101;
        this._urgentPulsing    = false;
        this.countdownText     = null;

        // NEW: spawn re-arm flag + watchdog tick
        this._spawnArmed = false;
        this._idleWatchStart = 0;
        this._debugTick = 0;
    }

    // NEW: restart-safe reset of volatile state each time we enter this scene
    init(data) {
        // core gameplay state
        this.germs = [];
        this.lastSpawn = 0;
        this.germSeq = 0;
        this.breaches = 0;
        this.gameOver = false;
        this.gameStartAt = null;

        // ui / pause
        this._paused = false;
        this._pauseUi = null;

        // round/session
        this.roundId = null;
        this._difficulty = data?.difficulty ?? this.registry.get("difficulty") ?? 1;

        // make absolutely sure clocks aren’t paused from a previous run
        try { this.time?.removeAllEvents?.(); } catch {}
        this.time.timeScale = 1;
        this.tweens.timeScale = 1;
        this.physics?.world?.resume?.();

        // NEW: make sure the spawner is re-armed on fresh entry
        this._spawnArmed = false;
        this._waveActive = false;
        this._pendingSpawns = 0;
        this._nextSpawnAt = 0;
        this._idleWatchStart = 0;
        this._debugTick = 0;
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
        this.load.image(
            "ss_end_bg",
            "assets/images/SoapSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png"
        );

        // kiko sprites for toasts (optional; code safely falls back if missing)
        this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        this.load.image("KikoCheer", CONFIG.assets.kiko.cheer);
        this.load.image("KikoSad", CONFIG.assets.kiko.sad);
        this.load.image("ui_close_button", CONFIG.assets.ui.closeBut);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("ui_home", CONFIG.assets.ui.homeBut); // kept for other scenes if needed
        this.load.image("ui_pause", CONFIG.assets.ui.pauseBut);
    }

    _buildPauseOverlay() {
        const { width: W, height: H } = this.scale;
        const g = this.add.container(0, 0).setDepth(99_999); // guaranteed top layer

        // backdrop
        const overlay = this.add.rectangle(0, 0, W, H, 0xffffff, 0.45)
            .setOrigin(0, 0)
            .setInteractive();
        g.add(overlay);

        // panel
        let panel; let panelGeom = null;
        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W/2, H/2, "DialogPanel").setOrigin(0.5).setDepth(10_001);
            const targetW = Math.min(W * 0.8, 980);
            panel.setDisplaySize(targetW, targetW * 0.58);
        } else {
            const gfx = this.add.graphics().setDepth(10_001);
            const pw = Math.min(W * 0.8, 980), ph = Math.min(H * 0.6, 520);
            const px = (W - pw) / 2, py = (H - ph) / 2;
            gfx.fillStyle(0xffffff, 1);
            gfx.fillRoundedRect(px, py, pw, ph, 28);
            gfx.lineStyle(6, 0x222222, 0.18);
            gfx.strokeRoundedRect(px, py, pw, ph, 28);
            panel = gfx;
            panelGeom = { px, py, pw, ph };
        }
        g.add(panel);

        const title = this.add.text(W/2, H/2 - 170, "Game Paused", {
            fontFamily: "Chewy",
            fontSize: "72px",
            color: "#000000",
            align: "center"
        }).setOrigin(0.5).setDepth(10_002);
        g.add(title);

        const score    = this.streakSys?.totalScore ?? this.typing?.score ?? 0;
        const best     = this.streakSys?.bestStreak ?? this.typing?.bestStreak ?? 0;
        const breaches = this.breaches ?? 0;

        const stats = this.add.text(W/2, H/2 - 10,
            `Score: ${score}\nBest Streak: ${best}\nBreaches: ${breaches}`, {
                fontFamily: "Montserrat",
                fontSize: "40px",
                color: "#000000",
                align: "center",
                lineSpacing: 12
            }).setOrigin(0.5).setDepth(10_002);
        g.add(stats);

        // compute panel corners for placing buttons
        let px, py, pw, ph;
        if (panelGeom) ({ px, py, pw, ph } = panelGeom);
        else {
            pw = panel.displayWidth ?? Math.min(W * 0.8, 980);
            ph = panel.displayHeight ?? Math.min(H * 0.6, 520);
            px = panel.x - pw/2; py = panel.y - ph/2;
        }

        // 🔧 CLOSE (top-right)
        const closeX = px + pw - 26, closeY = py + 26;
        const closeImg = this.add.image(closeX, closeY, "ui_close_button")
            .setDisplaySize(70, 70)
            .setOrigin(0.5)
            .setDepth(10_003)
            .setInteractive({ useHandCursor: true });

        closeImg.on("pointerover", () => closeImg.setTint(0xcde3ff));
        closeImg.on("pointerout",  () => closeImg.clearTint());

        // unpause logic
        const unpause = () => {
            this._paused = false;
            if (this._pauseUi?.destroy) {
                this._pauseUi.destroy();
                this._pauseUi = null;
            }
            if (this._origSysPauseOverlay) {
                systems.ui.pauseOverlay = this._origSysPauseOverlay;
                this._origSysPauseOverlay = null;
            }
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            this.bgVideo?.resume();
            this.sound.resumeAll();
        };

        closeImg.on("pointerup", () => {
            unpause();
            destroyAll();
        });

        // ---- BUTTON ROW (Mute only, centered) ----
        const rowY   = Math.min(py + ph - 90, (H/2) + 160);
        const MUTE_W = 350;

        const makePillBtn = (label, x, y, onClick, w = MUTE_W, h = 90) => {
            const baseFill  = 0xBFF4C7;
            const hoverFill = 0xAEEAB7;
            const stroke    = 0x6DAE7F;

            const c = this.add.container(x, y).setDepth(10_003);
            c.setSize(w, h).setInteractive({ useHandCursor: true });

            const gfx = this.add.graphics();
            const draw = (fill) => {
                gfx.clear();
                gfx.fillStyle(fill, 1);
                gfx.fillRoundedRect(-w/2, -h/2, w, h, 26);
                gfx.lineStyle(4, stroke, 1);
                gfx.strokeRoundedRect(-w/2, -h/2, w, h, 26);
            };
            draw(baseFill);

            const txt = this.add.text(0, 0, label, {
                fontFamily: "Montserrat",
                fontSize: "44px",
                color: "#1d4330",
            }).setOrigin(0.5);

            c.add([ gfx, txt ]);
            c.on("pointerover", () => draw(hoverFill));
            c.on("pointerout",  () => draw(baseFill));
            c.on("pointerup", onClick);

            g.add(c);
            return { c, txt };
        };

        const muteLabel = (this.registry.get("mute") === true || this.sound?.mute) ? "Unmute" : "Mute";
        const muteBtn = makePillBtn(muteLabel, W / 2, rowY, () => {
            if (this.sound) {
                this.sound.mute = !this.sound.mute;
                this.registry.set("mute", !!this.sound.mute);
                muteBtn.txt.setText(this.sound.mute ? "Unmute" : "Mute");
            }
        });

        // DEBUG: row locator
        this.add.circle(W/2, rowY, 3, 0xff00ff, 1).setDepth(10_010);
        console.log("[Pause] mute row at", { rowY });

        const destroyAll = () => {
            if (g?.destroy) g.destroy(true);
            panel?.destroy();
            title?.destroy();
            stats?.destroy();
            closeImg?.destroy();
            overlay?.destroy();
            muteBtn?.c?.destroy?.();
            muteBtn?.txt?.destroy?.();
            this._pauseUi = null;
            this._paused = false;
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            this.bgVideo?.resume?.();
            this.sound?.resumeAll?.();
            if (this._origSysPauseOverlay) {
                systems.ui.pauseOverlay = this._origSysPauseOverlay;
                this._origSysPauseOverlay = null;
            }
        };

        return g;
    }

    togglePause() {
        if (this._paused) {
            // --- resume game ---
            this._paused = false;

            // destroy our custom pause UI
            this._pauseUi?.destroy();
            this._pauseUi = null;

            // ✅ restore legacy pause overlay handler (if we replaced it before)
            if (this._origSysPauseOverlay) {
                systems.ui.pauseOverlay = this._origSysPauseOverlay;
                this._origSysPauseOverlay = null;
            }

            // restore time / tween / physics / audio / video
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            this.bgVideo?.resume();
            this.sound.resumeAll();
            return;
        }

        // --- pause game ---
        this._paused = true;

        // 🚫 1) suppress the legacy overlay so we don't get two menus
        if (systems?.ui?.pauseOverlay) {
            this._origSysPauseOverlay = this._origSysPauseOverlay || systems.ui.pauseOverlay;
            systems.ui.pauseOverlay = () => {}; // no-op while this scene is paused
        }

        // 🧰 2) build only OUR overlay (make sure its container uses a very high depth)
        this._pauseUi = this._buildPauseOverlay();

        // 🧊 3) freeze time / tweens / physics / audio / video
        this.time.timeScale = 0;
        this.tweens.timeScale = 0;
        if (this.physics?.world) this.physics.world.isPaused = true;
        this.bgVideo?.pause();
        this.sound.pauseAll();
    }

    create() {
        const SS = CONFIG.soapSplash;

        // NEW: ensure global audio isn’t stuck paused from previous scene
        this.sound?.resumeAll?.();

        // NEW: install teardown hooks once
        if (!this._booted) {
            this.events.once("shutdown", this._teardown, this);
            this.events.on("sleep", this._teardown, this);
            this._booted = true;
        }

        // NEW: re-arm & fully unpause on wake/resume (fixes no-spawn after Home/Explain)
        const _fullUnpause = () => {
            this._paused = false;
            this._spawnArmed = false;
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
        };
        this.events.on("wake",   _fullUnpause);
        this.events.on("resume", _fullUnpause);

        // ── Difficulty: normalise to 1..3 and expose ─────────────────────────────
        const raw = this.registry.get("difficulty"); // may be "easy"/"normal"/"hard" or 1/2/3
        const map = { easy: 1, normal: 2, medium: 2, hard: 3 };
        const levelNum = (typeof raw === "number")
            ? Phaser.Math.Clamp(Math.round(raw), 1, 3)
            : (map[String(raw ?? "").toLowerCase()] ?? 2);
        SS.activeDifficulty = levelNum;

        // ── Word buckets from WordBank loader ────────────────────────────────────
        const grouped =
            (SS.wordsByDifficulty && typeof SS.wordsByDifficulty === "object")
                ? SS.wordsByDifficulty
                : (SS.words && !Array.isArray(SS.words) ? SS.words : { 1: [], 2: [], 3: [] });

        let pool = Array.isArray(grouped?.[levelNum]) ? grouped[levelNum].slice() : [];
        if (pool.length === 0 && Array.isArray(SS.words)) {
            // legacy flat array fallback so the game never stalls
            pool = SS.words.slice();
        }

        // Deduplicate and prepare a shuffled bag for low repetition
        SS.words = pool; // keep for any legacy helpers that read SS.words directly
        const unique = [...new Set(pool.filter(Boolean).map(String))];
        this._wordBag = Phaser.Utils.Array.Shuffle(unique);
        this._wordIndex = 0;

        // Primary supplier used by systems.soapsplash.pickWord()
        CONFIG.soapSplash.nextWordFn = () => {
            if (!this._wordBag || this._wordBag.length === 0) return "wash";
            const w = this._wordBag[this._wordIndex++];
            if (this._wordIndex >= this._wordBag.length) {
                this._wordBag = Phaser.Utils.Array.Shuffle(this._wordBag);
                this._wordIndex = 0;
            }
            return w;
        };

        console.log(`[SoapSplash] level=${levelNum} | words=${pool.length}`);

        // ── Tuning by level ──────────────────────────────────────────────────────
        switch (levelNum) {
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

        // (optional) align underlying systems timer to 100s
        if (SS) SS.timerMs = 100000;

        // audio
        const savedMute = this.registry.get("mute") === true;
        if (this.sound) this.sound.mute = savedMute;

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
        const firstKey = this._bgKeys[0] || null;
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
                    this.bgVideo.setScale(scale * 1.5);
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

        // DB round — NEW: always start a new round on entry (same as before, explicit intent)
        const difficulty = this.registry.get("difficulty");
        this.roundId = DB.beginRound(window.__SESSION_ID__, "SoapSplasher", String(difficulty));

        // ── Top-right PAUSE icon only (no home/settings in this scene) ───────────
        const T = CONFIG.ui.topbar;
        const pause = this.add.image(this.scale.width - T.padding - T.iconSize/2, T.padding + T.iconSize/2, "ui_pause")
            .setOrigin(0.5).setDisplaySize(T.iconSize, T.iconSize).setDepth(200).setScrollFactor(0)
            .setInteractive({ useHandCursor: true });
        pause.on("pointerup", () => this.togglePause());

        // Hide generic systems timer text if exposed (remove small white timer)
        this.topbar?.timerText?.setVisible(false);
        this.topbar?.setTimerVisible?.(false);

        // build our Chewy countdown HUD (visual only, 100 → 0)
        this._buildCountdownHUD();

        // typing + original systems timer start after Explain overlay resumes
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            systems.soapsplash.timer.init(this); // ← keep old system
            this.gameStartAt = this.time.now;
            systems.soapsplash.typing.init(this);
        });

        // launch explain overlay then pause ourselves (with watchdog auto-resume)
        console.log("[SoapSplash] launching Explain overlay");
        this.time.delayedCall(800, () => {
            this.scene.launch("SoapSplashExplain", { parentKey: "SoapSplash" });
            this.scene.bringToTop("SoapSplashExplain");
            this.scene.pause("SoapSplash");

            // NEW: watchdog — if still paused after 5s, auto-resume (dev-safety)
            this.time.delayedCall(5000, () => {
                if (this.scene.isPaused("SoapSplash")) {
                    console.warn("[SoapSplash] auto-resume watchdog fired");
                    this.scene.resume("SoapSplash");
                }
            });
        });

        // background stage swapper
        this.setSoapSplashBackground = (breaches) => {
            const i = Math.min(breaches, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // finalize on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this.gameOver) this.finalizeRound("Scene shutdown");
        });
    }

    finalizeRound(reason = "Time up", overrides = {}) {
        if (this.gameOver) return;
        this.gameOver = true;

        if (this.roundId) {
            DB.finalizeRound(this.roundId, {
                score: overrides.score ?? this.streakSys?.totalScore ?? this.typing?.score ?? 0,
                bestStreak: overrides.bestStreak ?? this.streakSys?.bestStreak ?? this.typing?.bestStreak ?? 0,
                breaches: overrides.breaches ?? this.breaches ?? 0,
                baseScore: overrides.baseScore ?? this.streakSys?.baseScore ?? 0,
                multiplier: overrides.multiplier ?? (this.streakSys?.multiplier?.() || 0),
                reason,
            });
        }
        // NOTE: no forced transition here.
    }

    // ─────────────────────────────────────────────
    // Toast builder (bottom-right, minimal, Chewy font)
    // ─────────────────────────────────────────────
    _makeToast({ mood = "happy", text, ttl = 1800 }) {
        const { width: W, height: H } = this.scale;

        if (!this._toastStack) this._toastStack = [];
        const margin = 22;

        const g = this.add.container(0, 0).setDepth(600);

        // choose sprite based on mood
        let spriteKey = null;
        if (mood === "sad") {
            if (this.textures.exists("KikoSad")) spriteKey = "KikoSad";
            else if (this.textures.exists("KikoJump")) spriteKey = "KikoJump";
            else if (this.textures.exists("KikoCheer")) spriteKey = "KikoCheer";
        } else {
            if (this.textures.exists("KikoCheer")) spriteKey = "KikoCheer";
            else if (this.textures.exists("KikoJump")) spriteKey = "KikoJump";
            else if (this.textures.exists("KikoSad"))  spriteKey = "KikoSad";
        }

        // kiko sprite with subtle glow (white outline feel)
        let kiko = null;
        if (spriteKey) {
            const glow = this.add.image(0, 0, spriteKey)
                .setOrigin(1, 1)
                .setScale(0.23)
                .setTint(0xffffff)
                .setAlpha(0.25)
                .setBlendMode(Phaser.BlendModes.SCREEN);
            kiko = this.add.image(0, 0, spriteKey)
                .setOrigin(1, 1)
                .setScale(0.23)
                .setTint(0xffffff);
            g.add(glow);
            g.add(kiko);
        }

        // text style — Chewy font, no box behind
        const label = this.add.text(0, 0, text, {
            fontFamily: "Chewy, Arial, sans-serif",
            fontSize: "44px",
            color: "#ffffff",
            align: "right",
            wordWrap: { width: Math.min(W * 0.7, 600) }
        })
            .setOrigin(1, 1)
            .setStroke("#000000", 6)
            .setAlpha(0);

        g.add(label);

        // layout bottom-right, stack upward if multiple
        const stackHeight = this._toastStack.reduce((acc, it) => acc + (it.h + 6), 0);
        const baseX = W - margin;
        const baseY = H - margin - stackHeight;

        label.setPosition(baseX - (kiko ? 80 : 0), baseY);
        if (kiko) kiko.setPosition(baseX, baseY - 8);

        // animation (fade & float)
        const items = kiko ? [label, kiko] : [label];
        items.forEach(t => t.setY(t.y + 14));
        this.tweens.add({
            targets: items,
            y: "-=14",
            alpha: 1,
            duration: 220,
            ease: "Back.Out"
        });

        if (kiko) {
            this.tweens.add({
                targets: kiko,
                y: "-=6",
                duration: 420,
                yoyo: true,
                repeat: (mood === "sad" ? 1 : 2),
                ease: "Sine.inOut"
            });
            this.tweens.add({
                targets: kiko,
                angle: mood === "sad" ? -3 : 3,
                duration: 360,
                yoyo: true,
                repeat: 1,
                ease: "Sine.inOut"
            });
        }

        // push to stack
        const itemH = Math.round(label.height + (kiko ? kiko.displayHeight * 0.3 : 20));
        const stackItem = { g, h: itemH };
        this._toastStack.push(stackItem);

        // fade out later
        this.time.delayedCall(ttl, () => {
            this.tweens.add({
                targets: items,
                y: "+=12",
                alpha: 0,
                duration: 250,
                ease: "Cubic.In",
                onComplete: () => {
                    g.destroy(true);
                    const idx = this._toastStack.indexOf(stackItem);
                    if (idx >= 0) this._toastStack.splice(idx, 1);
                }
            });
        });

        return g;
    }

    // ---- HAPPY (Encouragement)
    showKikoEncouragement(messageOverride = null) {
        if (this._encourageGroup) this._encourageGroup.destroy(true);

        const LINES = [
            "Keep going!",
            "Awesome typing — you’re winning!",
            "Keep up the scrubbing!",
            "Nice streak — stay focused!"
        ];
        const msg = messageOverride ?? LINES[Math.floor(Math.random() * LINES.length)];

        this._encourageGroup = this._makeToast({ mood: "happy", text: msg, ttl: 1700 });
    }

    // ---- SAD (Breach)
    showKikoSad(messageOverride = null) {
        if (this._sadCooldownUntil && this.time.now < this._sadCooldownUntil) return;
        this._sadCooldownUntil = this.time.now + 400;
        if (this._sadGroup) this._sadGroup.destroy(true);

        const LINES = [
            "Oops! Stop those germs!",
            "Type faster — you’ve got this!",
            "Watch out — scrub quicker!",
            "Don’t give up, try again!"
        ];
        const msg = messageOverride ?? LINES[Math.floor(Math.random() * LINES.length)];

        this._sadGroup = this._makeToast({ mood: "sad", text: msg, ttl: 1850 });
    }

    // ===== Countdown (100 → 0), Chewy font, urgency under 10 (visual only) =====
    _buildCountdownHUD() {
        const { width: W } = this.scale;
        this._countdownMsTotal = 100 * 1000;
        this._countdownMsLeft  = this._countdownMsTotal;
        this._lastShownSec     = 101;
        this._urgentPulsing    = false;

        // big, centered Chewy text
        this.countdownText = this.add.text(W / 2, 16, "100", {
            fontFamily: "Chewy",
            fontSize: "64px",
            color: "#ffffff",
            align: "center"
        })
            .setOrigin(0.5, 0)
            .setStroke("#000000", 8)
            .setShadow(0, 4, "#00000099", 8, true, true)
            .setDepth(1000);
    }

    _updateCountdown(delta) {
        if (this._paused || this.gameOver) return;

        this._countdownMsLeft = Math.max(0, this._countdownMsLeft - delta);

        let secLeft = Math.ceil(this._countdownMsLeft / 1000);
        if (secLeft < 0) secLeft = 0;

        if (secLeft !== this._lastShownSec) {
            this._lastShownSec = secLeft;
            this.countdownText?.setText(String(secLeft));

            if (secLeft <= 10) {
                this.countdownText
                    ?.setColor("#ff3b3b")
                    .setStroke("#7a0000", 10)
                    .setShadow(0, 6, "#ff3b3b", 14, true, true);

                if (!this._urgentPulsing) {
                    this._urgentPulsing = true;
                    this.tweens.add({
                        targets: this.countdownText,
                        scaleX: 1.12, scaleY: 1.12,
                        duration: 110,
                        yoyo: true,
                        ease: "Sine.inOut",
                        onComplete: () => { this._urgentPulsing = false; }
                    });
                }
            } else if (secLeft <= 20) {
                this.countdownText
                    ?.setColor("#ffd166")
                    .setStroke("#5c3b00", 9)
                    .setShadow(0, 5, "#000000aa", 10, true, true);

                this.tweens.add({
                    targets: this.countdownText,
                    scaleX: 1.06, scaleY: 1.06,
                    duration: 140,
                    yoyo: true,
                    ease: "Sine.inOut"
                });
            } else {
                this.countdownText
                    ?.setColor("#ffffff")
                    .setStroke("#000000", 8)
                    .setShadow(0, 4, "#00000099", 8, true, true);
            }
        }
    }

    // -------------------------------
    // WAVE-BASED UPDATE LOOP (+ toasts)
    // -------------------------------
    update(time, delta) {
        // --- hard guards ---
        const active = this.sys?.isActive?.() ?? true;
        if (this._tearingDown || this._paused || !active) return;
        if (this.gameOver) return;

        // --- (re)arm the spawner after any resume/home cycle ---
        if (!this._spawnArmed) {
            this._spawnArmed = true;
            this._waveActive = false;
            this._pendingSpawns = 0;
            // schedule a first spawn window shortly after we become active again
            this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 700);
            this._idleWatchStart = time;
        }

        // --- SAFETY: if board is idle for >3s after start/resume, force a spawn
        if (!this._idleWatchStart) this._idleWatchStart = time;
        const idleMs = time - this._idleWatchStart;
        const noActors = this.germs.length === 0 && this._pendingSpawns === 0;
        if (noActors && idleMs > 3000) {
            try {
                console.warn("[SoapSplash] idle watchdog spawning a germ");
                systems.soapsplash.spawn.spawnGerm(this);
                const cap = (CONFIG.soapSplash?.waveCap ?? CONFIG.soapSplash?.maxGerms ?? 5);
                this._pendingSpawns = Math.max(0, cap - 1);
                this._nextSpawnAt = time + (CONFIG.soapSplash?.spawnIntervalMs ?? 1200);
                this._waveActive = true;
            } catch (e) {
                console.error("Watchdog spawn failed:", e);
            }
            this._idleWatchStart = time; // reset watchdog
        }

        // ensure a typing target if germs exist but none selected
        if (this.germs.length && (!this.typing || !this.typing.activeId)) {
            systems.soapsplash.typing.pickNearest(this);
        }

        const SS = CONFIG.soapSplash || {};
        if (this.gameStartAt == null) this.gameStartAt = time;

        // countdown / timer housekeeping
        this._updateCountdown?.(delta);

        const base   = SS.spawnIntervalMs ?? SS.spawnEveryMs ?? 1200;
        const jitter = SS.spawnJitterMs ?? 140;
        const cap    = SS.waveCap ?? SS.maxGerms ?? 5;

        // start a new wave when board is clear
        if (!this._waveActive && this.germs.length === 0) {
            this._waveActive = true;
            this._pendingSpawns = cap;
            // if a resume just happened, _nextSpawnAt was primed above; otherwise prime now
            this._nextSpawnAt = this._nextSpawnAt ?? (time + (this._betweenWaveDelayMs ?? 900));
        }

        // spawn loop
        if (this._waveActive && time >= (this._nextSpawnAt ?? 0) && this._pendingSpawns > 0) {
            try {
                // (optional) warn once if word bank is empty; spawn has its own fallback anyway
                if (!SS.words || Object.values(SS.words).every(arr => !arr?.length)) {
                    if (!this._warnedEmptyWB) {
                        console.warn("[SoapSplash] Word bank empty — using fallback.");
                        this._warnedEmptyWB = true;
                    }
                }
                systems.soapsplash.spawn.spawnGerm(this);
            } catch (err) {
                console.error("Spawn error:", err);
            }
            this._pendingSpawns--;
            const j = Phaser.Math.Between(-jitter, jitter);
            this._nextSpawnAt = time + base + j;
        }

        // end wave when finished
        if (this._waveActive && this._pendingSpawns <= 0 && this.germs.length === 0) {
            this._waveActive = false;
            // schedule the next wave window
            this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 900);
        }

        // movement + rules
        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);

        // HUD timer
        systems.soapsplash.timer.updateHUD(this, time);

        // Kiko reactions
        if (this.breaches > (this._lastSadAtBreaches ?? -1)) {
            this._lastSadAtBreaches = this.breaches;
            this.showKikoSad?.();
        }
        const curStreak = this.streakSys?.streak ?? this.typing?.streak ?? 0;
        if (curStreak > (this._lastEncouragementAt ?? 0) && curStreak >= 1) {
            this._lastEncouragementAt = curStreak;
            this.showKikoEncouragement?.();
        }

        // --- DEBUG TICK (once/sec)
        if (!this._debugTick || time - this._debugTick > 1000) {
            this._debugTick = time;
            console.log("[SS update]", {
                paused: this._paused,
                tearing: this._tearingDown,
                active: this.sys?.isActive?.(),
                waveActive: this._waveActive,
                pending: this._pendingSpawns,
                germs: this.germs.length,
                nextSpawnIn: Math.round((this._nextSpawnAt ?? time) - time)
            });
        }
    }

    // NEW: shared teardown used by Home-reset and lifecycle events
    _teardown() {
        try { this.time?.removeAllEvents?.(); } catch {}
        try { this.tweens?.killAll?.(); } catch {}
        try { this.input?.keyboard?.removeAllListeners?.(); } catch {}
        try { this._pauseUi?.destroy?.(); } catch {}
        this._pauseUi = null;
        this._paused = false;

        try {
            this.germs?.slice().forEach((g, i) => systems.movement?.removeGermByIndex?.(this, i));
            this.germs = [];
        } catch {}
    }

    // (optional) clean up overlay and listeners on shutdown
    shutdown() {
        // call the robust teardown instead of partial manual cleanup
        this._teardown();
        this.bgVideo?.stop?.();
    }
}
