// src/scenes/MenuScene.js
/* global Phaser, CONFIG */

import systems from "../systems.js";
import { DB } from "../db.js";
import { AudioManager } from "../systems.js";

const DLG = { W_FRAC: 0.80, H_FRAC: 0.60 }; // dialog occupies 80% width, 60% height
const getUIFont = () => CONFIG.ui?.fontFamily || "Montserrat";

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
        this.video = null;
        this.fallback = null;

        this.startButton = null;
        this.startShadow = null;
        this.startLabel = null;

        // inside constructor()
        this._leaving = false;      // avoid double transition
        this._audioEnsured = false; // guard for one-time audio unlock (DOM-first)
        this._gateArmed = false;    // NEW: gesture gate armed?
        this._uiBlocker = null;     // NEW: transparent blocker while gating


        this._leaving = false;     // avoid double transition
        this._audioEnsured = false; // guard for one-time audio unlock (DOM-first)
    }

    preload() {
        // Fallback background if video fails
        const BG = (typeof CONFIG !== "undefined" && CONFIG.assets && CONFIG.assets.backgrounds) || {};
        this.load.image("frontpage_background", BG.frontpage || "assets/images/backgrounds/frontpage.png");

        // Background video (muted)
        this.load.video(
            "menu_bg_video",
            "assets/videos/washed_kikos-day_LEVEL_01_scene_01_action_01_launcher.mp4",
            "loadeddata",
            false,
            true // noAudio
        );

        // UI textures
        this.load.image("dialog_skin", "assets/images/UI/washed_kikos-day_UI-dialogue-box-v1.png");
        this.load.image("ui_exit", "assets/images/UI/washed_kikos-day_UI-Button_EXIT.png");
        this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        this.load.image("ui_continue", "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png");

        // Shared BGM key used across scenes
        this.load.audio("kikos_day", "assets/sounds/kikos_day.mp3");
    }

    create(data) {
        // Coming from EndingScene "New Player" path — reset session only
        if (data?.resetSession) {
            window.__SESSION_ID__ = null;
        }

        // Ensure minigame scenes are not lingering
        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        // ─────────────────────────────────────────────==
// AUDIO: gesture-gated start (idempotent, safe)
// ─────────────────────────────────────────────
        try {
            const KEY = "kikos_day";
            const VOL = 0.6;

            const playNow = () => {
                try { AudioManager.stopGroup?.("game"); } catch {}
                try { AudioManager.resumeGroup?.("global"); } catch {}

                let s = this.sound.get(KEY);
                if (!(s?.isPlaying)) {
                    s = s || this.sound.add(KEY, { loop: true, volume: VOL });
                    s.play();
                }

                if (typeof window !== "undefined") {
                    window.__GLOBAL_BGM__ = s;
                    s.once?.("destroy", () => {
                        if (window.__GLOBAL_BGM__ === s) window.__GLOBAL_BGM__ = null;
                    });
                }
            };

            // prevent double-arming across re-entries
            if (!this._gateArmed) {
                this._gateArmed = true;

                // keep a reference for safe teardown
                this._uiBlocker = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0)
                    .setOrigin(0, 0)
                    .setScrollFactor(0)
                    .setDepth(9999)
                    .setInteractive({ useHandCursor: true });

                const safeKillGate = () => {
                    const g = this._uiBlocker;
                    this._uiBlocker = null;
                    if (g && g.scene) {
                        // removeInteractive() avoids touching scene.sys
                        try { g.removeInteractive?.(); } catch {}
                        try { g.destroy?.(); } catch {}
                    }
                };

                const onFirstGesture = () => {
                    // Only run once (protect against multiple sources)
                    if (!this._gateArmed) return;
                    this._gateArmed = false;

                    try { if (this.sound.locked) this.sound.unlock(); } catch {}
                    try { this.sound.context?.resume?.(); } catch {}

                    playNow();
                    // gate may already be gone if Start emitted first — guard it
                    safeKillGate();
                };

                // Use pointer *up* so the gate doesn't eat Start’s click
                this._uiBlocker.once("pointerup", onFirstGesture);
                this.input.keyboard?.once("keydown", onFirstGesture);

                // DOM/other paths can emit this:
                this.events.once("menu:startPressed", onFirstGesture);

                // If already unlocked, kick on next tick
                if (!this.sound.locked) this.time.delayedCall(0, onFirstGesture);
            }

            this.sound.pauseOnBlur = false;
            this.sound.mute = this.registry.get("mute") === true;
        } catch (e) {
            console.warn("[MenuScene] audio bootstrap error:", e);
        }


        // Also ensure DOM-only interactions emit the start signal at least once
        this.ensureAudioStartOnce();

        // ─────────────────────────────────────────────
        // Visual setup
        // ─────────────────────────────────────────────
        systems.ui.placeLogo(this);

        const { width, height } = this.scale;

        this._leaving = false;
        this.input.enabled = true;
        this.tweens.killAll();
        this.cameras.main.resetFX();

        // Fallback background
        this.fallback = this.add
            .image(0, 0, "frontpage_background")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setDepth(-3);

        // Video background
        this.video = this.add
            .video(width / 2, height / 2, "menu_bg_video")
            .setOrigin(0.5)
            .setDepth(-2)
            .setLoop(true);
        this.video.setMute(true).play(true);

        const resizeVideo = () => {
            const W = this.scale.width;
            const H = this.scale.height;
            const vw = this.video.video?.videoWidth || 1280;
            const vh = this.video.video?.videoHeight || 720;
            const vr = vw / vh;
            const sr = W / H;

            let dw, dh;
            if (vr > sr) { dh = H; dw = H * vr; }
            else { dw = W; dh = W / vr; }
            this.video.setSize(dw, dh).setPosition(W / 2, H / 2);
            this.fallback.setDisplaySize(W, H).setPosition(0, 0);
        };
        this.video.on("loadeddata", resizeVideo);
        resizeVideo();

        // ─────────────────────────────────────────────
        // Start flow (Start → Name → Difficulty → Playground)
        // ─────────────────────────────────────────────
        const startFlow = () => {
            const cachedName = this.registry.get("playerName");

            const proceedAfterName = (rawName) => {
                const name = (rawName || "").trim() || "Player";
                this.registry.set("playerName", name);

                // Open difficulty dialog; when chosen, ensure session and go
                this.openDifficultyDialog((lvl) => {
                    window.__SESSION_ID__ = window.__SESSION_ID__ ?? DB.beginSession(name);
                    this.registry.set("difficulty", lvl);
                    this.goToPlaygroundSmooth(name, lvl, 600);
                });
            };

            if (!cachedName) this.openNameDialog(proceedAfterName);
            else proceedAfterName(cachedName);
        };

        // Optional quick-restart
        this._quickRestart = !!data?.quickRestart;
        this._qrName = data?.restartName || "Kiko";
        this._qrReuseDifficulty = (data?.reuseDifficulty !== false);

        const onStartPressed = () => {
            // Ensure BGM start even if the interaction happened on DOM
            this.events.emit("menu:startPressed");

            if (this._quickRestart) {
                const currentName = this.registry.get("playerName") ?? this._qrName;
                const difficulty = 1;

                if (!this.registry.get("playerName")) this.registry.set("playerName", currentName);
                if (!this.registry.get("difficulty")) this.registry.set("difficulty", difficulty);

                if (typeof this.goToPlaygroundSmooth === "function") {
                    this.goToPlaygroundSmooth(currentName, difficulty, 400);
                } else {
                    this.scene.start("PlaygroundScene", { playerName: currentName, difficulty });
                }
                return;
            }
            startFlow();
        };

        // Wire START button
        this.createStartButton(onStartPressed);

        // Responsive layout
        this.scale.on("resize", () => {
            resizeVideo();
            this.layoutUI();
        });

        this.cameras.main.fadeIn(800, 0, 0, 0);
    }

    // Smoothly leave this scene (fade-out) then start PlaygroundScene
    goToPlaygroundSmooth(playerName, difficulty, dur = 600) {

        // kill any leftover blocker safely
        if (this._uiBlocker) {
            try { this._uiBlocker.removeInteractive?.(); this._uiBlocker.destroy?.(); } catch {}
            this._uiBlocker = null;
        }
        this._gateArmed = false;


        if (this._leaving) return;
        this._leaving = true;

        this.input.enabled = false;
        this.tweens.killAll();
        this.video?.stop(); // stop video only (do NOT touch BGM)

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PlaygroundScene", { playerName, difficulty });
        });
        this.cameras.main.fadeOut(dur, 0, 0, 0);
    }

    // ─────────────────────────────────────────────
    // Name input popup
    // ─────────────────────────────────────────────
    openNameDialog(onOk) {
        const { width, height } = this.scale;
        const dialogRoot = this.add.container(0, 0).setDepth(20);

        // Dim overlay
        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        // Panel scale
        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        const innerPad = Math.round(60 * s);
        const innerLeft = panel.x - panelW / 2 + innerPad;
        const innerRight = panel.x + panelW / 2 - innerPad;
        const innerW = innerRight - innerLeft;

        const gutter = Math.round(28 * s);
        const leftColW = Math.round(innerW * 0.3);
        const rightX = innerLeft + leftColW + gutter;
        const rightW = innerW - leftColW - gutter;

        // Kiko art (left column)
        if (this.textures.exists("kiko_dialog")) {
            const kd = this.add
                .image(innerLeft + leftColW / 2, panel.y + panelH * 0.35, "kiko_dialog")
                .setOrigin(0.5, 1);
            const targetH = panelH * 0.70;
            kd.setScale(targetH / kd.height);
            dialogRoot.add(kd);
        }

        const uiFont = getUIFont();

        // Title
        const title = this.add
            .text(rightX, panel.y - panelH * 0.12, "Hey, I’m Kiko. What’s your name?", {
                fontFamily: uiFont,
                color: "#000000",
            })
            .setOrigin(0, 0.5);
        title.setFontSize(Math.max(40, Math.round(40 * s)));
        title.setWordWrapWidth(rightW, true);
        dialogRoot.add(title);

        // DOM form (input + hidden button)
        const html = `
          <div id="wrap" style="font-family:${uiFont}">
            <input id="nameInput" type="text" placeholder="Type your name..." style="font-family:${uiFont}" />
            <button id="okBtn">Continue</button>
          </div>
        `;
        const form = this.add.dom(rightX + 110, panel.y + panelH * 0.02).createFromHTML(html).setOrigin(0.5);
        dialogRoot.add(form);

        const wrap = form.getChildByID("wrap");
        const input = form.getChildByID("nameInput");
        const ok = form.getChildByID("okBtn");

        wrap.style.width = `${Math.floor(rightW)}px`;
        wrap.style.display = "flex";
        wrap.style.flexDirection = "column";
        wrap.style.alignItems = "stretch";
        wrap.style.gap = `${Math.max(10, Math.round(10 * s))}px`;

        input.style.boxSizing = "border-box";
        input.style.flex = "1 1 auto";
        input.style.width = "60%";
        input.style.height = `${Math.round(120 * s)}px`;
        input.style.padding = `0 ${Math.round(14 * s)}px`;
        input.style.fontSize = `${Math.round(50 * s)}px`;
        input.style.border = `${Math.max(2, Math.round(2 * s))}px solid #9EDCFF`;
        input.style.borderRadius = `${Math.round(10 * s)}px`;
        input.style.outline = "none";

        ok.style.display = "none"; // we use the arrow image as the submit

        // Continue arrow button
        const btnSize = Math.round(170 * s);
        const continueBtn = this.add
            .image(panel.x, panel.y + panelH * 0.27, "ui_continue")
            .setOrigin(0.5)
            .setDisplaySize(btnSize, btnSize)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(continueBtn);

        const base = { s: continueBtn.scale, y: continueBtn.y };
        continueBtn.on("pointerover", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s * 1.06, y: base.y - 3, duration: 120, ease: "Sine.easeOut" });
        });
        continueBtn.on("pointerout", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s, y: base.y, duration: 120, ease: "Sine.easeOut" });
        });

        const submit = () => {
            const value = (input.value || "").trim();
            if (value) {
                destroyDialog();
                onOk?.(value);
            } else {
                const bx = form.x;
                this.tweens.add({
                    targets: form,
                    x: bx + Math.round(8 * s),
                    duration: 50,
                    yoyo: true,
                    repeat: 3,
                    onComplete: () => form.setX(bx),
                });
            }
        };
        const onKey = (e) => { if (e.key === "Enter") submit(); };

        continueBtn.on("pointerdown", () => {
            this.tweens.add({
                targets: continueBtn,
                scale: base.s * 0.97,
                duration: 80,
                yoyo: true,
                ease: "Quad.easeOut",
                onComplete: () => submit(),
            });
        });

        form.node.addEventListener("keydown", onKey);

        // Close (X) button
        const closeBtn = this.add
            .image(
                panel.x + panelW / 2 - Math.round(46 * s),
                panel.y - panelH / 2 + Math.round(46 * s),
                "ui_exit"
            )
            .setOrigin(0.5)
            .setScale(0.12)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(closeBtn);

        const baseScale = 0.12;
        closeBtn.on("pointerover", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale * 1.15, duration: 120, ease: "Sine.easeOut" });
        });
        closeBtn.on("pointerout", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale, duration: 120, ease: "Sine.easeOut" });
        });

        const destroyDialog = () => {
            form.node.removeEventListener?.("keydown", onKey);
            this.tweens.killTweensOf(closeBtn);
            this.tweens.killTweensOf(form);
            this.tweens.killTweensOf(continueBtn);
            dialogRoot.destroy(true);
            this.events.off("shutdown", destroyDialog);
        };

        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);

        // Ensure audio unlock also fires when user interacts only with DOM
        this.ensureAudioStartOnce();
    }

    // ─────────────────────────────────────────────
    // Difficulty select popup (Easy / Normal / Hard)
    // ─────────────────────────────────────────────
    openDifficultyDialog(onPick) {
        const { width, height } = this.scale;

        const dialogRoot = this.add.container(0, 0).setDepth(20);

        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        const lvlMap = { easy: 1, normal: 2, hard: 3 };

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        const innerPad = Math.round(60 * s);
        const left = panel.x - panelW / 2 + innerPad;
        const right = panel.x + panelW / 2 - innerPad;
        const innerW = right - left;

        const uiFont = getUIFont();

        const title = this.add
            .text(panel.x, panel.y - panelH * 0.18, "Choose Difficulty", {
                fontFamily: "Chewy", color: "#000000", align: "center"
            })
            .setOrigin(0.5, 0.5);
        title.setFontSize(Math.max(85, Math.round(85 * s)));
        title.setFontStyle("bold");
        title.setWordWrapWidth(innerW, true);
        dialogRoot.add(title);

        const rowY = panel.y + Math.round(panelH * 0.02);
        const btnW = Math.min(width * 0.22, 360);
        const btnH = Math.min(height * 0.12, 120);
        const radius = Math.round(btnH * 0.28);
        const gap = Math.round(22 * s);

        const makeBtnTex = (key, fill) => {
            const g = this.add.graphics();
            g.fillStyle(fill, 1);
            g.fillRoundedRect(0, 0, btnW, btnH, radius);
            g.lineStyle(Math.max(3, Math.round(3 * s)), 0x073b4c, 0.35);
            g.strokeRoundedRect(0, 0, btnW, btnH, radius);
            g.generateTexture(key, btnW, btnH);
            g.destroy();
        };

        if (!this.textures.exists("btn_diff_easy")) makeBtnTex("btn_diff_easy", 0xB9FBC0);
        if (!this.textures.exists("btn_diff_norm")) makeBtnTex("btn_diff_norm", 0xBEE1FF);
        if (!this.textures.exists("btn_diff_hard")) makeBtnTex("btn_diff_hard", 0xFFD6A5);

        const cx = panel.x;
        const x1 = cx - btnW - gap;
        const x2 = cx;
        const x3 = cx + btnW + gap;

        const buttons = [
            { key: "btn_diff_easy", label: "Easy", value: "easy" },
            { key: "btn_diff_norm", label: "Normal", value: "normal" },
            { key: "btn_diff_hard", label: "Hard", value: "hard" },
        ];
        const bx = [x1, x2, x3];
        const phaserBtns = [];

        buttons.forEach((b, i) => {
            const img = this.add.image(bx[i], rowY, b.key).setOrigin(0.5).setInteractive({ useHandCursor: true });
            img.setDepth(1);
            const lab = this.add.text(bx[i], rowY, b.label, { fontFamily: uiFont, color: "#073B4C" }).setOrigin(0.5, 0.55);
            lab.setFontSize(Math.round(btnH * 0.35));
            lab.setDepth(2);

            const base = { y: img.y, ly: lab.y };
            img.on("pointerover", () => {
                this.tweens.add({ targets: img, scale: 1.04, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: lab, scale: 1.04, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerout", () => {
                this.tweens.add({ targets: img, scale: 1, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: lab, scale: 1, y: base.ly, duration: 120, ease: "Sine.easeOut" });
            });

            img.on("pointerdown", () => {
                this.tweens.add({
                    targets: [img, lab],
                    scale: 0.98,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => {
                        const raw = b.value ?? "normal";
                        const lvl = lvlMap[String(raw).toLowerCase()] ?? 2;
                        this.registry.set("difficulty", lvl);
                        destroyDialog();
                        onPick?.(lvl);
                    },
                });
            });

            phaserBtns.push(img, lab);
            dialogRoot.add(img);
            dialogRoot.add(lab);
        });

        // Close (X)
        const closeBtn = this.add
            .image(
                panel.x + panelW / 2 - Math.round(46 * s),
                panel.y - panelH / 2 + Math.round(46 * s),
                "ui_exit"
            )
            .setOrigin(0.5)
            .setScale(0.12)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(closeBtn);

        const baseScale = 0.12;
        closeBtn.on("pointerover", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale * 1.15, duration: 120, ease: "Sine.easeOut" });
        });
        closeBtn.on("pointerout", () => {
            this.tweens.add({ targets: closeBtn, scale: baseScale, duration: 120, ease: "Sine.easeOut" });
        });

        const destroyDialog = () => {
            phaserBtns.forEach(b => this.tweens.killTweensOf(b));
            dialogRoot.destroy(true);
            this.events.off("shutdown", destroyDialog);
        };
        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);
    }

    // =======================
    // START button (image or generated)
    // =======================
    createStartButton(onStart) {
        const { width, height } = this.scale;
        const bx = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
        const BTN_X = width * bx;
        const BTN_Y = height * by;

        this.startButton?.destroy();
        this.startShadow?.destroy();
        this.startLabel?.destroy();

        if (this.textures.exists("ui_start")) {
            const img = this.add
                .image(BTN_X, BTN_Y, "ui_start")
                .setOrigin(0.5)
                .setDepth(2)
                .setInteractive({ useHandCursor: true });

            const s = this.calcButtonScale(img.width, img.height);
            img.setScale(s);

            const shadow = this.add
                .image(img.x + 6, img.y + 8, "ui_start")
                .setOrigin(0.5)
                .setDepth(1)
                .setScale(s)
                .setTint(0x000000)
                .setAlpha(0.25);

            const base = { s, y: img.y, sy: shadow.y };
            img.on("pointerover", () => {
                this.tweens.add({ targets: img, scale: base.s * 1.05, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: base.s * 1.05, y: base.sy - 4, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerout", () => {
                this.tweens.add({ targets: img, scale: base.s, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: base.s, y: base.sy, duration: 120, ease: "Sine.easeOut" });
            });
            img.on("pointerdown", () => {
                this.tweens.add({
                    targets: [img, shadow],
                    scale: base.s * 0.97,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => onStart(),
                });
            });

            this.startButton = img;
            this.startShadow = shadow;
            this.startLabel = null;
        } else {
            // Generated button fallback
            const bw = Math.min(width * 0.5, 520);
            const bh = Math.min(height * 0.2, 140);
            const radius = Math.min(24, bh * 0.25);

            const g = this.add.graphics();
            g.fillStyle(0xff8a00, 1);
            g.fillRoundedRect(0, 0, bw, bh, radius);
            g.fillStyle(0xffa733, 0.35);
            g.fillRoundedRect(8, 8, bw - 16, bh * 0.5, radius * 0.7);
            g.lineStyle(6, 0xcc5f00, 1);
            g.strokeRoundedRect(0, 0, bw, bh, radius);
            g.generateTexture("btn_big_orange", bw, bh);
            g.destroy();

            const btn = this.add
                .image(BTN_X, BTN_Y, "btn_big_orange")
                .setOrigin(0.5)
                .setDepth(2)
                .setInteractive({ useHandCursor: true });
            const shadow = this.add
                .image(btn.x + 6, btn.y + 8, "btn_big_orange")
                .setOrigin(0.5)
                .setDepth(1)
                .setTint(0x000000)
                .setAlpha(0.25);
            const label = this.add
                .text(BTN_X, BTN_Y, "START", { fontFamily: getUIFont(), color: "#ffffff" })
                .setOrigin(0.5)
                .setDepth(3);
            label.setFontSize(Math.round(bh * 0.42));
            label.setStroke("#6b2600", Math.max(2, Math.round(bh * 0.05)));

            const base = { y: BTN_Y, sy: shadow.y, ly: label.y };
            btn.on("pointerover", () => {
                this.tweens.add({ targets: btn, scale: 1.05, y: base.y - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: 1.05, y: base.sy - 4, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: label, scale: 1.05, y: base.ly - 4, duration: 120, ease: "Sine.easeOut" });
            });
            btn.on("pointerout", () => {
                this.tweens.add({ targets: btn, scale: 1, y: base.y, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: shadow, scale: 1, y: base.sy, duration: 120, ease: "Sine.easeOut" });
                this.tweens.add({ targets: label, scale: 1, y: base.ly, duration: 120, ease: "Sine.easeOut" });
            });
            btn.on("pointerdown", () => {
                this.tweens.add({
                    targets: [btn, shadow, label],
                    scale: 0.97,
                    duration: 80,
                    yoyo: true,
                    ease: "Quad.easeOut",
                    onComplete: () => onStart(),
                });
            });

            this.startButton = btn;
            this.startShadow = shadow;
            this.startLabel = label;
        }

        this.layoutUI();
    }

    layoutUI() {
        const { width, height } = this.scale;
        const bx = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by = (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
        const BTN_X = width * bx;
        const BTN_Y = height * by;

        if (!this.startButton) return;

        this.startButton.setPosition(BTN_X, BTN_Y);
        this.startShadow?.setPosition(BTN_X + 6, BTN_Y + 8);
        this.startLabel?.setPosition(BTN_X, BTN_Y);

        if (this.textures.exists("ui_start") && this.startButton.texture.key === "ui_start") {
            const tex = this.textures.get("ui_start").getSourceImage();
            const s = this.calcButtonScale(tex.width, tex.height);
            this.startButton.setScale(s);
            this.startShadow?.setScale(s);
        } else if (this.startButton.texture.key === "btn_big_orange") {
            const bh = Math.min(height * 0.2, 140);
            this.startLabel?.setFontSize(Math.round(bh * 0.42));
            this.startLabel?.setStroke("#6b2600", Math.max(2, Math.round(bh * 0.05)));
        }
    }

    calcButtonScale(nativeW, nativeH) {
        const { width, height } = this.scale;
        const sW = (width * 0.38) / nativeW;
        const sH = (height * 0.22) / nativeH;
        return Math.min(sW, sH);
    }

    // ─────────────────────────────────────────────
    // One-time audio unlock that also works for DOM interactions
    // ─────────────────────────────────────────────
    ensureAudioStartOnce() {
        if (this._audioEnsured) return;
        this._audioEnsured = true;

        const fire = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            // Route into the gesture gate (menu:startPressed handler)
            this.events.emit("menu:startPressed");
        };

        window.addEventListener("mousedown", fire, { once: true, passive: true });
        window.addEventListener("touchstart", fire, { once: true, passive: true });
        document.addEventListener("keydown", fire, { once: true });
    }
}
