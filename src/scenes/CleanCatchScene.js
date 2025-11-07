/**
 *
 * Purpose in the system
 *   Hosts and orchestrates the “Clean Catch” aka soapsplasher mini-game. This scene bootstraps
 *   the gameplay runtime from systems.cleancatcher, owns the per-mini-game
 *   audio (“game” group), starts/finalizes DB rounds, and continuously mirrors
 *   the score into multiple surfaces (Phaser registry, localStorage, and a
 *   window global) so EndingScene can read totals reliably—even across scene
 *   transitions or reloads.
 *
 * Public surface: exported symbols
 *   export default class CleanCatchScene extends Phaser.Scene
 *   Scene key: "CleanCatch"
 *
 * Dependencies (internal + external) and why they’re chosen.
 *   - Phaser 3: scene lifecycle (preload/create/leave), timers, DOM layer for a sub-canvas.
 *   - ../systems.js: AudioManager for group-based BGM ownership; systems.cleancatcher for gameplay.
 *   - ../db.js: DB.beginSession/beginRound/finalizeRound/saveRound for telemetry + scoreboard totals.
 *   - Browser APIs: localStorage (score mirroring), window global (last-resort score visibility).
 *
 * Performance notes
 *   - Hot path is inside systems.cleancatcher; this scene mostly coordinates.
 *   - Score sampler is O(1) work every 250 ms; keep it ≥ 16 ms to avoid frame contention.
 *   - DOM canvas + resize listener: we detach on SHUTDOWN; leaking listeners will keep the scene alive, so dont.
 *   - Avoid synchronous localStorage thrash inside tight loops—here it’s batched by the sampler.
 *
 */

import systems from "../systems.js";
import { AudioManager } from "../systems.js";
import { DB } from "../db.js";

const Assets = CONFIG.assets;
const Audio = CONFIG.audio;


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

    /**
     * What it does
     *   Pushes the latest numeric score to all public mirrors.
     *
     * Parameters
     *   score: number — total points (>= 0). NaN/invalid coerced to 0.
     *
     * Returns
     *   void
     *
     * Side effects
     *   Writes to Phaser registry keys: "catch_score", "cleanCatchScore", "cc_score"
     *   Writes to localStorage with same keys; sets window.__CLEAN_CATCH_SCORE__.
     *
     * Preconditions / Postconditions
     *   Registry available; localStorage may throw (caught). After return, mirrors
     *   converge to the same numeric value.
     *
     * Determinism & idempotency
     *   Deterministic and idempotent for a given numeric input.
     */
    _pushCatchScore(score) {
        const s = Number(score) || 0;

        try {
            this.registry.set("catch_score", s);
            this.registry.set("cleanCatchScore", s);
            this.registry.set("cc_score", s);
        } catch {}

        try {
            localStorage.setItem("catch_score", String(s));
            localStorage.setItem("cleanCatchScore", String(s));
            localStorage.setItem("cc_score", String(s));
        } catch {}

        try { window.__CLEAN_CATCH_SCORE__ = s; } catch {}
    }

    // ─────────────────────────────────────────────────────────────
    // Snapshot score from whatever structure the runtime uses
    // ─────────────────────────────────────────────────────────────

    /**
     * What it does
     *   Adapts to multiple runtime score shapes and extracts a single number.
     *
     * Parameters
     *   none (reads this._runtime and systems helpers)
     *
     * Returns
     *   number — best guess of current total score (>= 0), or 0 if unknown.
     *
     * Side effects
     *   None (pure read with try/catch guards).
     *
     * Performance
     *   O(1): small fixed list of candidate lookups and a helper call.
     */

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

    /**
     * What it does
     *   Finalizes the round (one-shot), restores audio groups, and switches scenes.
     *
     * Parameters
     *   targetKey: string | undefined — scene key to start after leaving.
     *   data: any — payload forwarded to the next scene’s create/init.
     *
     * Returns
     *   void
     *
     * Side effects
     *   Stops "game" audio, resumes "global", stops this scene, starts target scene.
     *
     * Errors
     *   Internal try/catch around audio. Safe if AudioManager is missing.
     */
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

    /**
     * What it does
     *   Ensures minimal assets are present (idempotent cache checks).
     *
     * Params / Return
     *   none / void
     *
     * Notes
     *   Re-loading existing keys is avoided to keep loader lean and prevent duplicates.
     */
    preload() {
        this.load.image("dialog_skin", Assets.ui.dialogPanel);
        this.load.image("kiko_dialog", Assets.kiko.base);
        this.load.image("cc_sink_bg", Assets.cleanCatch.backgroundFullLives);
        this.load.audio("sfx_goodCatch", Audio.cleanCatchAudioGood);
        this.load.audio("sfx_badCatch", Audio.cleanCatchAudioBad );
        this.load.audio("sfx_beep", Audio.cleanCatchBeepAudio);
    }

    /**
     * What it does
     *   Wires audio ownership, (re)starts a DB session/round, mounts a sub-canvas,
     *   creates the Clean Catch runtime, and starts a periodic score sampler.
     *
     * Parameters
     *   data: { playerName?: string, difficulty?: number|string }
     *     - difficulty accepts 1|2|3 or "easy"|"normal"|"hard" (stored in registry).
     *
     * Returns
     *   void
     *
     * Side effects
     *   Pauses "global" audio group; begins DB round; writes mirrors every 250 ms;
     *   attaches resize/shutdown listeners.
     *
     * Preconditions / Postconditions
     *   Requires systems.cleancatcher.create(). After return, runtime is mounted
     *   and score mirrors begin updating.
     *
     * Determinism
     *   Deterministic given same inputs and deck suppliers; relies on systems engine.
     */
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

    /**
     * What it does
     *   Commits the best-known score to mirrors and DB, then closes the open
     *   round. Designed to be safe to call multiple times; only first call
     *   writes (by nulling _roundId).
     *
     * Parameters
     *   reason: string — label included in DB.finalizeRound metadata (default "finalize").
     *
     * Returns
     *   void
     *
     * Side effects
     *   Updates mirrors, calls DB.saveRound("CleanCatch", score, bestStreak),
     *   and DB.finalizeRound(roundId, {...}).
     *
     * Errors
     *   Wrapped; logs a warning and ensures _roundId is nulled to prevent loops.
     */
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
