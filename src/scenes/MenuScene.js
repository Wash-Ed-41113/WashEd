// src/scenes/MenuScene.js
/* global Phaser, CONFIG */

// Use the same target fractions for both dialogs

import { DB } from "../db.js";


const DLG = { W_FRAC: 0.80, H_FRAC: 0.60 }; // 80% of viewport width, 60% of height
const UI_FONT_FALLBACK = "Montserrat";

const getUIFont = () => CONFIG.ui?.fontFamily || "Montserrat";

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
        this.video= null;
        this.fallback = null;

        this.startButton = null;
        this.startShadow = null;
        this.startLabel = null;

        this._leaving = false; // avoid double transition
    }

    preload() {
        // backup background (if video is not loaded)
        const BG =
            (typeof CONFIG !== "undefined" &&
                CONFIG.assets &&
                CONFIG.assets.backgrounds) ||
            {};
        this.load.image(
            "frontpage_background",
            BG.frontpage || "assets/images/backgrounds/frontpage.png"
        );

        // background video
        this.load.video(
            "menu_bg_video",
            "assets/videos/washed_kikos-day_LEVEL_01_scene_01_action_01_launcher.mp4",
            true // noAudio
        );

        // pop up + X button + kiko + continue arrow
        this.load.image("dialog_skin","assets/images/UI/washed_kikos-day_UI-dialogue-box-v1.png");
        this.load.image("ui_exit","assets/images/UI/washed_kikos-day_UI-Button_EXIT.png");
        this.load.image("kiko_dialog","assets/images/Kiko/WashEd_kiko_sprite_base.png");
        this.load.image("ui_continue","assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png");

        // BGM
        this.load.audio("bgm_kiko", "assets/sounds/kikos_day.mp3");
    }

    create() {
        const { width, height } = this.scale;

        // backup background
        this.fallback = this.add
            .image(0, 0, "frontpage_background")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setDepth(-3);

        // video background
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

        // ► Start BGM immediately (and persist across scenes until a minigame stops it)
        this.sound.pauseOnBlur = false;
        this.sound.mute = this.registry.get("mute") === true;

        const startBgm = () => {
            let bgm = this.sound.get("bgm_kiko");
            if (!bgm) {
                bgm = this.sound.add("bgm_kiko", { loop: true, volume: 0.45 });
            }
            if (!bgm.isPlaying) bgm.play();
        };
        if (this.sound.locked) {
            this.sound.once(Phaser.Sound.Events.UNLOCKED, startBgm);
            this.input.once("pointerdown", startBgm);
        } else {
            startBgm();
        }

        // START → ask name → ask difficulty → go Playground
        const startFlow = () => {
            const cachedName = this.registry.get("playerName");
            const cachedDiff = this.registry.get("difficulty");

            const goPlay = (playerName, difficulty) => {
                this.goToPlaygroundSmooth(playerName, difficulty, 600);
            };

            const afterName = (playerName) => {
                this.registry.set("playerName", playerName);
                const diff = this.registry.get("difficulty");
                if (diff) return goPlay(playerName, diff);
                this.openDifficultyDialog((difficulty) => {
                    this.registry.set("difficulty", difficulty);
                    goPlay(playerName, difficulty);
                });
            };

            if (!cachedName) {
                this.openNameDialog(afterName);
            } else if (!cachedDiff) {
                this.openDifficultyDialog((difficulty) => {
                    this.registry.set("difficulty", difficulty);
                    goPlay(cachedName, difficulty);
                });
            } else {
                goPlay(cachedName, cachedDiff);
            }
        };

        // START button
        this.createStartButton(startFlow);

        this.scale.on("resize", () => {
            resizeVideo();
            this.layoutUI();
        });

        this.cameras.main.fadeIn(800, 0, 0, 0);
    }

    // Smoothly leave this scene (fade-out) then start PlaygroundScene
    goToPlaygroundSmooth(playerName, difficulty, dur = 600) {
        if (this._leaving) return;
        this._leaving = true;

        this.input.enabled = false;      // debounce clicks while fading
        this.tweens.killAll();           // stop UI tweens for snappy fade
        this.video?.stop();              // optional: stop video during transition

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("PlaygroundScene", { playerName, difficulty });
        });
        this.cameras.main.fadeOut(dur, 0, 0, 0);
    }

    // ─────────────────────────────────────────────
    // name input popup
    // ─────────────────────────────────────────────
    openNameDialog(onOk) {
        const { width, height } = this.scale;

        // container
        const dialogRoot = this.add.container(0, 0).setDepth(20);

        // dim overlay
        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        // skin layout and (UNIFIED) scale
        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width  * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        const panel = this.add
            .image(width / 2, height / 2, "dialog_skin")
            .setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        // inner layout (same math for both dialogs)
        const innerPad  = Math.round(60 * s);
        const innerLeft = panel.x - panelW / 2 + innerPad;
        const innerRight = panel.x + panelW / 2 - innerPad;
        const innerW = innerRight - innerLeft;

        const gutter   = Math.round(28 * s);
        const leftColW = Math.round(innerW * 0.3);
        const rightX   = innerLeft + leftColW + gutter;
        const rightW   = innerW - leftColW - gutter;

        // kiko (left side)
        if (this.textures.exists("kiko_dialog")) {
            const kd = this.add
                .image(innerLeft + leftColW / 2, panel.y + panelH * 0.35, "kiko_dialog")
                .setOrigin(0.5, 1);
            const targetH = panelH * 0.70;
            kd.setScale(targetH / kd.height);
            dialogRoot.add(kd);
        }

        // title

        const uiFont = getUIFont();

        const title = this.add
            .text(rightX, panel.y - panelH * 0.12, "Hey, I’m Kiko. What’s your name?", {
                fontFamily: uiFont,
                color: "#000000",
            })
            .setOrigin(0, 0.5);
        title.setFontSize(Math.max(40, Math.round(40 * s)));
        // title.setFontStyle("bold");
        title.setWordWrapWidth(rightW, true);
        dialogRoot.add(title);

        // DOM form (we only use the input; the DOM button will be hidden)
        const html = `
      <div id="wrap" style="font-family:${uiFont}">
        <input id="nameInput" type="text" placeholder="Type your name..." style="font-family:${uiFont}" />
        <button id="okBtn">Continue</button>
      </div>
    `;
        const form = this.add
            .dom(rightX + 110, panel.y + panelH * 0.02)
            .createFromHTML(html)
            .setOrigin(0.5);
        dialogRoot.add(form);

        // styling
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

        // hide DOM button
        ok.style.display = "none";

        // Phaser image button (green arrow)
        const btnSize = Math.round(170 * s);
        const continueBtn = this.add
            .image(panel.x, panel.y + panelH * 0.27, "ui_continue")
            .setOrigin(0.5)
            .setDisplaySize(btnSize, btnSize)
            .setInteractive({ useHandCursor: true });
        dialogRoot.add(continueBtn);

        // Hover / out
        const base = { s: continueBtn.scale, y: continueBtn.y };
        continueBtn.on("pointerover", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s * 1.06, y: base.y - 3, duration: 120, ease: "Sine.easeOut" });
        });
        continueBtn.on("pointerout", () => {
            this.tweens.add({ targets: continueBtn, scale: base.s, y: base.y, duration: 120, ease: "Sine.easeOut" });
        });

        // submit / key handler
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

        // click image button to submit
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

        // (keep DOM listeners for keyboard)
        form.node.addEventListener("keydown", onKey);

        // close(X)
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
            this.tweens.add({
                targets: closeBtn,
                scale: baseScale * 1.15,
                duration: 120,
                ease: "Sine.easeOut",
            });
        });
        closeBtn.on("pointerout", () => {
            this.tweens.add({
                targets: closeBtn,
                scale: baseScale,
                duration: 120,
                ease: "Sine.easeOut",
            });
        });

        const destroyDialog = () => {
            form.node.removeEventListener?.("keydown", onKey);
            this.tweens.killTweensOf(closeBtn);
            this.tweens.killTweensOf(form);
            this.tweens.killTweensOf(continueBtn); // ensure cleanup
            dialogRoot.destroy(true);
            this.events.off("shutdown", destroyDialog);
        };

        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);
    }

    // ─────────────────────────────────────────────
    // difficulty select popup (Easy / Normal / Hard)
    // ─────────────────────────────────────────────
    openDifficultyDialog(onPick) {
        const { width, height } = this.scale;

        // container
        const dialogRoot = this.add.container(0, 0).setDepth(20);

        // overlay
        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        dialogRoot.add(overlay);

        // skin + (UNIFIED) scale
        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width  * DLG.W_FRAC) / skinImg.width,
            (height * DLG.H_FRAC) / skinImg.height
        );

        // Map button value -> numeric difficulty
        const lvlMap = { easy: 1, normal: 2, hard: 3 };


        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        // inner layout (same math as name dialog)
        const innerPad = Math.round(60 * s);
        const left  = panel.x - panelW / 2 + innerPad;
        const right = panel.x + panelW / 2 - innerPad;
        const innerW = right - left;

        const uiFont = getUIFont();

        // title (centered)
        const title = this.add
            .text(
                panel.x,
                panel.y - panelH * 0.18,
                "Choose difficulty",
                { fontFamily: uiFont, color: "#000000", align: "center" }
            )
            .setOrigin(0.5, 0.5);
        title.setFontSize(Math.max(42, Math.round(42 * s)));
        title.setFontStyle("bold");
        title.setWordWrapWidth(innerW, true);
        dialogRoot.add(title);

        // three buttons row
        const rowY = panel.y + Math.round(panelH * 0.02);
        const btnW = Math.min(width * 0.22, 360);
        const btnH = Math.min(height * 0.12, 120);
        const radius = Math.round(btnH * 0.28);
        const gap = Math.round(22 * s);

        const makeBtnTex = (key, fill) => {
            const g = this.add.graphics();
            g.fillStyle(fill, 1);
            g.fillRoundedRect(0, 0, btnW, btnH, radius);
            g.lineStyle(Math.max(3, Math.round(3*s)), 0x073b4c, 0.35);
            g.strokeRoundedRect(0, 0, btnW, btnH, radius);
            g.generateTexture(key, btnW, btnH);
            g.destroy();
        };

        if (!this.textures.exists("btn_diff_easy"))  makeBtnTex("btn_diff_easy",  0xB9FBC0);
        if (!this.textures.exists("btn_diff_norm"))  makeBtnTex("btn_diff_norm",  0xBEE1FF);
        if (!this.textures.exists("btn_diff_hard"))  makeBtnTex("btn_diff_hard",  0xFFD6A5);

        const cx = panel.x;
        const x1 = cx - btnW - gap;
        const x2 = cx;
        const x3 = cx + btnW + gap;

        const buttons = [
            { key: "btn_diff_easy",  label: "Easy",   value: "easy" },
            { key: "btn_diff_norm",  label: "Normal", value: "normal" },
            { key: "btn_diff_hard",  label: "Hard",   value: "hard" },
        ];
        const bx = [x1, x2, x3];

        const phaserBtns = [];

        buttons.forEach((b, i) => {
            const img = this.add.image(bx[i], rowY, b.key)
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });
            img.setDepth(1);
            const lab = this.add.text(bx[i], rowY, b.label, {
                fontFamily: uiFont, color: "#073B4C",
            }).setOrigin(0.5, 0.55);
            lab.setFontSize(Math.round(btnH * 0.35));
            lab.setDepth(2);

            // hover
            const base = { s: 1, y: img.y, ly: lab.y };
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
                        // MINIMAL CHANGE: convert string -> numeric, store, pass number
                        const raw = b.value ?? "normal";
                        const lvl = lvlMap[String(raw).toLowerCase()] ?? 2;
                        this.registry.set("difficulty", lvl);
                        destroyDialog();
                        onPick?.(lvl); // startFlow -> goToPlaygroundSmooth with numeric 1/2/3
                    },
                });
            });

            phaserBtns.push(img, lab);
            dialogRoot.add(img);
            dialogRoot.add(lab);
        });

        // close(X)
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
    // START button
    // =======================
    createStartButton(onStart) {
        const { width, height } = this.scale;
        const bx =
            (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by =
            (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
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
                this.tweens.add({
                    targets: img,
                    scale: base.s * 1.05,
                    y: base.y - 4,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: shadow,
                    scale: base.s * 1.05,
                    y: base.sy - 4,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
            });
            img.on("pointerout", () => {
                this.tweens.add({
                    targets: img,
                    scale: base.s,
                    y: base.y,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: shadow,
                    scale: base.s,
                    y: base.sy,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
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
            // instant button
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
                .text(BTN_X, BTN_Y, "START", {
                    fontFamily: getUIFont(),
                    color: "#ffffff",
                    // fontStyle: "bold",
                })
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
        const bx =
            (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsX?.start) ?? 0.72;
        const by =
            (typeof CONFIG !== "undefined" && CONFIG.menu?.buttonsY?.start) ?? 0.7;
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
}
