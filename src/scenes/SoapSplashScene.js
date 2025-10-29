/* global Phaser, CONFIG */
import systems from "../systems.js";
import { DB } from "../db.js";
import { AudioManager } from "../systems.js";

const MINI_KEY = "germ_scrubber_music";
const MUSIC_PATHS = ["assets/sounds/germ-scrubber.mp3", "./assets/sounds/germ-scrubber.mp3"];

export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");
        // guards
        this._booted = false; this._tearingDown = false; this._typingBooted = false; this._timerInit = false;
        // core state
        this.germs = []; this.lastSpawn = 0; this.germSeq = 0; this.breaches = 0; this.gameOver = false; this.gameStartAt = null;
        // ui / pause
        this._paused = false; this._pauseUi = null;
        // spawn geometry
        this.rOuter = 0; this.rInner = 0; this.angleMinDeg = 0; this.angleMaxDeg = 90;
        // visuals
        this.bgSprite = null; this._bgKeys = [];
        // db / round
        this.roundId = null;
        // spawner loop
        this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = 0; this._betweenWaveDelayMs = 900;
        // toast state (Kiko reactions)
        this._lastSadAtBreaches = 0; this._lastEncouragementAt = 0;
        this._toastStack = [];
        // SFX trackers (new)
        this._lastStreakVal = 0;           // detect streak changes for SFX
        this._sfxCooldownUntil = 0;        // anti-spam guard (ms)
        // timer HUD
        this._countdownMsTotal = 100000; this._countdownMsLeft = 100000; this._lastShownSec = 101; this._urgentPulsing = false; this.countdownText = null;
        // misc runtime
        this._spawnArmed = false; this._idleWatchStart = 0; this._debugTick = 0;
        this._nextWord = null;
        this._bgmArmed = false;
    }

    // --- one-shots for correct / incorrect typing (direct Phaser playback) ---
    _playCorrectSfx() {
        try {
            if (!this.cache.audio.exists("SS_SND_CORRECT")) return;
            if (this.sound?.context?.state === "suspended") this.sound.context.resume?.();
            this.sound.mute = false;
            this.sound.play("SS_SND_CORRECT", { volume: 0.9 });
        } catch (_) {}
    }
    _playIncorrectSfx() {
        try {
            if (!this.cache.audio.exists("SS_SND_INCORRECT")) return;
            if (this.sound?.context?.state === "suspended") this.sound.context.resume?.();
            this.sound.mute = false;
            this.sound.play("SS_SND_INCORRECT", { volume: 0.9 });
        } catch (_) {}
    }

    // --- wire SFX to *all* typing logs without editing other files ---
    _wireSfxTaps() {
        if (this._logTapInstalled) return;
        this._logTapInstalled = true;

        const orig = DB?.logTyping?.bind(DB);
        if (!orig) return;

        const okRx  = /(word[_:\- ]?ok|word[_:\- ]?correct|typed[_:\- ]?correct|hit|accepted)/i;
        const badRx = /(word[_:\- ]?miss|word[_:\- ]?wrong|typed[_:\- ]?wrong|breach|fail|rejected|timeout)/i;

        DB.logTyping = (...args) => {
            let ev = null;
            if (args.length >= 1 && typeof args[0] === "string") ev = args[0];
            if (args.length >= 2 && typeof args[1] === "string") ev = args[1] || ev;

            try {
                if (ev && okRx.test(ev))  this._playCorrectSfx();
                if (ev && badRx.test(ev)) this._playIncorrectSfx();
            } catch {}

            try { return orig(...args); }
            catch (e) { console.warn("[SFX tap] logTyping passthrough failed:", e); }
        };
    }

    // ---- helper: ALWAYS use this to leave SoapSplash ----
    leaveTo(targetKey, data) {
        try { AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global"); } catch {}
        this.scene.stop(this.scene.key);
        if (targetKey) this.scene.start(targetKey, data);
    }

    init(data) {
        this.germs = []; this.lastSpawn = 0; this.germSeq = 0; this.breaches = 0; this.gameOver = false; this.gameStartAt = null;
        this._paused = false; this._pauseUi = null;
        this.roundId = null; this._difficulty = data?.difficulty ?? this.registry.get("difficulty") ?? 1;

        try { this.time?.removeAllEvents?.(); } catch {}
        this.time.timeScale = 1; this.tweens.timeScale = 1; this.physics?.world?.resume?.();

        this._spawnArmed = false; this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = 0; this._idleWatchStart = 0; this._debugTick = 0;
        this._typingBooted = false; this._timerInit = false; this._bgmArmed = false;

        // reset toast trackers every round
        this._lastSadAtBreaches = 0;
        this._lastEncouragementAt = 0;

        // reset SFX trackers
        this._lastStreakVal = 0;
        this._sfxCooldownUntil = 0;
    }

    preload() {
        const set = CONFIG.assets.soapSplash.backgrounds;
        this._bgKeys = set.map((p, i) => { const k = `SS_BG_${i}`; this.load.image(k, p); return k; });

        const vids = CONFIG.assets?.soapSplash?.backgroundVid;
        if (vids) { const s = Array.isArray(vids) ? vids : [vids]; this.load.video("SS_BG_VIDEO", s, "loadeddata", false, true); }

        const frames = CONFIG.assets?.soapSplash?.handsFrames;
        if (frames?.dir && frames?.count) {
            const z = frames.zeroPad ?? 3;
            for (let i = 1; i <= frames.count; i++) {
                const n = String(i).padStart(z, "0");
                this.load.image(`HANDS_${n}`, `${frames.dir}/hands_${n}.png`);
            }
        }

        // game bits
        this.load.image("Germ", CONFIG.assets.soapSplash.germ);
        this.load.image("ss_end_bg", "assets/images/SoapSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png");

        // Kiko sprites for toasts
        if (CONFIG.assets.kiko?.jump) this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        this.load.image("KikoCheer", CONFIG.assets.kiko.cheer);
        this.load.image("KikoSad",   CONFIG.assets.kiko.sad);

        // ui
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("ui_home", CONFIG.assets.ui.homeBut);
        this.load.image("ui_pause", CONFIG.assets.ui.pauseBut);

        // music
        if (!this.cache.audio.exists(MINI_KEY)) {
            this.load.audio(MINI_KEY, MUSIC_PATHS);
            this.load.on(Phaser.Loader.Events.LOAD_ERROR, (f) => { if (f?.key === MINI_KEY) console.warn("[Scene] music load error:", f.src || f.url); });
        }

        // --- SFX for correct / incorrect typings ---
        const okSrc  = CONFIG.assets?.soapSplash?.correctAud;
        const badSrc = CONFIG.assets?.soapSplash?.incorrectAud;
        if (okSrc  && !this.cache.audio.exists("SS_SND_CORRECT"))   this.load.audio("SS_SND_CORRECT", okSrc);
        if (badSrc && !this.cache.audio.exists("SS_SND_INCORRECT")) this.load.audio("SS_SND_INCORRECT", badSrc);
    }

    _buildPauseOverlay() {
        const { width: W, height: H } = this.scale;
        const g = this.add.container(0, 0).setDepth(99999);
        const overlay = this.add.rectangle(0, 0, W, H, 0xffffff, 0.45).setOrigin(0, 0).setInteractive(); g.add(overlay);

        let panel;
        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H / 2, "DialogPanel").setOrigin(0.5);
            const tw = Math.min(W * 0.8, 980); panel.setDisplaySize(tw, tw * 0.58);
        } else {
            const gfx = this.add.graphics();
            const pw = Math.min(W * 0.8, 980), ph = Math.min(H * 0.6, 520), px = (W - pw) / 2, py = (H - ph) / 2;
            gfx.fillStyle(0xffffff, 1).fillRoundedRect(px, py, pw, ph, 28).lineStyle(6, 0x222222, 0.18).strokeRoundedRect(px, py, pw, ph, 28);
            panel = gfx;
        }
        g.add(panel);

        const title = this.add.text(W / 2, H / 2 - 170, "Game Paused", { fontFamily: "Chewy", fontSize: "72px", color: "#000", align: "center" }).setOrigin(0.5); g.add(title);
        const score = this.streakSys?.totalScore ?? 0, best = this.streakSys?.bestStreak ?? 0, breaches = this.breaches ?? 0;
        const stats = this.add.text(W / 2, H / 2 - 10, `Score: ${score}\nBest Streak: ${best}\nBreaches: ${breaches}`, {
            fontFamily: "Montserrat", fontSize: "40px", color: "#000", align: "center", lineSpacing: 12
        }).setOrigin(0.5); g.add(stats);

        g.destroy = () => {
            try { panel?.destroy(); title?.destroy(); stats?.destroy(); } catch { }
            finally {
                this._pauseUi = null; this._paused = false;
                this.time.timeScale = 1; this.tweens.timeScale = 1;
                if (this.physics?.world) this.physics.world.isPaused = false;
                this.sound?.resumeAll?.();
                if (this._origSysPauseOverlay) { systems.ui.pauseOverlay = this._origSysPauseOverlay; this._origSysPauseOverlay = null; }
            }
        };
        this._pauseUi = g; return g;
    }

    // ─────────────────────────────────────────────
    // Toast builder (bottom-right, Chewy font)
    // ─────────────────────────────────────────────
    _makeToast({ mood = "happy", text, ttl = 1800 }) {
        const { width: W, height: H } = this.scale;
        if (!this._toastStack) this._toastStack = [];

        const g = this.add.container(0, 0).setDepth(600);
        const margin = 22;

        // choose sprite
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

        let kiko = null;
        if (spriteKey) {
            const glow = this.add.image(0, 0, spriteKey).setOrigin(1, 1).setScale(0.23).setTint(0xffffff).setAlpha(0.25).setBlendMode(Phaser.BlendModes.SCREEN);
            kiko = this.add.image(0, 0, spriteKey).setOrigin(1, 1).setScale(0.23).setTint(0xffffff);
            g.add(glow); g.add(kiko);
        }

        const label = this.add.text(0, 0, text, {
            fontFamily: "Chewy, Arial, sans-serif",
            fontSize: "44px",
            color: "#ffffff",
            align: "right",
            wordWrap: { width: Math.min(W * 0.7, 600) }
        }).setOrigin(1, 1).setStroke("#000000", 6).setAlpha(0);
        g.add(label);

        // stack at bottom-right
        const stackH = this._toastStack.reduce((a, it) => a + (it.h + 6), 0);
        const baseX = W - margin, baseY = H - margin - stackH;
        label.setPosition(baseX - (kiko ? 80 : 0), baseY);
        if (kiko) kiko.setPosition(baseX, baseY - 8);

        const items = kiko ? [label, kiko] : [label];
        items.forEach(t => t.setY(t.y + 14));
        this.tweens.add({ targets: items, y: "-=14", alpha: 1, duration: 220, ease: "Back.Out" });

        if (kiko) {
            this.tweens.add({ targets: kiko, y: "-=6", duration: 420, yoyo: true, repeat: (mood === "sad" ? 1 : 2), ease: "Sine.inOut" });
            this.tweens.add({ targets: kiko, angle: (mood === "sad" ? -3 : 3), duration: 360, yoyo: true, repeat: 1, ease: "Sine.inOut" });
        }

        const itemH = Math.round(label.height + (kiko ? kiko.displayHeight * 0.3 : 20));
        const stackItem = { g, h: itemH };
        this._toastStack.push(stackItem);

        this.time.delayedCall(ttl, () => {
            this.tweens.add({
                targets: items, y: "+=12", alpha: 0, duration: 250, ease: "Cubic.In",
                onComplete: () => {
                    g.destroy(true);
                    const idx = this._toastStack.indexOf(stackItem);
                    if (idx >= 0) this._toastStack.splice(idx, 1);
                }
            });
        });
        return g;
    }

    showKikoEncouragement(messageOverride = null) {
        const LINES = [
            "Keep going!",
            "Awesome typing — you’re winning!",
            "Keep up the scrubbing!",
            "Nice streak — stay focused!"
        ];
        const msg = messageOverride ?? LINES[(Math.random() * LINES.length) | 0];
        return this._makeToast({ mood: "happy", text: msg, ttl: 1700 });
    }

    showKikoSad(messageOverride = null) {
        // tiny cooldown to avoid spam
        if (this._sadCooldownUntil && this.time.now < this._sadCooldownUntil) return;
        this._sadCooldownUntil = this.time.now + 400;
        const LINES = [
            "Oops! Stop those germs!",
            "Type faster — you’ve got this!",
            "Watch out — scrub quicker!",
            "Don’t give up, try again!"
        ];
        const msg = messageOverride ?? LINES[(Math.random() * LINES.length) | 0];
        return this._makeToast({ mood: "sad", text: msg, ttl: 1850 });
    }

    // togglePause() { ... }  // (intentionally disabled UI button; ESC handler kept)

    create() {
        const SS = CONFIG.soapSplash;

        // --- Master audio sanity ---
        AudioManager.pauseGroup("global");
        try { this.sound.context?.resume?.(); } catch {}
        this.registry.set("mute", false);
        this.sound.mute = false;
        this.sound.setVolume?.(1);

        const ensureBgm = () => {
            try { this.sound.unlock?.(); } catch {}
            let inst = this.sound.get(MINI_KEY);

            const reallyPlay = () => {
                try {
                    AudioManager.play(this, MINI_KEY, { group: "game", volume: 0.8, loop: true });
                    inst = this.sound.get(MINI_KEY);
                } catch {
                    if (!inst) inst = this.sound.add(MINI_KEY, { loop: true, volume: 0.8 });
                    if (!inst.isPlaying) inst.play();
                }
                if (inst) { inst.setMute?.(false); inst.setVolume?.(0.8); }
                if (typeof window !== "undefined") window.__SS_BGM__ = inst || null;
            };

            if (inst) { if (inst.isPaused) inst.resume(); else if (!inst.isPlaying) reallyPlay(); }
            else if (this.cache.audio.exists(MINI_KEY)) {
                if (this.sound.locked) this.sound.once("unlocked", reallyPlay);
                else reallyPlay();
            } else {
                console.warn("[Scene] BGM not in cache. Key/path:", MINI_KEY);
            }
        };

        ensureBgm();
        if (!this._bgmArmed) {
            this._bgmArmed = true;
            const fire = () => ensureBgm();
            this.input.once("pointerdown", fire);
            this.input.keyboard?.once("keydown", fire);
            window.addEventListener("mousedown", fire, { once: true, passive: true });
            window.addEventListener("touchstart", fire, { once: true, passive: true });
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) { try { this.sound.context?.resume?.(); } catch {} ensureBgm(); }
            });
        }

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global"); });
        this.events.once(Phaser.Scenes.Events.DESTROY,  () => { AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global"); });

        systems.ui.placeLogo(this);
        this.sound?.resumeAll?.();

        if (!this._booted) { this.events.once("shutdown", this._teardown, this); this.events.on("sleep", this._teardown, this); this._booted = true; }
        const _fullUnpause = () => {
            this._paused = false; this._spawnArmed = false;
            this.time.timeScale = 1; this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            ensureBgm();
        };
        this.events.on("wake", _fullUnpause); this.events.on("resume", _fullUnpause);

        if (!this._typingBooted) {
            systems.soapsplash.typing.init(this);
            this._typingBooted = true;

            // ensure SFX always fire on every judged word
            this._wireSfxTaps();

            // keep the event listeners too (harmless if not emitted)
            const okEvents  = ["typing:word:ok", "typing:word:correct", "ss:word:ok", "soapsplash:word:ok", "germ:splashed"];
            const badEvents = ["typing:word:miss", "typing:word:wrong", "ss:word:miss", "soapsplash:word:miss", "germ:breach"];
            okEvents.forEach (ev => this.events.on(ev,  () => this._playCorrectSfx()));
            badEvents.forEach(ev => this.events.on(ev, () => this._playIncorrectSfx()));
        }
        if (!this.typeHud || !this.typeHud.scene) {
            this.typeHud = this.add.text(16, 14, "Score: 0  (base 0 × 1.0)   Streak: 0", {
                fontFamily: CONFIG.ui?.fontFamily || "Montserrat", fontSize: "20px", color: "#fff"
            }).setDepth(200);
        }

        this.gameStartAt = this.time.now;
        if (!this._timerInit) { systems.soapsplash.timer.init(this); this._timerInit = true; }

        const raw = this.registry.get("difficulty"); const map = { easy: 1, normal: 2, medium: 2, hard: 3 };
        const levelNum = (typeof raw === "number") ? Phaser.Math.Clamp(Math.round(raw), 1, 3) : (map[String(raw ?? "").toLowerCase()] ?? 2);
        SS.activeDifficulty = levelNum;

        if (CONFIG?.soapSplash?.resetDeck && CONFIG?.soapSplash?.getDeck) {
            CONFIG.soapSplash.resetDeck(levelNum);
            this._nextWord = CONFIG.soapSplash.getDeck(levelNum);
            CONFIG.soapSplash.nextWordFn = this._nextWord;
        } else {
            console.warn("[SoapSplash] Deck APIs missing; use fallback");
            this._nextWord = () => "wash"; CONFIG.soapSplash.nextWordFn = this._nextWord;
        }

        switch (levelNum) {
            case 1: SS.spawnEveryMs = 1600; SS.spawnJitterMs = 120; SS.germBaseSpeed = 70;  SS.maxGerms = 5;  SS.waveCap = 4; break;
            case 3: SS.spawnEveryMs = 900;  SS.spawnJitterMs = 160; SS.germBaseSpeed = 120; SS.maxGerms = 10; SS.waveCap = 6; break;
            default: SS.spawnEveryMs = 1200; SS.spawnJitterMs = 140; SS.germBaseSpeed = 100; SS.maxGerms = 8;  SS.waveCap = 5; break;
        }
        SS.spawnIntervalMs = SS.spawnEveryMs; SS.timerMs = 100000;

        const sink = { x: SS.width * SS.sinkHitRel.x, y: SS.height * SS.sinkHitRel.y };
        this.sinkPosition = { ...sink }; this.getSinkHitPoint = () => sink;
        this.rSink = (SS.rSinkRel != null) ? Math.round(SS.height * SS.rSinkRel) : (SS.rSinkPx ?? 70);

        const firstKey = this._bgKeys[0] || null;
        this.bgSprite = firstKey ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey).setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0).setDepth(0);

        if (this.cache.video.exists("SS_BG_VIDEO")) {
            const W = SS.width, H = SS.height, targetW = W * 0.18;
            this.bgVideo = this.add.video(W * 0.53, H * 0.15, "SS_BG_VIDEO").setOrigin(0.5).setDepth(3).setLoop(true).setMute(true);
            this.bgVideo.play(true);
            const setScale = () => { const vw = this.bgVideo.video?.videoWidth || 640; const s = targetW / vw; this.bgVideo.setScale(s * 1.5); };
            if (this.bgVideo.video?.readyState >= 2) setScale(); else { this.bgVideo.once("play", setScale); this.bgVideo.once("loadeddata", setScale); }
        }

        if (SS.useSpawner) {
            const d = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
            this.rOuter = Math.max(0, d - SS.cornerMargin); this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);
            const cdeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, cdeg - SS.angleSpreadDeg); this.angleMaxDeg = Math.min(90, cdeg + SS.angleSpreadDeg);
            if (this.angleMinDeg > this.angleMaxDeg) { const t = this.angleMinDeg; this.angleMinDeg = this.angleMaxDeg; this.angleMaxDeg = t; }
        }

        // round reset bits
        this.germs = []; this.lastSpawn = 0; this.germSeq = 0; this.breaches = 0; this.gameOver = false;
        this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = 0;
        this._lastSadAtBreaches = 0; this._lastEncouragementAt = 0;

        const diff = this.registry.get("difficulty");
        this.roundId = DB.beginRound(window.__SESSION_ID__, "SoapSplash", String(diff));

        // PAUSE BUTTON DISABLED (per request)
        const T = CONFIG.ui.topbar;
        // const pause = this.add.image(this.scale.width - T.padding - T.iconSize/2, T.padding + T.iconSize/2, "ui_pause")
        //   .setOrigin(0.5).setDisplaySize(T.iconSize, T.iconSize).setDepth(200).setScrollFactor(0).setInteractive({ useHandCursor: true });
        // pause.on("pointerup", () => this.togglePause());

        // keep only ESC to close our overlay if present
        this.input.keyboard?.on("keydown-ESC", () => { if (this._paused && this._pauseUi?.destroy) this._pauseUi.destroy(); });
        this.events.once("shutdown", () => { this._pauseUi?.destroy?.(); });
        this.events.once("destroy",  () => { this._pauseUi?.destroy?.(); });

        // Hide generic systems timer text if exposed
        this.topbar?.timerText?.setVisible(false);
        this.topbar?.setTimerVisible?.(false);
        try { this.topbar?.timerText?.destroy?.(); } catch (_) {}

        this._buildCountdownHUD();

        systems.soapsplash.typing.updateHud(this);
        if (!this.typing?.activeId && this.germs.length) systems.soapsplash.typing.pickNearest(this);

        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            this.gameStartAt = this.time.now;
            if (!this._timerInit) { systems.soapsplash.timer.init(this); this._timerInit = true; }
            if (this.germs.length && (!this.typing || !this.typing.activeId)) systems.soapsplash.typing.pickNearest(this);
            ensureBgm();
        });

        // explain overlay, watchdog resume
        this.time.delayedCall(800, () => {
            this.scene.launch("SoapSplashExplain", { parentKey: "SoapSplash" });
            this.scene.bringToTop("SoapSplashExplain");
            this.scene.pause("SoapSplash");
            this.time.delayedCall(5000, () => {
                if (this.scene.isPaused("SoapSplash")) {
                    console.warn("[SoapSplash] auto-resume watchdog");
                    this.scene.resume("SoapSplash"); ensureBgm();
                }
            });
        });

        this.setSoapSplashBackground = (b) => {
            const i = Math.min(b, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (!this.gameOver) this.finalizeRound("Scene shutdown"); });
    }

    _commitFinalScore(reason = "finalize") {
        try {
            this.streakSys?._recompute?.();
            const final = this.streakSys?.totalScore ?? 0, best = this.streakSys?.bestStreak ?? 0;
            DB.logTyping?.("SoapSplash_end", { totalScore: final, bestStreak: best, reason });
            DB.saveRound?.("SoapSplash", final, best);
        } catch (e) { console.warn("[SoapSplash] _commitFinalScore failed:", e); }
    }

    endGameAndGoto(next, data = {}, reason = "scene-change") {
        if (this.gameOver) return;
        this.finalizeRound(reason);
        try { this.scene.stop("SoapSplash"); if (next) this.scene.start(next, data); }
        catch (e) { console.warn("[SoapSplash] endGameAndGoto error:", e); }
    }

    finalizeRound(reason = "Time up", overrides = {}) {
        if (this.gameOver) return; this.gameOver = true;
        this.streakSys?._recompute?.(); this._commitFinalScore(reason);
        if (this.roundId) {
            DB.finalizeRound(this.roundId, {
                score:        overrides.score        ?? (this.streakSys?.totalScore ?? 0),
                bestStreak:   overrides.bestStreak   ?? (this.streakSys?.bestStreak ?? 0),
                breaches:     overrides.breaches     ?? (this.breaches ?? 0),
                baseScore:    overrides.baseScore    ?? (this.streakSys?.baseScore ?? 0),
                multiplier:   overrides.multiplier   ?? (this.streakSys?.multiplier?.() ?? 1.0),
                reason
            });
        }
    }

    _buildCountdownHUD() {
        const { width: W } = this.scale;
        this._countdownMsTotal = 100000; this._countdownMsLeft = 100000; this._lastShownSec = 101; this._urgentPulsing = false;
        this.countdownText = this.add.text(W / 2, 16, "100", {
            fontFamily: "Chewy", fontSize: "64px", color: "#fff", align: "center"
        }).setOrigin(0.5, 0).setStroke("#000", 8).setShadow(0, 4, "#00000099", 8, true, true).setDepth(1000);
    }

    _updateCountdown(delta) {
        if (this._paused || this.gameOver) return;
        this._countdownMsLeft = Math.max(0, this._countdownMsLeft - delta);
        let s = Math.ceil(this._countdownMsLeft / 1000); if (s < 0) s = 0;
        if (s !== this._lastShownSec) {
            this._lastShownSec = s; this.countdownText?.setText(String(s));
            if (s <= 10) {
                this.countdownText?.setColor("#ff3b3b")?.setStroke("#7a0000", 10)?.setShadow(0, 6, "#ff3b3b", 14, true, true);
                if (!this._urgentPulsing) {
                    this._urgentPulsing = true;
                    this.tweens.add({ targets: this.countdownText, scaleX: 1.12, scaleY: 1.12, duration: 110, yoyo: true, ease: "Sine.inOut", onComplete: () => { this._urgentPulsing = false; } });
                }
            } else if (s <= 20) {
                this.countdownText?.setColor("#ffd166")?.setStroke("#5c3b00", 9)?.setShadow(0, 5, "#000000aa", 10, true, true);
                this.tweens.add({ targets: this.countdownText, scaleX: 1.06, scaleY: 1.06, duration: 140, yoyo: true, ease: "Sine.inOut" });
            } else {
                this.countdownText?.setColor("#fff")?.setStroke("#000", 8)?.setShadow(0, 4, "#00000099", 8, true, true);
            }
        }
    }

    update(time, delta) {
        const active = this.sys?.isActive?.() ?? true;
        if (this._tearingDown || this._paused || !active) return;
        if (this.gameOver) return;

        if (!this._spawnArmed) { this._spawnArmed = true; this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 700); this._idleWatchStart = time; }

        if (!this._idleWatchStart) this._idleWatchStart = time;
        const idle = time - this._idleWatchStart, noActors = this.germs.length === 0 && this._pendingSpawns === 0;
        if (noActors && idle > 3000) {
            try {
                systems.soapsplash.spawn.spawnGerm(this);
                const cap = (CONFIG.soapSplash?.waveCap ?? CONFIG.soapSplash?.maxGerms ?? 5);
                this._pendingSpawns = Math.max(0, cap - 1);
                this._nextSpawnAt = time + (CONFIG.soapSplash?.spawnIntervalMs ?? 1200);
                this._waveActive = true;
            } catch (e) { console.error("Watchdog spawn failed:", e); }
            this._idleWatchStart = time;
        }

        if (this.germs.length && (!this.typing || !this.typing.activeId)) systems.soapsplash.typing.pickNearest(this);

        const SS = CONFIG.soapSplash || {};
        if (this.gameStartAt == null) this.gameStartAt = time;
        this._updateCountdown?.(delta);

        const base = SS.spawnIntervalMs ?? SS.spawnEveryMs ?? 1200, jitter = SS.spawnJitterMs ?? 140, cap = SS.waveCap ?? SS.maxGerms ?? 5;
        if (!this._waveActive && this.germs.length === 0) { this._waveActive = true; this._pendingSpawns = cap; this._nextSpawnAt = this._nextSpawnAt ?? (time + (this._betweenWaveDelayMs ?? 900)); }
        if (this._waveActive && time >= (this._nextSpawnAt ?? 0) && this._pendingSpawns > 0) {
            try { systems.soapsplash.spawn.spawnGerm(this); } catch (err) { console.error("Spawn error:", err); }
            this._pendingSpawns--; const j = Phaser.Math.Between(-jitter, jitter); this._nextSpawnAt = time + base + j;
        }
        if (this._waveActive && this._pendingSpawns <= 0 && this.germs.length === 0) { this._waveActive = false; this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 900); }

        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);
        systems.soapsplash.timer.updateHUD(this, time);

        // ── Kiko reactions + SFX binding to gameplay signals ──
        // Breach -> SAD toast + incorrect SFX
        if (this.breaches > (this._lastSadAtBreaches ?? -1)) {
            this._lastSadAtBreaches = this.breaches;
            this.showKikoSad?.();
            if (time >= (this._sfxCooldownUntil || 0)) {
                this._playIncorrectSfx();
                this._sfxCooldownUntil = time + 40; // relaxed to 40ms
            }
        }

        // Streak increase -> encouragement toast
        const curStreak = this.streakSys?.streak ?? 0;
        if (curStreak > (this._lastEncouragementAt ?? 0) && curStreak >= 1) {
            this._lastEncouragementAt = curStreak;
            this.showKikoEncouragement?.();
        }

        // SFX on streak change (increase: correct; drop: incorrect)
        if (curStreak !== this._lastStreakVal) {
            if (time >= (this._sfxCooldownUntil || 0)) {
                if (curStreak > this._lastStreakVal) this._playCorrectSfx();
                else this._playIncorrectSfx();
                this._sfxCooldownUntil = time + 40; // relaxed to 40ms
            }
            this._lastStreakVal = curStreak;
        }

        if (!this._debugTick || time - this._debugTick > 1000) {
            this._debugTick = time;
            console.log("[SS update]", {
                paused: this._paused, tearing: this._tearingDown, active: this.sys?.isActive?.(),
                waveActive: this._waveActive, pending: this._pendingSpawns, germs: this.germs.length,
                nextSpawnIn: Math.round((this._nextSpawnAt ?? time) - time)
            });
        }
    }

    _teardown() {
        try { this.time?.removeAllEvents?.(); } catch {}
        try { this.tweens?.killAll?.(); } catch {}
        try { this.input?.keyboard?.removeAllListeners?.(); } catch {}
        try { this._pauseUi?.destroy?.(); } catch {}
        this._pauseUi = null; this._paused = false;
        try { this.germs?.slice().forEach((g, i) => systems.movement?.removeGermByIndex?.(this, i)); this.germs = []; } catch {}
    }
    shutdown() { this._teardown(); this.bgVideo?.stop?.(); }
}
