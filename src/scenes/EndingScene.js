// src/scenes/EndingScene.js
export default class EndingScene extends Phaser.Scene {
    constructor() { super("EndingScene"); }

    preload() {
        this.load.image("classroom_bg", "assets/images/background/classroom.png");
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
    }

    create() {
        const { width, height } = this.scale;

        // background
        this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);

        // confetti loop param
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this.startConfettiLoop();

        // Kiko
        const baseY = height * 0.85;
        const kiko = this.add.image(width / 2, baseY, "kiko_cheer")
            .setDisplaySize(450, 450)
            .setOrigin(0.5, 1)
            .setDepth(10);

        // scale save
        const baseScaleX = kiko.scaleX;
        const baseScaleY = kiko.scaleY;

        const jumpHeight = 34;
        const jumpDuration = 520;

        // jump
        this.tweens.add({
            targets: kiko,
            y: baseY - jumpHeight,
            duration: jumpDuration,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1
        });

        // squash / streach animation
        this.tweens.add({
            targets: kiko,
            scaleX: { from: baseScaleX, to: baseScaleX * 1.06 },
            scaleY: { from: baseScaleY, to: baseScaleY * 0.92 },
            duration: 120,
            yoyo: true,
            repeat: -1,
            repeatDelay: jumpDuration - 120
        });

        // stars
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
                    )
                        .setAlpha(Phaser.Math.FloatBetween(0.6, 1))
                        .setDepth(8)
                        .setAngle(Phaser.Math.Between(0, 360));

                    this.tweens.add({
                        targets: sparkle,
                        scale: { from: 1, to: Phaser.Math.FloatBetween(1.4, 2.2) },
                        alpha: 0,
                        rotation: "+=" + Phaser.Math.FloatBetween(1, 2),
                        duration: Phaser.Math.Between(500, 800),
                        ease: "Sine.easeOut",
                        onComplete: () => sparkle.destroy()
                    });
                }
            }
        });

        // text
        this.add.text(width / 2, height * 0.18, "Well Done!", {
            fontFamily: "Arial",
            fontSize: "64px",
            fontStyle: "bold",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(15);

        this.add.text(width / 2, height * 0.3,
            "Kiko has learned how to stay healthy by washing hands!",
            {
                fontFamily: "Arial",
                fontSize: "30px",
                color: "#ffffff",
                align: "center"
            }
        ).setOrigin(0.5).setDepth(15)
            .setWordWrapWidth(width * 0.8, true);

        // button text
        if (!this.textures.exists("btn_yellow")) {
            const btnW = 260, btnH = 64;
            const gBtn = this.make.graphics({ x: 0, y: 0, add: false });
            gBtn.fillStyle(0xffcc00, 1);
            gBtn.fillRoundedRect(0, 0, btnW, btnH, 16);
            gBtn.lineStyle(3, 0x111111, 1);
            gBtn.strokeRoundedRect(0, 0, btnW, btnH, 16);
            gBtn.generateTexture("btn_yellow", btnW, btnH);
            gBtn.destroy();
        }

        const btn = this.add.image(width / 2, height * 0.65, "btn_yellow")
            .setOrigin(0.5)
            .setDepth(30)
            .setInteractive({ useHandCursor: true });

        // text
        const btnLabel = this.add.text(btn.x, btn.y, "Back to Menu", {
            fontFamily: "Arial",
            fontSize: "28px",
            color: "#000000"
        }).setOrigin(0.5).setDepth(31);

        btn.on("pointerover", () => btn.setScale(1.03));
        btn.on("pointerout",  () => btn.setScale(1.00));
        btn.on("pointerdown", () => {
            btn.disableInteractive();
            this.cameras.main.fadeOut(500, 0, 0, 0);
        });

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("MenuScene");
        });

        this.cameras.main.fadeIn(600, 0, 0, 0);
    }


    // confetti loop
    startConfettiLoop() {
        const { width, height } = this.scale;
        const randomX = Phaser.Math.Between(width * 0.1, width * 0.9);
        const randomY = Phaser.Math.Between(height * 0.15, height * 0.75);
        const pieces = Phaser.Math.Between(5, 8);
        this.shootConfetti(randomX, randomY, pieces);
        const delay = Phaser.Math.Between(this.DELAY_MIN, this.DELAY_MAX);
        this.time.delayedCall(delay, () => this.startConfettiLoop());
    }

    // confetti shoot
    shootConfetti(x, y, pieces = 6) {
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
