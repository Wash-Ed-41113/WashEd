import {DB} from "../db.js"; //not sure why its greyed out...
// src/scenes/EndingScene.jS
export default class EndingScene extends Phaser.Scene {
    constructor() { super("EndingScene"); }
    //i added these assets into the config file ...not sure how to change this
    preload() {
        this.load.image("classroom_bg", "assets/images/background/classroom.png");
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
    }

    create() {
        DB.init();
        const { width, height } = this.scale;
        //placeholder leaderboard stuff - ill replace soon
        const playerName = "Riya";
        const finalScore = 120;

        // --- DB: Get round and session info ---
        // const state = DB.dump();
        // const lastRound = state.rounds[state.rounds.length - 1];
        // const lastSession = state.sessions.find(s => s.session_id === lastRound.session_id);

        // --- Dummy Score for Testing ---
        //const testScores = [87, 120, 1007];
        //const finalScore = testScores[Math.floor(Math.random() * testScores.length)];

        // --- Score Tier Helper --- can change the
        function getScoreTier(score) {
            if (score >= 500) return "high";
            if (score >= 250) return "medium";
            return "low";
        }

        const tier = getScoreTier(finalScore);

        // --- Dialogue Sets ---
        const dialogueSets = {
            high: [
                `Great work, ${playerName}! Because of you, Kiko is happy, healthy, and ready for more fun.`,
                `Amazing ${playerName}! You helped Kiko every step of the way. Those germs didn’t stand a chance!`,
                `Wow ${playerName}! You made Kiko's day super clean and helped him stay healthy. You're a true WASH Hero!`
            ],
            medium: [
                `Awesome  ${playerName}! You helped Kiko finish his day with clean hands!`,
                `Great job ${playerName}! You guided Kiko through the whole day - and look, his hands are clean and safe`,
                `Nice work  ${playerName}! You kept Kiko healthy. Each try makes you stronger!`
            ],
            low: [
                `Thanks for your help, ${playerName}! You finished Kiko’s day and learned how to stay clean and healthy. Next time, you'll be even faster`,
                `Good effort  ${playerName}! You know how to stay clean and safe. Let’s play again and keep practicing!`,
                `Yay  ${playerName}. you finished your adventure with Kiko! Every ty makes you a better WASH Hero - don't give up!`
            ]
        };

        const messages = dialogueSets[tier];
        const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
        // background
        this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);

        // --- Dialogue Panel ---
        const dialogY = height * 0.97;

        const dialoguePanel = this.add.image(width * 0.45, dialogY, "dialogPanel")
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(25)
            .setScale(0.4);

        const text = this.add.text(width * 0.45, height * 0.77, selectedMessage, {
            fontFamily: "Montserrat",
            fontSize: "64px",
            color: "#000000",
            wordWrap: { width: 700}
        })
            .setOrigin(0.5)
            .setAlpha(0)
            .setDepth(26);

        this.tweens.add({
            targets: dialoguePanel,
            alpha: { from: 0, to: 1 },
            duration: 600,
            ease: "Sine.easeInOut"
        });
        this.tweens.add({
            targets: text,
            alpha: 1,
            duration: 800,
            ease: "Sine.easeInOut",
            delay: 200
        });

        //height variable so that we can change once actual asset is used
        const panelY = height * 0.5 - 80;

        const panel = this.add.rectangle(width / 2, panelY, width * 0.35, height * 0.35, 0xeeeeee)
            .setStrokeStyle(4, 0x333333)
            .setDepth(20);

        this.add.text(width / 2, panel.y - panel.height / 2 + 40, "Leaderboard", {
            //change later to chewy
            fontFamily: "Chewy",
            fontSize: "72px",
            color: "#000000"
        }).setOrigin(0.5).setDepth(21);

        // Placeholder player data
        const placeholderScores = [
            { name: "Riya", score: 120 }
        ];
        //sorts the scores descending
        placeholderScores.sort((a, b) => b.score - a.score);

        // ---------Display scores----------
        placeholderScores.forEach((player, index) => {
            this.add.text(width / 2, panel.y - panel.height / 2 + 120 + index * 40,
                `${index + 1} ${player.name} ... ${player.score}`, {
                    fontFamily: "Montserrat",
                    fontSize: "48px",
                    color: "#333333"
                }).setOrigin(0.5).setDepth(21);
        });

        // confetti loop param
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this.startConfettiLoop();

        // Kiko
        const baseY = height * 1;
        const widthX = width * 0.15;
        const kiko = this.add.image(widthX, baseY, "kiko_cheer")
            .setDisplaySize(650, 650)
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

        const btn = this.add.image(width / 2, height * 0.55, "btn_yellow")
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
            // heheheh
        }
    }
}