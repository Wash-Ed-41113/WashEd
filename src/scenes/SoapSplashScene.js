// src/scenes/SoapSplashScene.js — UPDATED
// Purpose: fix 404s / missing audio key by preloading audio here, make loads idempotent,
//          and keep the scene self‑sufficient for required assets.

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
        this.bgVideo = null;

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
    }

    // -----------------------------
    // Pause overlay
    // -----------------------------
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

    // -----------------------------
    // Preload — make loads idempotent and cover audio & images used here
    // -----------------------------
    preload() {
        const SS_ASSETS = CONFIG.assets?.soapSplash || {};

        // Helpers so we never double‑load keys
        const loadImg = (key, path) => {
            if (!key || !path) return;
            if (!this.textures.exists(key)) this.load.image(key, path);
        };
        const loadAudio = (key, paths) => {
            if (!key || !paths) return;
            const srcs = Array.isArray(paths) ? paths : [paths];
            if (!this.cache.audio.exists(key)) this.load.audio(key, srcs);
        };
        const loadVideo = (key, paths, loadEvent = "loadeddata", asBlob = false, noAudio = true) => {
            if (!key || !paths) return;
            const srcs = Array.isArray(paths) ? paths : [paths];
            if (!this.cache.video?.exists?.(key)) this.load.video(key, srcs, loadEvent, asBlob, noAudio);
        };

        // --- Background image set (stage progression) ---
        const bgSet = SS_ASSETS.backgrounds || [];
        this._bgKeys = bgSet.map((path, i) => {
            const key = `SS_BG_${i}`;
            loadImg(key, path);
            return key;
        });

        // --- Optional transparent video overlay (hands) ---
        const bgVid = SS_ASSETS.backgroundVid; // e.g., "assets/images/SopaSplash/hands_alpha.webm"
        if (bgVid) loadVideo("SS_BG_VIDEO", bgVid, "loadeddata", false, true);

        // --- Game sprites used here ---
        loadImg("Germ", SS_ASSETS.germ);
        loadImg(
            "ss_end_bg",
            "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png"
        );

        // --- Optional UI skins & Kiko stickers ---
        loadImg("dialog_skin", CONFIG.assets?.ui?.dialogPanel);
        if (CONFIG.assets?.kiko?.jump) loadImg("KikoJump", CONFIG.assets.kiko.jump);
        if (CONFIG.assets?.kiko?.cheer) loadImg("KikoCheer", CONFIG.assets.kiko.cheer);
        if (CONFIG.assets?.kiko?.sad) loadImg("KikoSad", CONFIG.assets.kiko.sad);

        // --- AUDIO: preload here so keys exist before create() ---
        // Use conventional, space‑free filenames to avoid 404 on dev servers
        const bgMusicPath = CONFIG.assets?.audio?.bgMusic || "assets/sounds/bg_music.mp3";
        const scrubSfxPath = CONFIG.assets?.audio?.scrub || "assets/sounds/germ_scrubber.mp3"; // rename file on disk if needed
        loadAudio("BG_Music", bgMusicPath);
        loadAudio("SFX_Scrub", scrubSfxPath);
    }

    // -----------------------------
    // Create — set difficulty, scene state, audio, geometry, overlays
    // -----------------------------
    create() {
        const SS = CONFIG.soapSplash;

        // ---- Difficulty & words ----
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
                SS.spawnEveryMs = 1600; SS.spawnJitterMs = 120; SS.germBaseSpeed = 70;  SS.maxGerms = 5;  SS.waveCap = 4; break;
            case 3:
                SS.spawnEveryMs = 900;  SS.spawnJitterMs = 160; SS.germBaseSpeed = 120; SS.maxGerms = 10; SS.waveCap = 6; break;
            default:
                SS.spawnEveryMs = 1200; SS.spawnJitterMs = 140; SS.germBaseSpeed = 100; SS.maxGerms = 8;  SS.waveCap = 5; break;
        }
        SS.spawnIntervalMs = SS.spawnEveryMs;

        // ---- Audio (respect saved mute) ----
        const savedMute = this.registry.get("mute") === true;
        if (this.sound) this.sound.mute = savedMute;
        this._playBGMusicSafe();

        // ---- Sink position & (optional) debug marker ----
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

        // ---- Background image (stage 0) ----
        const firstKey = this._bgKeys[0] || null;
        this.bgSprite = firstKey
            ? this.add.sprite(SS.width / 2, SS.height / 2, firstKey).setDepth(0).setDisplaySize(SS.width, SS.height)
            : this.add.rectangle(0, 0, SS.width, SS.height, 0x1b2a3a, 1).setOrigin(0, 0).setDepth(0);

        // ---- Optional video overlay (transparent hands) ----
        if (this.cache.video?.exists?.("SS_BG_VIDEO")) {
            const W = SS.width, H = SS.height;
            const targetW = W * 0.18;
            this.bgVideo = this.add.video(W * 0.53, H * 0.15, "SS_BG_VIDEO")
                .setOrigin(0.5)
                .setDepth(3)
                .setLoop(true)
                .setMute(true);
            this.bgVideo.play(true);
            const setScale = () => {
                const vw = this.bgVideo.video?.videoWidth || 640;
                const scale = targetW / vw;
                this.bgVideo.setScale(scale);
            };
            if (this.bgVideo.video?.readyState >= 2) setScale();
            else {
                this.bgVideo.once("play", setScale);
                this.bgVideo.once("loadeddata", setScale);
            }
        }

        // ---- Spawner geometry (corner‑ring) ----
        if (SS.useSpawner) {
            const cornerDist = Math.hypot(SS.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
            this.rOuter = Math.max(0, cornerDist - SS.cornerMargin);
            this.rInner = Math.max(0, this.rOuter - SS.cornerBandWidth);
            const centerDeg = Phaser.Math.RadToDeg(Math.atan2(SS.height, SS.width));
            this.angleMinDeg = Math.max(0, centerDeg - SS.angleSpreadDeg);
            this.angleMaxDeg = Math.min(90, centerDeg + SS.angleSpreadDeg);
            if (this.angleMinDeg > this.angleMaxDeg) { const t = this.angleMinDeg; this.angleMinDeg = this.angleMaxDeg; this.angleMaxDeg = t; }
        }

        // ---- Reset round state ----
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

        // ---- DB Round ----
        const difficulty = this.registry.get("difficulty") || "normal";
        this.roundId = DB.beginRound(window.__SESSION_ID__, "SoapSplash", String(difficulty));

        // ---- Topbar (home / pause) ----
        this.topbar = systems.ui.topbar(this, {
            onHome: () => {
                this.finalizeRound?.("Home button");
                const playerName = this.registry.get("playerName");
                this.scene.start("GameScene", { playerName });
            },
            onPause: () => this.togglePause(),
        });

        // ---- Timer & typing attach on resume (Explain overlay pauses us first) ----
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
            systems.soapsplash.timer.init(this);
            this.gameStartAt = this.time.now;
            systems.soapsplash.typing.init(this);
        });

        // ---- Launch explain overlay then pause ourselves ----
        if (this.scene.getIndex("SoapSplashExplain") !== -1) {
            this.scene.launch("SoapSplashExplain", { parentKey: "SoapSplash" });
            this.scene.bringToTop("SoapSplashExplain");
            this.scene.pause("SoapSplash");
        }

        // ---- Background stage swapper ----
        this.setSoapSplashBackground = (breaches) => {
            const i = Math.min(breaches, this._bgKeys.length - 1);
            const k = this._bgKeys[i] || this._bgKeys[0];
            if (k && this.bgSprite.setTexture) this.bgSprite.setTexture(k);
        };

        // optional blur effect
        this.initSpotBlur?.();

        // finalize on shutdown (ensure DB round ends)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            if (!this.gameOver) this.finalizeRound("Scene shutdown");
        });
    }

    // -----------------------------
    // Play BG music if it exists; if not, try to lazy‑load once
    // -----------------------------
    _playBGMusicSafe() {
        const play = () => {
            if (!this.sound) return;
            if (!this.sound.get("BG_Music") && this.cache.audio.exists("BG_Music")) {
                const s = this.sound.add("BG_Music", { loop: true, volume: 0.4 });
                s.play();
            }
        };
        if (this.cache.audio.exists("BG_Music")) {
            play();
        } else {
            // Fallback attempt (keeps scene robust if another scene failed to preload)
            const fallback = CONFIG.assets?.audio?.bgMusic || "assets/sounds/bg_music.mp3";
            this.load.audio("BG_Music", fallback);
            this.load.once(Phaser.Loader.Events.COMPLETE, play);
            this.load.start();
        }
    }

    // -----------------------------
    // Round finalization (telemetry)
    // -----------------------------
    finalizeRound(reason = "Time up", overrides = {}) {
        if (this.gameOver) return;
        this.gameOver = true;
        if (!this.roundId) return;

        DB.finalizeRound(this.roundId, {
            score: overrides.score ?? this.streakSys?.totalScore ?? this.typing?.score ?? 0,
            bestStreak: overrides.bestStreak ?? this.streakSys?.bestStreak ?? this.typing?.bestStreak ?? 0,
            breaches: overrides.breaches ?? this.breaches ?? 0,
            baseScore: overrides.baseScore ?? this.streakSys?.baseScore ?? 0,
            multiplier: overrides.multiplier ?? (this.streakSys?.multiplier?.() || 0),
            reason,
        });
    }

    // -----------------------------
    // Per‑frame update — delegate to systems.soapsplash engines
    // -----------------------------
    update(time, delta) {
        if (this._paused || this.gameOver) return;

        // Spawn logic (defer to systems.soapsplash if configured)
        const SS = CONFIG.soapSplash;
        if (SS?.useSpawner && systems?.soapsplash?.spawn?.spawnGerm) {
            const now = this.time.now;
            if (!this._nextSpawnAt) this._nextSpawnAt = now + (SS.spawnIntervalMs || 1200);
            if (now >= this._nextSpawnAt) {
                systems.soapsplash.spawn.spawnGerm(this);
                const jitter = (SS.spawnJitterMs ?? 0);
                const base = (SS.spawnIntervalMs ?? 1200);
                this._nextSpawnAt = now + base + Phaser.Math.Between(-jitter, jitter);
            }
        }

        // Movement & rules
        systems?.soapsplash?.movement?.moveGerms?.(this, delta);
        systems?.soapsplash?.rules?.checkBreaches?.(this);

        // Timer HUD
        systems?.soapsplash?.timer?.updateHUD?.(this, time);
    }
}
