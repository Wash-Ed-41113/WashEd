// src/scenes/EndingScene.js
import { DB } from "../db.js";

export default class EndingScene extends Phaser.Scene {
    constructor() { super("EndingScene"); }

    preload() {
        // if you already preload these via CONFIG elsewhere, these will just re-use the cache
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", CONFIG.assets.dialogPanel);
        this.load.image("homeResetButton", "assets/images/UI/washed_kikos-day_UI-Button_HOME.png");
        this.load.image("classroom_bg", "assets/images/background/Classroom.png");

        // ending music (guarded at runtime in case the file is absent)
        if (!this.cache.audio.exists("endingMusic")) {
            this.load.audio("endingMusic", "assets/sounds/kikos day.mp3");
        }
    }

    create() {
        const { width, height } = this.scale;

        // ---- Audio (guarded) ----
        this.music = null;
        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        } else {
            console.warn("[Ending] endingMusic not found; continuing silently");
        }

        const playerName = this.registry.get("playerName") || "Player";

        // ---- Score tier + message (based on TOTAL for this session) ----
        const sid = window.__SESSION_ID__ || null;
        const myTotal = sid ? DB.query.sessionTotal(sid) : 0;

        const getScoreTier = (s) => (s >= 500 ? "high" : s >= 250 ? "medium" : "low");
        const tier = getScoreTier(myTotal);

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
        const messages = dialogueSets[tier];
        const selectedMessage = messages[Math.floor(Math.random() * messages.length)];

        // ---- Background with fallback ----
        if (this.textures.exists("classroom_bg")) {
            this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);
        } else {
            this.add.rectangle(0, 0, width, height, 0x1b2a3a).setOrigin(0, 0);
        }

        // ---- Dialogue panel + text ----
        const dialogY = height * 0.97;
        const dialoguePanel = this.add.image(width * 0.50, dialogY, "dialogPanel")
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(25)
            .setScale(0.5);

        const panelCenterY = dialogY - (dialoguePanel.height * dialoguePanel.scaleY) / 2;

        const text = this.add.text(width * 0.50, panelCenterY, selectedMessage, {
            fontFamily: "Montserrat",
            fontSize: "64px",
            color: "#000000",
            wordWrap: { width: 870 },
            align: "center"
        }).setOrigin(0.5).setAlpha(0).setDepth(26);

        this.tweens.add({ targets: dialoguePanel, alpha: 1, duration: 600, ease: "Sine.inOut" });
        this.tweens.add({ targets: text, alpha: 1, duration: 800, ease: "Sine.inOut", delay: 200 });

        // =========================
        // ---- Live LEADERBOARD ---
        // =========================
        const board = DB.query.topTotals({ limit: 6 }); // one row per session (player)
        this.add.text(width * 0.65, height * 0.17, "SCOREBOARD", {
            fontFamily: "Chewy",
            fontSize: "88px",
            color: "#ffffff"
        }).setOrigin(0.5).setDepth(21);

        const leaderboardStartY = height * 0.27;
        board.forEach((row, i) => {
            const you = (sid && row.session_id === sid) ? "  (you)" : "";
            this.add.text(
                width * 0.65,
                leaderboardStartY + i * 50,
                `${i + 1}. ${row.player_name}: ${row.total}${you}`,
                { fontFamily: "Chewy", fontSize: "48px", color: "#ffffff" }
            ).setOrigin(0.5).setDepth(21);
        });

        // current player's total (prominent)
        this.add.text(
            width * 0.65,
            leaderboardStartY + board.length * 50 + 64,
            `My Total: ${myTotal}`,
            { fontFamily: "Chewy", fontSize: "64px", color: "#ffffff" }
        ).setOrigin(0.5).setDepth(21);

        // ---- Confetti loop params ----
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this._confettiCancelled = false;
        this.startConfettiLoop();

        // ---- Kiko sprite + idle jump + squash ----
        const baseY = height * 0.9;
        const widthX = width * 0.15;
        const kiko = this.add.image(widthX, baseY, "kiko_cheer")
            .setDisplaySize(650, 650)
            .setOrigin(0.5, 1)
            .setDepth(40);

        const baseScaleX = kiko.scaleX;
        const baseScaleY = kiko.scaleY;
        const jumpHeight = 34;
        const jumpDuration = 520;

        this.tweens.add({
            targets: kiko,
            y: baseY - jumpHeight,
            duration: jumpDuration,
            ease: "Sine.inOut",
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: kiko,
            scaleX: { from: baseScaleX, to: baseScaleX * 1.06 },
            scaleY: { from: baseScaleY, to: baseScaleY * 0.92 },
            duration: 120,
            yoyo: true,
            repeat: -1,
            repeatDelay: jumpDuration - 120
        });

        // ---- Sparkles above Kiko ----
        this.time.addEvent({
            delay: jumpDuration,
            loop: true,
            callback: () => {
                const sparkleCount = Phaser.Math.Between(3, 5);
                for (let i = 0; i < sparkleCount; i++) {
                    const sparkle = this.add.star(
                        kiko.x + Phaser.Math.Between(-80, 80),
                        kiko.y - Phaser.Math.Between(80, 200),
                        5,
                        Phaser.Math.Between(3, 6),
                        Phaser.Math.Between(10, 16),
                        0xffffcc
                    ).setAlpha(Phaser.Math.FloatBetween(0.6, 1))
                        .setDepth(8)
                        .setAngle(Phaser.Math.Between(0, 360));

                    this.tweens.add({
                        targets: sparkle,
                        scale: { from: 1, to: Phaser.Math.FloatBetween(1.4, 2.2) },
                        alpha: 0,
                        rotation: "+=" + Phaser.Math.FloatBetween(2, 3.5),
                        duration: Phaser.Math.Between(500, 800),
                        ease: "Sine.easeOut",
                        onComplete: () => sparkle.destroy()
                    });
                }
            }
        });

        // ---- Home / Reset button ----
        const baseScale = 0.1;
        const btn = this.add.image(width * 0.95, height * 0.1, "homeResetButton")
            .setOrigin(0.5)
            .setScale(baseScale)
            .setDepth(20)
            .setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => btn.setScale(baseScale * 1.03));
        btn.on("pointerout",  () => btn.setScale(baseScale));
        btn.on("pointerdown", () => {
            btn.disableInteractive();
            this.cameras.main.fadeOut(500, 0, 0, 0);
        });

        this.cameras.main.once("camerafadeoutcomplete", () => {
            // stop confetti loop so it doesn't schedule more
            this._confettiCancelled = true;

            if (this.music) {
                this.tweens.add({
                    targets: this.music,
                    volume: 0,
                    duration: 600,
                    ease: "Sine.easeOut",
                    onComplete: () => {
                        this.music && this.music.stop();
                        this.scene.start("MenuScene");
                    }
                });
            } else {
                this.scene.start("MenuScene");
            }
        });

        this.cameras.main.fadeIn(600, 0, 0, 0);

        // clean-up on shutdown just in case
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            if (this.music) { try { this.music.stop(); } catch(_){} this.music.destroy(); this.music = null; }
        });
    }

    // ---- Confetti: loop ----
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

    // ---- Confetti: burst ----
    shootConfetti(x, y, pieces = 6) {
        if (this._confettiCancelled) return;
        if (this.liveConfetti >= this.MAX_LIVE_CONFETTI) return;

        const canCreate = Math.min(pieces, this.MAX_LIVE_CONFETTI - this.liveConfetti);
        for (let i = 0; i < canCreate; i++) {
            const img = this.add.image(x, y, "confetti")
                .setScale(Phaser.Math.FloatBetween(0.18, 0.28))
                .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
                .setAlpha(1)
                .setDepth(5);

            this.liveConfetti++;

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(200, 400);
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;

            this.tweens.add({
                targets: img,
                x: targetX,
                y: targetY,
                rotation: "+=" + Phaser.Math.FloatBetween(2, 4),
                alpha: 0,
                duration: Phaser.Math.Between(900, 1300),
                ease: "Cubic.easeOut",
                onComplete: () => { img.destroy(); this.liveConfetti--; }
            });
        }
    }
}
