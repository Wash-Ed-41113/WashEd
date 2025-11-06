// this import pulls shared helpers and ui widgets from systems which centralizes audio ui and mini game engines used by scenes
import systems from "../systems.js";
// this import exposes audiomanager from systems so this scene can pause resume and switch bgm groups between global and game tracks
import { AudioManager } from "../systems.js";

// entry_scene names the scene we jump to on a hard reset it is the starting menu scene for a clean restart flow
const ENTRY_SCENE = "MenuScene";

// getPlayerName reads the player display name defensively it checks phaser registry then window globals and falls back to Player so ui text is always valid scope is local helper
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

// getTotalsNoDB collects scoreboard totals without using db it coerces numbers from window globals storage game registry and scene registry then returns soapSplasher germScrubber and grand for the scoreboard scope is local helper
function getTotalsNoDB(scene) {
    const toNum = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    // small getters that tolerate missing objects so the function never crashes when scenes change order
    const regGet = (s, key) => {
        try { return s?.registry?.get?.(key); } catch { return undefined; }
    };
    const gameRegGet = (s, key) => {
        try { return s?.game?.registry?.get?.(key); } catch { return undefined; }
    };
    const win = (typeof window !== "undefined") ? window : undefined;

    // prefer scores passed via _handoff when available to keep transitions deterministic
    if (scene?._handoff?.scores) {
        const cc = toNum(scene._handoff.scores.cc);
        const ss = toNum(scene._handoff.scores.ss);
        return { soapSplasher: cc, germScrubber: ss, grand: cc + ss };
    }

    // collect clean catch mirrors from several places then pick the first valid number
    let cc = 0;
    cc = cc || toNum(win?.__CLEAN_CATCH_SCORE__);
    try { cc = cc || toNum(localStorage.getItem("cc_score")); } catch {}
    cc = cc || toNum(gameRegGet(scene, "cc_score"));
    cc = cc || toNum(regGet(scene, "cc_score"));

    // collect soap splash mirrors from several places then pick the first valid number
    let ss = 0;
    ss = ss || toNum(win?.__SS_LAST_SCORE__?.total);
    try { ss = ss || toNum(localStorage.getItem("ss_score")); } catch {}
    ss = ss || toNum(gameRegGet(scene, "ss_score"));
    ss = ss || toNum(regGet(scene, "ss_score"));

    // final normalized object for ui rendering
    return {
        soapSplasher: cc,
        germScrubber: ss,
        grand: cc + ss,
    };
}

// _clearProgressFlags wipes progress and score mirrors across registry window globals and web storage it resets played flags difficulty last scores and session id so the next run is clean scope is internal utility
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

    // clear likely keys from the scene registry without throwing if absent
    for (const k of KEYS) {
        try { scene.registry.set(k, false); } catch {}
        try { scene.registry.remove(k); } catch {}
    }

    // clear related window globals so old scores do not leak into new sessions
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

    // clear browser storage mirrors covering both local and session scopes
    try {
        localStorage.removeItem("cc_score");
        localStorage.removeItem("ss_score");
        sessionStorage.removeItem("cc_score");
        sessionStorage.removeItem("ss_score");
    } catch {}
}


// fullResetAndGotoStart performs a comprehensive cleanup then jumps to ENTRY_SCENE it clears flags stops audio tweens and timers switches audio groups and restarts the flow with resetSession metadata scope is async utility
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


// class EndingScene represents the final screen it shows totals congratulates the player plays confetti and provides a play again control it can read optional data via _handoff and coordinates audio groups scope is phaser scene
export default class EndingScene extends Phaser.Scene {
    // constructor initializes fields for music confetti cancel and handoff storage used during create
    constructor() {
        super("EndingScene");
        this.music = null;
        this._confettiCancelled = false;
        this._handoff = null;
    }

    // init captures incoming data for later use without coupling to previous scenes
    init(data) {
        this._handoff = data || null;
    }

    // preload ensures required textures exist before create runs keys map to asset files and CONFIG for consistency
    preload() {

        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("classroom_bg", "assets/images/background/Classroom.png");
    }

    // _ensureEasyBtnTexture builds and caches a rounded button texture sized from the viewport so no external sprite is needed scope is private factory
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

    // _addPlayAgainButton pins a button and label to the viewport adds hover tweens and on click disables input cancels confetti stops audio and reloads the page to hard reset scope is local ui builder
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

    // create orchestrates the entire ending screen flow including music stopping prior scenes computing totals setting background animating kiko placing logo building a responsive scoreboard selecting a congratulatory line running confetti restoring global audio fading in and wiring cleanup scope is main scene lifecycle
    create() {
        const { width, height } = this.scale;

        // start ending music if the key exists to avoid errors in builds without audio packs
        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        }

        // stop any leftover mini game scenes so timers inputs and audio do not leak into the ending
        try {
            this.scene.stop("CleanCatch");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplash");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        // read player name and totals using defensive helpers to ensure ui always has values
        const playerName = getPlayerName(this);
        const totals = getTotalsNoDB(this); // { soapSplasher, germScrubber, grand }

        // set the classroom background to fill the viewport then spawn kiko and add bounce and squash for lively feedback
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

        // place the project logo using systems ui helper so it pins correctly across resolutions
        systems.ui.placeLogo(this);

        // build the scoreboard container with a geometry mask dynamic font sizing and three rows for per game totals plus a grand total add subtle shadow for readability
        {
            const W = width, H = height;
            const board = { x: W * 0.56, y: H * 0.14, w: W * 0.70, h: H * 0.70 };
            const clip = this.add.graphics().fillStyle(0x000000, 0).fillRect(board.x, board.y, board.w, board.h);
            const mask = clip.createGeometryMask();

            // ↑↑ NEW: scale text from screen height so it uses the space better
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

        // define message tiers high medium and low the scene will pick one at random within the chosen tier to keep feedback fresh
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

        // choose a tier from total score then create and fade in a dialog panel with a centered wrapped message sized from the panel to fit cleanly on all screens
        const tier = (totals.grand >= 500 ? "high" : totals.grand >= 250 ? "medium" : "low");

        const dialogY = height * 0.97;

        const dialog = this.add.image(width * 0.58, dialogY, "dialogPanel")
            .setOrigin(0.5, 1).setAlpha(0).setDepth(25).setScale(0.5);

        const panelW = dialog.width  * dialog.scaleX;
        const panelH = dialog.height * dialog.scaleY;

        const msgFontPx = Math.max(28, Math.round(panelH * 0.085));
        const msgWrapW  = Math.round(panelW * 0.78);

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

        // configure confetti limits and timing so effects stay lightweight and deterministic across devices
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this._confettiCancelled = false;

        // shoot spawns a small burst of confetti with random direction distance rotation and lifetime while respecting live limits and cancel flag
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

        // loop schedules the next burst with a randomized delay creating a gentle ongoing celebration until canceled
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

        // restore audio routing by stopping the game group resuming the global group and playing a global background track when configured
        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
            AudioManager.play(this, "global_bg", { group: "global", volume: 0.6 });
        } catch {}

        // fade in the camera for a soft entrance add the play again button and register shutdown cleanup to stop music and confetti
        this.cameras.main.fadeIn(600, 0, 0, 0);
        this._addPlayAgainButton();

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch {}
            this.music?.destroy?.(); this.music = null;
        });
    }
}
