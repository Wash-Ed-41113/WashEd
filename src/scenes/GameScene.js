import systems from "../systems.js";
import { DB } from "../db.js";

const soapSplashMusic = new Audio("assets/sounds/bg_music.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;


// define the main hub scene for the game flow
export default class GameScene extends Phaser.Scene {
    // register scene key and set up state flags
    constructor() {
        super("GameScene");
        // _typing stores state for the typewriter effect
        this._typing = null;
        // _navigating prevents double scene transitions
        this._navigating = false;
    }

    // create builds the scene and starts the greeting flow
    create(data) {
        // store player name into registry if passed in
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        // read player name once (fallback to default)
        const playerName = this.registry.get("playerName") || "Player";

        // get current canvas size
        const { width, height } = this.scale;

        // --- start an in-memory session once per app run ---
        if (!window.__SESSION_ID__) {
            window.__SESSION_ID__ = DB.beginSession(playerName);
        }

        // add kiko image on the left side with feet anchored at bottom
        const kiko = this.add
            .image(width * 0.32, height * 0.8, "kiko_base")
            .setDisplaySize(600, 600)
            .setOrigin(0.5, 1);

        // gentle idle bounce for kiko to feel alive
        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // layout values for the speech bubble
        const bubbleX = width * 0.62;
        const bubbleY = height * 0.45;
        const bubbleW = 720;
        const bubbleH = 180;

        // draw speech bubble rectangle with light stroke
        const bubble = this.add
            .rectangle(bubbleX, bubbleY, bubbleW, bubbleH, 0xffffff, 0.85)
            .setStrokeStyle(3, 0x000000)
            .setOrigin(0.5)
            .setDepth(5);

        // create text object for greeting lines inside bubble
        const greetText = this.add
            .text(bubbleX, bubbleY - 20, "", {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "48px",
                color: "#000000",
                wordWrap: { width: bubbleW - 40 },
            })
            .setOrigin(0.5)
            .setDepth(6);

        // sequence of messages for the typewriter effect
        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help me today?`,
            "Select your difficulty!",
        ];

        // typing state holds timer current index and flags
        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };

        // helper to update the next button label based on typing state
        const updateNextLabel = () => {
            if (this._typing.isRunning) nextLabel.setText("Skip");
            else nextLabel.setText(this._typing.msgIndex >= messages.length - 1 ? "Done" : "Next ▶");
        };

        // starts typewriter animation for a given message
        const startTyping = (msg, speed = 50) => {
            // clear previous timer if any
            if (this._typing.timer) {
                this._typing.timer.remove(false);
                this._typing.timer = null;
            }
            // reset visible text and set running flag
            greetText.setText("");
            this._typing.isRunning = true;
            this._typing.currentFull = msg;

            // add one character each tick until complete
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

        // draw rectangular next button at bubble corner
        const nextBtn = this.add
            .rectangle(bubbleX + bubbleW / 2 - 110, bubbleY + bubbleH / 2 - 20, 180, 56, 0x111111, 0.85)
            .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).setDepth(6);

        // text label for the next button
        const nextLabel = this.add
            .text(nextBtn.x, nextBtn.y, "Next ", {
                fontFamily: "Arial", fontSize: "22px", color: "#ffffff",
            })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

        // click or keypress logic for next behavior
        const onNext = () => {
            // if typing then skip to end of current message
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

            // advance to next message or finish the sequence
            if (this._typing.msgIndex < messages.length - 1) {
                this._typing.msgIndex += 1;
                startTyping(messages[this._typing.msgIndex]);
            } else {
                // fade out bubble and show difficulty selection panel
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

        // wire up interactions for next
        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        // start with the first message
        startTyping(messages[0]);

        // function to build the difficulty panel
        this.showDifficultyPanel = ({ bubbleX, bubbleY, bubbleW, bubbleH }) => {
            // target panel size and position
            const panelW = bubbleW, panelFinalH = 340, panelX = bubbleX;
            const panelTopY = bubbleY - bubbleH / 2 - 50;

            // panel rect starts collapsed and animates open
            const panelRect = this.add
                .rectangle(panelX, panelTopY, panelW, 0, 0xffffff, 0.95)
                .setOrigin(0.5, 0).setStrokeStyle(3, 0x000000).setDepth(50);

            // create a mask so content reveals only as panel grows
            const mask = panelRect.createGeometryMask();
            const content = this.add.container(panelX, panelTopY).setDepth(51);
            content.setMask(mask);

            // title text which fades in as the panel opens
            const title = this.add.text(0, 24, "Select your difficulty!", {
                fontFamily: "Arial", fontSize: "44px", color: "#000000",
            }).setOrigin(0.5, 0).setAlpha(0.0);

            // track selected difficulty
            let selectedDifficulty = null;

            // helper to make a labeled button inside content
            const makeBtn = (label, y, key) => {
                const btn = this.add.rectangle(0, y, 520, 64, 0x142038, 1)
                    .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
                    .setInteractive({ useHandCursor: true }).setAlpha(0.0);

                const txt = this.add.text(0, y, label, {
                    fontFamily: "Arial", fontSize: "26px", color: "#ffffff",
                }).setOrigin(0.5).setAlpha(0.0);

                // hover feedback for button
                btn.on("pointerover", () => btn.setFillStyle(0x1d2b52, 1));
                btn.on("pointerout",  () => btn.setFillStyle(0x142038, 1));

                // select difficulty when either rect or label is pressed
                const choose = () => finalizeSelection(key, btn, txt);
                btn.on("pointerdown", choose);
                txt.on("pointerdown", choose);

                content.add([btn, txt]);
                return { btn, txt };
            };

            // build three buttons with spacing
            const gap = 78, baseY = 120;
            const b1 = makeBtn("Easy",   baseY,           "easy");
            const b2 = makeBtn("Normal", baseY + gap,     "normal");
            const b3 = makeBtn("Hard",   baseY + 2 * gap, "hard");

            content.add([title]);

            // animate the panel opening and reveal contents smoothly
            this.tweens.add({
                targets: panelRect,
                height: panelFinalH,
                duration: 380,
                ease: "Cubic.Out",
                onUpdate: (tw, target) => {
                    const a = Phaser.Math.Easing.Cubic.Out(
                        Phaser.Math.Clamp(target.height / panelFinalH, 0, 1)
                    );
                    title.setAlpha(a);
                    [b1.btn, b1.txt, b2.btn, b2.txt, b3.btn, b3.txt].forEach(o => o.setAlpha(a));
                },
                onComplete: () => {
                    // ensure full opacity after animation
                    title.setAlpha(1);
                    [b1.btn, b1.txt, b2.btn, b2.txt, b3.btn, b3.txt].forEach(o => o.setAlpha(1));
                }
            });

            // prevent further clicks after one selection
            const disableAll = () => {
                [b1, b2, b3].forEach(({ btn, txt }) => { btn.disableInteractive(); txt.disableInteractive(); });
            };

            // finalize selection then transition to mode panel
            const finalizeSelection = (difficultyKey, btn, txt) => {
                if (this._navigating) return;
                this.registry.set("difficulty", difficultyKey);
                selectedDifficulty = difficultyKey;
                disableAll();

                // small blink feedback on chosen button then collapse panel
                this.tweens.add({
                    targets: [btn, txt],
                    alpha: 0.4, yoyo: true, duration: 120, repeat: 1,
                    onComplete: () => {
                        // collapse difficulty panel then show mode panel
                        this.tweens.add({
                            targets: panelRect, height: 10, duration: 160, ease: "Cubic.In",
                            onComplete: () => {
                                content.clearMask(true);
                                panelRect.destroy(); content.destroy();
                                this.showModePanel(selectedDifficulty);
                            },
                        });
                    },
                });
            };

            // keyboard shortcuts for quick selection
            this.input.keyboard.once("keydown-ONE",   () => finalizeSelection("easy",   b1.btn, b1.txt));
            this.input.keyboard.once("keydown-TWO",   () => finalizeSelection("normal", b2.btn, b2.txt));
            this.input.keyboard.once("keydown-THREE", () => finalizeSelection("hard",   b3.btn, b3.txt));
        };

        // function to build the mode selection panel after difficulty
        this.showModePanel = (difficulty) => {
            const cx = this.scale.width / 2;
            const cy = this.scale.height / 2;

            const PANEL_W = 780;
            const PANEL_H = 360;

            // background panel starts vertically collapsed then expands
            const bg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0xffffff, 0.96)
                .setOrigin(0.5)
                .setStrokeStyle(3, 0x000000)
                .setDepth(60)
                .setScale(1, 0.01);

            // container for interactive content fades in after bg expands
            const content = this.add.container(cx, cy).setDepth(61).setAlpha(0);

            // title label for the panel
            const title = this.add.text(0, -PANEL_H / 2 + 28, "Choose a game", {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "44px",
                color: "#000",
                align: "center",
            }).setOrigin(0.5, 0);
            content.add(title);

            // helper to create a standard button with label and handler
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
                    fixedWidth: Bw,
                }).setOrigin(0.5);

                rect.on("pointerover", () => rect.setFillStyle(0x1d2b52));
                rect.on("pointerout",  () => rect.setFillStyle(0x142038));
                rect.on("pointerdown", onClick);
                txt.on("pointerdown", onClick);

                content.add([rect, txt]);
                return { rect, txt };
            };

            // build three mode buttons with equal spacing
            const GAP = 86;
            makeBtn("Play Soap Splash",  -GAP, () => go("SoapSplash"));
            makeBtn("Play Clean Catch", 0, () => {
                soapSplashMusic.play().catch(() => {
                    console.log("User interaction required before playing music.");
                });
                go("CleanCatch");
            });

            makeBtn("Explore Playground",  GAP, () => go("PlaygroundScene"));

            // animate panel open then fade in the content
            this.tweens.add({
                targets: bg,
                scaleY: 1,
                duration: 280,
                ease: "Cubic.Out",
                onComplete: () => {
                    this.tweens.add({ targets: content, alpha: 1, duration: 160, ease: "Quadratic.Out" });
                }
            });

            // go switches to the chosen scene with difficulty and player name
            const go = (sceneKey) => {
                // mark that we are leaving to avoid double clicks
                this._navigating = true;

                const data = {
                    difficulty,
                    playerName: this.registry.get("playerName")
                };
                // fade camera then start the target scene
                this.cameras.main.fade(220, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    bg.destroy(); content.destroy();
                    this.scene.start(sceneKey, data);
                });
            };

            // put a minimal topbar with home that returns to this scene state
            systems.ui.topbar(this, {
                onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") })
            });

            // allow escape to back out to menu
            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });
        };
    }
}
