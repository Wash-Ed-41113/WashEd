// src/scenes/GameScene.js
export default class GameScene extends Phaser.Scene {
    constructor() { super("GameScene"); }

    create() {
        const { width, height } = this.scale;
        const playerName = this.registry.get('playerName') || "Player";

        // === 1) Character (left side) ===
        const kiko = this.add.image(width * 0.32, height * 0.8, 'kiko_base')
            .setDisplaySize(600, 600)
            .setOrigin(0.5, 1);

        // Gentle floating animation
        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.inOut'
        });

        // === 2) Speech bubble (box only ===
        const bubbleX = width * 0.62;
        const bubbleY = height * 0.45;
        const bubbleW = 720;
        const bubbleH = 180;

        const bubble = this.add.rectangle(bubbleX, bubbleY, bubbleW, bubbleH, 0xffffff, 0.85)
            .setStrokeStyle(3, 0x000000)
            .setOrigin(0.5)
            .setDepth(5);

        // Typing text inside the bubble
        const greetText = this.add.text(bubbleX, bubbleY - 20, "", {
            fontFamily: "Arial",
            fontSize: "48px",
            color: "#000000",
            wordWrap: { width: bubbleW - 40 }
        }).setOrigin(0.5).setDepth(6);

        // === 3) Messages (typewriter) ===
        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help my day today?`,
            'Select your difficulty!'
        ];

        // Typing state
        this._typing = {
            timer: null,
            msgIndex: 0,
            isRunning: false,
            currentFull: ""
        };

        const startTyping = (msg, speed = 50) => {
            if (this._typing.timer) {
                this._typing.timer.remove(false);
                this._typing.timer = null;
            }
            greetText.setText("");
            this._typing.isRunning = true;
            this._typing.currentFull = msg;

            let i = 0;
            this._typing.timer = this.time.addEvent({
                delay: speed,
                repeat: msg.length - 1,
                callback: () => {
                    greetText.text += msg[i];
                    i++;
                    if (i >= msg.length) {
                        this._typing.isRunning = false;
                        this._typing.timer = null;
                        updateNextLabel();
                    }
                }
            });
            updateNextLabel();
        };

        // === 4) Next / Skip / Done button ===
        const nextBtn = this.add.rectangle(
            bubbleX + bubbleW / 2 - 110,
            bubbleY + bubbleH / 2 - 20,
            180, 56,
            0x111111, 0.85
        )
            .setStrokeStyle(2, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .setDepth(6);

        const nextLabel = this.add.text(nextBtn.x, nextBtn.y, "Next ▶", {
            fontFamily: "Arial",
            fontSize: "22px",
            color: "#ffffff"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

        const updateNextLabel = () => {
            if (this._typing.isRunning) {
                nextLabel.setText("Skip");
            } else {
                const last = this._typing.msgIndex >= messages.length - 1;
                nextLabel.setText(last ? "Done" : "Next ▶");
            }
        };

        const onNext = () => {
            if (this._typing.isRunning) {
                if (this._typing.timer) {
                    this._typing.timer.remove(false);
                    this._typing.timer = null;
                }
                this._typing.isRunning = false;
                greetText.setText(this._typing.currentFull);
                updateNextLabel();
                return;
            }

            if (this._typing.msgIndex < messages.length - 1) {
                this._typing.msgIndex += 1;
                startTyping(messages[this._typing.msgIndex]);
            } else {
                // End of dialog: fade out bubble + next, then show difficulty panel
                nextBtn.disableInteractive();

                this.tweens.add({
                    targets: [bubble, greetText, nextBtn, nextLabel],
                    alpha: 0,
                    duration: 280,
                    ease: 'Cubic.Out',
                    onComplete: () => {
                        bubble.destroy();
                        greetText.destroy();
                        nextBtn.destroy();
                        nextLabel.destroy();
                        this.showDifficultyPanel({ bubbleX, bubbleY, bubbleW, bubbleH });
                    }
                });
            }
        };

        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        // Start first message
        startTyping(messages[0]);

        // === 5) Difficulty panel builder ===
        this.showDifficultyPanel = ({ bubbleX, bubbleY, bubbleW, bubbleH }) => {
            const panelW = bubbleW;
            const panelFinalH = 340;
            const panelX = bubbleX;
            const panelTopY = bubbleY - bubbleH / 2 -50;

            // White panel grows downward from top-center (above previous bubble depth)
            const panelRect = this.add.rectangle(panelX, panelTopY, panelW, 0, 0xffffff, 0.95)
                .setOrigin(0.5, 0)
                .setStrokeStyle(3, 0x000000)
                .setDepth(50);

            // Geometry mask based on the panel rectangle
            const mask = panelRect.createGeometryMask();

            // Container for title + buttons; masked to stay inside the panel
            const content = this.add.container(panelX, panelTopY).setDepth(51);
            content.setMask(mask);

            // Title
            const title = this.add.text(0, 24, "Select your difficulty!", {
                fontFamily: "Arial",
                fontSize: "44px",
                color: "#000000"
            }).setOrigin(0.5, 0).setAlpha(0.0);

            // Button factory
            const makeBtn = (label, y, key) => {
                const btnW = 520, btnH = 64;

                const btn = this.add.rectangle(0, y, btnW, btnH, 0x142038, 1)
                    .setStrokeStyle(2, 0xffffff)
                    .setOrigin(0.5)
                    .setInteractive({ useHandCursor: true })
                    .setAlpha(0.0);

                const txt = this.add.text(0, y, label, {
                    fontFamily: "Arial",
                    fontSize: "26px",
                    color: "#ffffff"
                }).setOrigin(0.5).setAlpha(0.0);

                btn.on('pointerover', () => btn.setFillStyle(0x1d2b52, 1));
                btn.on('pointerout',  () => btn.setFillStyle(0x142038, 1));

                const choose = () => {
                    this.registry.set('difficulty', key);
                    // Visual feedback
                    this.tweens.add({
                        targets: [btn, txt],
                        alpha: 0.4,
                        yoyo: true,
                        duration: 120,
                        repeat: 1
                    });
                    // TODO: start gameplay or go to next scene
                    // this.scene.start('YourNextScene');
                };
                btn.on('pointerdown', choose);
                txt.on('pointerdown', choose);

                content.add([btn, txt]);
                return { btn, txt };
            };

            const gap = 78;
            const baseY = 120;
            const b1 = makeBtn("Easy",   baseY + 0 * gap, "easy");
            const b2 = makeBtn("Normal", baseY + 1 * gap, "normal");
            const b3 = makeBtn("Hard",   baseY + 2 * gap, "hard");

            content.add([title]);

            // Expand panel; fade in content as it grows
            this.tweens.add({
                targets: panelRect,
                height: panelFinalH,
                duration: 380,
                ease: 'Cubic.Out',
                onUpdate: (tw, target) => {
                    const ratio = Phaser.Math.Clamp(target.height / panelFinalH, 0, 1);
                    const a = Phaser.Math.Easing.Cubic.Out(ratio);
                    title.setAlpha(a);
                    [b1.btn, b1.txt, b2.btn, b2.txt, b3.btn, b3.txt].forEach(o => o.setAlpha(a));
                }
            });

            // Optional: keyboard shortcuts 1/2/3
            this.input.keyboard.once('keydown-ONE',   () => this.registry.set('difficulty', 'easy'));
            this.input.keyboard.once('keydown-TWO',   () => this.registry.set('difficulty', 'normal'));
            this.input.keyboard.once('keydown-THREE', () => this.registry.set('difficulty', 'hard'));
        };
    }
}
