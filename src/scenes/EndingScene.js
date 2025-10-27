// src/scenes/EndingScene.js
import systems from "../systems.js";
import { DB } from "../db.js";
// import { CONFIG } from "../config.js";
// needed for assets + fonts used below

export default class EndingScene extends Phaser.Scene {
    constructor() {
        super("EndingScene");
        this._nameUi = null; // track modal bits for cleanup
        this._leaderboardPanel = null;
        this._simpleScoresBox = null;
    }

    preload() {
        // if you already preload these via CONFIG elsewhere, these will just re-use the cache
        this.load.image("kiko_cheer", "assets/images/WashEd_kiko_sprite/kiko_cheer.png");
        this.load.image("confetti", "assets/images/background/confetti.png");
        this.load.image("dialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("homeResetButton", "assets/images/UI/washed_kikos-day_UI-Button_HOME.png");
        this.load.image("classroom_bg", "assets/images/background/Classroom.png");

        // ending music (guarded at runtime in case the file is absent)
        if (!this.cache.audio.exists("endingMusic")) {
            this.load.audio("endingMusic", "assets/sounds/kikos day.mp3");
        }
    }

    // =========
    // Helpers
    // =========

    // dark button identical to pause overlay's mute/unmute feel
    _darkButton(x, y, label, onClick) {
        const Bw = CONFIG?.ui?.button?.width  ?? 360;
        const Bh = CONFIG?.ui?.button?.height ?? 64;
        const stroke = 0xffffff;
        const fillIdle  = 0x142038;
        const fillHover = 0x1d2b52;

        const rect = this.add.rectangle(x, y, Bw, Bh, fillIdle, 1)
            .setOrigin(0.5)
            .setStrokeStyle(2, stroke)
            .setInteractive({ useHandCursor: true })
            .setDepth(30);

        const txt = this.add.text(x, y, label, {
            fontFamily: CONFIG?.ui?.fontFamily ?? "Montserrat",
            fontSize: "26px",
            color: "#ffffff",
            align: "center",
            fixedWidth: Bw
        }).setOrigin(0.5).setDepth(31).setInteractive({ useHandCursor: true });

        const handler = () => onClick && onClick();

        rect.on("pointerover", () => rect.setFillStyle(fillHover));
        rect.on("pointerout",  () => rect.setFillStyle(fillIdle));
        rect.on("pointerup",   handler);
        txt.on("pointerup",    handler);

        return { rect, txt };
    }

    // open a name dialog using the dialogPanel asset (self-contained)
    _openNameDialog(onSubmit) {
        this._closeNameDialog(); // if any existing

        const { width, height } = this.scale;

        // blocking overlay to prevent clicks behind
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35)
            .setDepth(98).setInteractive();

        // base panel: use dialogPanel image (preloaded from CONFIG)
        let panel = this.add.image(width / 2, height / 2, "dialogPanel")
            .setOrigin(0.5).setDepth(100);

        // scale panel to fit nicely
        const s = Math.min((width * 0.62) / panel.width, (height * 0.48) / panel.height);
        panel.setScale(s);

        // title text on panel
        const title = this.add.text(
            width / 2,
            (height / 2) - (panel.displayHeight * 0.35),
            "Enter Your Name",
            {
                fontFamily: CONFIG?.ui?.fontFamily ?? "Montserrat",
                fontSize: "30px",
                color: "#102040"
            }
        ).setOrigin(0.5).setDepth(101);

        // DOM container (input + two buttons)
        const innerW = Math.min(520, panel.displayWidth * 0.85);
        const dom = this.add.dom(width / 2, height / 2 + 10).createFromHTML(`
          <div style="
            width:${innerW}px;
            display:flex; flex-direction:column; align-items:center; gap:14px;
            font-family:${CONFIG?.ui?.fontFamily || "Montserrat"}, sans-serif;
          ">
            <input id="playerNameInput" type="text" maxlength="24" autofocus
              style="
                width:100%;
                font-size:20px; padding:10px 12px; border-radius:12px;
                border:2px solid #1d2b52; outline:none;
                text-align:center;
              "
              placeholder="Type your name" />
            <div style="display:flex; gap:14px;">
              <button id="okBtn" style="
                font-size:18px; padding:10px 18px; border-radius:10px; border:2px solid #fff;
                background:#142038; color:#fff; cursor:pointer;
              ">OK</button>
              <button id="cancelBtn" style="
                font-size:18px; padding:10px 18px; border-radius:10px; border:2px solid #142038;
                background:#ffffff; color:#142038; cursor:pointer;
              ">Cancel</button>
            </div>
          </div>
        `);
        dom.setOrigin(0.5).setDepth(101);

        const node = dom.node;
        const input = node.querySelector("#playerNameInput");
        const okBtn = node.querySelector("#okBtn");
        const cancelBtn = node.querySelector("#cancelBtn");

        const submit = () => {
            const raw = (input?.value || "").trim();
            const name = raw || "Player";
            onSubmit?.(name);
            this._closeNameDialog();
        };
        const cancel = () => this._closeNameDialog();

        okBtn?.addEventListener("click", submit);
        cancelBtn?.addEventListener("click", cancel);
        input?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") cancel();
        });

        this._nameUi = { overlay, panel, title, dom };
    }

    _closeNameDialog() {
        const ui = this._nameUi;
        if (!ui) return;
        ui.overlay?.destroy?.();
        ui.panel?.destroy?.();
        ui.title?.destroy?.();
        ui.dom?.destroy?.();
        this._nameUi = null;
    }

    /** Build a transparent, resizable leaderboard window. (SAFE VERSION) */
    _showLeaderboard(opts = {}) {
        // ---- local helpers ----
        const isGO = (x) => x && typeof x === "object" && ("type" in x) && x.once && x.on; // basic Phaser GO shape

        // Always returns a Container (safe to add to other Containers)
        const makeDarkButton = (x, y, label, onClick, w = 160, h = 54) => {
            const cont = this.add.container(x, y);
            const rect = this.add.rectangle(0, 0, w, h, 0x000000, 0.65)
                .setStrokeStyle(2, 0xffffff, 0.9)
                .setOrigin(0, 0)
                .setInteractive({ useHandCursor: true });
            const txt = this.add.text(w / 2, h / 2, label, {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(Math.min(w, h) * 0.38),
                color: "#ffffff",
            }).setOrigin(0.5);

            rect.on("pointerover", () => rect.setFillStyle(0x111111, 0.85));
            rect.on("pointerout",  () => rect.setFillStyle(0x000000, 0.65));
            rect.on("pointerdown", () => {
                this.sound?.play?.("click_sfx"); // optional if you have it
                onClick?.();
            });

            cont.add([rect, txt]);
            cont.setSize(w, h);
            cont.setDepth(205);
            return cont;
        };

        const addSafe = (parent, child) => {
            if (!child) return;
            if (Array.isArray(child)) {
                for (const c of child) addSafe(parent, c);
                return;
            }
            if (!isGO(child)) return; // ignore plain objects
            parent.add(child);
        };

        // ---- layout options ----
        const xFrac = opts.xFrac ?? 0.50;
        const yFrac = opts.yFrac ?? 0.50;
        const wFrac = opts.wFrac ?? 0.78;
        const hFrac = opts.hFrac ?? 0.60;
        const corner = opts.corner ?? 18;
        const bgAlpha = opts.bgAlpha ?? 0.18;
        const strokeAlpha = opts.strokeAlpha ?? 0.65;

        const { width: W, height: H } = this.scale;
        const panelW = Math.max(420, W * wFrac);
        const panelH = Math.max(300, H * hFrac);
        const panelX = W * xFrac - panelW / 2;
        const panelY = H * yFrac - panelH / 2;

        const panel = this.add.container(panelX, panelY).setDepth(200).setScrollFactor(0);

        // BG
        const g = this.add.graphics();
        g.fillStyle(0x000000, bgAlpha);
        g.fillRoundedRect(0, 0, panelW, panelH, corner);
        g.lineStyle(2, 0xffffff, strokeAlpha);
        g.strokeRoundedRect(0, 0, panelW, panelH, corner);
        addSafe(panel, g);

        // Metrics
        const pad = Math.round(Math.min(panelW, panelH) * 0.05);
        const colGap = Math.round(panelW * 0.04);
        const colWidth = Math.floor((panelW - pad * 2 - colGap) / 2);
        const headerH = Math.round(panelH * 0.13);
        const listH = panelH - headerH - pad * 2;

        // Title
        const title = this.add.text(pad, pad, "Leaderboard", {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(headerH * 0.45),
            fontStyle: "700",
            color: "#ffffff",
        });
        addSafe(panel, title);

        // Subheader with current totals
        const name = this.registry.get("playerName") || "Player";
        const sessionId = window.__SESSION_ID__;
        let currentTotal = 0, top3 = [], uniquePlayers = [];
        try {
            currentTotal = DB.query.sessionTotal(sessionId) || 0;
            top3 = DB.query.topRoundsBySession(sessionId, 3) || [];
            uniquePlayers = DB.query.players() || [];
        } catch (e) {
            console.warn("[EndingScene] DB queries failed:", e);
        }

        const sub = this.add.text(
            pad,
            pad + Math.round(headerH * 0.55),
            `Current: ${name} — Total ${currentTotal}`,
            {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(headerH * 0.32),
                color: "#ffffff",
            }
        );
        addSafe(panel, sub);

        // Left column: Top-3
        const leftX = pad;
        const leftY = pad + headerH;
        addSafe(panel, this.add.text(leftX, leftY, "Top 3 (this session)", {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(headerH * 0.30),
            color: "#ffffff",
        }));

        const list1 = this.add.container(leftX, leftY + Math.round(headerH * 0.35));
        addSafe(panel, list1);

        const rowH = Math.max(28, Math.round(listH / 6));
        top3.forEach((r, i) => {
            const y = i * rowH;
            addSafe(list1, this.add.text(0, y, `${i + 1}.`, {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(rowH * 0.55),
                color: "#ffffff",
            }));
            addSafe(list1, this.add.text(Math.round(colWidth * 0.15), y, `${r.score}`, {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(rowH * 0.55),
                color: "#A2F1B1",
            }));
            addSafe(list1, this.add.text(
                Math.round(colWidth * 0.45),
                y,
                `${r.game_key || ""}  (streak ${r.best_streak || 0})`,
                {
                    fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                    fontSize: Math.round(rowH * 0.40),
                    color: "#dfe9ff",
                }
            ));
        });

        // Right column: unique players (first 8)
        const rightX = pad + colWidth + colGap;
        const rightY = leftY;
        addSafe(panel, this.add.text(rightX, rightY, "Players in database", {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(headerH * 0.30),
            color: "#ffffff",
        }));

        const list2 = this.add.container(rightX, rightY + Math.round(headerH * 0.35));
        addSafe(panel, list2);

        uniquePlayers.slice(0, 8).forEach((p, i) => {
            const y = i * rowH;
            addSafe(list2, this.add.circle(0, y + Math.round(rowH * 0.42), Math.round(rowH * 0.14), 0xffffff, 0.9));
            addSafe(list2, this.add.text(Math.round(rowH * 0.38), y, p.name, {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(rowH * 0.50),
                color: "#ffffff",
            }));
            addSafe(list2, this.add.text(Math.round(colWidth * 0.55), y, `sessions ${p.sessions}`, {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(rowH * 0.38),
                color: "#dfe9ff",
            }));
        });

        // Close button (always a proper Container)
        const btnW = Math.max(120, Math.round(panelW * 0.18));
        const btnH = Math.max(40, Math.round(panelH * 0.10));
        const btn = makeDarkButton(
            panelW - btnW - pad,
            panelH - btnH - pad,
            "Close",
            () => { panel.destroy(); },
            btnW,
            btnH
        );
        addSafe(panel, btn);

        // keep a reference for cleanup
        this._leaderboardPanel = panel;

        // cleanup on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._leaderboardPanel?.destroy?.();
            this._leaderboardPanel = null;
        });

        return panel;
    }

    /** Simple text-only scoreboard that reads from DB and lays out cleanly. */
    _showSimpleSessionScores(opts = {}) {
        const name = this.registry.get("playerName") || "Player";
        const sessionId = window.__SESSION_ID__;
        const W = this.scale.width, H = this.scale.height;

        let soap = 0, catchr = 0, total = 0, best = { player_name: "-", total: 0 };
        try {
            soap   = DB.query.sessionGameTotal(sessionId, "SoapSplash") || 0;
            catchr = DB.query.sessionGameTotal(sessionId, "CleanCatch") || 0;
            total  = DB.query.sessionTotal(sessionId) || 0;
            best   = (DB.query.bestSessionTotals(1)[0]) || best;
        } catch (e) {
            console.warn("[EndingScene] simple scores query failed:", e);
        }

        // Anchor box to keep layout stable and relative
        const boxW = Math.max(520, Math.round(W * (opts.wFrac ?? 0.55)));
        const boxH = Math.max(220, Math.round(H * (opts.hFrac ?? 0.28)));
        const boxX = Math.round(W * (opts.xFrac ?? 0.5) - boxW / 2);
        const boxY = Math.round(H * (opts.yFrac ?? 0.78) - boxH / 2);

        const cont = this.add.container(boxX, boxY).setDepth(180);

        // Optional translucent backdrop so white text reads over confetti
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.22);
        bg.fillRoundedRect(0, 0, boxW, boxH, 14);
        cont.add(bg);

        const pad = Math.round(Math.min(boxW, boxH) * 0.08);
        const lineH = Math.round(Math.min(boxW, boxH) * 0.16);

        const header = this.add.text(pad, pad, `Scores — ${name}`, {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(lineH * 0.8),
            color: "#ffffff",
        });
        cont.add(header);

        const t1 = this.add.text(pad, pad + lineH * 1.2, `Soap Splash: ${soap}`, {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(lineH * 0.7),
            color: "#dfe9ff",
        });
        const t2 = this.add.text(pad, pad + lineH * 2.0, `Clean Catch: ${catchr}`, {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(lineH * 0.7),
            color: "#dfe9ff",
        });
        const t3 = this.add.text(pad, pad + lineH * 2.8, `Total this session: ${total}`, {
            fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
            fontSize: Math.round(lineH * 0.75),
            color: "#A2F1B1",
        });

        const bestTxt = this.add.text(
            Math.round(boxW * 0.50),
            pad + lineH * 1.2,
            `Best total: ${best.total}`,
            {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(lineH * 0.70),
                color: "#ffffff",
            }
        ).setOrigin(0.5, 0);
        const bestBy = this.add.text(
            Math.round(boxW * 0.50),
            pad + lineH * 2.0,
            `by ${best.player_name || "-"}`,
            {
                fontFamily: (window.CONFIG?.ui?.fontFamily || "Arial"),
                fontSize: Math.round(lineH * 0.55),
                color: "#dfe9ff",
            }
        ).setOrigin(0.5, 0);

        cont.add([t1, t2, t3, bestTxt, bestBy]);

        this._simpleScoresBox = cont;
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._simpleScoresBox?.destroy?.(); this._simpleScoresBox = null;
        });
    }

    create() {
        const { width, height } = this.scale;

        // ---- Audio (guarded) ----
        this.music = null;
        if (this.cache.audio.exists("endingMusic")) {
            this.music = this.sound.add("endingMusic", { loop: true, volume: 0.6 });
            this.music.play();
        } else {
            console.warn("[Ending] endingMusic not found; continuing silently");
        }

        const playerName = this.registry.get("playerName") || "Player";

        // ---- Score tier + message (based on TOTAL for this session) ----
        const sid = window.__SESSION_ID__ || null;
        const myTotal = sid ? DB.query.sessionTotal(sid) : 0;

        const getScoreTier = (s) => (s >= 500 ? "high" : s >= 250 ? "medium" : "low");
        const tier = getScoreTier(myTotal);

        const dialogueSets = {
            high: [
                `Great work, ${playerName}! Because of you, Kiko is happy, healthy, and ready for more fun.`,
                `Amazing ${playerName}! You helped Kiko every step of the way. Those germs didn’t stand a chance!`,
                `Wow ${playerName}! You made Kiko's day super clean and helped him stay healthy. You're a true WASH Hero!`
            ],
            medium: [
                `Awesome ${playerName}! You helped Kiko finish his day with clean hands!`,
                `Great job ${playerName}! You guided Kiko through the whole day - and look, his hands are clean and safe`,
                `Nice work ${playerName}! You kept Kiko healthy. Each try makes you stronger!`
            ],
            low: [
                `Thanks for your help, ${playerName}! You finished Kiko’s day and learned how to stay clean and healthy. Next time, you'll be even faster`,
                `Good effort ${playerName}! You know how to stay clean and safe. Let’s play again and keep practicing!`,
                `Yay ${playerName}! You finished your adventure with Kiko! Every try makes you a better WASH Hero - don't give up!`
            ]
        };
        const messages = dialogueSets[tier];
        const selectedMessage = messages[Math.floor(Math.random() * messages.length)];

        // ---- Background with fallback ----
        if (this.textures.exists("classroom_bg")) {
            this.add.image(width / 2, height / 2, "classroom_bg").setDisplaySize(width, height);
        } else {
            this.add.rectangle(0, 0, width, height, 0x1b2a3a).setOrigin(0, 0);
        }

        // ---- Dialogue panel + text ----
        const dialogY = height * 0.97;
        const dialoguePanel = this.add.image(width * 0.50, dialogY, "dialogPanel")
            .setOrigin(0.5, 1)
            .setAlpha(0)
            .setDepth(25)
            .setScale(0.5);

        const panelCenterY = dialogY - (dialoguePanel.height * dialoguePanel.scaleY) / 2;

        const text = this.add.text(width * 0.50, panelCenterY, selectedMessage, {
            fontFamily: "Montserrat",
            fontSize: "64px",
            color: "#000000",
            wordWrap: { width: 870 },
            align: "center"
        }).setOrigin(0.5).setAlpha(0).setDepth(26);

        this.tweens.add({ targets: dialoguePanel, alpha: 1, duration: 600, ease: "Sine.inOut" });
        this.tweens.add({ targets: text, alpha: 1, duration: 800, ease: "Sine.inOut", delay: 200 });

        // =========================
        // ---- Live LEADERBOARD / SIMPLE SCORES ---
        // =========================
        const board = DB.query.topTotals({ limit: 6 }); // existing code kept as-is
        this.add.text(width * 0.65, height * 0.17, "SCOREBOARD", {
            fontFamily: "Chewy",
            fontSize: "88px",
            color: "#ffffff"
        }).setOrigin(0.5).setDepth(21);

        const leaderboardStartY = height * 0.27;
        board.forEach((row, i) => {
            const you = (sid && row.session_id === sid) ? "  (you)" : "";
            this.add.text(
                width * 0.65,
                leaderboardStartY + i * 50,
                `${i + 1}. ${row.player_name}: ${row.total}${you}`,
                { fontFamily: "Chewy", fontSize: "48px", color: "#ffffff" }
            ).setOrigin(0.5).setDepth(21);
        });

        // current player's total (prominent)
        this.add.text(
            width * 0.65,
            leaderboardStartY + board.length * 50 + 64,
            `My Total: ${myTotal}`,
            { fontFamily: "Chewy", fontSize: "64px", color: "#ffffff" }
        ).setOrigin(0.5).setDepth(21);

        // ---- Confetti loop params ----
        this.MAX_LIVE_CONFETTI = 40;
        this.liveConfetti = 0;
        this.DELAY_MIN = 600;
        this.DELAY_MAX = 1200;
        this._confettiCancelled = false;
        this.startConfettiLoop();

        // ---- Kiko sprite + idle jump + squash ----
        const baseY = height * 0.9;
        const widthX = width * 0.15;
        const kiko = this.add.image(widthX, baseY, "kiko_cheer")
            .setDisplaySize(650, 650)
            .setOrigin(0.5, 1)
            .setDepth(40);

        const baseScaleX = kiko.scaleX;
        const baseScaleY = kiko.scaleY;
        const jumpHeight = 34;
        const jumpDuration = 520;

        this.tweens.add({
            targets: kiko,
            y: baseY - jumpHeight,
            duration: jumpDuration,
            ease: "Sine.inOut",
            yoyo: true,
            repeat: -1
        });

        this.tweens.add({
            targets: kiko,
            scaleX: { from: baseScaleX, to: baseScaleX * 1.06 },
            scaleY: { from: baseScaleY, to: baseScaleY * 0.92 },
            duration: 120,
            yoyo: true,
            repeat: -1,
            repeatDelay: jumpDuration - 120
        });

        // ---- Sparkles above Kiko ----
        this.time.addEvent({
            delay: jumpDuration,
            loop: true,
            callback: () => {
                const sparkleCount = Phaser.Math.Between(3, 5);
                for (let i = 0; i < sparkleCount; i++) {
                    const sparkle = this.add.star(
                        kiko.x + Phaser.Math.Between(-80, 80),
                        kiko.y - Phaser.Math.Between(80, 200),
                        5,
                        Phaser.Math.Between(3, 6),
                        Phaser.Math.Between(10, 16),
                        0xffffcc
                    ).setAlpha(Phaser.Math.FloatBetween(0.6, 1))
                        .setDepth(8)
                        .setAngle(Phaser.Math.Between(0, 360));

                    this.tweens.add({
                        targets: sparkle,
                        scale: { from: 1, to: Phaser.Math.FloatBetween(1.4, 2.2) },
                        alpha: 0,
                        rotation: "+=" + Phaser.Math.FloatBetween(2, 3.5),
                        duration: Phaser.Math.Between(500, 800),
                        ease: "Sine.easeOut",
                        onComplete: () => sparkle.destroy()
                    });
                }
            }
        });

        // ---- Home / Reset button ----
        const baseScale = 0.1;
        const btn = this.add.image(width * 0.95, height * 0.1, "homeResetButton")
            .setOrigin(0.5)
            .setScale(baseScale)
            .setDepth(20)
            .setInteractive({ useHandCursor: true });

        btn.on("pointerover", () => btn.setScale(baseScale * 1.03));
        btn.on("pointerout",  () => btn.setScale(baseScale));
        btn.on("pointerdown", () => {
            btn.disableInteractive();
            this.cameras.main.fadeOut(500, 0, 0, 0);
        });

        this.cameras.main.once("camerafadeoutcomplete", () => {
            // stop confetti loop so it doesn't schedule more
            this._confettiCancelled = true;

            if (this.music) {
                this.tweens.add({
                    targets: this.music,
                    volume: 0,
                    duration: 600,
                    ease: "Sine.easeOut",
                    onComplete: () => {
                        this.music && this.music.stop();
                        this.scene.start("MenuScene");
                    }
                });
            } else {
                this.scene.start("MenuScene");
            }
        });

        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Initialize DB and choose scoreboard UI via flag
        try { DB.init(); } catch (e) { console.warn("DB init error", e); }

        if (CONFIG?.ui?.isLeaderboardsSwas) {
            // Fancy transparent, resizable window
            this._showLeaderboard({
                xFrac: 0.50,
                yFrac: 0.52,
                wFrac: 0.75,
                hFrac: 0.60,
                bgAlpha: 0.18
            });
        } else {
            // Simple text-only scoreboard using the DB
            this._showSimpleSessionScores({
                xFrac: 0.50,
                yFrac: 0.80,
                wFrac: 0.55,
                hFrac: 0.28
            });
        }

        // clean-up on shutdown just in case
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this._confettiCancelled = true;
            if (this.music) { try { this.music.stop(); } catch(_){} this.music.destroy(); this.music = null; }
            this._leaderboardPanel?.destroy?.();
            this._leaderboardPanel = null;
            this._simpleScoresBox?.destroy?.();
            this._simpleScoresBox = null;
            this._closeNameDialog();
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this._leaderboardPanel?.destroy?.();
            this._leaderboardPanel = null;
            this._simpleScoresBox?.destroy?.();
            this._simpleScoresBox = null;
            this._closeNameDialog();
        });
    }

    // ---- Confetti: loop ----
    startConfettiLoop() {
        if (this._confettiCancelled) return;
        const { width, height } = this.scale;
        const randomX = Phaser.Math.Between(width * 0.1, width * 0.9);
        const randomY = Phaser.Math.Between(height * 0.15, height * 0.75);
        const pieces = Phaser.Math.Between(5, 8);
        this.shootConfetti(randomX, randomY, pieces);
        const delay = Phaser.Math.Between(this.DELAY_MIN, this.DELAY_MAX);
        this.time.delayedCall(delay, () => this.startConfettiLoop());
    }

    // ---- Confetti: burst ----
    shootConfetti(x, y, pieces = 6) {
        if (this._confettiCancelled) return;
        if (this.liveConfetti >= this.MAX_LIVE_CONFETTI) return;

        const canCreate = Math.min(pieces, this.MAX_LIVE_CONFETTI - this.liveConfetti);
        for (let i = 0; i < canCreate; i++) {
            const img = this.add.image(x, y, "confetti")
                .setScale(Phaser.Math.FloatBetween(0.18, 0.28))
                .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
                .setAlpha(1)
                .setDepth(5);

            this.liveConfetti++;

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.FloatBetween(200, 400);
            const targetX = x + Math.cos(angle) * distance;
            const targetY = y + Math.sin(angle) * distance;

            this.tweens.add({
                targets: img,
                x: targetX,
                y: targetY,
                rotation: "+=" + Phaser.Math.FloatBetween(2, 4),
                alpha: 0,
                duration: Phaser.Math.Between(900, 1300),
                ease: "Cubic.easeOut",
                onComplete: () => { img.destroy(); this.liveConfetti--; }
            });
        }
    }
}
