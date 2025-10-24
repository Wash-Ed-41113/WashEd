// this file defines the typing game scene for soap splash
// the scene manages germs spawning movement breaches timer ui and pause state
// comments are in simple language with no punctuation and only code names use caps

// src/scenes/SoapSplashScene.js
import systems from "../systems.js";
import { DB } from "../db.js";

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");

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
    }


    _buildPauseOverlay() {
        const { width: W, height: H } = this.scale;
        const g = this.add.container(0, 0).setDepth(10_000);

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

        // title
        const title = this.add.text(W/2, H/2 - 140, "Game Paused", {
            fontFamily: "Chewy, Arial, sans-serif",
            fontSize: "72px",
            color: "#000000",
            align: "center"
        }).setOrigin(0.5).setDepth(10_002);
        g.add(title);

        // 🔧 stats now in Montserrat
        const score = this.streakSys?.totalScore ?? this.typing?.score ?? 0;
        const best  = this.streakSys?.bestStreak ?? this.typing?.bestStreak ?? 0;
        const breaches = this.breaches ?? 0;

        const stats = this.add.text(W/2, H/2 - 50,
            `Score: ${score}\nBest Streak: ${best}\nBreaches: ${breaches}`, {
                fontFamily: "Montserrat, Arial, sans-serif",   // ← Montserrat
                fontSize: "40px",
                color: "#000000",
                align: "center",
                lineSpacing: 8
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

        // 🔧 CLOSE "X" (top-right)
        const closeKey = this.textures.exists("ui_close") ? "ui_close" : null;
        const closeX = px + pw - 26, closeY = py + 26;
        const closeImg = closeKey
            ? this.add.image(closeX, closeY, "ui_close").setDisplaySize(36,36)
            : this.add.text(closeX, closeY, "✕", { fontFamily: "Arial", fontSize: "36px", color: "#000" }).setOrigin(0.5);
        closeImg.setOrigin(0.5).setDepth(10_003).setInteractive({ useHandCursor: true });
        g.add(closeImg);

        const unpause = () => {
            this._paused = false;
            this._pauseUi = null;
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            this.bgVideo?.resume();
            this.sound.resumeAll();
        };
        closeImg.on("pointerup", () => { destroyAll(); unpause(); });

        // 🔧 HOME + EXIT image buttons (center-bottom row)
        const makeIconButton = (key, x, y, onClick, size = 72) => {
            const img = this.add.image(x, y, key).setOrigin(0.5).setDepth(10_003)
                .setDisplaySize(size, size)
                .setInteractive({ useHandCursor: true });
            img.on("pointerover", () => img.setScale(1.06));
            img.on("pointerout",  () => img.setScale(1.00));
            img.on("pointerup", onClick);
            g.add(img);
            return img;
        };

        const rowY = py + ph - 86;
        // needs these textures preloaded in PreloadScene: "ui_home", "ui_close" already used
        const homeBtn = (this.textures.exists("ui_home"))
            ? makeIconButton("ui_home", W/2 - 80, rowY, () => {
                this.finalizeRound?.("Paused → Home");
                const playerName = this.registry.get("playerName");
                destroyAll();
                this.scene.start("GameScene", { playerName });
            }, 76)
            : null;

        const exitBtn = makeIconButton(closeKey ?? null, W/2 + 80, rowY, () => {
            this.finalizeRound?.("Paused → Exit to Menu");
            destroyAll();
            this.scene.start("MenuScene");
        }, 76);

        // 🔧 MUTE as a proper coloured button (like difficulty UI)
        const makeRectBtn = (label, x, y, onClick) => {
            const Bw = CONFIG?.ui?.button?.width  ?? 520;
            const Bh = CONFIG?.ui?.button?.height ?? 64;
            const rect = this.add.rectangle(x, y, Bw, Bh, 0x142038, 1)
                .setOrigin(0.5).setStrokeStyle(2, 0xffffff)
                .setInteractive({ useHandCursor: true }).setDepth(10_003);
            const txt = this.add.text(x, y, label, {
                fontFamily: "Montserrat, Arial, sans-serif",
                fontSize: "26px",
                color: "#ffffff",
                align: "center",
                fixedWidth: Bw
            }).setOrigin(0.5).setDepth(10_004);
            rect.on("pointerover", () => rect.setFillStyle(0x1d2b52));
            rect.on("pointerout",  () => rect.setFillStyle(0x142038));
            rect.on("pointerup", onClick);
            txt.on("pointerup", onClick);
            g.add(rect); g.add(txt);
            return { rect, txt };
        };

        const muteLabel = this.sound?.mute ? "Unmute" : "Mute";
        const muteY = rowY - 76;
        const muteBtn = makeRectBtn(muteLabel, W/2, muteY, () => {
            if (this.sound) {
                this.sound.mute = !this.sound.mute;
                muteBtn.txt.setText(this.sound.mute ? "Unmute" : "Mute");
            }
        });

        function destroyAll() {
            if (panel?.destroy) panel.destroy();
            title.destroy(); stats.destroy();
            closeImg.destroy(); overlay.destroy();
            muteBtn.rect.destroy(); muteBtn.txt.destroy();
            homeBtn?.destroy();
            exitBtn?.destroy();
            g.destroy?.();
        }
        return g;
    }


    // pause must freeze timers/tweens and bg video
    togglePause() {
        if (this._paused) {
            // --- resume game ---
            this._paused = false;

            // destroy our custom pause UI
            this._pauseUi?.destroy();
            this._pauseUi = null;

            // restore time / tween / physics / audio / video
            this.time.timeScale = 1;
            this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            this.bgVideo?.resume();
            this.sound.resumeAll();
        } else {
            // --- pause game ---
            this._paused = true;

            // build the new Game-Over-styled overlay (replaces systems.ui.pauseOverlay)
            this._pauseUi = this._buildPauseOverlay();

            // freeze time / tweens / physics / audio / video
            this.time.timeScale = 0;
            this.tweens.timeScale = 0;
            if (this.physics?.world) this.physics.world.isPaused = true;
            this.bgVideo?.pause();
            this.sound.pauseAll();
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
        this.load.image(
            "ss_end_bg",
            "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png"
        );

        // kiko sprites for toasts (optional; code safely falls back if missing)
        if (CONFIG.assets?.kiko?.jump) this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        if (CONFIG.assets?.kiko?.cheer) this.load.image("KikoCheer", CONFIG.assets.kiko.cheer);
        if (CONFIG.assets?.kiko?.sad) this.load.image("KikoSad", CONFIG.assets.kiko.sad);

        // optional dialog panel (not required by the toasts)
        if (CONFIG.assets?.ui?.dialogPanel) this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
    }

    create() {
        const SS = CONFIG.soapSplash;

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

        // DB round
        const difficulty = this.registry.get("difficulty") || "normal";
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

        // ── REMOVE keyboard pause toggles (no ESC/P pause) ──────────────────────
        // (intentionally no key bindings for pause)

        // build our Chewy countdown HUD (visual only, 100 → 0)
        this._buildCountdownHUD();

        // typing + original systems timer start after Explain overlay resumes
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            systems.soapsplash.timer.init(this); // ← keep old system
            this.gameStartAt = this.time.now;
            systems.soapsplash.typing.init(this);
        });

        // launch explain overlay then pause ourselves
        console.log("[SoapSplash] launching Explain overlay");
        this.time.delayedCall(800, () => {
            this.scene.launch("SoapSplashExplain", { parentKey: "SoapSplash" });
            this.scene.bringToTop("SoapSplashExplain");
            this.scene.pause("SoapSplash");
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
        // NOTE: we do NOT force any scene transition here.
        // Your original systems flow should already handle Game Over screen navigation.
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
            fontFamily: "Chewy, Arial, sans-serif",
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

        // tick down (visual only) and clamp
        this._countdownMsLeft = Math.max(0, this._countdownMsLeft - delta);

        // compute whole seconds (clamped to 0 for display)
        let secLeft = Math.ceil(this._countdownMsLeft / 1000);
        if (secLeft < 0) secLeft = 0;

        if (secLeft !== this._lastShownSec) {
            this._lastShownSec = secLeft;
            this.countdownText?.setText(String(secLeft));

            if (secLeft <= 10) {
                // urgent: red, faster pulse, stronger shadow
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
                // warning: amber, gentle pulse
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
                // normal
                this.countdownText
                    ?.setColor("#ffffff")
                    .setStroke("#000000", 8)
                    .setShadow(0, 4, "#00000099", 8, true, true);
            }
        }

        // IMPORTANT: do NOT end the round here.
        // The original systems timer will handle time-up game over.
    }

    // -------------------------------
    // WAVE-BASED UPDATE LOOP (+ toasts)
    // -------------------------------
    update(time, delta) {
        // stop all game logic when finished or paused
        if (this.gameOver) return;
        if (this._paused) {
            // timers/tweens are already frozen via timeScale=0 in togglePause()
            return;
        }

        // ensure an active target exists without needing a keypress
        if (this.germs.length && (!this.typing || !this.typing.activeId)) {
            systems.soapsplash.typing.pickNearest(this);
        }

        const SS = CONFIG.soapSplash;
        if (this.gameStartAt == null) this.gameStartAt = time;

        // drive our Chewy countdown (visual only)
        this._updateCountdown(delta);

        const base   = SS.spawnIntervalMs ?? 1200;
        const jitter = SS.spawnJitterMs ?? 0;
        const cap    = SS.waveCap ?? SS.maxGerms ?? 5;

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

        // movement + collisions + rules
        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);

        // keep original systems HUD update (drives old Game Over logic)
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
    }

    // (optional) clean up overlay and listeners on shutdown
    shutdown() {
        // destroy pause UI if present
        if (this._pauseUi) {
            this._pauseUi.destroy();
            this._pauseUi = null;
        }

        // stop background video (saves resources across scene swaps)
        this.bgVideo?.stop?.();
    }
}
