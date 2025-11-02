// src/scenes/EndingScene.js
/* global Phaser, CONFIG */
import systems from "../systems.js";
// import { DB } from "../db.js";            // ❌ No DB anymore
import { AudioManager } from "../systems.js";

/**
 * Entry scene to restart the whole flow (your video + Start button lives here).
 * Change to "PreloadScene" if that's your true first scene.
 */
const ENTRY_SCENE = "MenuScene";

/* -------------------------------------------------------------------------- */
/*                               NO-DB HELPERS                                */
/* -------------------------------------------------------------------------- */

// Player name: prefer registry, fallback to window
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

// Scores: prefer registry mirrors from scenes, fallback to window mirrors
// LEADERBOARDDD
//  - "Soap Splasher" row shows CLEAN CATCH total
//  - "Germ Scrubber" row shows SOAP SPLASH total
// Scores: prefer registry mirrors from scenes, fallback to window mirrors
// LEADERBOARDDD
//  - "Soap Splasher" row shows CLEAN CATCH total
//  - "Germ Scrubber" row shows SOAP SPLASH total
function getTotalsNoDB(scene) {
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    // tiny helpers to avoid unsafe property walks
    const regGet = (s, key) => {
        try { return s?.registry?.get?.(key); } catch { return undefined; }
    };
    const gameRegGet = (s, key) => {
        try { return s?.game?.registry?.get?.(key); } catch { return undefined; }
    };
    const win = (typeof window !== "undefined") ? window : undefined;

    // Priority: data passed directly via scene.start()
    if (scene?._handoff?.scores) {
        const cc = toNum(scene._handoff.scores.cc);
        const ss = toNum(scene._handoff.scores.ss);
        return { soapSplasher: cc, germScrubber: ss, grand: cc + ss };
    }

    // Clean Catch ("Soap Splasher") score
    let cc = 0;
    cc = cc || toNum(win?.__CLEAN_CATCH_SCORE__);
    try { cc = cc || toNum(localStorage.getItem("cc_score")); } catch {}
    cc = cc || toNum(gameRegGet(scene, "cc_score"));
    cc = cc || toNum(regGet(scene, "cc_score"));

    // Soap Splash ("Germ Scrubber") score
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


/* -------------------------------------------------------------------------- */
/*                       PROGRESS / GATING FLAGS CLEAR                        */
/* -------------------------------------------------------------------------- */

function _clearProgressFlags(scene) {
    // All gating + mirrors we’ve used across scenes
    const KEYS = [
        // mini-game completion / gating
        "cc_done", "cleanCatchDone", "cleanCatchPlayed", "hasPlayedCleanCatch",
        "ss_done", "soapSplashDone", "soapSplashPlayed", "hasPlayedSoapSplash",
        // bathroom / flow
        "bathroom:ccComplete", "bathroom:soapComplete", "bathroom:ccLocked",
        "flow:enteredBathroom", "flow:enteredPlayground", "flowStage",
        // misc state
        "visitedPlayground", "difficulty",
        // mirrors / scores / identity
        "playerName", "cc_score", "ss_score",
        "cc:lastScore", "ss:lastScore", "ss:lastBestStreak",
        "sessionId"
    ];

    // Registry
    for (const k of KEYS) {
        try { scene.registry.set(k, false); } catch {}
        try { scene.registry.remove(k); } catch {}
    }

    // Window mirrors (belt & braces)
    try {
        if (typeof window !== "undefined") {
            window.__PLAYER_NAME__      = null;
            window.__CC_LAST_SCORE__    = null;
            window.__CLEAN_CATCH_SCORE__= null;
            window.__SS_LAST_SCORE__    = null;
            window.__SESSION_ID__       = null;

            // optional: any ad-hoc booleans you used anywhere
            window.__SOAP_SPLASH_PLAYED__ = false;
            window.__CLEAN_CATCH_PLAYED__ = false;
        }
    } catch {}

    // Local/session storage (only if you used these keys)
    try {
        localStorage.removeItem("cc_score");
        localStorage.removeItem("ss_score");
        sessionStorage.removeItem("cc_score");
        sessionStorage.removeItem("ss_score");
    } catch {}
}


/* -------------------------------------------------------------------------- */
/*                         FULL RESET (NO DB; PURE UI)                        */
/* -------------------------------------------------------------------------- */

/** Full app reset → go back to the very first entry scene (no DB). */
async function fullResetAndGotoStart(scene) {
    try {
        // Clear gating + mirrors
        _clearProgressFlags(scene);

        // Kill audio/timers/tweens gracefully
        try { scene.sound?.stopAll?.(); } catch {}
        try { scene.tweens?.killAll?.(); } catch {}
        try { scene.time?.removeAllEvents?.(); } catch {}

        // Make sure game SFX group is down and global is free to resume in Menu
        try { AudioManager.stopGroup?.("game"); } catch {}
        try { AudioManager.resumeGroup?.("global"); } catch {}
    } finally {
        try { scene.scene.stop(); } catch {}
        // 👇 This is the key bit that your plan called out
        scene.scene.start(ENTRY_SCENE, { resetSession: true });
    }
}


/* -------------------------------------------------------------------------- */
/*                                   SCENE                                    */
/* -------------------------------------------------------------------------- */

export default class EndingScene extends Phaser.Scene {
    constructor() {
        super("EndingScene");
        this.music = null;
        this._confettiCancelled = false;
        // this._btnPlayAgain = null;
        this._handoff = null; // cache data passed from the previous scene
    }

    init(data) {
        this._handoff = data || null;
    }


    preload() {
        // Art used here
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", CONFIG.assets.ui.dialogPanel);
        // this.load.image("homeResetButton", "assets/images/UI/washed_kikos-day_UI-Button_HOME.png"); // ❌ kept commented
        this.load.image("classroom_bg", "assets/images/background/Classroom.png");
    }

    /** Create (or reuse) a rounded “Easy-style” button texture. */
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

    /** Fixed Play Again button (same position as original, hard reload). */
    _addPlayAgainButton() {
        const { width, height } = this.scale;
        const texKey = this._ensureEasyBtnTexture(1);

        // same coords as your original version
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

        // responsive label size
        const btnH = img.displayHeight || 100;
        label.setFontSize(Math.round(btnH * 0.35));

        // hover micro-anim
        const base = { y: img.y, ly: label.y, sI: img.scale, sL: label.scale };
        img.on("pointerover", () => {
            this.tweens.add({ targets: img,   scale: base.sI * 1.04, y: base.y  - 4, duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL * 1.04, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
        });
        img.on("pointerout", () => {
            this.tweens.add({ targets: img,   scale: base.sI, y: base.y,  duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL, y: base.ly, duration: 120, ease: "Sine.easeOut" });
        });

        // original behavior: hard page reload
        const go = () => {
            img.disableInteractive(); label.disableInteractive();
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch {}
            try { this.sound?.stopAll?.(); } catch {}
            location.reload();
        };
        img.on("pointerup", go);
        label.on("pointerup", go);

        // ensure topmost if anything new is added later
        this.children.bringToTop(img);
        this.children.bringToTop(label);
    }

    create() {
        const { width, height } = this.scale;

        // BGM (optional)
        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        }

        // Ensure minigames are stopped by their scene keys
        try {
            this.scene.stop("CleanCatch");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplash");
            this.scene.stop("SoapSplashExplain");
        } catch {}


        // Totals (NO DB)
        const playerName = getPlayerName(this);
        const totals = getTotalsNoDB(this); // { soapSplasher, germScrubber, grand }

        // Background
        this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);

        // Kiko celebratory sprite (kept ABOVE dialog bubble)
        const kiko = this.add.image(width * 0.16, height * 0.90, "kiko_cheer")
            .setOrigin(0.5, 1)
            .setDisplaySize(Math.min(650, width * 0.38), Math.min(650, height * 0.85))
            .setDepth(40);
        // Gentle hop animation
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

        /* ---------------------------- Chalkboard UI ---------------------------- */
        {
            const W = width, H = height;
            const board = { x: W * 0.56, y: H * 0.14, w: W * 0.70, h: H * 0.70 };
            const clip = this.add.graphics().fillStyle(0x000000, 0).fillRect(board.x, board.y, board.w, board.h);
            const mask = clip.createGeometryMask();

            // ↑↑ NEW: scale text from screen height so it uses the space better
            const titleFS = Math.max(56, Math.round(H * 0.045));
            const lineFS  = Math.max(40, Math.round(H * 0.032));

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

            // ↑↑ NEW: consistent single space *after* the colon, none before
            const rowGap = Math.round(lineFS * 0.95);
            const yBase  = titleFS + 12 + lineFS + 14;

            const l1 = this.add.text(0, yBase,              `Soap Splasher: ${totals.soapSplasher}`, styleLine).setOrigin(0, 0);
            const l2 = this.add.text(0, yBase + rowGap,     `Germ Scrubber: ${totals.germScrubber}`, styleLine).setOrigin(0, 0);
            const l3 = this.add.text(0, yBase + rowGap * 2, `Grand Total: ${totals.grand}`,          styleLine).setOrigin(0, 0);

            c.add([t1, t2, l1, l2, l3]);
            [t1, t2, l1, l2, l3].forEach(t => t.setShadow(0, 1, "#FFFFFF22", 2));
        }


        /* ------------------------------ Dialogue ------------------------------ */

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
// (lines object stays; we’ll fix the specific strings in Step 3)

        const dialogY = height * 0.97;

// Keep your same image key and initial scale
        const dialog = this.add.image(width * 0.58, dialogY, "dialogPanel")
            .setOrigin(0.5, 1).setAlpha(0).setDepth(25).setScale(0.5);

// Compute panel dimensions after scale
        const panelW = dialog.width  * dialog.scaleX;
        const panelH = dialog.height * dialog.scaleY;

// NEW: text sizing & wrap from panel size so it never touches the border
        const msgFontPx = Math.max(28, Math.round(panelH * 0.085)); // smaller than 64px and responsive
        const msgWrapW  = Math.round(panelW * 0.78);                 // generous side padding

// Vertical centering: center Y of the panel area
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

        /* ------------------------------ Confetti ------------------------------ */
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

        // Global music group
        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
            AudioManager.play(this, "global_bg", { group: "global", volume: 0.6 });
        } catch {}

        // // Home/reset icon (top-right) → full reset to ENTRY_SCENE (kept commented)
        // const home = this.add.image(width * 0.95, height * 0.1, "homeResetButton")
        //   .setOrigin(0.5).setScale(0.1).setDepth(20).setInteractive({ useHandCursor: true });
        // home.on("pointerover", () => home.setScale(0.103));
        // home.on("pointerout",  () => home.setScale(0.1));
        // home.on("pointerdown", () => { home.disableInteractive(); this.cameras.main.fadeOut(500, 0, 0, 0); });
        // this.cameras.main.once("camerafadeoutcomplete", async () => {
        //   this._confettiCancelled = true;
        //   try {
        //     if (this.music) {
        //       await new Promise((res) => {
        //         this.tweens.add({
        //           targets: this.music, volume: 0, duration: 600, ease: "Sine.easeOut",
        //           onComplete: () => { this.music?.stop(); res(); }
        //         });
        //       });
        //     }
        //   } catch {}
        //   await fullResetAndGotoStart(this);
        // });

        // Fade-in + Play Again
        this.cameras.main.fadeIn(600, 0, 0, 0);
        this._addPlayAgainButton();

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch {}
            this.music?.destroy?.(); this.music = null;
            // this._btnPlayAgain?.img?.destroy?.();
            // this._btnPlayAgain?.label?.destroy?.();
            // this._btnPlayAgain = null;
        });
    }
}
