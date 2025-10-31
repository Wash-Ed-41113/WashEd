// src/scenes/EndingScene.js
import systems from "../systems.js";
import { DB } from "../db.js";

import { AudioManager } from "../systems.js";


// Safe default for where "Replay" starts (override via CONFIG.flow.replayStartScene)
const REPLAY_START_SCENE = (window.CONFIG?.flow?.replayStartScene) || "PlaygroundScene";


// === NEW: define the actual entry scene (mp4 background + Start button lives here) ===
// Change to "MenuScene" if your video/start is there instead of PreloadScene.
const ENTRY_SCENE = "MenuScene";

/** NEW: do a complete state refresh and jump back to the very start */
async function fullResetAndGotoStart(scene) {
    try {
        // 1) End/reset current DB session safely (ignore if stubs)
        try {
            const sid =
                window.__SESSION_ID__ ||
                DB?.getSessionId?.() ||
                scene.registry.get("sessionId");
            if (sid && DB?.endSession) await DB.endSession(sid);
        } catch (e) {
            console.warn("[EndingScene] endSession failed (non-fatal):", e);
        }
        try {
            await DB.resetCurrentSession?.(
                DB?.getSessionId?.() ?? scene.registry.get("sessionId")
            );
        } catch (e) {
            // ok if unsupported
        }

        // 2) Clear runtime/flow flags so BOTH minis are playable again
        try {
            scene.registry.set("completedSoapSplash", false);
            scene.registry.set("completedCleanCatch", false);
            scene.registry.set("bathroomPlayed", false);
            scene.registry.set("playgroundPlayed", false);
            scene.registry.set("playerName", null)
            scene.registry.set("difficulty", null);

        } catch (e) {}

        // clear global JS session id, too
        try { window.__SESSION_ID__ = null; } catch (e) {}

        // 3) Freshen the word decks for next run (no-repeat feeling)
        try {
            CONFIG.cleanCatch?.resetDecks?.();
            CONFIG.soapSplash?.resetDeck?.(1);
            CONFIG.soapSplash?.resetDeck?.(2);
            CONFIG.soapSplash?.resetDeck?.(3);
        } catch (e) {
            console.warn("[EndingScene] deck reset error:", e);
        }

        // 4) Stop audio and timers cleanly
        try { scene.sound?.stopAll?.(); } catch (e) {}
        try { scene.tweens?.killAll?.(); } catch (e) {}
        try { scene.time?.removeAllEvents?.(); } catch (e) {}
    } finally {
        // 5) Hard jump to the app's *first* scene (mp4 + Start)
        try { scene.scene.stop(); } catch (e) {}
        scene.scene.start(ENTRY_SCENE, { resetSession: true });

    }
}

export default class EndingScene extends Phaser.Scene {
    constructor() {
        super("EndingScene");
        this._nameUi = null;
        // this._btnReplay = null;
        this._btnNewPlayer = null;
        this.music = null;
        this._confettiCancelled = false;
    }

    preload() {
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("homeResetButton", "assets/images/UI/washed_kikos-day_UI-Button_HOME.png");
        this.load.image("classroom_bg", "assets/images/background/Classroom.png");

    }

    // ===== Helpers =====

    _darkButton(x, y, label, onClick) {
        const Bw = CONFIG?.ui?.button?.width  ?? 360;
        const Bh = CONFIG?.ui?.button?.height ?? 64;
        const stroke = 0xffffff;
        const fillIdle  = 0x142038;
        const fillHover = 0x1d2b52;

        const rect = this.add.rectangle(x, y, Bw, Bh, fillIdle, 1)
            .setOrigin(0.5).setStrokeStyle(2, stroke)
            .setInteractive({ useHandCursor: true })
            .setDepth(300).setScrollFactor(0);

        const txt = this.add.text(x, y, label, {
            fontFamily: CONFIG?.ui?.fontFamily ?? "Montserrat",
            fontSize: "26px", color: "#ffffff", align: "center", fixedWidth: Bw
        }).setOrigin(0.5).setDepth(301).setScrollFactor(0).setInteractive({ useHandCursor: true });

        const handler = () => onClick && onClick();
        rect.on("pointerover", () => rect.setFillStyle(fillHover));
        rect.on("pointerout",  () => rect.setFillStyle(fillIdle));
        rect.on("pointerup",   handler);
        txt.on("pointerup",    handler);

        return { rect, txt };
    }

    _closeNameDialog() {
        const ui = this._nameUi; if (!ui) return;
        ui.overlay?.destroy?.(); ui.panel?.destroy?.(); ui.title?.destroy?.(); ui.dom?.destroy?.();
        this._nameUi = null;
    }

    /** Ensure we have the same rounded button texture used for "Easy" in MenuScene. */
    _ensureEasyBtnTexture(scaleHint = 1) {
        const key = "btn_diff_easy";
        if (this.textures.exists(key)) return key;

        // Dimensions close to MenuScene’s easy button (auto-scales fine on hi-DPI)
        const btnW = Math.min(this.scale.width  * 0.22, 360) * scaleHint;
        const btnH = Math.min(this.scale.height * 0.12, 120) * scaleHint;
        const radius = Math.round(btnH * 0.28);

        const g = this.add.graphics();
        g.fillStyle(0xB9FBC0, 1); // same green fill as Easy
        g.fillRoundedRect(0, 0, btnW, btnH, radius);
        g.lineStyle(Math.max(3, Math.round(3 * scaleHint)), 0x073b4c, 0.35);
        g.strokeRoundedRect(0, 0, btnW, btnH, radius);
        g.generateTexture(key, btnW, btnH);
        g.destroy();

        return key;
    }

    /** Always-visible end buttons (no leaderboard dependency). */
    /** Always-visible end buttons (no leaderboard dependency). */
    _addEndButtons() {
        const { width, height } = this.scale;

        // Position a little higher and to the right so it does not overlap the dialogue panel
        const posX = Math.round(width * 0.84);   // shifted right
        const posY = Math.round(height * 0.82);  // a bit above the bottom dialog

        // Make sure we have the Easy-style texture (or reuse if already created in MenuScene)
        const texKey = this._ensureEasyBtnTexture(1);

        // Create the button image
        const img = this.add.image(posX, posY, texKey)
            .setOrigin(0.5)
            .setDepth(300)
            .setInteractive({ useHandCursor: true });

        // Label (same vibe as difficulty dialog)
        const uiFont = (window.CONFIG?.ui?.fontFamily) || "Montserrat";
        const label = this.add.text(posX, posY, "Play Again", {
            fontFamily: uiFont,
            color: "#073B4C",
            align: "center"
        })
            .setOrigin(0.5, 0.55)
            .setDepth(301);

        // Scale label to the button height
        const btnH = img.displayHeight || 100;
        label.setFontSize(Math.round(btnH * 0.35));

        // Simple hover/tap feedback (matches difficulty dialog motion)
        const base = { y: img.y, ly: label.y, sI: img.scale, sL: label.scale };
        img.on("pointerover", () => {
            this.tweens.add({ targets: img,   scale: base.sI * 1.04, y: base.y  - 4, duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL * 1.04, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
        });
        img.on("pointerout", () => {
            this.tweens.add({ targets: img,   scale: base.sI, y: base.y,   duration: 120, ease: "Sine.easeOut" });
            this.tweens.add({ targets: label, scale: base.sL, y: base.ly,  duration: 120, ease: "Sine.easeOut" });
        });

        // Click handler — fade then full reset to entry scene
        const go = async () => {
            // Prevent double-activations
            img.disableInteractive(); label.disableInteractive();
            this._confettiCancelled = true;

            this.cameras.main.fadeOut(450, 0, 0, 0);
            this.cameras.main.once("camerafadeoutcomplete", async () => {
                try { this.music?.stop(); } catch (_) {}
                await fullResetAndGotoStart(this);
            });
        };

        // Use pointerup to avoid colliding with any global gesture-gates
        img.on("pointerup", go);
        label.on("pointerup", go);

        // Keep refs if you need to clean them up on shutdown
        this._btnNewPlayer = { rect: img, txt: label };
    }


    // ===== Scene =====

    create() {
        const { width, height } = this.scale;

        // Music
        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        } else {
            console.warn("[Ending] endingMusic not found; continuing silently");
        }

        const playerName = this.registry.get("playerName") || "Player";
        const sid = window.__SESSION_ID__ || null;
        const myTotal = sid ? DB?.query?.sessionTotal?.(sid) ?? 0 : 0;

        const tier = (myTotal >= 500 ? "high" : myTotal >= 250 ? "medium" : "low");
        const dialogueSets = {
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
        const selectedMessage = dialogueSets[tier][Math.floor(Math.random() * dialogueSets[tier].length)];

        // Background
        this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);

        // ====== SCOREBOARD on the classroom chalkboard ======
        {
            const { width: W, height: H } = this.scale;

            DB.init?.();

// Use the exact session your rounds wrote to
            let sessionId =
                (typeof window !== "undefined" && window.__SESSION_ID__) ||
                this.registry.get("sessionId");

// If still no session (e.g., someone jumped straight here), create one
            if (!sessionId) {
                const name = this.registry.get("playerName") || "Player";
                sessionId = DB.beginSession?.(name);
                this.registry.set("sessionId", sessionId);
                try { window.__SESSION_ID__ = sessionId; } catch (_) {}
            }

// Totals per game (keys must match what was saved during rounds)
            const soapSplashTotal = DB?.query?.sessionGameTotal?.(sessionId, "SoapSplash") ?? 0;
            const cleanCatchTotal = DB?.query?.sessionGameTotal?.(sessionId, "CleanCatch") ?? 0;
            // Chalkboard safe area (tweak to your art)
            const board = { x: W * 0.56, y: H * 0.14, w: W * 0.36, h: H * 0.30 };
            const clip = this.add.graphics().fillStyle(0x000000, 0).fillRect(board.x, board.y, board.w, board.h);
            const mask = clip.createGeometryMask();

            const styleTitle = {
                fontFamily: "Chewy, Arial, sans-serif",
                fontSize: "48px",
                color: "#F3F0E6",
                align: "left",
                wordWrap: { width: board.w - 20 }
            };
            const styleLine = {
                fontFamily: "Chewy, Arial, sans-serif",
                fontSize: "34px",
                color: "#F3F0E6",
                align: "left",
                wordWrap: { width: board.w - 20 }
            };

            const chalkName = this.registry.get("playerName") || "Player";
            const c = this.add.container(board.x, board.y).setDepth(5).setMask(mask);

            const tTitle = this.add.text(0, 0, "Scoreboard", styleTitle).setOrigin(0, 0);
            const tName  = this.add.text(0, 60, chalkName, styleLine).setOrigin(0, 0);

            // Your labels: Germ Scrubber = SoapSplash, Soap Splasher = CleanCatch
            const tGS = this.add.text(0, 60 + 44, `Germ Scrubber : ${soapSplashTotal}`, styleLine).setOrigin(0, 0);
            const tSS = this.add.text(0, 60 + 44 + 38, `Soap Splasher : ${cleanCatchTotal}`, styleLine).setOrigin(0, 0);

            c.add([tTitle, tName, tGS, tSS]);
            [tTitle, tName, tGS, tSS].forEach(t => t.setShadow(0, 1, "#FFFFFF22", 2));
        }
// ====== END SCOREBOARD ======


        // Dialogue panel + text (kept AFTER scoreboard as requested)
        const dialogY = height * 0.97;
        const dialoguePanel = this.add.image(width * 0.50, dialogY, "dialogPanel")
            .setOrigin(0.5, 1).setAlpha(0).setDepth(25).setScale(0.5);
        const panelCenterY = dialogY - (dialoguePanel.height * dialoguePanel.scaleY) / 2;

        const text = this.add.text(width * 0.50, panelCenterY, selectedMessage, {
            fontFamily: "Montserrat", fontSize: "64px", color: "#000000",
            wordWrap: { width: 870 }, align: "center"
        }).setOrigin(0.5).setAlpha(0).setDepth(26);

        this.tweens.add({ targets: dialoguePanel, alpha: 1, duration: 600, ease: "Sine.inOut" });
        this.tweens.add({ targets: text, alpha: 1, duration: 800, ease: "Sine.inOut", delay: 200 });

        // Confetti loop
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this._confettiCancelled = false;
        this.startConfettiLoop();

        AudioManager.resumeGroup("global");
        AudioManager.play(this, "global_bg", { group: "global", volume: 0.6 });

        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
        } catch {}


        // Kiko sprite motion
        const baseY = height * 0.9;
        const widthX = width * 0.15;
        const kiko = this.add.image(widthX, baseY, "kiko_cheer")
            .setDisplaySize(650, 650).setOrigin(0.5, 1).setDepth(40);

        const baseScaleX = kiko.scaleX, baseScaleY = kiko.scaleY;
        const jumpHeight = 34, jumpDuration = 520;

        this.tweens.add({
            targets: kiko, y: baseY - jumpHeight, duration: jumpDuration,
            ease: "Sine.inOut", yoyo: true, repeat: -1
        });
        this.tweens.add({
            targets: kiko,
            scaleX: { from: baseScaleX, to: baseScaleX * 1.06 },
            scaleY: { from: baseScaleY, to: baseScaleY * 0.92 },
            duration: 120, yoyo: true, repeat: -1, repeatDelay: jumpDuration - 120
        });

        // Sparkles
        this.time.addEvent({
            delay: jumpDuration, loop: true, callback: () => {
                const sparkleCount = Phaser.Math.Between(3, 5);
                for (let i = 0; i < sparkleCount; i++) {
                    const s = this.add.star(
                        kiko.x + Phaser.Math.Between(-80, 80),
                        kiko.y - Phaser.Math.Between(80, 200),
                        5, Phaser.Math.Between(3, 6), Phaser.Math.Between(10, 16), 0xffffcc
                    ).setAlpha(Phaser.Math.FloatBetween(0.6, 1)).setDepth(8).setAngle(Phaser.Math.Between(0, 360));

                    this.tweens.add({
                        targets: s, scale: { from: 1, to: Phaser.Math.FloatBetween(1.4, 2.2) }, alpha: 0,
                        rotation: "+=" + Phaser.Math.FloatBetween(2, 4),
                        duration: Phaser.Math.Between(500, 800), ease: "Sine.easeOut",
                        onComplete: () => s.destroy()
                    });
                }
            }
        });

        // Home / Reset (now routes to fullResetAndGotoStart)
        const baseScale = 0.1;
        const btn = this.add.image(width * 0.95, height * 0.1, "homeResetButton")
            .setOrigin(0.5).setScale(baseScale).setDepth(20)
            .setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => btn.setScale(baseScale * 1.03));
        btn.on("pointerout",  () => btn.setScale(baseScale));
        btn.on("pointerdown", () => {
            btn.disableInteractive();
            this.cameras.main.fadeOut(500, 0, 0, 0);
        });

        this.cameras.main.once("camerafadeoutcomplete", async () => {
            this._confettiCancelled = true;
            try {
                if (this.music) {
                    await new Promise((res) => {
                        this.tweens.add({
                            targets: this.music, volume: 0, duration: 600, ease: "Sine.easeOut",
                            onComplete: () => { this.music?.stop(); res(); }
                        });
                    });
                }
            } catch {}
            await fullResetAndGotoStart(this);
        });

        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Always-visible action buttons
        this._addEndButtons();

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch(_) {}
            this.music?.destroy?.(); this.music = null;
            // this._btnReplay?.rect?.destroy?.();  this._btnReplay?.txt?.destroy?.();  this._btnReplay = null;
            this._btnNewPlayer?.rect?.destroy?.(); this._btnNewPlayer?.txt?.destroy?.(); this._btnNewPlayer = null;
            this._closeNameDialog();
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            // this._btnReplay?.rect?.destroy?.();  this._btnReplay?.txt?.destroy?.();  this._btnReplay = null;
            this._btnNewPlayer?.rect?.destroy?.(); this._btnNewPlayer?.txt?.destroy?.(); this._btnNewPlayer = null;
            this._closeNameDialog();
        });
    }

    // ===== Confetti =====

    startConfettiLoop() {
        if (this._confettiCancelled) return;
        const { width, height } = this.scale;
        const randomX = Phaser.Math.Between(width * 0.1, width * 0.9);
        const randomY = Phaser.Math.Between(height * 0.15, height * 0.75);
        const pieces = Phaser.Math.Between(5, 8);
        this.shootConfetti(randomX, randomY, pieces);
        const delay = Phaser.Math.Between(this.DELAY_MIN, this.DELAY_MAX);
        this.time.delayedCall(delay, () => this.startConfettiLoop());
    }

    shootConfetti(x, y, pieces = 6) {
        if (this._confettiCancelled) return;
        if (this.liveConfetti >= this.MAX_LIVE_CONFETTI) return;

        const canCreate = Math.min(pieces, this.MAX_LIVE_CONFETTI - this.liveConfetti);
        for (let i = 0; i < canCreate; i++) {
            const img = this.add.image(x, y, "confetti")
                .setScale(Phaser.Math.FloatBetween(0.18, 0.28))
                .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
                .setAlpha(1).setDepth(5);

            this.liveConfetti++;
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(200, 400);
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;

            this.tweens.add({
                targets: img, x: targetX, y: targetY, rotation: "+=" + Phaser.Math.FloatBetween(2, 4),
                alpha: 0, duration: Phaser.Math.Between(900, 1300), ease: "Cubic.easeOut",
                onComplete: () => { img.destroy(); this.liveConfetti--; }
            });
        }
    }
}
