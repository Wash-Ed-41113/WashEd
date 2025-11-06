// this scene implements the soap splash typing mini game core loop
// it manages audio bgm spawns movement scoring toasts timer and round finalization
// comments explain each block purpose flow and how state is coordinated across systems and db

/* global Phaser, CONFIG */
import systems from "../systems.js";
import { DB } from "../db.js";
import { AudioManager } from "../systems.js";

// constants for the mini game background music loaded once and reused
const MINI_KEY = "germ_scrubber_music";
const MUSIC_PATHS = ["assets/sounds/germ-scrubber.mp3", "./assets/sounds/germ-scrubber.mp3"];

// scene constructor sets up guards runtime state ui flags spawn geometry visuals and db round handle
export default class SoapSplashScene extends Phaser.Scene {
    constructor() {
        super("SoapSplash");
        // guards
        this._booted = false; this._tearingDown = false; this._typingBooted = false; this._timerInit = false;
        // core state
        this.germs = []; this.lastSpawn = 0; this.germSeq = 0; this.breaches = 0; this.gameOver = false; this.gameStartAt = null;
        // ui / pause
        this._paused = false; this._pauseUi = null;
        this._timeUpFired = false; // prevent double-handling at 00
        this._leaving = false;     // used by endGameAndGoto one-shot guard

        // spawn geometry
        this.rOuter = 0; this.rInner = 0; this.angleMinDeg = 0; this.angleMaxDeg = 90;
        // visuals
        this.bgSprite = null; this._bgKeys = [];
        // db / round
        this.roundId = null;

        // spawner loop
        this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = 0; this._betweenWaveDelayMs = 900;
        // toast state kiko reactions and encouragement cadence
        this._lastSadAtBreaches = 0; this._lastEncouragementAt = 0;
        this._toastStack = [];
        // sfx trackers to rate limit tap sounds and follow streak changes
        this._lastStreakVal = 0;           // detect streak changes for SFX
        this._sfxCooldownUntil = 0;        // anti-spam guard (ms)
        // legacy small hud fields chewy timer is authoritative now kept for compatibility
        this._countdownMsTotal = 100000; this._countdownMsLeft = 100000; this._lastShownSec = 101; this._urgentPulsing = false; this.countdownText = null;
        // misc runtime
        this._spawnArmed = false; this._idleWatchStart = 0; this._debugTick = 0;
        this._nextWord = null;
        this._bgmArmed = false;
    }

    // small helpers to play correct or incorrect sfx using phaser sound api with safe guards
    // these are triggered by event taps and streak changes
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

    // wraps db logTyping to listen for success or failure tokens so sfx fire regardless of where events originate
    // leaves original behavior intact and passes through args
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

    // single time up path that mirrors breach limit end logic clamps hud triggers reaction and transitions safely
    _onTimeUp() {
        if (this._timeUpFired || this.gameOver) return;
        this._timeUpFired = true;

        // clamp legacy HUD if present
        try { this._countdownMsLeft = 0; this.countdownText?.setText("0"); } catch {}

        // optional reaction
        try { this.showKikoSad?.("Time’s up!"); } catch {}

        // EXACT SAME PATH as breach-limit end:
        try {
            systems.soapsplash.timer?.endGame?.(this, "Time's up");
        } catch (e) {
            console.warn("[SoapSplash] timer.endGame failed, falling back:", e);
            this.finalizeRound("Time's up");
            this.leaveTo("HandwashAnimationScene", { skipIntro: true });
        }
    }

    // central exit helper stops game audio resumes global and switches scenes used by all leaves
    // guarantees no lingering scene instance
    leaveTo(targetKey, data) {
        try { AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global"); } catch {}
        this.scene.stop(this.scene.key);
        if (targetKey) this.scene.start(targetKey, data);
    }

    // init resets per round state difficulty flags clocks and trackers for a clean start
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

        this._timeUpFired = false;

        // reset sfx trackers for streak change sounds
        this._lastStreakVal = 0;
        this._sfxCooldownUntil = 0;
    }

    // preload all art audio and video for the mini game including dynamic frame loads and safety handlers
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

        // kiko reaction sprites used in toasts
        if (CONFIG.assets.kiko?.jump) this.load.image("KikoJump", CONFIG.assets.kiko.jump);
        this.load.image("KikoCheer", CONFIG.assets.kiko.cheer);
        this.load.image("KikoSad",   CONFIG.assets.kiko.sad);

        // ui chrome elements
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("ui_home", CONFIG.assets.ui.homeBut);
        this.load.image("ui_pause", CONFIG.assets.ui.pauseBut);

        // music with cache guard and error log
        if (!this.cache.audio.exists(MINI_KEY)) {
            this.load.audio(MINI_KEY, MUSIC_PATHS);
            this.load.on(Phaser.Loader.Events.LOAD_ERROR, (f) => { if (f?.key === MINI_KEY) console.warn("[Scene] music load error:", f.src || f.url); });
        }

        // sfx for typing feedback optional and guarded by cache checks
        const okSrc  = CONFIG.assets?.soapSplash?.correctAud;
        const badSrc = CONFIG.assets?.soapSplash?.incorrectAud;
        if (okSrc  && !this.cache.audio.exists("SS_SND_CORRECT"))   this.load.audio("SS_SND_CORRECT", okSrc);
        if (badSrc && !this.cache.audio.exists("SS_SND_INCORRECT")) this.load.audio("SS_SND_INCORRECT", badSrc);
    }

    // pause overlay builder intentionally omitted retained for future ui work
    // _buildPauseOverlay() { ... } // (kept commented)

    // toast factory builds a small stackable notification with kiko art and animated entrance exit
    // used for encouragement and gentle corrections without blocking gameplay
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
            fontFamily: "Chewy",
            fontSize: "44px",
            color: "#ffffff",
            align: "right",
            wordWrap: { width: Math.min(W * 0.7, 600) }
        }).setOrigin(1, 1).setStroke("#000000", 6).setAlpha(0);
        g.add(label);

        // stack at bottom right with gentle motion and timed dismissal
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

    // convenience wrappers to show mood specific toasts with randomized lines and minimal cooldowns
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

    // create is the main scene setup it prepares audio resumes context wires timers builds background and spawner config and launches explain overlay
    create() {
        const SS = CONFIG.soapSplash;

        // master audio setup pause global resume context and ensure game bgm with robust unlock flow
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

        // cleanup handlers to stop timers and swap audio groups when scene ends
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            try { this._chewyTimerEvt?.remove?.(); } catch {}
            try { this.chewyTimer?.destroy?.(); } catch {}
            AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global");
        });

        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            try { this._chewyTimerEvt?.remove?.(); } catch {}
            try { this.chewyTimer?.destroy?.(); } catch {}
            AudioManager.stop(this); AudioManager.stopGroup("game"); AudioManager.resumeGroup("global");
        });

        systems.ui.placeLogo(this);
        this.sound?.resumeAll?.();

        // boot only once wire teardown on shutdown or sleep and define full unpause to restore clocks and bgm
        if (!this._booted) { this.events.once("shutdown", this._teardown, this); this.events.on("sleep", this._teardown, this); this._booted = true; }
        const _fullUnpause = () => {
            this._paused = false; this._spawnArmed = false;
            this.time.timeScale = 1; this.tweens.timeScale = 1;
            if (this.physics?.world) this.physics.world.isPaused = false;
            ensureBgm();
        };
        this.events.on("wake", _fullUnpause); this.events.on("resume", _fullUnpause);

        // patch a pause resume bookkeeping uses wall clock to extend end time so timer remains fair
        this._scenePausedAtWall = null;
        this.events.on(Phaser.Scenes.Events.PAUSE, () => {
            this._scenePausedAtWall = Date.now(); // Phaser's clock freezes; use wall time
            this._paused = true;
        });
        this.events.on(Phaser.Scenes.Events.RESUME, () => {
            if (this._scenePausedAtWall != null && this._roundStarted && this._roundEndAt != null) {
                const pausedFor = Date.now() - this._scenePausedAtWall;
                this._roundEndAt += pausedFor; // extend the round by the real pause
            }
            this._scenePausedAtWall = null;
            this._lastTimerNow = this.time.now; // reset per-tick baseline
            this._paused = false;
            // this._ensureRoundStarted?.("resume");
        });
        // end patch a

        // initialize typing subsystem once attach sfx taps and event listeners for ok and miss signals
        if (!this._typingBooted) {
            systems.soapsplash.typing.init(this);
            this._typingBooted = true;

            // ensure sfx always fire on every judged word
            this._wireSfxTaps();

            // keep the event listeners too harmless if not emitted
            const okEvents  = ["typing:word:ok", "typing:word:correct", "ss:word:ok", "soapsplash:word:ok", "germ:splashed"];
            const badEvents = ["typing:word:miss", "typing:word:wrong", "ss:word:miss", "soapsplash:word:miss", "germ:breach"];
            okEvents.forEach (ev => this.events.on(ev,  () => this._playCorrectSfx()));
            badEvents.forEach(ev => this.events.on(ev, () => this._playIncorrectSfx()));
        }

        // store a baseline timestamp and resolve difficulty to numeric level
        this.gameStartAt = this.time.now;

        const raw = this.registry.get("difficulty"); const map = { easy: 1, normal: 2, medium: 2, hard: 3 };
        const levelNum = (typeof raw === "number") ? Phaser.Math.Clamp(Math.round(raw), 1, 3) : (map[String(raw ?? "").toLowerCase()] ?? 2);
        SS.activeDifficulty = levelNum;

        // build word deck api or fallback stub when absent also expose nextWordFn for external systems
        if (CONFIG?.soapSplash?.resetDeck && CONFIG?.soapSplash?.getDeck) {
            CONFIG.soapSplash.resetDeck(levelNum);
            this._nextWord = CONFIG.soapSplash.getDeck(levelNum);
            CONFIG.soapSplash.nextWordFn = this._nextWord;
        } else {
            console.warn("[SoapSplash] Deck APIs missing; use fallback");
            this._nextWord = () => "wash"; CONFIG.soapSplash.nextWordFn = this._nextWord;
        }

        // apply difficulty tuning for spawn rate speed caps and timers then compute derivative values
        switch (levelNum) {
            case 1: SS.spawnEveryMs = 1600; SS.spawnJitterMs = 120; SS.germBaseSpeed = 70;  SS.maxGerms = 5;  SS.waveCap = 4; break;
            case 3: SS.spawnEveryMs = 900;  SS.spawnJitterMs = 160; SS.germBaseSpeed = 120; SS.maxGerms = 10; SS.waveCap = 6; break;
            default: SS.spawnEveryMs = 1200; SS.spawnJitterMs = 140; SS.germBaseSpeed = 100; SS.maxGerms = 8;  SS.waveCap = 5; break;
        }
        SS.spawnIntervalMs = SS.spawnEveryMs; SS.timerMs = 100000;

        // compute sink position and radius then set background image or fallback rectangle
        const sink = { x: SS.width * SS.sinkHitRel.x, y: SS.height * SS.sinkHitRel.y };
        this.sinkPosition = { ...sink }; this.getSinkHitPoint = () => sink;
        this.rSink = (SS.rSinkRel != null) ? Math.round(SS.height * SS.rSinkRel) : (SS.rSinkPx ?? 70);

        const firstKey = this._bgKeys[0] || null;
        this.bgSprite = firstKey ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey).setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0).setDepth(0);

        // optional background video scaled and looped silently for ambient motion
        if (this.cache.video.exists("SS_BG_VIDEO")) {
            const W = SS.width, H = SS.height, targetW = W * 0.18;
            this.bgVideo = this.add.video(W * 0.53, H * 0.15, "SS_BG_VIDEO").setOrigin(0.5).setDepth(3).setLoop(true).setMute(true);
            this.bgVideo.play(true);
            const setScale = () => { const vw = this.bgVideo.video?.videoWidth || 640; const s = targetW / vw; this.bgVideo.setScale(s * 1.5); };
            if (this.bgVideo.video?.readyState >= 2) setScale(); else { this.bgVideo.once("play", setScale); this.bgVideo.once("loadeddata", setScale); }
        }

        // chewy countdown fields and event wires the 60 to 00 timer starts on first spawn or resume and respects pauses
        // looks authoritative for end of round and emits time up through shared timer path
        // === CHEWY COUNTDOWN (center-top) — SECONDS: 60 → 00 ===
        // Defer starting the countdown until the first germ actually spawns (or resume).
        this._roundMs = 60000;
        this._roundStarted = false;
        this._roundEndAt = null;
        this._lastTimerNow = null;
        this._chewyTimerEvt = null;

        // Big Chewy timer at top-center (60 → 00)
        const Wc = this.scale.width;
        this.chewyTimer = this.add.text(Wc / 2, 16, "60", {
            fontFamily: "Chewy",
            fontSize: "48px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center",
        })
            .setOrigin(0.5, 0)
            .setDepth(1000);

        // helper to format 60 then two digit seconds with zero pad
        const _fmtChewySec = (n) => (n === 60 ? "60" : String(Math.max(0, n)).padStart(2, "0"));

        // arm the ticking event once safe against duplicates updates text color and triggers time up
        this._armChewyTick = () => {
            if (this._chewyTimerEvt) return;
            this._chewyTimerEvt = this.time.addEvent({
                delay: 1000,
                loop: true,
                callback: () => {
                    if (this.gameOver || !this._roundStarted) return;

                    // pause aware using our own wall time compensation
                    const now = this.time.now;
                    const dt = now - (this._lastTimerNow || now);
                    this._lastTimerNow = now;
                    if (this._paused) { this._roundEndAt += dt; return; }

                    const remainMs = Math.max(0, this._roundEndAt - now);

                    let secs = Math.ceil(remainMs / 1000); // 60..0
                    if (secs < 0) secs = 0;
                    if (secs > 60) secs = 60;

                    this.chewyTimer.setText(_fmtChewySec(secs));

                    // color cues for urgency
                    if (secs <= 10) this.chewyTimer.setColor("#ff6666");
                    else if (secs <= 30) this.chewyTimer.setColor("#ffcc33");
                    else this.chewyTimer.setColor("#ffffff");

                    if (remainMs <= 0 && !this._timeUpFired) {
                        this._timeUpFired = true;
                        try { this._chewyTimerEvt?.remove?.(); } catch {}
                        try { this.chewyTimer?.setText("00"); } catch {}
                        try { this.showKikoSad?.("Time’s up!"); } catch {}

                        try {
                            systems.soapsplash.timer?.endGame?.(this, "Time's up");
                        } catch (e) {
                            this.finalizeRound("Time's up");
                            this.leaveTo("HandwashAnimationScene", { skipIntro: true });
                        }
                    }
                },
            });
        };

        // idempotent start of round captures baseline times and arms tick event logs for debugging
        this._ensureRoundStarted = (why = "unknown") => {
            if (this._roundStarted) return;
            this._roundStarted = true;
            this._lastTimerNow = this.time.now;
            this._roundEndAt = this.time.now + this._roundMs;
            this.chewyTimer?.setText("60");
            console.log("[ChewyTimer] started via:", why); // <-- debug line
            this._armChewyTick();
        };

        // compute spawn geometry based on sink hit point and margins when using spawner system
        if (SS.useSpawner) {
            const d = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
            this.rOuter = Math.max(0, d - SS.cornerMargin); this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);
            const cdeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, cdeg - SS.angleSpreadDeg); this.angleMaxDeg = Math.min(90, cdeg + SS.angleSpreadDeg);
            if (this.angleMinDeg > this.angleMaxDeg) { const t = this.angleMinDeg; this.angleMinDeg = this.angleMaxDeg; this.angleMaxDeg = t; }
        }

        // reset round locals wave counters and encouragement trackers and open a db round id
        this.germs = []; this.lastSpawn = 0; this.germSeq = 0; this.breaches = 0; this.gameOver = false;
        this._waveActive = false; this._pendingSpawns = 0; this._nextSpawnAt = 0;
        this._lastSadAtBreaches = 0; this._lastEncouragementAt = 0;

        const diff = this.registry.get("difficulty");
        this.roundId = DB.beginRound(window.__SESSION_ID__, "SoapSplash", String(diff));

        // esc key handler for any overlay and cleanup on scene end
        this.input.keyboard?.on("keydown-ESC", () => { if (this._paused && this._pauseUi?.destroy) this._pauseUi.destroy(); });
        this.events.once("shutdown", () => { this._pauseUi?.destroy?.(); });
        this.events.once("destroy",  () => { this._pauseUi?.destroy?.(); });

        // hide generic topbar timer if present because chewy timer replaces it
        this.topbar?.timerText?.setVisible(false);
        this.topbar?.setTimerVisible?.(false);
        try { this.topbar?.timerText?.destroy?.(); } catch (_) {}

        // if typing has no active target but enemies exist pick nearest to keep flow smooth
        // systems.soapsplash.typing.updateHud(this);
        if (!this.typing?.activeId && this.germs.length) systems.soapsplash.typing.pickNearest(this);

        // on resume reselect targets ensure bgm and optionally start timer via existing hook if used
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            this.gameStartAt = this.time.now;
            if (this.germs.length && (!this.typing || !this.typing.activeId)) systems.soapsplash.typing.pickNearest(this);
            ensureBgm();
            // patch c also start on resume once hook kept commented to avoid duplicate start
            // this._ensureRoundStarted?.("resume-once");
        });

        // launch explain overlay pause game and watchdog auto resume in case of stuck state
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

        // helper to swap background by index called externally by systems or debug keys
        this.setSoapSplashBackground = (b) => {
            const i = Math.min(b, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // if the scene shuts down unexpectedly finalize the round to persist progress
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (!this.gameOver) this.finalizeRound("Scene shutdown"); });
    }

    // compute and mirror final score to registry and window then call db end hooks for scoreboard and persistence
    _commitFinalScore(reason = "finalize") {
        try {
            // make sure score is recomputed once at end
            this.streakSys?._recompute?.();

            const ssTotal = this.streakSys?.totalScore ?? 0;
            const ssBest  = this.streakSys?.bestStreak ?? 0;

            // --- lightweight mirrors work even without db ---
            try { this.registry?.set?.("ss:lastScore", ssTotal); } catch {}
            try { this.registry?.set?.("ss:lastBestStreak", ssBest); } catch {}
            try { window.__SS_LAST_SCORE__ = { total: ssTotal, bestStreak: ssBest, when: Date.now() }; } catch {}

            // keep your existing db end signals unchanged
            DB.logTyping?.("SoapSplash_end", { totalScore: ssTotal, bestStreak: ssBest, reason });
            DB.saveRound?.("SoapSplash", ssTotal, ssBest);
        } catch (e) {
            console.warn("[SoapSplash] _commitFinalScore failed:", e);
        }
    }

    // wraps finalize and scene transition ensuring one shot behavior and stopping overlays before navigation
    endGameAndGoto(next, data = {}, reason = "scene-change") {
        if (this._leaving) return;
        this._leaving = true;

        if (!this.gameOver) this.finalizeRound?.(reason);

        // stop overlays that might be on top
        try { this.scene.stop("SoapSplashExplain"); } catch {}

        try {
            this.scene.stop(this.scene.key);
            if (next) this.scene.start(next, data);
        } catch (e) {
            console.warn("[SoapSplash] endGameAndGoto error:", e);
        }
    }

    // finalizeRound safely records end state and writes a summary to the db using optional overrides then locks gameover
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

    // handles the transition from timer zero to game over including audio fade ui fallback and navigation to next scene
    _handleTimeUpToGameOver() {
        this._paused = true;
        if (this.physics?.world) this.physics.world.isPaused = true;

        try { this._chewyTimerEvt?.remove?.(); } catch {}
        try { this.scene.stop("SoapSplashExplain"); } catch {}
        try { AudioManager.fadeGroup?.("game", { to: 0, duration: 600 }); } catch {}

        try { this.finalizeRound?.("Time up"); } catch (e) {
            console.warn("[SoapSplash] finalizeRound on timeup failed:", e);
        }

        if (typeof this.gameOverScreen === "function") return this.gameOverScreen({ reason: "timeup" });
        if (systems?.soapsplash?.ui?.showGameOver)       return systems.soapsplash.ui.showGameOver(this, { reason: "timeup" });
        if (systems?.ui?.showGameOver)                    return systems.ui.showGameOver(this, { reason: "timeup" });

        this.events.emit("soapsplash:gameover", { reason: "timeup" });

        this.time.delayedCall(1200, () => {
            const NEXT = (window.CONFIG?.flow?.afterSoapSplash) || "EndingScene";
            try { this.endGameAndGoto?.(NEXT, { from: "SoapSplash", reason: "timeup" }, "Time up"); } catch {}
        });
    }

    // legacy countdown updater retained for compatibility chewy timer now owns time progression
    _updateCountdown(delta) {
        // intentionally left available but UNUSED; Chewy timer now owns time-up
        if (this._paused || this.gameOver) return;

        this._countdownMsLeft = Math.max(0, this._countdownMsLeft - delta);
        let s = Math.ceil(this._countdownMsLeft / 1000); if (s < 0) s = 0;

        if (s <= 0) { this._onTimeUp(); return; }

        if (s !== this._lastShownSec) {
            this._lastShownSec = s;
            this.countdownText?.setText(String(s));

            if (s <= 10) {
                this.countdownText?.setColor("#ff3b3b")?.setStroke("#7a0000", 10)?.setShadow(0, 6, "#ff3b3b", 14, true, true);
                if (!this._urgentPulsing) {
                    this._urgentPulsing = true;
                    this.tweens.add({
                        targets: this.countdownText,
                        scaleX: 1.12, scaleY: 1.12, duration: 110, yoyo: true, ease: "Sine.inOut",
                        onComplete: () => { this._urgentPulsing = false; }
                    });
                }
            } else if (s <= 20) {
                this.countdownText?.setColor("#ffd166")?.setStroke("#5c3b00", 9)?.setShadow("#000000aa");
                this.tweens.add({ targets: this.countdownText, scaleX: 1.06, scaleY: 1.06, duration: 140, yoyo: true, ease: "Sine.inOut" });
            } else {
                this.countdownText?.setColor("#fff")?.setStroke("#000", 8)?.setShadow(0, 4, "#00000099", 8, true, true);
            }
        }
    }

    // per frame update drives spawn waves movement breach checks sfx cadence and debug logs
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
                // patch b start timer on first spawn via watchdog
                this._ensureRoundStarted?.("first-spawn-watchdog");
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

        // legacy countdown intentionally disabled to avoid double timer
        // this._updateCountdown?.(delta);

        const base = SS.spawnIntervalMs ?? SS.spawnEveryMs ?? 1200, jitter = SS.spawnJitterMs ?? 140, cap = SS.waveCap ?? SS.maxGerms ?? 5;
        if (!this._waveActive && this.germs.length === 0) { this._waveActive = true; this._pendingSpawns = cap; this._nextSpawnAt = this._nextSpawnAt ?? (time + (this._betweenWaveDelayMs ?? 900)); }
        if (this._waveActive && time >= (this._nextSpawnAt ?? 0) && this._pendingSpawns > 0) {
            try { systems.soapsplash.spawn.spawnGerm(this); } catch (err) { console.error("Spawn error:", err); }
            // patch b start timer on first spawn during normal wave
            this._ensureRoundStarted?.("first-spawn-wave");
            this._pendingSpawns--; const j = Phaser.Math.Between(-jitter, jitter); this._nextSpawnAt = time + base + j;
        }
        if (this._waveActive && this._pendingSpawns <= 0 && this.germs.length === 0) { this._waveActive = false; this._nextSpawnAt = time + (this._betweenWaveDelayMs ?? 900); }

        systems.soapsplash.movement.moveGerms(this, delta);
        systems.soapsplash.rules.checkBreaches(this);
        // systems.soapsplash.timer.updateHUD(this, time);

        // kiko reaction logic and sfx bindings based on breaches and streak deltas with anti spam cooldown
        // Breach -> SAD toast + incorrect SFX
        if (this.breaches > (this._lastSadAtBreaches ?? -1)) {
            this._lastSadAtBreaches = this.breaches;
            this.showKikoSad?.();
            if (time >= (this._sfxCooldownUntil || 0)) {
                this._playIncorrectSfx();
                this._sfxCooldownUntil = time + 40;
            }
        }

        // Streak increase -> encouragement toast
        const curStreak = this.streakSys?.streak ?? 0;
        if (curStreak > (this._lastEncouragementAt ?? 0) && curStreak >= 1) {
            this._lastEncouragementAt = curStreak;
            this.showKikoEncouragement?.();
        }

        // SFX on streak change increase plays correct drop plays incorrect respecting cooldown
        if (curStreak !== this._lastStreakVal) {
            if (time >= (this._sfxCooldownUntil || 0)) {
                if (curStreak > this._lastStreakVal) this._playCorrectSfx();
                else this._playIncorrectSfx();
                this._sfxCooldownUntil = time + 40;
            }
            this._lastStreakVal = curStreak;
        }

        // lightweight debug log once per second to trace wave state and timers
        if (!this._debugTick || time - this._debugTick > 1000) {
            this._debugTick = time;
            console.log("[SS update]", {
                paused: this._paused, tearing: this._tearingDown, active: this.sys?.isActive?.(),
                waveActive: this._waveActive, pending: this._pendingSpawns, germs: this.germs.length,
                nextSpawnIn: Math.round((this._nextSpawnAt ?? time) - time)
            });
        }
    }

    // teardown removes timers tweens inputs overlays and clears all germs then resets flags
    _teardown() {
        try { this.time?.removeAllEvents?.(); } catch {}
        try { this.tweens?.killAll?.(); } catch {}
        try { this.input?.keyboard?.removeAllListeners?.(); } catch {}
        try { this._pauseUi?.destroy?.(); } catch {}
        this._pauseUi = null; this._paused = false;
        try { this.germs?.slice().forEach((g, i) => systems.movement?.removeGermByIndex?.(this, i)); this.germs = []; } catch {}
    }

    // shutdown hook calls teardown and stops background video if present safe for multiple calls
    shutdown() { this._teardown(); this.bgVideo?.stop?.(); }
}
