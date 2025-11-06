// src/scenes/CleanCatchScene.js
// Clean Catch mini-game scene — patched so EndingScene scoreboard gets totals.

// overview
// this scene runs the Clean Catch mini game and keeps its score consistent across the app
// it owns audio for the game group starts and finalizes a DB round and exposes scores to EndingScene through registry localstorage and a window global
// most gameplay graphics are produced by systems cleancatcher with this scene acting as host and coordinator



import systems from "../systems.js";
import { AudioManager } from "../systems.js";
import { DB } from "../db.js";


// scene lifecycle and state
// the constructor initializes flags for runtime audio pause ui and scene leaving
// it also prepares round tracking fields that are written to DB and mirrored for the scoreboard
export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._runtime = null;
        this._paused = false;
        this._pauseUi = null;
        this._leaving = false;

        // Scoreboard/DB state
        this._roundId = null;
        this._bestStreak = 0;
        this._breaches = 0;
        this._scoreSampler = null;
    }



    // ─────────────────────────────────────────────────────────────
    // Score mirrors
    // ─────────────────────────────────────────────────────────────
    // central helper to push the latest score into three places
    // registry is the preferred in scene store localstorage survives scene switches and window global is a last resort read by EndingScene
    _pushCatchScore(score) {
        const s = Number(score) || 0;

        // Registry mirrors (multiple keys for compatibility)
        try {
            this.registry.set("catch_score", s);
            this.registry.set("cleanCatchScore", s);
            this.registry.set("cc_score", s);
        } catch {}

        // localStorage mirrors (fallback across scene reloads)
        try {
            localStorage.setItem("catch_score", String(s));
            localStorage.setItem("cleanCatchScore", String(s));
            localStorage.setItem("cc_score", String(s));
        } catch {}

        // Global mirror (EndingScene last-resort)
        try { window.__CLEAN_CATCH_SCORE__ = s; } catch {}
    }



    // ─────────────────────────────────────────────────────────────
    // Snapshot score from whatever structure the runtime uses
    // ─────────────────────────────────────────────────────────────
    // pulls a single numeric score from the runtime regardless of how the engine exposes it
    // tries getScore then common fields then a systems helper and finally returns zero
    _snapshotScoreFromRuntime() {
        const rt = this._runtime || {};

        // 1) Function-style API: getScore()
        try {
            if (typeof rt.getScore === "function") {
                const v = Number(rt.getScore());
                if (Number.isFinite(v)) return v;
            }
        } catch {}

        // 2) Common field candidates (flat / nested)
        const candidates = [
            rt.totalScore, rt.total, rt.score, rt.points,
            rt?.state?.totalScore, rt?.state?.total, rt?.state?.score, rt?.state?.points,
            rt?.stats?.totalScore, rt?.stats?.total, rt?.stats?.score, rt?.stats?.points,
            rt?.streakSys?.totalScore, rt?.streakSys?.score,
        ];
        for (const v of candidates) {
            const n = Number(v);
            if (Number.isFinite(n) && n >= 0) return n;
        }

        // 3) systems helper (if your team exposed it)
        try {
            const sysScore = systems?.cleancatcher?.getScore?.(this);
            const n = Number(sysScore);
            if (Number.isFinite(n)) return n;
        } catch {}

        // Fallback
        return 0;
    }



    // ─────────────────────────────────────────────────────────────
    // Always use this to leave the scene (finalizes first)
    // ─────────────────────────────────────────────────────────────
    // wrapper for all scene exits
    // guarantees _finalizeRoundSafe runs once and returns audio to the global group before switching to another scene
    leaveTo(targetKey, data) {
        if (this._leaving) return;
        this._leaving = true;

        // Finalize first so EndingScene can read totals immediately
        this._finalizeRoundSafe("scene-change");

        try {
            AudioManager.stop(this);
            AudioManager.stopGroup("game");
            AudioManager.resumeGroup("global");
        } catch {}

        this.scene.stop(this.scene.key);
        if (targetKey) this.scene.start(targetKey, data);
    }



    // ─────────────────────────────────────────────────────────────
    // Phaser lifecycle
    // ─────────────────────────────────────────────────────────────
    // preload ensures all minimal assets exist to avoid runtime errors in create
    // art and sfx keys are checked before loading so repeated entries do not duplicate cache items
    preload() {
        // Minimal art/sfx guards (kept from your original)
        if (!this.textures.exists("dialog_skin")) {
            this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        }
        if (!this.textures.exists("kiko_dialog")) {
            this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        }
        if (!this.textures.exists("cc_sink_bg")) {
            const A = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
            this.load.image("cc_sink_bg", A.background || "assets/images/CleanCatcher/1.jpg");
        }
        if (!this.cache.audio.exists("sfx_goodCatch"))
            this.load.audio("sfx_goodCatch", "assets/sounds/bubble pop Soap Splasher.wav");
        if (!this.cache.audio.exists("sfx_badCatch"))
            this.load.audio("sfx_badCatch", "assets/sounds/badPop.mp3");
        if (!this.cache.audio.exists("sfx_beep"))
            this.load.audio("sfx_beep", "assets/sounds/timerSound.m4a");
    }



    // create wires the scene together
    // it stores player and difficulty info owns the game audio starts or resumes a DB session and round builds a html canvas host and creates the cleancatcher runtime via systems
    // it also installs a periodic sampler that mirrors score fields and sets up cleanup on shutdown
    create(data) {
        if (data?.difficulty) this.registry.set("difficulty", data.difficulty);
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        const { width, height } = this.scale;

        // Audio ownership
        AudioManager.pauseGroup("global");
        const killGameAudio = () => {
            try {
                AudioManager.stop(this);
                AudioManager.stopGroup("game");
                AudioManager.resumeGroup("global");
            } catch {}
        };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, killGameAudio);
        this.events.once(Phaser.Scenes.Events.SLEEP,    killGameAudio);
        this.events.once(Phaser.Scenes.Events.DESTROY,  killGameAudio);

        // Host canvas for runtime
        const rootEl = document.createElement("div");
        const root = this.add.dom(0, 0, rootEl).setOrigin(0, 0).setDepth(1);
        const canvas = document.createElement("canvas");
        canvas.style.display = "block";
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width;
        canvas.height = height;
        root.node.appendChild(canvas);

        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";
        this.registry.set("difficulty", difficulty);

        // DB round start (creates session if needed)
        try {
            const sid =
                window.__SESSION_ID__ ||
                DB?.getSessionId?.() ||
                this.registry.get("sessionId") ||
                DB.beginSession?.(this.registry.get("playerName") || "Player");

            if (sid && !window.__SESSION_ID__) window.__SESSION_ID__ = sid;
            if (sid) this._roundId = DB.beginRound?.(sid, "CleanCatch", String(difficulty)) ?? null;
        } catch (e) {
            console.warn("[CleanCatch] beginRound failed (non-fatal):", e);
        }

        // Word suppliers (if provided by CONFIG)
        if (CONFIG?.cleanCatch?.resetDecks && CONFIG?.cleanCatch?.nextGood && CONFIG?.cleanCatch?.nextBad) {
            CONFIG.cleanCatch.resetDecks();
            this.nextGoodLabel = () => CONFIG.cleanCatch.nextGood() || "clean";
            this.nextBadLabel  = () => CONFIG.cleanCatch.nextBad()  || "germ";
        } else {
            this.nextGoodLabel = () => "clean";
            this.nextBadLabel  = () => "germ";
        }

        // Create runtime
        const opts = { nextGood: this.nextGoodLabel, nextBad: this.nextBadLabel };
        const rt =
            systems.cleancatcher.create?.(this, canvas, difficulty, opts) ||
            systems.cleancatcher.create?.(this, canvas, difficulty);
        this._runtime = rt;

        // Initialize mirrors to 0
        this._pushCatchScore(0);

        // Optional runtime → scene score event
        this.events.on("CC:score", (s) => {
            if (s && typeof s.score === "number") this._pushCatchScore(s.score);
            if (s && typeof s.bestStreak === "number") this._bestStreak = s.bestStreak;
            if (s && typeof s.breaches === "number") this._breaches = s.breaches;
        });

        // Periodic sampler (keeps mirrors fresh)
        if (this._scoreSampler?.remove) this._scoreSampler.remove();
        this._scoreSampler = this.time.addEvent({
            delay: 250,
            loop: true,
            callback: () => {
                const s = this._snapshotScoreFromRuntime();
                this._pushCatchScore(s); // updates registry, localStorage, global
            }
        });

        // Responsive canvas
        const onResize = (gs) => {
            const w = gs.width, h = gs.height;
            canvas.width = w;  canvas.style.width = `${w}px`;
            canvas.height = h; canvas.style.height = `${h}px`;
        };
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this._finalizeRoundSafe("shutdown");
            try { this._scoreSampler?.remove?.(); } catch {}
            this._scoreSampler = null;
            this._runtime?.destroy?.();
            root.destroy();
            this._pauseUi?.destroy?.();
            this._pauseUi = null;
        });
    }



    // ─────────────────────────────────────────────────────────────
    // Finalize exactly once — records a round and prevents duplicates
    // ─────────────────────────────────────────────────────────────
    // finalization writes the best known score to mirrors logs a saveRound entry for EndingScene totals and calls DB finalize for analytics
    // it guards against duplicate calls and tries to recover a zero score from mirrors before giving up
    _finalizeRoundSafe(reason = "finalize") {
        try {
            if (!this._roundId) return; // already finalized or never started

            // Prefer latest snapshot; if NaN/neg, clamp to 0
            let score = this._snapshotScoreFromRuntime();
            if (!Number.isFinite(score) || score < 0) score = 0;

            // If zero, try mirrors (registry/localStorage/global) before giving up
            if (score === 0) {
                const reg = Number(
                    this.registry.get("catch_score") ??
                    this.registry.get("cleanCatchScore") ??
                    this.registry.get("cc_score") ?? 0
                );
                let ls = 0, gl = 0;
                try {
                    ls = Number(
                        localStorage.getItem("catch_score") ??
                        localStorage.getItem("cleanCatchScore") ??
                        localStorage.getItem("cc_score") ?? 0
                    );
                } catch {}
                try { gl = Number(window.__CLEAN_CATCH_SCORE__ ?? 0); } catch {}
                const pick = Math.max(0, (Number.isFinite(reg) ? reg : 0), (Number.isFinite(ls) ? ls : 0), (Number.isFinite(gl) ? gl : 0));
                if (pick > 0) score = pick;
            }

            // Keep mirrors aligned (registry/localStorage/global)
            this._pushCatchScore(score);

            // IMPORTANT: EndingScene sums saveRound() entries
            try { DB.saveRound?.("CleanCatch", score, this._bestStreak || 0); } catch {}

            // Also finalize the open round
            DB.finalizeRound?.(this._roundId, {
                score,
                bestStreak: this._bestStreak || 0,
                breaches: this._breaches || 0,
                reason
            });

            // Prevent double finalize
            this._roundId = null;
        } catch (e) {
            console.warn("[CleanCatch] finalizeRound failed:", e);
            this._roundId = null;
        }
    }
}
