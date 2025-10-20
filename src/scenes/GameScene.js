import systems from "../systems.js";
import { DB } from "../db.js";

// define the main hub scene for the game flow
export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this._typing = null;      // typewriter state
        this._navigating = false; // prevent double transitions
    }

    create(data) {
        if (data?.playerName) this.registry.set("playerName", data.playerName);
        const playerName = this.registry.get("playerName") || "Player";

        const { width, height } = this.scale;

        // background
        this.add.image(0, 0, "playground_bg")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setDepth(-10);

        this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
            .setOrigin(0)
            .setDepth(-9);

        if (!window.__SESSION_ID__) window.__SESSION_ID__ = DB.beginSession(playerName);

        // Kiko
        const kiko = this.add.image(width * 0.32, height * 0.8, "kiko_base")
            .setDisplaySize(600, 600)
            .setOrigin(0.5, 1);

        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // ── Intro bubble (aspect-fit)
        const bubbleX = width * 0.62;
        const bubbleY = height * 0.5;
        const maxW = 720, maxH = 180;

        const frame = this.textures.getFrame("dialog_skin");
        const texW = frame ? frame.width : this.textures.get("dialog_skin").getSourceImage().width;
        const texH = frame ? frame.height : this.textures.get("dialog_skin").getSourceImage().height;

        const scale = Math.min(maxW / texW, maxH / texH) * 2; // enlargement factor
        const dispW = Math.round(texW * scale);
        const dispH = Math.round(texH * scale);

        const bubble = this.add.image(bubbleX, bubbleY, "dialog_skin")
            .setOrigin(0.5)
            .setDisplaySize(dispW, dispH)
            .setDepth(5);

        const TEXT_PADDING = 180;

        const greetText = this.add.text(bubbleX, bubbleY - 4, "", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "48px",
            color: "#000000",
            align: "center",
            wordWrap: { width: dispW - TEXT_PADDING },
        }).setOrigin(0.5).setDepth(6);

        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help me today?`,
            "Select your difficulty!",
        ];

        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };
        const updateNextLabel = () => {};

        const startTyping = (msg, speed = 50) => {
            if (this._typing.timer) { this._typing.timer.remove(false); this._typing.timer = null; }
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

        // Next button (green arrow image)
        const nextBtn = this.add.image(
            bubbleX + dispW / 2 - 80,
            bubbleY + dispH / 2 - 20,
            "ui_arrow_right"
        )
            .setOrigin(0.5)
            .setDisplaySize(90, 90)
            .setInteractive({ useHandCursor: true })
            .setDepth(7);

        // subtle hover (relative)
        const baseScaleX = nextBtn.scaleX, baseScaleY = nextBtn.scaleY;
        nextBtn.on("pointerover", () => nextBtn.setScale(baseScaleX * 1.08, baseScaleY * 1.08));
        nextBtn.on("pointerout",  () => nextBtn.setScale(baseScaleX, baseScaleY));

        const onNext = () => {
            if (this._typing.isRunning) {
                if (this._typing.timer) { this._typing.timer.remove(false); this._typing.timer = null; }
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
                bubble.destroy(); greetText.destroy(); nextBtn.destroy();
                this.showDifficultyPanel({ bubbleX, bubbleY, bubbleW: dispW, bubbleH: dispH });
            }
        };

        nextBtn.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        startTyping(messages[0]);

        // ─────────────────────────────────────────────
        // Difficulty panel: same size as intro bubble
        // ─────────────────────────────────────────────
        this.showDifficultyPanel = ({ bubbleX, bubbleY, bubbleW, bubbleH }) => {
            // same size as intro
            const pW = bubbleW;
            const pH = bubbleH;

            // move lower so it doesn't cover Kiko's ear
            const panelX = bubbleX;
            const panelY = bubbleY + 80;

            const panel = this.add.image(panelX, panelY, "dialog_skin")
                .setOrigin(0.5)
                .setDisplaySize(pW, pH)
                .setDepth(50);

            const title = this.add.text(panelX, panelY - pH / 2 + 24, "Select your difficulty!", {
                fontFamily: CONFIG?.ui?.fontFamily || "Arial",
                fontSize: "44px",
                color: "#000000",
                align: "center",
                wordWrap: { width: pW - 160 },
            }).setOrigin(0.5, 0).setDepth(51);

            // buttons sized to bubble width
            const Bw = Math.min(520, pW - 200);
            const Bh = 64;

            const content = this.add.container(panelX, panelY).setDepth(51);

            const makeBtn = (label, y, key) => {
                const rect = this.add.rectangle(0, y, Bw, Bh, 0x142038, 1)
                    .setOrigin(0.5)
                    .setStrokeStyle(2, 0xffffff)
                    .setInteractive({ useHandCursor: true });

                const txt = this.add.text(0, y, label, {
                    fontFamily: "Arial",
                    fontSize: "26px",
                    color: "#ffffff",
                    align: "center",
                    fixedWidth: Bw,
                }).setOrigin(0.5);

                rect.on("pointerover", () => rect.setFillStyle(0x1d2b52));
                rect.on("pointerout",  () => rect.setFillStyle(0x142038));

                const choose = () => finalizeSelection(key, rect, txt);
                rect.on("pointerdown", choose);
                txt.on("pointerdown", choose);

                content.add([rect, txt]);
                return { rect, txt };
            };

            const GAP = 70;
            const baseY = 30;
            const b1 = makeBtn("Easy",   baseY,           "easy");
            const b2 = makeBtn("Normal", baseY + GAP,     "normal");
            const b3 = makeBtn("Hard",   baseY + GAP * 2, "hard");

            const disableAll = () => {
                [b1, b2, b3].forEach(({ rect, txt }) => { rect.disableInteractive(); txt.disableInteractive(); });
            };

            // click blink then proceed
            const finalizeSelection = (difficultyKey, rect, txt) => {
                if (this._navigating) return;
                this.registry.set("difficulty", difficultyKey);
                disableAll();

                this.tweens.add({
                    targets: [rect, txt],
                    alpha: 0.4,
                    yoyo: true,
                    duration: 120,
                    repeat: 1,
                    onComplete: () => {
                        panel.destroy(); content.destroy(); title.destroy();
                        this.showModePanel(difficultyKey);
                    }
                });
            };

            // keyboard shortcuts
            this.input.keyboard.once("keydown-ONE",   () => finalizeSelection("easy",   b1.rect, b1.txt));
            this.input.keyboard.once("keydown-TWO",   () => finalizeSelection("normal", b2.rect, b2.txt));
            this.input.keyboard.once("keydown-THREE", () => finalizeSelection("hard",   b3.rect, b3.txt));
        };

        // ─────────────────────────────────────────────
        // Mode selection panel (unchanged)
        // ─────────────────────────────────────────────
        this.showModePanel = (difficulty) => {
            const cx = this.scale.width / 2;
            const cy = this.scale.height / 2;

            const PANEL_W = 780, PANEL_H = 360;

            const bg = this.add.rectangle(cx, cy, PANEL_W, PANEL_H, 0xffffff, 0.96)
                .setOrigin(0.5)
                .setStrokeStyle(3, 0x000000)
                .setDepth(60)
                .setScale(1, 0.01);

            const content = this.add.container(cx, cy).setDepth(61).setAlpha(0);

            const title = this.add.text(0, -PANEL_H / 2 + 28, "Choose a game", {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "44px",
                color: "#000",
                align: "center",
            }).setOrigin(0.5, 0);
            content.add(title);

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

            const GAP = 86;
            makeBtn("Play Soap Splash",  -GAP, () => go("SoapSplash"));
            makeBtn("Play Clean Catch",    0,   () => go("CleanCatch"));
            makeBtn("Explore Playground",  GAP, () => go("PlaygroundScene"));

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
                this._navigating = true;
                const data = { difficulty, playerName: this.registry.get("playerName") };
                this.cameras.main.fade(220, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    bg.destroy(); content.destroy();
                    this.scene.start(sceneKey, data);
                });
            };

            systems.ui.topbar(this, {
                onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") })
            });

            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });
        };
    }
}
