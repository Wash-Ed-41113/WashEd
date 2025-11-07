/**
 * MODULE: EndingScene + reset helpers
 *
 * Purpose in the system
 * ---------------------
 * Provides the final "scoreboard / celebration" scene for Kiko’s Day and two small
 * utilities for defensively collecting totals and fully resetting the app state.
 * It coordinates audio groups, renders a responsive scoreboard, delivers a short
 * congratulatory message, spawns light confetti FX, and offers a "Play Again"
 * control that hard-resets the flow.
 *
 * Public surface (exported)
 * -------------------------
 * - default export class `EndingScene` (Phaser.Scene)
 *   (This file does not export its helper functions; they are file-local.)
 *
 * Invariants this module maintains
 * --------------------------------
 * - Ending scene never assumes DB availability; scoreboard totals are derived
 *   defensively from multiple mirrors (registry, localStorage, window) so it
 *   never crashes if a previous scene skipped persistence.
 * - Audio groups: "game" is stopped and "global" is resumed before we leave.
 * - Confetti spawner honors a hard cap (`MAX_LIVE_CONFETTI`) to avoid runaway
 *   allocations and is canceled on shutdown.
 *
 * Dependencies
 * ----------------------
 * - `../systems.js` → UI helpers and `AudioManager` for group-aware BGM control.
 *   Chosen to centralize audio routing (pause global when a game track plays,
 *   resume global on scene end) and to keep UI bits consistent.
 * - Phaser runtime (global) for Scene, tweens, time, geometry masks, etc.
 * - `CONFIG` (global) for asset keys and UI defaults.
 *
 */

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const ENTRY_SCENE = "MenuScene";

/**
 * Return a displayable player name from the most reliable source available.
 *
 * @param {Phaser.Scene} scene - Current scene (may or may not have registry).
 * @returns {string} Name suitable for UI; defaults to "Player".
 *
 * Side effects: none.
 * Preconditions: none (tolerates missing registry/window).
 * Postconditions: never throws.
 * Determinism & idempotency: deterministic, idempotent.
 * Performance: O(1).
 */
function getPlayerName(scene) {
    try {
        const r = scene.registry?.get?.("playerName");
        if (r) return String(r);
    } catch {}
    try {
        const w = (typeof window !== "undefined" && (window.__PLAYER_NAME__ || window.playerName));
        if (w) return String(w);
    } catch {}
    return "Player";
}

/**
 * Collect scoreboard totals without relying on the DB layer.
 *
 * What it does (not how):
 *   Pulls Clean Catch and Soap Splash scores from multiple mirrors
 *   (window, localStorage, game/scene registry) and returns normalized totals.
 *
 * @param {Phaser.Scene} scene - The scene requesting totals.
 * @returns {{soapSplasher:number, germScrubber:number, grand:number}}
 *   - soapSplasher: Clean Catch total (historical naming kept for UI)
 *   - germScrubber: Soap Splash total
 *   - grand: sum of the two
 *
 * Side effects:
 *   - Reads window and web storage; no writes.
 *
 * Preconditions / Postconditions:
 *   - Works even if none of the mirrors exist; returns zeros.
 *   - Prefers `_handoff.scores` when present to keep transitions deterministic.
 *
 * Errors:
 *   - Swallows storage access errors (e.g., privacy mode) and continues.
 *
 * Performance:
 *   - O(1) fixed set of mirrors; no iteration over dynamic collections.
 *
 * Determinism & idempotency:
 *   - Deterministic given the same mirrors; idempotent.
 */
function getTotalsNoDB(scene) {
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const regGet = (s, key) => {
        try { return s?.registry?.get?.(key); } catch { return undefined; }
    };
    const gameRegGet = (s, key) => {
        try { return s?.game?.registry?.get?.(key); } catch { return undefined; }
    };
    const win = (typeof window !== "undefined") ? window : undefined;

    if (scene?._handoff?.scores) {
        const cc = toNum(scene._handoff.scores.cc);
        const ss = toNum(scene._handoff.scores.ss);
        return { soapSplasher: cc, germScrubber: ss, grand: cc + ss };
    }
    let cc = 0;
    cc = cc || toNum(win?.__CLEAN_CATCH_SCORE__);
    try { cc = cc || toNum(localStorage.getItem("cc_score")); } catch {}
    cc = cc || toNum(gameRegGet(scene, "cc_score"));
    cc = cc || toNum(regGet(scene, "cc_score"));

    let ss = 0;
    ss = ss || toNum(win?.__SS_LAST_SCORE__?.total);
    try { ss = ss || toNum(localStorage.getItem("ss_score")); } catch {}
    ss = ss || toNum(gameRegGet(scene, "ss_score"));
    ss = ss || toNum(regGet(scene, "ss_score"));

    return {
        soapSplasher: cc,
        germScrubber: ss,
        grand: cc + ss,
    };
}

/**
 * Wipe gameplay progress mirrors (registries, globals, storage) for a clean start.
 *
 * Responsibility:
 *   Normalize the app to a "fresh session" by clearing likely keys across the
 *   scene registry, window globals, and local/session storage.
 *
 * @param {Phaser.Scene} scene - Scene providing a registry to clear.
 * @returns {void}
 *
 * Side effects:
 *   - Mutates `scene.registry`, `window` globals, `localStorage`, `sessionStorage`.
 *
 * Invariants:
 *   - Leaves no required key in an inconsistent state if a container is missing.
 *
 * Errors:
 *   - All operations are try/catch guarded; failures are ignored (best-effort).
 *
 * Determinism:
 *   - Idempotent: repeated calls produce the same cleared state.
 */
function _clearProgressFlags(scene) {

    const KEYS = [

        "cc_done", "cleanCatchDone", "cleanCatchPlayed", "hasPlayedCleanCatch",
        "ss_done", "soapSplashDone", "soapSplashPlayed", "hasPlayedSoapSplash",

        "bathroom:ccComplete", "bathroom:soapComplete", "bathroom:ccLocked",
        "flow:enteredBathroom", "flow:enteredPlayground", "flowStage",

        "visitedPlayground", "difficulty",

        "playerName", "cc_score", "ss_score",
        "cc:lastScore", "ss:lastScore", "ss:lastBestStreak",
        "sessionId"
    ];

    for (const k of KEYS) {
        try { scene.registry.set(k, false); } catch {}
        try { scene.registry.remove(k); } catch {}
    }

    try {
        if (typeof window !== "undefined") {
            window.__PLAYER_NAME__      = null;
            window.__CC_LAST_SCORE__    = null;
            window.__CLEAN_CATCH_SCORE__= null;
            window.__SS_LAST_SCORE__    = null;
            window.__SESSION_ID__       = null;

            window.__SOAP_SPLASH_PLAYED__ = false;
            window.__CLEAN_CATCH_PLAYED__ = false;
        }
    } catch {}

    try {
        localStorage.removeItem("cc_score");
        localStorage.removeItem("ss_score");
        sessionStorage.removeItem("cc_score");
        sessionStorage.removeItem("ss_score");
    } catch {}
}

/**
 * Hard reset the experience and jump back to the entry scene.
 *
 * What it does:
 *   Clears progress mirrors, stops sounds/tweens/timers, restores "global" audio
 *   group, and starts the ENTRY_SCENE with `{ resetSession: true }`.
 *
 * @param {Phaser.Scene} scene - Current scene.
 * @returns {Promise<void>} A resolved promise after the scene switch is scheduled.
 *
 * Side effects:
 *   - Kills timers/tweens; stops audio; changes scene.
 *
 * Preconditions / Postconditions:
 *   - Safe to call at any time; guarantees that the entry scene runs next.
 *
 * Errors:
 *   - All sub-steps are wrapped in try/finally; scene transition always attempted.
 *
 * Reentrancy:
 *   - Not intended for concurrent calls; callers should guard if needed.
 *
 * Performance:
 *   - O(1) over a few manager calls; no polling or long loops.
 */
async function fullResetAndGotoStart(scene) {
    try {
        _clearProgressFlags(scene);

        try { scene.sound?.stopAll?.(); } catch {}
        try { scene.tweens?.killAll?.(); } catch {}
        try { scene.time?.removeAllEvents?.(); } catch {}

        try { AudioManager.stopGroup?.("game"); } catch {}
        try { AudioManager.resumeGroup?.("global"); } catch {}
    } finally {
        try { scene.scene.stop(); } catch {}
        scene.scene.start(ENTRY_SCENE, { resetSession: true });
    }
}

/**
 * Class: EndingScene (Phaser.Scene)
 *
 * Responsibility (1 sentence):
 *   Render the celebration/scoreboard screen, route audio back to "global",
 *   and offer a safe "Play Again" reset path.
 *
 * Collaborators & invariants:
 *   - Uses `AudioManager` to stop "game" and resume "global" group (invariant:
 *     never leaves game music playing).
 *   - Reads totals via `getTotalsNoDB` (invariant: never throws on missing DB).
 *
 * Construction & lifecycle:
 *   - Created by Phaser when `this.scene.start("EndingScene", data)` is called.
 *   - `init(data)` stores `_handoff`; `preload()` ensures assets; `create()`
 *     lays out UI, plays ending music (if present), runs confetti loop, and
 *     restores global audio.
 *   - On shutdown/destroy, cancels confetti and stops music.
 *
 * Thread-safety / mutability:
 *   - Main-thread only; mutates instance fields (`music`, `_confettiCancelled`).
 *
 * Complexity hotspots:
 *   - None significant; confetti loop is small and bounded.
 *
 * Serialization / format:
 *   - Accepts optional `_handoff` data (e.g., `{ scores: { cc, ss } }`), but does
 *     not persist anything.
 *
 * Example:
 *   this.scene.start("EndingScene", { scores: { cc: 220, ss: 140 } });
 *
 * Smell to call out:
 *   - If this scene grows to handle multiple scoreboard styles or flows, consider
 *     splitting UI builders (scoreboard, dialog, confetti) into separate modules.
 */
export default class EndingScene extends Phaser.Scene {
    constructor() {
        super("EndingScene");
        this.music = null;
        this._confettiCancelled = false;
        this._handoff = null;
    }

    /**
     * Capture optional handoff payload for later use.
     * @param {object} [data] - Optional payload (e.g., `{ scores: {...} }`).
     * @returns {void}
     * Side effects: sets `this._handoff`.
     * Determinism: deterministic.
     */
    init(data) {
        this._handoff = data || null;
    }

    /**
     * Ensure textures used by the ending screen exist in cache.
     * Loads only by known keys from CONFIG to avoid duplicate entries.
     * @returns {void}
     */
    preload() {

        this.load.image("kiko_cheer", CONFIG.assets.kiko.cheer);
        this.load.image("confetti", CONFIG.assets.backgrounds.confetti);
        this.load.image("dialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("classroom_bg", CONFIG.assets.backgrounds.classroon);
    }

    /**
     * Create (if missing) and cache a simple rounded-rect button texture sized to viewport.
     *
     * @param {number} [scaleHint=1] - Extra scale factor applied to base size.
     * @returns {string} Texture key to use with `this.add.image(...)`.
     *
     * Side effects: generates a texture in Phaser's cache under a stable key.
     * Performance: O(1) immediate-mode draw; reused after first call.
     * Determinism: deterministic per viewport size.
     */
    _ensureEasyBtnTexture(scaleHint = 1) {
        const key = "btn_diff_easy";
        if (this.textures.exists(key)) return key;
        const btnW = Math.min(this.scale.width * 0.22, 360) * scaleHint;
        const btnH = Math.min(this.scale.height * 0.12, 120) * scaleHint;
        const radius = Math.round(btnH * 0.28);
        const g = this.add.graphics();
        g.fillStyle(0xB9FBC0, 1);
        g.fillRoundedRect(0, 0, btnW, btnH, radius);
        g.lineStyle(Math.max(3, Math.round(3 * scaleHint)), 0x073b4c, 0.35);
        g.strokeRoundedRect(0, 0, btnW, btnH, radius);
        g.generateTexture(key, btnW, btnH);
        g.destroy();
        return key;
    }

    /**
     * Build a "Play Again" button fixed to the viewport with subtle hover tween.
     * On click: disables interactions, cancels confetti, stops audio, and reloads.
     *
     * @returns {void}
     * Side effects: mutates scene display list; calls `location.reload()`.
     * Preconditions: should be called after `create()` when camera/UI exist.
     * Reentrancy: guarded by disabling interaction on first click.
     */
    _addPlayAgainButton() {
        const { width, height } = this.scale;
        const texKey = this._ensureEasyBtnTexture(1);

        const x = Math.round(width * 0.14);
        const y = Math.round(height * 0.90);

        const img = this.add.image(x, y, texKey)
            .setOrigin(0.5)
            .setDepth(1000)              // way above everything
            .setScrollFactor(0)          // stick to screen, not world/camera
            .setInteractive({ useHandCursor: true });

        const label = this.add.text(x, y, "Play Again", {
            fontFamily: (window.CONFIG?.ui?.fontFamily) || "Montserrat",
            color: "#073B4C",
            align: "center",
        })
            .setOrigin(0.5, 0.55)
            .setDepth(1001)
            .setScrollFactor(0);

        const btnH = img.displayHeight || 100;
        label.setFontSize(Math.round(btnH * 0.35));

        const base = { y: img.y, ly: label.y, sI: img.scale, sL: label.scale };
        img.on("pointerover", () => {
            this.tweens.add({ targets: img,   scale: base.sI * 1.04, y: base.y  - 4, duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL * 1.04, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
        });
        img.on("pointerout", () => {
            this.tweens.add({ targets: img,   scale: base.sI, y: base.y,  duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL, y: base.ly, duration: 120, ease: "Sine.easeOut" });
        });

        const go = () => {
            img.disableInteractive(); label.disableInteractive();
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch {}
            try { this.sound?.stopAll?.(); } catch {}
            location.reload();
        };
        img.on("pointerup", go);
        label.on("pointerup", go);

        this.children.bringToTop(img);
        this.children.bringToTop(label);
    }

    /**
     * Orchestrate the entire ending flow:
     * - Stop prior mini-game scenes.
     * - Compute totals (defensively).
     * - Lay out background, Kiko animation, scoreboard, congratulatory dialog.
     * - Start bounded confetti loop.
     * - Resume "global" audio group and fade in.
     *
     * @returns {void}
     *
     * Side effects:
     *   - Starts/stops audio; creates tweens and delayed calls; registers shutdown
     *     cleanup; updates display list.
     *
     * Postconditions:
     *   - Confetti loop stops on shutdown; music is stopped/destroyed.
     *
     * Determinism:
     *   - UI layout is deterministic; one message is picked randomly from the tier.
     *
     * Performance caveats:
     *   - Confetti population capped via `MAX_LIVE_CONFETTI`; no leaks on destroy.
     */
    create() {
        const { width, height } = this.scale;

        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        }

        try {
            this.scene.stop("CleanCatch");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplash");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        const playerName = getPlayerName(this);
        const totals = getTotalsNoDB(this); // { soapSplasher, germScrubber, grand }

        this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);

        const kiko = this.add.image(width * 0.16, height * 0.90, "kiko_cheer")
            .setOrigin(0.5, 1)
            .setDisplaySize(Math.min(650, width * 0.38), Math.min(650, height * 0.85))
            .setDepth(40);
        const jumpH = Math.round(height * 0.04);
        const jumpD = 520;
        this.tweens.add({ targets: kiko, y: kiko.y - jumpH, duration: jumpD, ease: "Sine.inOut", yoyo: true, repeat: -1 });
        this.tweens.add({
            targets: kiko,
            scaleX: { from: kiko.scaleX, to: kiko.scaleX * 1.06 },
            scaleY: { from: kiko.scaleY, to: kiko.scaleY * 0.92 },
            duration: 120, yoyo: true, repeat: -1, repeatDelay: jumpD - 120
        });

        systems.ui.placeLogo(this);

        {
            const W = width, H = height;
            const board = { x: W * 0.56, y: H * 0.14, w: W * 0.70, h: H * 0.70 };
            const clip = this.add.graphics().fillStyle(0x000000, 0).fillRect(board.x, board.y, board.w, board.h);
            const mask = clip.createGeometryMask();

            const titleFS = Math.max(56, Math.round(H * 0.07));
            const lineFS  = Math.max(40, Math.round(H * 0.05));

            const styleTitle = {
                fontFamily: "Chewy",
                fontSize: `${titleFS}px`,
                color: "#F3F0E6",
                align: "left",
                wordWrap: { width: board.w - 20 }
            };
            const styleLine  = {
                fontFamily: "Chewy",
                fontSize: `${lineFS}px`,
                color: "#F3F0E6",
                align: "left",
                wordWrap: { width: board.w - 20 }
            };

            const c  = this.add.container(board.x, board.y).setDepth(5).setMask(mask);

            const t1 = this.add.text(0, 0, "Scoreboard", styleTitle).setOrigin(0, 0);
            const t2 = this.add.text(0, titleFS + 12, playerName, styleLine).setOrigin(0, 0);

            const rowGap = Math.round(lineFS * 0.95);
            const yBase  = titleFS + 12 + lineFS + 14;

            const l1 = this.add.text(0, yBase,              `Soap Splasher: ${totals.soapSplasher}`, styleLine).setOrigin(0, 0);
            const l2 = this.add.text(0, yBase + rowGap,     `Germ Scrubber: ${totals.germScrubber}`, styleLine).setOrigin(0, 0);
            const l3 = this.add.text(0, yBase + rowGap * 2, `Grand Total: ${totals.grand}`,          styleLine).setOrigin(0, 0);

            c.add([t1, t2, l1, l2, l3]);
            [t1, t2, l1, l2, l3].forEach(t => t.setShadow(0, 1, "#FFFFFF22", 2));
        }

        const lines = {
            high: [
                `Great work, ${playerName}! Because of you, Kiko is happy, healthy, and ready for more fun.`,
                `Amazing ${playerName}! You helped Kiko every step of the way. Those germs didn’t stand a chance!`,
                // Day → capital D
                `Wow ${playerName}! You made Kiko’s Day super clean and helped him stay healthy. You're a true WASH Hero!`
            ],
            medium: [
                `Awesome ${playerName}! You helped Kiko finish his day with clean hands!`,
                `Great job ${playerName}! You guided Kiko through the whole day - and look, his hands are clean and safe.`,
                `Nice work ${playerName}! You kept Kiko healthy. Each try makes you stronger!`
            ],
            low: [
                // Day → capital D, and new ending sentence with full stop
                `Thanks for your help, ${playerName}! You finished Kiko’s Day and learned how to stay clean and healthy. Next time, you'll score even higher.`,
                `Good effort ${playerName}! You know how to stay clean and safe. Let’s play again and keep practicing!`,
                `Yay ${playerName}! You finished your adventure with Kiko! Every try makes you a better WASH Hero - don't give up!`
            ]
        };

        const tier = (totals.grand >= 500 ? "high" : totals.grand >= 250 ? "medium" : "low");

        const dialogY = height * 0.97;

        const dialog = this.add.image(width * 0.58, dialogY, "dialogPanel")
            .setOrigin(0.5, 1).setAlpha(0).setDepth(25).setScale(0.5);

        const panelW = dialog.width  * dialog.scaleX;
        const panelH = dialog.height * dialog.scaleY;

        const msgFontPx = Math.max(28, Math.round(panelH * 0.085));
        const msgWrapW  = Math.round(panelW * 0.78);

        const panelCenterY = dialogY - (panelH / 2);

        const selected = (()=>{
            const arr = lines[tier];
            return arr[Math.floor(Math.random() * arr.length)];
        })();

        const msg = this.add.text(width * 0.58, panelCenterY, selected, {
            fontFamily: "Montserrat",
            fontSize: `${msgFontPx}px`,
            color: "#000000",
            wordWrap: { width: msgWrapW },
            align: "center"
        }).setOrigin(0.5).setAlpha(0).setDepth(26);

        this.tweens.add({ targets: dialog, alpha: 1, duration: 600, ease: "Sine.inOut" });
        this.tweens.add({ targets: msg,    alpha: 1, duration: 800, ease: "Sine.inOut", delay: 200 });

        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this._confettiCancelled = false;

        const shoot = (x, y, pieces = 6) => {
            if (this._confettiCancelled || this.liveConfetti >= this.MAX_LIVE_CONFETTI) return;
            const count = Math.min(pieces, this.MAX_LIVE_CONFETTI - this.liveConfetti);
            for (let i = 0; i < count; i++) {
                const img = this.add.image(x, y, "confetti")
                    .setScale(Phaser.Math.FloatBetween(0.18, 0.28))
                    .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
                    .setAlpha(1).setDepth(5);
                this.liveConfetti++;
                const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
                const dist = Phaser.Math.FloatBetween(200, 400);
                this.tweens.add({
                    targets: img,
                    x: x + Math.cos(ang) * dist,
                    y: y + Math.sin(ang) * dist,
                    rotation: "+=" + Phaser.Math.FloatBetween(2, 4),
                    alpha: 0,
                    duration: Phaser.Math.Between(900, 1300),
                    ease: "Cubic.easeOut",
                    onComplete: () => { img.destroy(); this.liveConfetti--; }
                });
            }
        };

        const loop = () => {
            if (this._confettiCancelled) return;
            shoot(
                Phaser.Math.Between(this.scale.width * 0.1, this.scale.width * 0.9),
                Phaser.Math.Between(this.scale.height * 0.15, this.scale.height * 0.75),
                Phaser.Math.Between(5, 8)
            );
            this.time.delayedCall(Phaser.Math.Between(this.DELAY_MIN, this.DELAY_MAX), loop);
        };
        loop();

        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
            AudioManager.play(this, "global_bg", { group: "global", volume: 0.6 });
        } catch {}

        this.cameras.main.fadeIn(600, 0, 0, 0);
        this._addPlayAgainButton();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch {}
            this.music?.destroy?.(); this.music = null;
        });
    }
}
