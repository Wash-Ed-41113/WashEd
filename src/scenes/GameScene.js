/**
 * MODULE: GameScene (Phaser.Scene)
 * -----------------------------------------------------------------------------
 * Purpose
 *   Entry hub for “Kiko’s Day” after boot/preload. Welcomes the player,
 *   collects/stores player name, lets them pick difficulty, and routes to either
 *   the hub (Playground) or a chosen mini-game. Owns no gameplay itself; it
 *   orchestrates UI, session creation, and scene transitions.
 *
 * Public surface (exports)
 *   - default export class GameScene extends Phaser.Scene
 *
 * Invariants
 *   - Player name is persisted in Phaser registry key "playerName" once known.
 *   - A DB session exists in window.__SESSION_ID__ before launching a game scene.
 *   - Registry "difficulty" ∈ {1,2,3} (mapped from {easy,normal,hard} when used).
 *   - Sound mute state mirrors registry key "mute".
 *
 * Dependencies
 *   - ../systems.js  (as `systems`)
 *       UI helpers (logo/topbar/toasts), dev keybinds, general utilities.
 *   - ../db.js       (as `DB`)
 *       Session lifecycle (beginSession) and later round scaffolding by other scenes.
 *   - Phaser 3       (framework)
 *       Scene lifecycle, input, tweens, DOM/text rendering.
 *
 */

import systems from "../systems.js";
import { DB } from "../db.js";

/**
 * Class: GameScene
 * Responsibility
 *   Present the landing conversation, handle difficulty selection, and navigate
 *   to the hub or chosen mini-game while ensuring a DB session exists.
 *
 * Collaborators
 *   - systems.ui (logo, topbar, toasts), DB (session), downstream scenes:
 *     MenuScene, PlaygroundScene, SoapSplash, SoapSplashExplain, LeaderboardScene,
 *     EndingScene.
 *
 * Construction & lifecycle
 *   - constructor(): set small state flags.
 *   - create(data): wire greeting → difficulty → mode panel, then route.
 *   - Scene transitions dispose timers/listeners via explicit cleanup.
 *
 * Thread-safety / mutability
 *   - Single-threaded Phaser runtime. Internal flags (`_typing`, `_navigating`)
 *     protect against double-invocation.
 *
 * Complexity hotspots
 *   - None. Typewriter effect uses a short repeating timer and string concat.
 *
 * Serialization / formats
 *   - N/A. Reads/writes registry keys ("playerName", "difficulty", "mute").
 *
 * Example (minimal)
 *   // Add to Phaser config as a scene and start:
 *   this.scene.add("GameScene", GameScene, true);
 */
export default class GameScene extends Phaser.Scene {
    constructor() {
        super("GameScene");
        /** @private {null|{timer:Phaser.Time.TimerEvent|null,msgIndex:number,isRunning:boolean,currentFull:string}} */
        this._typing = null;
        /** @private {boolean} prevents double navigation while tweening/transitioning */
        this._navigating = false;
    }

    /**
     * Method: create
     * What it does (one line):
     *   Builds greeting + choice UI, ensures a DB session, manages mute state,
     *   and routes to hub or mini-game based on user actions/params.
     *
     * Parameters
     *   @param {{playerName?:string, skipDifficulty?:boolean, route?:'hub'|'menu'|string}} [data]
     *     - playerName: optional initial name to stash into registry.
     *     - skipDifficulty: when true, jump straight to hub/mode menu.
     *     - route: when 'hub', send user to the hub/Playground flow.
     *
     * Returns
     *   void (Phaser scene side-effects and scene switches).
     *
     * Side effects
     *   - Writes to this.registry ("playerName","difficulty","mute").
     *   - May set window.__SESSION_ID__ (DB session).
     *   - Installs timers, input handlers; starts other scenes.
     *
     * Preconditions / postconditions
     *   - Pre: PreloadScene has loaded assets; CONFIG is available.
     *   - Post: If user proceeds, exactly one next scene is started and local UI
     *     timers/handlers are cleaned up or become unreachable.
     *
     * Errors/exceptions
     *   - Best-effort guards; recover by no-op if optional APIs absent.
     *
     * Determinism & idempotency
     *   - Deterministic given same inputs/user interactions. Not idempotent
     *     (creates UI/timers each call).
     */
    create(data) {
        // Persist incoming name if provided.
        if (data?.playerName) this.registry.set("playerName", data.playerName);

        const playerName = this.registry.get("playerName") || "Player";

        // Brand watermark (non-blocking). Pure side-effect.
        systems.ui.placeLogo(this);

        // --- Early fast-path: hub / dev route --------------------------------
        /** When true, skip difficulty, ensure session, and go straight to hub/mode. */
        const skipDifficulty = !!data?.skipDifficulty;
        if (skipDifficulty || data?.route === "hub") {
            // Ensure session invariant before leaving.
            if (!window.__SESSION_ID__) {
                window.__SESSION_ID__ = DB.beginSession(playerName);
            }
            const difficulty = this.registry.get("difficulty") || 2;

            // Allow subclasses/variants to override hub or mode panel.
            if (typeof this.showHubMenu === "function") {
                this.showHubMenu();
                return;
            }
            if (typeof this.showModePanel === "function") {
                this.showModePanel(difficulty);
                return;
            }

            // Default: go to hub scene.
            this.scene.start("PlaygroundScene", { playerName, difficulty });
            return;
        }

        // --- Audio mute handshake (mirrors registry<->Phaser.Sound) -----------
        const initialMute = !!this.registry.get("mute");
        if (this.sound) this.sound.mute = initialMute;
        // NOTE: "soapSplashMusic" is referenced defensively for legacy code; safe if absent.
        try { soapSplashMusic.muted = initialMute; } catch (_) {}
        this.registry.events?.on("changedata-mute", (_key, _prev, v) => {
            if (this.sound) this.sound.mute = !!v;
            try { soapSplashMusic.muted = !!v; } catch (_) {}
        });

        // --- Session guard (idempotent) ---------------------------------------
        const { width, height } = this.scale;
        if (!window.__SESSION_ID__) {
            window.__SESSION_ID__ = DB.beginSession(playerName);
        }

        // --- Greeting character + subtle idle tween ---------------------------
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

        // --- Dialog bubble -----------------------------------------------------
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

        // Conversation script (small, linear).
        const messages = [
            `Hi, ${playerName}!`,
            `Welcome to Kiko's Day!`,
            `Can you help me today?`,
            "Select your difficulty!",
        ];

        // Typewriter pacing.
        const TYPE_BASE_MS   = 9000;
        const PUNCT_PAUSE_MS = { ",": 140, ".": 280, "!": 280, "?": 280, "…": 320, ";": 160, ":": 160 };

        this._typing = { timer: null, msgIndex: 0, isRunning: false, currentFull: "" };

        /** Internal: reflect typing state to CTA label. */
        const updateNextLabel = () => {
            if (this._typing.isRunning) nextLabel.setText("Skip");
            else nextLabel.setText(this._typing.msgIndex >= messages.length - 1 ? "Done" : "Next ▶");
        };

        /**
         * startTyping(msg)
         * What: animates the typewriter effect for a line and updates the cursor.
         * Params:
         *   - msg {string} non-empty UI string.
         * Returns: void. Side-effects: greetText content & timer installation.
         * Notes: idempotently clears previous timer; deterministic given msg.
         */
        const startTyping = (msg) => {
            if (this._typing.timer) {
                this._typing.timer.remove(false);
                this._typing.timer = null;
            }

            greetText.setText("");
            this._typing.isRunning = true;
            this._typing.currentFull = msg;

            // Inline “cursor” with subtle blink.
            let cursor = this.add.text(
                greetText.x + greetText.displayWidth / 2 + 6, greetText.y, "│",
                { fontFamily: greetText.style.fontFamily, fontSize: greetText.style.fontSize, color: "#000000" }
            ).setOrigin(0, 0.5).setDepth(greetText.depth + 1);
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

        // --- Next/Skip control -------------------------------------------------
        const nextBtn = this.add
            .rectangle(bubbleX + bubbleW / 2 - 110, bubbleY + bubbleH / 2 - 20, 180, 56, 0x111111, 0.85)
            .setStrokeStyle(2, 0xffffff).setOrigin(0.5)
            .setInteractive({ useHandCursor: true }).setDepth(6);

        const nextLabel = this.add
            .text(nextBtn.x, nextBtn.y, "Next ", {
                fontFamily: CONFIG.ui.fontFamily, fontSize: "22px", color: "#ffffff",
            })
            .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(7);

        /**
         * onNext()
         * What: advances typing (reveal/skip), or transitions to difficulty panel.
         * Params: none. Returns: void.
         * Side effects: stops timers, removes listeners, starts panel tween.
         * Preconditions: not navigating. Post: either more text or difficulty panel shown.
         */
        const onNext = () => {
            if (this._navigating) return;

            // If line is mid-type, reveal immediately.
            if (this._typing.isRunning) {
                if (this._typing.timer) { this._typing.timer.remove(false); this._typing.timer = null; }
                this._typing.isRunning = false;
                greetText.setText(this._typing.currentFull);
                return;
            }

            // Move to next line or end dialog.
            if (this._typing.msgIndex < messages.length - 1) {
                this._typing.msgIndex += 1;
                startTyping(messages[this._typing.msgIndex]);
                return;
            }

            // Dialog finished → animate out and show difficulty.
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

        /** Dev helpers: ENTER => next; S => SoapSplash; L => Leaderboard/Ending. */
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

        // Pointer & keyboard bindings for Next.
        nextBtn.on("pointerdown", onNext);
        nextLabel.on("pointerdown", onNext);
        this.input.keyboard.on("keydown-SPACE", onNext);
        this.input.keyboard.on("keydown-ENTER", onNext);

        // Begin dialog.
        startTyping(messages[0]);

        /**
         * showDifficultyPanel(ctx)
         * What: animates in a difficulty panel (Easy/Normal/Hard), maps to 1/2/3,
         *       stores registry value, then calls showModePanel().
         * Params:
         *   - ctx {object} geometry for where to place the panel (bubbleX/Y/W/H).
         * Return: void.
         * Side effects: sets registry.difficulty ∈ {1,2,3}; installs temporary key
         *               handlers 1/2/3; launches tweens.
         */
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

            // Factory for one button row.
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

            // Slide-open animation with alpha reveal.
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

            // Disable all interactions once a choice is made.
            const disableAll = () => {
                [b1, b2, b3].forEach(({ btn, txt }) => { btn.disableInteractive(); txt.disableInteractive(); });
            };

            /**
             * finalizeSelection(difficultyKey, btn, txt)
             * Maps "easy|normal|hard" → 1|2|3, sets registry, provides feedback, and
             * then transitions to the mode picker.
             */
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

            // Keyboard shortcuts: 1/2/3 (also numpad).
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

        /**
         * showModePanel(difficulty)
         * What: modal chooser for which game flow to launch next.
         * Params:
         *   - difficulty {1|2|3|string} accepted as numeric or label; forwarded
         *     untouched to next scene (SoapSplash/CleanCatch/etc.).
         * Returns: void. Side effects: scene transition on click/keys.
         */
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

            // Standardized button builder (uses CONFIG.ui.button dims).
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

            // Animate panel in, then reveal content.
            this.tweens.add({
                targets: bg,
                scaleY: 1,
                duration: 280,
                ease: "Cubic.Out",
                onComplete: () => {
                    this.tweens.add({ targets: content, alpha: 1, duration: 160, ease: "Quadratic.Out" });
                }
            });

            // Helper to transition to a scene key with fade.
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

            // Topbar with optional Home and live mute toggle.
            systems.ui.topbar(this, {
                onHome: () => this.scene.start("GameScene", { playerName: this.registry.get("playerName") }),
                showMute: true
            });

            // Escape returns to MenuScene.
            this.input.keyboard.once("keydown-ESC", () => {
                bg.destroy(); content.destroy();
                this.scene.start("MenuScene");
            });

            // Quick keys
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

        // Dev difficulty hotkeys (1/2/3) to set registry immediately.
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
