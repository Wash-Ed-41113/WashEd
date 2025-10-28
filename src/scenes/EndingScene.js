// src/scenes/EndingScene.js
import systems from "../systems.js";
import { DB } from "../db.js";

// Safe default for where "Replay" starts (override via CONFIG.flow.replayStartScene)
const REPLAY_START_SCENE = (window.CONFIG?.flow?.replayStartScene) || "PlaygroundScene";

export default class EndingScene extends Phaser.Scene {
    constructor() {
        super("EndingScene");
        this._nameUi = null;
        this._btnReplay = null;
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

        if (!this.cache.audio.exists("endingMusic")) {
            this.load.audio("endingMusic", "assets/sounds/kikos day.mp3");
        }
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

    _openNameDialog(onSubmit) {
        this._closeNameDialog();
        const { width, height } = this.scale;

        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35)
            .setDepth(98).setInteractive();
        let panel = this.add.image(width / 2, height / 2, "dialogPanel")
            .setOrigin(0.5).setDepth(100);
        const s = Math.min((width * 0.62) / panel.width, (height * 0.48) / panel.height);
        panel.setScale(s);

        const title = this.add.text(
            width / 2, (height / 2) - (panel.displayHeight * 0.35),
            "Enter Your Name",
            { fontFamily: CONFIG?.ui?.fontFamily ?? "Montserrat", fontSize: "30px", color: "#102040" }
        ).setOrigin(0.5).setDepth(101);

        const innerW = Math.min(520, panel.displayWidth * 0.85);
        const dom = this.add.dom(width / 2, height / 2 + 10).createFromHTML(`
      <div style="width:${innerW}px; display:flex; flex-direction:column; align-items:center; gap:14px; font-family:${CONFIG?.ui?.fontFamily || "Montserrat"}, sans-serif;">
        <input id="playerNameInput" type="text" maxlength="24" autofocus
          style="width:100%; font-size:20px; padding:10px 12px; border-radius:12px; border:2px solid #1d2b52; outline:none; text-align:center;"
          placeholder="Type your name" />
        <div style="display:flex; gap:14px;">
          <button id="okBtn" style="font-size:18px; padding:10px 18px; border-radius:10px; border:2px solid #fff; background:#142038; color:#fff; cursor:pointer;">OK</button>
          <button id="cancelBtn" style="font-size:18px; padding:10px 18px; border-radius:10px; border:2px solid #142038; background:#ffffff; color:#142038; cursor:pointer;">Cancel</button>
        </div>
      </div>
    `).setOrigin(0.5).setDepth(101);

        const node = dom.node;
        const input = node.querySelector("#playerNameInput");
        const okBtn = node.querySelector("#okBtn");
        const cancelBtn = node.querySelector("#cancelBtn");

        const submit = () => {
            const raw = (input?.value || "").trim();
            const name = raw || "Player";
            onSubmit?.(name);
            this._closeNameDialog();
        };
        const cancel = () => this._closeNameDialog();

        okBtn?.addEventListener("click", submit);
        cancelBtn?.addEventListener("click", cancel);
        input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
        });

        this._nameUi = { overlay, panel, title, dom };
    }

    _closeNameDialog() {
        const ui = this._nameUi; if (!ui) return;
        ui.overlay?.destroy?.(); ui.panel?.destroy?.(); ui.title?.destroy?.(); ui.dom?.destroy?.();
        this._nameUi = null;
    }

    /** Always-visible end buttons (no leaderboard dependency). */
    _addEndButtons() {
        const { width, height } = this.scale;
        const btnAreaY = Math.round(height * 0.88);
        const gap = Math.max(18, Math.round(width * 0.012));
        const BW = (CONFIG?.ui?.button?.width ?? 360);

        // Replay (same player/session)
        const replayBtn = this._darkButton(
            Math.round(width * 0.62), btnAreaY, "Replay",
            () => {
                this._confettiCancelled = true;
                this.cameras.main.fadeOut(450, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    try { this.music?.stop(); } catch(_) {}
                    this.scene.start(REPLAY_START_SCENE);
                });
            }
        );

        // New Player (go to MenuScene; ask name again)
        const newPlayerBtn = this._darkButton(
            Math.round(width * 0.62) + BW + gap, btnAreaY, "New Player",
            () => {
                this._confettiCancelled = true;
                this.cameras.main.fadeOut(450, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    try { this.music?.stop(); } catch(_) {}
                    try { this.registry.set("playerName", null); } catch(_) {}
                    try { const sidNow = window.__SESSION_ID__; if (sidNow && DB?.endSession) DB.endSession(sidNow); } catch(_) {}
                    window.__SESSION_ID__ = null;
                    this.scene.start("MenuScene");
                });
            }
        );

        this._btnReplay = replayBtn;
        this._btnNewPlayer = newPlayerBtn;
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
        if (this.textures.exists("classroom_bg")) {
            this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);
        } else {
            this.add.rectangle(0, 0, width, height, 0x1b2a3a).setOrigin(0, 0);
        }

        // Dialogue panel + text
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

        // Home / Reset
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

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this._confettiCancelled = true;
            if (this.music) {
                this.tweens.add({
                    targets: this.music, volume: 0, duration: 600, ease: "Sine.easeOut",
                    onComplete: () => { this.music && this.music.stop(); this.scene.start("MenuScene"); }
                });
            } else {
                this.scene.start("MenuScene");
            }
        });

        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Always-visible action buttons
        this._addEndButtons();

        // Cleanup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            try { this.music?.stop(); } catch(_) {}
            this.music?.destroy?.(); this.music = null;
            this._btnReplay?.rect?.destroy?.();  this._btnReplay?.txt?.destroy?.();  this._btnReplay = null;
            this._btnNewPlayer?.rect?.destroy?.(); this._btnNewPlayer?.txt?.destroy?.(); this._btnNewPlayer = null;
            this._closeNameDialog();
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this._btnReplay?.rect?.destroy?.();  this._btnReplay?.txt?.destroy?.();  this._btnReplay = null;
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
