import systems from "../systems.js";
import { DB } from "../db.js";

const soapSplashMusic = new Audio("assets/sounds/soap splasher.mp3");
soapSplashMusic.loop = true;

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

        // ─────────────────────────────────────────────────────────────
        // (3) BYPASS OLD DIFFICULTY WHEN ASKED → jump straight to hub
        // ─────────────────────────────────────────────────────────────
        const skipDifficulty = !!data?.skipDifficulty;
        if (skipDifficulty || data?.route === "hub") {
            // ensure a session exists
            if (!window.__SESSION_ID__) {
                window.__SESSION_ID__ = DB.beginSession(playerName);
            }
            // use existing difficulty or sensible default
            const difficulty = this.registry.get("difficulty") || 2;

            // Prefer a dedicated hub/menu builder if you have one
            if (typeof this.showHubMenu === "function") {
                this.showHubMenu();
                return;
            }

            // If your hub is the mode selector in this scene, call it directly
            if (typeof this.showModePanel === "function") {
                this.showModePanel(difficulty);
                return;
            }

            // Fallback: jump to Playground hub scene if no local hub method exists
            this.scene.start("PlaygroundScene", { playerName, difficulty });
            return;
        }
        // ─────────────────────────────────────────────────────────────

        // ---- keep mute state in sync (Phaser Audio <-> HTMLAudio <-> registry) ----
        const initialMute = !!this.registry.get("mute");
        if (this.sound) this.sound.mute = initialMute;
        try { soapSplashMusic.muted = initialMute; } catch (_) {}
        this.registry.events?.on("changedata-mute", (_key, _prev, v) => {
            if (this.sound) this.sound.mute = !!v;
            try { soapSplashMusic.muted = !!v; } catch (_) {}
        });
        // ---------------------------------------------------------------------------

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

        // --- typewriter tuning ---
        const TYPE_BASE_MS   = 9000;  // ↑ higher = slower
        const PUNCT_PAUSE_MS = { ",": 140, ".": 280, "!": 280, "?": 280, "…": 320, ";": 160, ":": 160 };

        // typing state holds timer current index and flags
        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };

        // helper to update the next button label based on typing state
        const updateNextLabel = () => {
            if (this._typing.isRunning) nextLabel.setText("Skip");
            else nextLabel.setText(this._typing.msgIndex >= messages.length - 1 ? "Done" : "Next ▶");
        };

        // starts typewriter animation for a given message with punctuation-aware pauses
        const startTyping = (msg) => {
            // clear previous timer if any
            if (this._typing.timer) {
                this._typing.timer.remove(false);
                this._typing.timer = null;
            }

            greetText.setText("");
            this._typing.isRunning = true;
            this._typing.currentFull = msg;

            // soft blink cursor while typing
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

                // keep cursor hugging the end of the text
                cursor.setPosition(greetText.getTopRight().x + 6, greetText.y);

                if (i >= msg.length) {
                    // done
                    this._typing.isRunning = false;
                    this._typing.timer = null;
                    cursorTw?.stop(); cursor.destroy();
                    updateNextLabel();
                    return;
                }

                // compute next delay = base + pause on current/next punctuation
                const nextCh = msg[i] ?? "";
                const pause  = Math.max(PUNCT_PAUSE_MS[ch] ?? 0, PUNCT_PAUSE_MS[nextCh] ?? 0);
                const delay  = TYPE_BASE_MS + pause;

                this._typing.timer = this.time.delayedCall(delay, step);
            };

            // kick off first tick
            this._typing.timer = this.time.delayedCall(TYPE_BASE_MS, step);
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
                fontFamily: CONFIG.ui.fontFamily, fontSize: "22px", color: "#ffffff",
            })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

        // click or keypress logic for next behavior
        const onNext = () => {
            if (this._navigating) return;

            // --- still typing? finish instantly ---
            if (this._typing.isRunning) {
                if (this._typing.timer) { this._typing.timer.remove(false); this._typing.timer = null; }
                this._typing.isRunning = false;
                greetText.setText(this._typing.currentFull);
                return;
            }

            // --- next message ---
            if (this._typing.msgIndex < messages.length - 1) {
                this._typing.msgIndex += 1;
                startTyping(messages[this._typing.msgIndex]);
                return;
            }

            // --- transition to difficulty panel ---
            this._navigating = true;

            // unbind keyboard keys to avoid repeat
            this.input.keyboard.off("keydown-SPACE", onNext);
            this.input.keyboard.off("keydown-ENTER", onNext);

            // remove pointer listeners safely
            nextBtn?.removeAllListeners?.();
            nextLabel?.removeAllListeners?.();

            // fade out the speech UI
            this.tweens.add({
                targets: [bubble, greetText, nextBtn, nextLabel],
                alpha: 0,
                duration: 280,
                ease: "Cubic.Out",
                onComplete: () => {
                    // destroy old UI
                    bubble?.destroy?.();
                    greetText?.destroy?.();
                    nextBtn?.destroy?.();
                    nextLabel?.destroy?.();

                    //  re-enable input BEFORE building next panel
                    this.input.enabled = true;
                    this._navigating = false;

                    // show difficulty panel
                    this.showDifficultyPanel({ bubbleX, bubbleY, bubbleW, bubbleH });
                }
            });
        };

        // --- bind once (ENTER also triggers onNext; S/L dev keys) ---
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

        // wire up interactions for next
        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        // start with the first message
        startTyping(messages[0]);

        // function to build the difficulty panel
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

                // quick feedback + collapse
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

            // clean on scene shutdown too (belt & braces)
            this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupKeys);
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

            // (buttons intentionally commented in your file)
            // const GAP = 86;
            // makeBtn("Play Soap Splash",  -GAP, () => go("SoapSplash"));
            // makeBtn("Play Clean Catch", 0, () =>  go("CleanCatchExplain", { difficulty: "hard" }));
            // makeBtn("Explore Playground",  GAP, () => go("PlaygroundScene"));

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

            // put a minimal topbar with home that returns to this scene state. merging
            systems.ui.topbar(this, {
                onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") }),
                // pass showMute: true if you want the toggle visible here
                showMute: true
            });

            // allow escape to back out to menu
            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });

            // optional S/L hotkeys while mode panel is open
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

        if (CONFIG.isDevMode) {
            const setLvl = (n) => {
                this.registry.set("difficulty", n);
                // optional: quick feedback so you know it worked
                systems?.ui?.toast?.(this, `Dev: difficulty = ${["","easy","normal","hard"][n]}`, { ms: 900 });
            };

            this.input.keyboard.on("keydown-ONE",   () => setLvl(1));
            this.input.keyboard.on("keydown-TWO",   () => setLvl(2));
            this.input.keyboard.on("keydown-THREE", () => setLvl(3));
        }
    }
}
