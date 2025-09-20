// src/scenes/GameScene.js
export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this._typing = null;
        this._navigating = false; // prevent multiple scene transitions
    }

    create() {
        const { width, height } = this.scale;
        const playerName = this.registry.get("playerName") || "Player";

        // === 1) Character (left side) ===
        const kiko = this.add
            .image(width * 0.32, height * 0.8, "kiko_base")
            .setDisplaySize(600, 600)
            .setOrigin(0.5, 1);

        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.inOut",
        });

        // === 2) Speech bubble ===
        const bubbleX = width * 0.62;
        const bubbleY = height * 0.45;
        const bubbleW = 720;
        const bubbleH = 180;

        const bubble = this.add
            .rectangle(bubbleX, bubbleY, bubbleW, bubbleH, 0xffffff, 0.85)
            .setStrokeStyle(3, 0x000000)
            .setOrigin(0.5)
            .setDepth(5);

        const greetText = this.add
            .text(bubbleX, bubbleY - 20, "", {
                fontFamily: "Arial",
                fontSize: "48px",
                color: "#000000",
                wordWrap: { width: bubbleW - 40 },
            })
            .setOrigin(0.5)
            .setDepth(6);

        // === 3) Messages (typewriter) ===
        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help my day today?`,
            "Select your difficulty!",
        ];

        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };

        const updateNextLabel = () => {
            if (this._typing.isRunning) nextLabel.setText("Skip");
            else nextLabel.setText(this._typing.msgIndex >= messages.length - 1 ? "Done" : "Next ▶");
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
                },
            });
            updateNextLabel();
        };

        // === 4) Next / Skip / Done button ===
        const nextBtn = this.add
            .rectangle(bubbleX + bubbleW / 2 - 110, bubbleY + bubbleH / 2 - 20, 180, 56, 0x111111, 0.85)
            .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).setDepth(6);

        const nextLabel = this.add
            .text(nextBtn.x, nextBtn.y, "Next ▶", {
                fontFamily: "Arial", fontSize: "22px", color: "#ffffff",
            })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

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
                nextBtn.disableInteractive();
                nextLabel.disableInteractive();

                this.tweens.add({
                    targets: [bubble, greetText, nextBtn, nextLabel],
                    alpha: 0, duration: 280, ease: "Cubic.Out",
                    onComplete: () => {
                        bubble.destroy(); greetText.destroy(); nextBtn.destroy(); nextLabel.destroy();
                        this.showDifficultyPanel({ bubbleX, bubbleY, bubbleW, bubbleH });
                    },
                });
            }
        };

        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        startTyping(messages[0]);


        // === 5) Difficulty panel ===
        this.showDifficultyPanel = ({ bubbleX, bubbleY, bubbleW, bubbleH }) => {
            const panelW = bubbleW, panelFinalH = 340, panelX = bubbleX;
            const panelTopY = bubbleY - bubbleH / 2 - 50;

            const panelRect = this.add
                .rectangle(panelX, panelTopY, panelW, 0, 0xffffff, 0.95)
                .setOrigin(0.5, 0).setStrokeStyle(3, 0x000000).setDepth(50);

            const mask = panelRect.createGeometryMask();
            const content = this.add.container(panelX, panelTopY).setDepth(51);
            content.setMask(mask);

            const title = this.add.text(0, 24, "Select your difficulty!", {
                fontFamily: "Arial", fontSize: "44px", color: "#000000",
            }).setOrigin(0.5, 0).setAlpha(0.0);

            let selectedDifficulty = null;

            const makeBtn = (label, y, key) => {
                const btn = this.add.rectangle(0, y, 520, 64, 0x142038, 1)
                    .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
                    .setInteractive({ useHandCursor: true }).setAlpha(0.0);

                const txt = this.add.text(0, y, label, {
                    fontFamily: "Arial", fontSize: "26px", color: "#ffffff",
                }).setOrigin(0.5).setAlpha(0.0);

                btn.on("pointerover", () => btn.setFillStyle(0x1d2b52, 1));
                btn.on("pointerout",  () => btn.setFillStyle(0x142038, 1));

                const choose = () => finalizeSelection(key, btn, txt);
                btn.on("pointerdown", choose);
                txt.on("pointerdown", choose);

                content.add([btn, txt]);
                return { btn, txt };
            };

            const gap = 78, baseY = 120;
            const b1 = makeBtn("Easy",   baseY,           "easy");
            const b2 = makeBtn("Normal", baseY + gap,     "normal");
            const b3 = makeBtn("Hard",   baseY + 2 * gap, "hard");

            content.add([title]);

            this.tweens.add({
                targets: panelRect, height: panelFinalH, duration: 380, ease: "Cubic.Out",
                onUpdate: (tw, target) => {
                    const a = Phaser.Math.Easing.Cubic.Out(
                        Phaser.Math.Clamp(target.height / panelFinalH, 0, 1)
                    );
                    title.setAlpha(a);
                    [b1.btn, b1.txt, b2.btn, b2.txt, b3.btn, b3.txt].forEach(o => o.setAlpha(a));
                },
            });

            const disableAll = () => {
                [b1, b2, b3].forEach(({ btn, txt }) => { btn.disableInteractive(); txt.disableInteractive(); });
            };

            const finalizeSelection = (difficultyKey, btn, txt) => {
                if (this._navigating) return;
                this.registry.set("difficulty", difficultyKey);
                selectedDifficulty = difficultyKey;
                disableAll();

                this.tweens.add({
                    targets: [btn, txt], alpha: 0.4, yoyo: true, duration: 120, repeat: 1,
                    onComplete: () => {
                        // Collapse difficulty panel, then show mode panel
                        this.tweens.add({
                            targets: panelRect, height: 10, duration: 160, ease: "Cubic.In",
                            onComplete: () => {
                                content.clearMask(true);
                                panelRect.destroy(); content.destroy();
                                this.showModePanel(selectedDifficulty);   // <— NEW
                            },
                        });
                    },
                });
            };

            // keyboard shortcuts
            this.input.keyboard.once("keydown-ONE",   () => finalizeSelection("easy",   b1.btn, b1.txt));
            this.input.keyboard.once("keydown-TWO",   () => finalizeSelection("normal", b2.btn, b2.txt));
            this.input.keyboard.once("keydown-THREE", () => finalizeSelection("hard",   b3.btn, b3.txt));
        };

        // === 6) Mode selection panel  === //todo This is temporary
        // === 6) Mode selection panel (mask-free, centered, no clipping) ===
        this.showModePanel = (difficulty) => {
            const cx = this.scale.width / 2;
            const cy = this.scale.height / 2;

            const PANEL_W = 780;
            const PANEL_H = 360;

            // Panel bg: set full size, then scale Y from tiny to 1
            const bg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0xffffff, 0.96)
                .setOrigin(0.5)
                .setStrokeStyle(3, 0x000000)
                .setDepth(60)
                .setScale(1, 0.01); // collapsed vertically

            // Content container, centered on the panel
            const content = this.add.container(cx, cy).setDepth(61).setAlpha(0);

            // Title
            const title = this.add.text(0, -PANEL_H / 2 + 28, "Choose a game", {
                fontFamily: CONFIG?.ui?.fontFamily || "Arial",
                fontSize: "44px",
                color: "#000",
                align: "center",
            }).setOrigin(0.5, 0);
            content.add(title);

            // Button factory (centered x=0 inside content)
            const makeBtn = (label, y, onClick) => {
                const Bw = CONFIG?.ui?.button?.width  ?? 560;
                const Bh = CONFIG?.ui?.button?.height ?? 68;

                const rect = this.add.rectangle(0, y, Bw, Bh, 0x142038, 1)
                    .setOrigin(0.5)
                    .setStrokeStyle(2, 0xffffff)
                    .setInteractive({ useHandCursor: true });

                const txt = this.add.text(0, y, label, {
                    fontFamily: CONFIG?.ui?.fontFamily || "Arial",
                    fontSize: "26px",
                    color: "#fff",
                    align: "center",
                    fixedWidth: Bw, // keeps text centered over the rect
                }).setOrigin(0.5);

                rect.on("pointerover", () => rect.setFillStyle(0x1d2b52));
                rect.on("pointerout",  () => rect.setFillStyle(0x142038));
                rect.on("pointerdown", onClick);
                txt.on("pointerdown", onClick);

                content.add([rect, txt]);
                return { rect, txt };
            };

            const GAP = 86;
            const bSoap  = makeBtn("Play Soap Splash",  -GAP, () => go("SoapSplash"));
            const bCatch = makeBtn("Play Clean Catch",    0,   () => go("CleanCatch"));
            const bPlay  = makeBtn("Explore Playground",  GAP, () => go("PlaygroundScene")); // optional

            // Animate panel open (scaleY) then fade in content
            this.tweens.add({
                targets: bg,
                scaleY: 1,
                duration: 280,
                ease: "Cubic.Out",
                onComplete: () => {
                    this.tweens.add({ targets: content, alpha: 1, duration: 160, ease: "Quadratic.Out" });
                }
            });

            const go = (sceneKey) => {
                const data = (sceneKey === "PlaygroundScene") ? { difficulty } : {};
                this.cameras.main.fade(220, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    bg.destroy(); content.destroy();
                    this.scene.start(sceneKey, data);
                });
            };

            // ESC → back to Menu
            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });
        };



    }
}
