// this file is the main hub scene that greets the player and routes them to difficulty and game mode
// it relies on systems ui helpers and db session tracking and phaser scene lifecycle
// scope is limited to showing the intro messages building a difficulty picker and then opening game scenes

import systems from "../systems.js";
import { DB } from "../db.js";

// imports
// brings in shared helpers via systems and a simple persistence api via db
// nothing is executed at import time only symbols are referenced later in create

export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        this._typing = null;
        this._navigating = false;
    }

    // class header and constructor
    // registers the scene key gamescene and sets up two flags
    // _typing holds state for the typewriter effect and _navigating guards against double transitions

    create(data) {
        // create start
        // accepts optional data such as playername skipdifficulty and route
        // writes playername into the phaser registry for cross scene access and draws the sticky logo
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        const playerName = this.registry.get("playerName") || "Player";

        systems.ui.placeLogo(this);

        // skipdifficulty and hub route branch
        // if skipdifficulty is true or route equals hub then ensure a session id exists in db
        // prefer your own hub functions if present showhubmenu or showmodepanel otherwise fall back to playgroundscene
        // returns early to avoid building the greeting ui when jumping straight to hub
        const skipDifficulty = !!data?.skipDifficulty;
        if (skipDifficulty || data?.route === "hub") {
            if (!window.__SESSION_ID__) {
                window.__SESSION_ID__ = DB.beginSession(playerName);
            }
            const difficulty = this.registry.get("difficulty") || 2;

            if (typeof this.showHubMenu === "function") {
                this.showHubMenu();
                return;
            }

            if (typeof this.showModePanel === "function") {
                this.showModePanel(difficulty);
                return;
            }

            this.scene.start("PlaygroundScene", { playerName, difficulty });
            return;
        }

        // mute wiring
        // keeps audio mute state in sync across phaser sound registry and any external htmlaudio element soapsplashmusic
        // reacts to changedata mute so the toggle in other scenes updates this scene immediately
        const initialMute = !!this.registry.get("mute");
        if (this.sound) this.sound.mute = initialMute;
        try { soapSplashMusic.muted = initialMute; } catch (_) {}
        this.registry.events?.on("changedata-mute", (_key, _prev, v) => {
            if (this.sound) this.sound.mute = !!v;
            try { soapSplashMusic.muted = !!v; } catch (_) {}
        });
        const { width, height } = this.scale;

        // session bootstrap and kiko sprite
        // ensures a db session exists then adds the kiko_base image pinned to bottom and applies a gentle idle tween
        // tween uses sine ease and infinite yoyo to keep kiko lively while text animates
        if (!window.__SESSION_ID__) {
            window.__SESSION_ID__ = DB.beginSession(playerName);
        }

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
            ease: "Sine.easeInOut",
        });

        // speech bubble layout
        // computes bubble center and size then draws a rounded white rectangle and a text object for the greeting
        // text uses config ui font family and wraps within the bubble width
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
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "48px",
                color: "#000000",
                wordWrap: { width: bubbleW - 40 },
            })
            .setOrigin(0.5)
            .setDepth(6);

        // greeting messages and timing constants
        // messages is the rotating script for the typewriter experience personalizing with playername
        // type_base_ms is the per character delay and punct_pause_ms adds a small pause near punctuation for readability
        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help me today?`,
            "Select your difficulty!",
        ];

        const TYPE_BASE_MS   = 9000;
        const PUNCT_PAUSE_MS = { ",": 140, ".": 280, "!": 280, "?": 280, "…": 320, ";": 160, ":": 160 };

        // typing state and next label updater
        // _typing tracks the timer index running flag and full message
        // updatenextlabel switches the button copy between skip next and done based on typing progress
        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };

        const updateNextLabel = () => {
            if (this._typing.isRunning) nextLabel.setText("Skip");
            else nextLabel.setText(this._typing.msgIndex >= messages.length - 1 ? "Done" : "Next ▶");
        };

        // starttyping function
        // cancels any previous timer clears the text and starts adding characters one by one
        // places a soft blinking cursor at the end of the text and advances with punctuation aware delays
        // when the message completes it stops the cursor tween clears the timer and updates the next button state
        const startTyping = (msg) => {
            if (this._typing.timer) {
                this._typing.timer.remove(false);
                this._typing.timer = null;
            }

            greetText.setText("");
            this._typing.isRunning = true;
            this._typing.currentFull = msg;

            let cursor = this.add.text(greetText.x + greetText.displayWidth / 2 + 6, greetText.y, "│", {
                fontFamily: greetText.style.fontFamily,
                fontSize: greetText.style.fontSize,
                color: "#000000",
            }).setOrigin(0, 0.5).setDepth(greetText.depth + 1);
            const cursorTw = this.tweens.add({ targets: cursor, alpha: { from: 1, to: 0.25 }, duration: 450, yoyo: true, repeat: -1 });

            let i = 0;

            const step = () => {
                const ch = msg[i];
                greetText.text += ch;
                i++;

                cursor.setPosition(greetText.getTopRight().x + 6, greetText.y);

                if (i >= msg.length) {
                    this._typing.isRunning = false;
                    this._typing.timer = null;
                    cursorTw?.stop(); cursor.destroy();
                    updateNextLabel();
                    return;
                }

                const nextCh = msg[i] ?? "";
                const pause  = Math.max(PUNCT_PAUSE_MS[ch] ?? 0, PUNCT_PAUSE_MS[nextCh] ?? 0);
                const delay  = TYPE_BASE_MS + pause;

                this._typing.timer = this.time.delayedCall(delay, step);
            };

            this._typing.timer = this.time.delayedCall(TYPE_BASE_MS, step);
            updateNextLabel();
        };

        // next button visuals
        // draws a dark rounded rectangle and a white label stacked above it both interactive and at higher depth
        // the label mirrors button interactions so keyboard and mouse clicks feel identical
        const nextBtn = this.add
            .rectangle(bubbleX + bubbleW / 2 - 110, bubbleY + bubbleH / 2 - 20, 180, 56, 0x111111, 0.85)
            .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).setDepth(6);

        const nextLabel = this.add
            .text(nextBtn.x, nextBtn.y, "Next ", {
                fontFamily: CONFIG.ui.fontFamily, fontSize: "22px", color: "#ffffff",
            })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

        // onnext handler
        // if a transition is already running it exits early
        // if the typewriter is active it fast forwards and prints the whole message
        // otherwise it advances to the next message or fades out the bubble and builds the difficulty panel
        // removes bound listeners before continuing to avoid accidental double fires
        const onNext = () => {
            if (this._navigating) return;

            if (this._typing.isRunning) {
                if (this._typing.timer) { this._typing.timer.remove(false); this._typing.timer = null; }
                this._typing.isRunning = false;
                greetText.setText(this._typing.currentFull);
                return;
            }

            if (this._typing.msgIndex < messages.length - 1) {
                this._typing.msgIndex += 1;
                startTyping(messages[this._typing.msgIndex]);
                return;
            }

            this._navigating = true;
            this.input.keyboard.off("keydown-SPACE", onNext);
            this.input.keyboard.off("keydown-ENTER", onNext);

            nextBtn?.removeAllListeners?.();
            nextLabel?.removeAllListeners?.();

            this.tweens.add({
                targets: [bubble, greetText, nextBtn, nextLabel],
                alpha: 0,
                duration: 280,
                ease: "Cubic.Out",
                onComplete: () => {
                    bubble?.destroy?.();
                    greetText?.destroy?.();
                    nextBtn?.destroy?.();
                    nextLabel?.destroy?.();

                    this.input.enabled = true;
                    this._navigating = false;

                    this.showDifficultyPanel({ bubbleX, bubbleY, bubbleW, bubbleH });
                }
            });
        };

        // developer hotkeys binder
        // binds enter to advance s to launch soapsplash side by side with its explain scene and l to open leaderboard or ending
        // cleans the temporary keys on scene shutdown to avoid leaks across reloads
        const bindDevKeys = () => {
            const ENTER = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
            const S     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            const L     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);

            ENTER.on("down", () => onNext?.());
            S.on("down", () => {
                if (this._navigating) return;
                const data = {
                    playerName: this.registry.get("playerName") || "Player",
                    difficulty: this.registry.get("difficulty") || 2,
                };
                this.scene.start("SoapSplashExplain", { parentKey: "SoapSplash" });
                this.scene.launch("SoapSplash", data);
            });
            L.on("down", () => {
                if (this._navigating) return;
                if (this.scene.get("LeaderboardScene")) this.scene.start("LeaderboardScene");
                else if (this.scene.get("EndingScene")) this.scene.start("EndingScene");
            });

            this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
                ENTER.destroy(); S.destroy(); L.destroy();
            });
        };
        bindDevKeys();

        // wire interactions and kick off typing
        // connects mouse clicks and space or enter to onnext and starts the first greeting line
        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        startTyping(messages[0]);

        // showdifficultypanel definition
        // creates a masked white panel that slides open above the bubble and reveals a title and three buttons
        // easy normal and hard buttons call finalizeselection and are also mapped to keys 1 2 3 including numpad variants
        // when a choice is made it writes difficulty into the registry gives a quick toast and collapses the panel
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
                fontFamily: CONFIG.ui.fontFamily, fontSize: "44px", color: "#000000",
            }).setOrigin(0.5, 0).setAlpha(0.0);

            let selectedDifficulty = null;

            const makeBtn = (label, y, key) => {
                const btn = this.add.rectangle(0, y, 520, 64, 0x142038, 1)
                    .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
                    .setInteractive({ useHandCursor: true }).setAlpha(0.0);

                const txt = this.add.text(0, y, label, {
                    fontFamily: CONFIG.ui.fontFamily, fontSize: "26px", color: "#ffffff",
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
                    title.setAlpha(1);
                    [b1.btn, b1.txt, b2.btn, b2.txt, b3.btn, b3.txt].forEach(o => o.setAlpha(1));
                }
            });

            // finalizeselection internals
            // guards against re entry with _navigating disables all inputs and maps key names to numeric levels
            // collapses the panel then calls showmodepanel with the chosen difficulty after cleaning up key listeners
            const disableAll = () => {
                [b1, b2, b3].forEach(({ btn, txt }) => { btn.disableInteractive(); txt.disableInteractive(); });
            };

            const finalizeSelection = (difficultyKey, btn, txt) => {
                if (this._navigating) return;
                this._navigating = true;

                const lvlMap = { easy: 1, normal: 2, hard: 3 };
                const chosen = lvlMap[difficultyKey] ?? 2;
                this.registry.set("difficulty", chosen);

                selectedDifficulty = difficultyKey;
                disableAll();

                systems?.ui?.toast?.(this, `Difficulty: ${difficultyKey.toUpperCase()}`, { ms: 900 });
                this.tweens.add({
                    targets: [btn, txt],
                    alpha: 0.4, yoyo: true, duration: 120, repeat: 1,
                    onComplete: () => {
                        this.tweens.add({
                            targets: panelRect, height: 10, duration: 160, ease: "Cubic.In",
                            onComplete: () => {
                                content.clearMask(true);
                                panelRect.destroy(); content.destroy();
                                // cleanup key bindings before moving on
                                cleanupKeys();
                                this.showModePanel(selectedDifficulty);
                                this._navigating = false;
                            },
                        });
                    },
                });
            };

            const keys = this.input.keyboard.addKeys({
                one:   Phaser.Input.Keyboard.KeyCodes.ONE,
                two:   Phaser.Input.Keyboard.KeyCodes.TWO,
                three: Phaser.Input.Keyboard.KeyCodes.THREE,
                n1:    Phaser.Input.Keyboard.KeyCodes.NUMPAD_ONE,
                n2:    Phaser.Input.Keyboard.KeyCodes.NUMPAD_TWO,
                n3:    Phaser.Input.Keyboard.KeyCodes.NUMPAD_THREE,
            });

            const on1 = () => finalizeSelection("easy",   b1.btn, b1.txt);
            const on2 = () => finalizeSelection("normal", b2.btn, b2.txt);
            const on3 = () => finalizeSelection("hard",   b3.btn, b3.txt);

            keys.one.on("down", on1); keys.n1.on("down", on1);
            keys.two.on("down", on2); keys.n2.on("down", on2);
            keys.three.on("down", on3); keys.n3.on("down", on3);

            const cleanupKeys = () => {
                keys.one.off("down", on1); keys.n1.off("down", on1);
                keys.two.off("down", on2); keys.n2.off("down", on2);
                keys.three.off("down", on3); keys.n3.off("down", on3);
            };

            this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupKeys);
        };

        // showmodepanel definition
        // builds a centered white modal with a scale in animation and then fades in its contents
        // draws a title and uses a helper to make two large rectangular buttons via makebtn logic
        // go function fades out the camera and then starts the requested scene with difficulty and playername
        // systems ui topbar is attached to give home and mute controls and esc closes back to menuscene
        // while the panel is open s jumps to soapsplash and l jumps to leaderboard or ending where available
        this.showModePanel = (difficulty) => {
            const cx = this.scale.width / 2;
            const cy = this.scale.height / 2;

            const PANEL_W = 780;
            const PANEL_H = 360;

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
                    fontFamily: CONFIG.ui.fontFamily,
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

                const data = {
                    difficulty,
                    playerName: this.registry.get("playerName")
                };
                this.cameras.main.fade(220, 0, 0, 0);
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    bg.destroy(); content.destroy();
                    this.scene.start(sceneKey, data);
                });
            };

            systems.ui.topbar(this, {
                onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") }),
                showMute: true
            });

            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });

            const keysMode = this.input.keyboard.addKeys({
                s: Phaser.Input.Keyboard.KeyCodes.S,
                l: Phaser.Input.Keyboard.KeyCodes.L
            });
            keysMode.s.on("down", () => go("SoapSplash"));
            keysMode.l.on("down", () => {
                if (this.scene.get("LeaderboardScene")) this.scene.start("LeaderboardScene");
                else if (this.scene.get("EndingScene")) this.scene.start("EndingScene");
            });
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
                keysMode.s.destroy(); keysMode.l.destroy();
            });
        };

        // dev helpers at bottom
        // if config is in dev mode number keys one two three set the difficulty directly and show a tiny toast
        // useful during testing to skip the picker and verify downstream logic quickly
        if (CONFIG.isDevMode) {
            const setLvl = (n) => {
                this.registry.set("difficulty", n);
                systems?.ui?.toast?.(this, `Dev: difficulty = ${["","easy","normal","hard"][n]}`, { ms: 900 });
            };

            this.input.keyboard.on("keydown-ONE",   () => setLvl(1));
            this.input.keyboard.on("keydown-TWO",   () => setLvl(2));
            this.input.keyboard.on("keydown-THREE", () => setLvl(3));
        }
    }
}
