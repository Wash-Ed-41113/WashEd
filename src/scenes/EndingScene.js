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
function getTotalsNoDB(scene) {
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    // Priority: data passed directly via scene.start()
    if (scene._handoff?.scores) {
        const cc = toNum(scene._handoff.scores.cc);
        const ss = toNum(scene._handoff.scores.ss);
        return { soapSplasher: cc, germScrubber: ss, grand: cc + ss };
    }

    // Clean Catch ("Soap Splasher") score
    // Try everything: window → localStorage → registry
    let cc =
        toNum(window.__CLEAN_CATCH_SCORE__) ||
        toNum(localStorage.getItem("cc_score")) ||
        toNum(scene.game.registry?.get("cc_score")) ||
        toNum(scene.registry?.get("cc_score")) ||
        0;

    // Soap Splash ("Germ Scrubber") score
    let ss =
        toNum(window.__SS_LAST_SCORE__?.total) ||
        toNum(localStorage.getItem("ss_score")) ||
        toNum(scene.game.registry?.get("ss_score")) ||
        toNum(scene.registry?.get("ss_score")) ||
        0;

    // Return final totals
    return {
        soapSplasher: cc,
        germScrubber: ss,
        grand: cc + ss,
    };
}



/* -------------------------------------------------------------------------- */
/*                         FULL RESET (NO DB; PURE UI)                        */
/* -------------------------------------------------------------------------- */

/** Full app reset → go back to the very first entry scene (no DB). */
async function fullResetAndGotoStart(scene) {
    try {
        // Clear play flags + player info (registry)
        try {
            const KEYS = [
                // mini-game completion / gating
                "cc_done", "cleanCatchDone", "cleanCatchPlayed", "hasPlayedCleanCatch",
                "ss_done", "soapSplashDone", "soapSplashPlayed", "hasPlayedSoapSplash",
                // bathroom / flow
                "bathroom:ccComplete", "bathroom:soapComplete", "bathroom:ccLocked",
                "flow:enteredBathroom", "flow:enteredPlayground", "flowStage",
                // misc state
                "visitedPlayground", "difficulty",
                // mirrors
                "playerName", "cc:lastScore", "ss:lastScore", "ss:lastBestStreak",
                "sessionId"
            ];
            for (const k of KEYS) {
                try { scene.registry.set(k, false); } catch {}
                try { scene.registry.remove(k); } catch {}
            }
        } catch {}

        // Window mirrors
        try { if (typeof window !== "undefined") {
            window.__PLAYER_NAME__ = null;
            window.__CC_LAST_SCORE__ = null;
            window.__SS_LAST_SCORE__ = null;
            window.__SESSION_ID__ = null;
        }} catch {}

        // Kill audio/timers/tweens gracefully
        try { scene.sound?.stopAll?.(); } catch {}
        try { scene.tweens?.killAll?.(); } catch {}
        try { scene.time?.removeAllEvents?.(); } catch {}
    } finally {
        try { scene.scene.stop(); } catch {}
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
        this._btnPlayAgain = null;
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

    /** Fixed bottom-right “Play Again” button that hard-resets to ENTRY_SCENE. */
    _addPlayAgainButton() {
        const { width, height } = this.scale;
        const texKey = this._ensureEasyBtnTexture(1);
        const x = Math.round(width * 0.14);
        const y = Math.round(height * 0.90);

        const img = this.add.image(x, y, texKey).setOrigin(0.5).setDepth(300).setInteractive({ useHandCursor: true });
        const label = this.add.text(x, y, "Play Again", {
            fontFamily: (window.CONFIG?.ui?.fontFamily) || "Montserrat",
            color: "#073B4C",
            align: "center"
        }).setOrigin(0.5, 0.55).setDepth(301);

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

        const go = async () => {
            img.disableInteractive(); label.disableInteractive();
            this._confettiCancelled = true;
            this.cameras.main.fadeOut(450, 0, 0, 0);
            this.cameras.main.once("camerafadeoutcomplete", async () => {
                try { this.music?.stop(); } catch {}
                await fullResetAndGotoStart(this);
            });
        };
        img.on("pointerup", go);
        label.on("pointerup", go);

        this._btnPlayAgain = { img, label };
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

        // ❌ NO DB BOOTSTRAP, NO SESSION ID

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
            const board = { x: W * 0.56, y: H * 0.14, w: W * 0.36, h: H * 0.34 };
            const clip = this.add.graphics().fillStyle(0x000000, 0).fillRect(board.x, board.y, board.w, board.h);
            const mask = clip.createGeometryMask();

            const styleTitle = { fontFamily: "Chewy", fontSize: "48px", color: "#F3F0E6", align: "left", wordWrap: { width: board.w - 20 } };
            const styleLine  = { fontFamily: "Chewy", fontSize: "34px", color: "#F3F0E6", align: "left", wordWrap: { width: board.w - 20 } };

            const c  = this.add.container(board.x, board.y).setDepth(5).setMask(mask);

            const t1 = this.add.text(0, 0, "Scoreboard", styleTitle).setOrigin(0, 0);
            const t2 = this.add.text(0, 60, playerName,   styleLine ).setOrigin(0, 0);

            const yBase = 60 + 44;
            const l1 = this.add.text(0, yBase,           `Soap Splasher : ${totals.soapSplasher}`, styleLine).setOrigin(0, 0);
            const l2 = this.add.text(0, yBase + 38,      `Germ Scrubber : ${totals.germScrubber}`, styleLine).setOrigin(0, 0);
            const l3 = this.add.text(0, yBase + 38 + 34, `Grand Total   : ${totals.grand}`,        styleLine).setOrigin(0, 0);

            c.add([t1, t2, l1, l2, l3]);
            [t1, t2, l1, l2, l3].forEach(t => t.setShadow(0, 1, "#FFFFFF22", 2));
        }

        /* ------------------------------ Dialogue ------------------------------ */
        const tier = (totals.grand >= 500 ? "high" : totals.grand >= 250 ? "medium" : "low");
        const lines = {
            high: [
                `Great work, ${playerName}! Because of you, Kiko is happy, healthy, and ready for more fun.`,
                `Amazing ${playerName}! You helped Kiko every step of the way. Those germs didn’t stand a chance!`,
                `Wow ${playerName}! You made Kiko's day super clean and helped him stay healthy. You're a true WASH Hero!`
            ],
            medium: [
                `Awesome ${playerName}! You helped Kiko finish his day with clean hands!`,
                `Great job ${playerName}! You guided Kiko through the whole day - and look, his hands are clean and safe`,
                `Nice work ${playerName}! You kept Kiko healthy. Each try makes you stronger!`
            ],
            low: [
                `Thanks for your help, ${playerName}! You finished Kiko’s day and learned how to stay clean and healthy. Next time, you'll be even faster`,
                `Good effort ${playerName}! You know how to stay clean and safe. Let’s play again and keep practicing!`,
                `Yay ${playerName}! You finished your adventure with Kiko! Every try makes you a better WASH Hero - don't give up!`
            ]
        };

        console.log("Scores found:", totals);

        const selected = lines[tier][Math.floor(Math.random() * lines[tier].length)];

        const dialogY = height * 0.97;
        const dialog = this.add.image(width * 0.58, dialogY, "dialogPanel")
            .setOrigin(0.5, 1).setAlpha(0).setDepth(25).setScale(0.5);
        const panelCenterY = dialogY - (dialog.height * dialog.scaleY) / 2;
        const msg = this.add.text(width * 0.58, panelCenterY, selected, {
            fontFamily: "Montserrat", fontSize: "64px", color: "#000000", wordWrap: { width: 870 }, align: "center"
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
            this._btnPlayAgain?.img?.destroy?.();
            this._btnPlayAgain?.label?.destroy?.();
            this._btnPlayAgain = null;
        });
    }
}
