// src/scenes/MenuScene.js
export default class MenuScene extends Phaser.Scene {
    constructor() {
        super("MenuScene");
        this.video = null;
        this.fallback = null;

        this.startButton = null;
        this.startShadow = null;
        this.startLabel = null;
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

        // pop up + X button + kiko
        this.load.image(
            "dialog_skin",
            "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png"
        );
        this.load.image(
            "ui_exit",
            "assets/images/UI/washed_kikos-day_UI-Button_EXIT.png"
        );
        this.load.image(
            "kiko_dialog",
            "assets/images/Kiko/WashEd_kiko_sprite_base.png"
        );
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
            if (vr > sr) {
                dh = H;
                dw = H * vr;
            } else {
                dw = W;
                dh = W / vr;
            }
            this.video.setSize(dw, dh).setPosition(W / 2, H / 2);
            this.fallback.setDisplaySize(W, H).setPosition(0, 0);
        };
        this.video.on("loadeddata", resizeVideo);
        resizeVideo();

        // START: 이름 → 난이도 → GameScene
        const goWithName = () => {
            const cached = this.registry.get("playerName");
            if (cached) {
                this.openDifficultyDialog(cached, (difficulty) => {
                    this.registry.set("difficulty", difficulty);
                    this.scene.start("GameScene", {
                        playerName: cached,
                        preselectedDifficulty: difficulty,
                    });
                });
            } else {
                this.openNameDialog((playerName) => {
                    this.registry.set("playerName", playerName);
                    this.openDifficultyDialog(playerName, (difficulty) => {
                        this.registry.set("difficulty", difficulty);
                        this.scene.start("GameScene", {
                            playerName,
                            preselectedDifficulty: difficulty,
                        });
                    });
                });
            }
        };

        // START button
        this.createStartButton(goWithName);

        this.scale.on("resize", () => {
            resizeVideo();
            this.layoutUI();
        });

        this.cameras.main.fadeIn(800, 0, 0, 0);
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

        // skin layout and scale
        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * 0.82) / skinImg.width,
            (height * 0.62) / skinImg.height
        );

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        dialogRoot.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        // inner layout
        const innerPad = Math.round(60 * s);
        const innerLeft = panel.x - panelW / 2 + innerPad;
        const innerRight = panel.x + panelW / 2 - innerPad;
        const innerW = innerRight - innerLeft;

        const gutter = Math.round(28 * s);
        const leftColW = Math.round(innerW * 0.3);
        const rightX = innerLeft + leftColW + gutter;
        const rightW = innerW - leftColW - gutter;

        // kiko (left side)
        if (this.textures.exists("kiko_dialog")) {
            const kikoDialog = this.add
                .image(innerLeft + leftColW / 2, panel.y + panelH * 0.24, "kiko_dialog")
                .setOrigin(0.5, 1);
            const targetH = panelH * 0.55;
            kikoDialog.setScale(targetH / kikoDialog.height);
            dialogRoot.add(kikoDialog);
        }

        // title
        const uiFont =
            (typeof CONFIG !== "undefined" &&
                CONFIG.ui &&
                typeof CONFIG.ui.fontFamily === "string" &&
                CONFIG.ui.fontFamily) ||
            "Arial";

        const title = this.add
            .text(rightX, panel.y - panelH * 0.1, "Hey, I’m Kiko. What’s your name?", {
                fontFamily: uiFont,
                color: "#000000",
            })
            .setOrigin(0, 0.5);
        title.setFontSize(Math.max(40, Math.round(40 * s)));
        title.setFontStyle("bold");
        title.setWordWrapWidth(rightW, true);
        dialogRoot.add(title);

        // DOM form
        const html = `
      <div id="wrap">
        <input id="nameInput" type="text" placeholder="Type your name..." />
        <button id="okBtn">Continue</button>
      </div>
    `;
        const form = this.add
            .dom(rightX + 110, panel.y + panelH * 0.01)
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

        ok.style.width = `${Math.round(300 * s)}px`;
        ok.style.height = `${Math.round(120 * s)}px`;
        ok.style.border = "none";
        ok.style.borderRadius = `${Math.round(12 * s)}px`;
        ok.style.background = "#2db4ff";
        ok.style.color = "#fff";
        ok.style.fontWeight = "700";
        ok.style.fontSize = `${Math.round(50 * s)}px`;
        ok.style.cursor = "pointer";
        ok.style.marginLeft = `${Math.round(250 * s)}px`;
        ok.style.marginTop = `${Math.round(80 * s)}px`;

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
        const onKey = (e) => {
            if (e.key === "Enter") submit();
        };

        ok.addEventListener("click", submit);
        form.node.addEventListener("keydown", onKey);

        const destroyDialog = () => {
            ok.removeEventListener?.("click", submit);
            form.node.removeEventListener?.("keydown", onKey);

            this.tweens.killTweensOf(closeBtn);
            this.tweens.killTweensOf(form);

            dialogRoot.destroy(true);

            this.events.off("shutdown", destroyDialog);
        };

        closeBtn.on("pointerdown", destroyDialog);
        this.events.once("shutdown", destroyDialog);
    }

    // ─────────────────────────────────────────────
    // difficulty popup (name dialog와 동일 포맷) — 제목/버튼 레이어/정렬 수정
    // ─────────────────────────────────────────────
    openDifficultyDialog(playerName, onSelect) {
        const { width, height } = this.scale;

        // root
        const root = this.add.container(0, 0).setDepth(20);

        // overlay
        const overlay = this.add
            .rectangle(0, 0, width, height, 0x000000, 0.35)
            .setOrigin(0, 0)
            .setInteractive();
        root.add(overlay);

        // bubble scale/pos
        const skinImg = this.textures.get("dialog_skin").getSourceImage();
        const s = Math.min(
            (width * 0.82) / skinImg.width,
            (height * 0.62) / skinImg.height
        );

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setScale(s);
        root.add(panel);

        const panelW = skinImg.width * s;
        const panelH = skinImg.height * s;

        // inner layout grid
        const innerPad = Math.round(60 * s);
        const innerLeft = panel.x - panelW / 2 + innerPad;
        const innerRight = panel.x + panelW / 2 - innerPad;
        const innerW = innerRight - innerLeft;

        const gutter = Math.round(28 * s);
        const leftColW = Math.round(innerW * 0.3);
        const rightX = innerLeft + leftColW + gutter;
        const rightW = innerW - leftColW - gutter;

        // Kiko (left)
        if (this.textures.exists("kiko_dialog")) {
            const kiko = this.add
                .image(innerLeft + leftColW / 2, panel.y + panelH * 0.24, "kiko_dialog")
                .setOrigin(0.5, 1);
            const targetH = panelH * 0.55;
            kiko.setScale(targetH / kiko.height);
            root.add(kiko);
        }

        // ── Title
        const uiFont =
            (typeof CONFIG !== "undefined" && CONFIG.ui?.fontFamily) || "Arial";

        const colCenterX = rightX + rightW / 2;
        const title = this.add.text(
            colCenterX,
            panel.y - panelH * 0.1,
            "Select your difficulty!",
            {
                fontFamily: uiFont,
                color: "#000",
                fontStyle: "bold",
                align: "center",
                wordWrap: { width: rightW * 0.9 },
            }
        )
            .setOrigin(0.5, 0.5)
            .setFontSize(Math.max(44, Math.round(46 * s)))
            .setDepth(5); // 제목을 버튼 위 레이어로
        root.add(title);

        // ── Buttons (크고 정렬 깔끔하게)
        const BTN_W = Math.min(rightW * 0.72, 640 * s);
        const BTN_H = Math.max(70 * s, 60);
        const GAP = Math.max(26 * s, 18);
        const FONT_SZ = Math.round(30 * s);
        const STROKE = Math.max(2, 2 * s);

        // 제목 실제 높이 반영해서 첫 버튼 시작 Y 계산
        const titleH = title.displayHeight || (title.height ?? 0);
        const margin = Math.max(18 * s, 14);
        const startYBase = (title.y + titleH / 2) + margin;

        // 세로 중앙 느낌 유지 위해 3개 버튼 블록 높이로 오프셋
        const totalH = BTN_H * 3 + GAP * 2;
        const baseOffset = -totalH / 2;

        const makeBtn = (label, offset, key) => {
            const y = startYBase + offset;
            const rect = this.add
                .rectangle(colCenterX, y, BTN_W, BTN_H, 0x142038, 1)
                .setOrigin(0.5)
                .setStrokeStyle(STROKE, 0xffffff)
                .setInteractive({ useHandCursor: true })
                .setDepth(4); // 제목 아래
            const txt = this.add
                .text(colCenterX, y, label, {
                    fontFamily: "Arial",
                    fontSize: FONT_SZ,
                    color: "#ffffff",
                    align: "center",
                    fixedWidth: BTN_W,
                })
                .setOrigin(0.5)
                .setDepth(4);

            rect.on("pointerover", () => rect.setFillStyle(0x1d2b52));
            rect.on("pointerout", () => rect.setFillStyle(0x142038));

            const choose = () => finalize(key, rect, txt);
            rect.on("pointerdown", choose);
            txt.on("pointerdown", choose);

            root.add(rect);
            root.add(txt);
            return { rect, txt };
        };

        const b1 = makeBtn("Easy", baseOffset + BTN_H * 0 + GAP * 0, "easy");
        const b2 = makeBtn("Normal", baseOffset + BTN_H * 1 + GAP * 1, "normal");
        const b3 = makeBtn("Hard", baseOffset + BTN_H * 2 + GAP * 2, "hard");

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
        root.add(closeBtn);

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
        closeBtn.on("pointerdown", () => destroyDialog());

        // finalize (blink/yoyo) then callback
        const disableAll = () => {
            [b1, b2, b3].forEach(({ rect, txt }) => {
                rect.disableInteractive();
                txt.disableInteractive();
            });
            closeBtn.disableInteractive();
        };
        const finalize = (difficultyKey, rect, txt) => {
            disableAll();
            this.tweens.add({
                targets: [rect, txt],
                alpha: 0.4,
                yoyo: true,
                duration: 120,
                repeat: 1,
                onComplete: () => {
                    destroyDialog();
                    onSelect?.(difficultyKey);
                },
            });
        };

        const destroyDialog = () => {
            this.tweens.killTweensOf(closeBtn);
            root.destroy(true);
        };
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
                    fontFamily:
                        (typeof CONFIG !== "undefined" && CONFIG.ui?.fontFamily) || "Arial",
                    color: "#ffffff",
                    fontStyle: "bold",
                })
                .setOrigin(0.5)
                .setDepth(3);
            label.setFontSize(Math.round(bh * 0.42));
            label.setStroke("#6b2600", Math.max(2, Math.round(bh * 0.05)));

            const base = { y: BTN_Y, sy: shadow.y, ly: label.y };
            btn.on("pointerover", () => {
                this.tweens.add({
                    targets: btn,
                    scale: 1.05,
                    y: base.y - 4,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: shadow,
                    scale: 1.05,
                    y: base.sy - 4,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: label,
                    scale: 1.05,
                    y: base.ly - 4,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
            });
            btn.on("pointerout", () => {
                this.tweens.add({
                    targets: btn,
                    scale: 1,
                    y: base.y,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: shadow,
                    scale: 1,
                    y: base.sy,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
                this.tweens.add({
                    targets: label,
                    scale: 1,
                    y: base.ly,
                    duration: 120,
                    ease: "Sine.easeOut",
                });
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
