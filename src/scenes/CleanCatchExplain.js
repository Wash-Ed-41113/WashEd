/* global Phaser, CONFIG */
import systems from "../systems.js";

const BGM_KEY  = "cleanCatcher_bgm";
const BGM_PATH = "assets/sounds/cleanCatcher.mp3";

export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain");
        this._started = false;
        this._gateFired = false;
        this._unbinders = [];
    }

    preload() {
        const explain = CONFIG.assets?.kiko || {};
        const A  = CONFIG.assets?.cleanCatch || {};
        const ui = CONFIG.assets?.ui || {};

        if (!this.textures.exists("KikoBase") && explain.base) this.load.image("KikoBase", explain.base);
        if (!this.textures.exists("KikoCheer") && explain.cheer) this.load.image("KikoCheer", explain.cheer);
        if (!this.textures.exists("DialogPanel") && ui.dialogPanel) this.load.image("DialogPanel", ui.dialogPanel);
        if (!this.textures.exists("UI_Next") && ui.next) this.load.image("UI_Next", ui.next);

        if (!this.textures.exists("backgroundFullLives"))
            this.load.image("backgroundFullLives", A.background || "assets/images/CleanCatcher/1.jpg");

        if (!this.cache.audio.exists(BGM_KEY)) this.load.audio(BGM_KEY, [BGM_PATH]);
        this.load.on("loaderror", (f) => { if (f?.key === BGM_KEY) console.warn("[CleanCatchExplain] BGM load failed:", f.src || f.url); });
    }

    create(data) {
        const { width: W, height: H } = this.scale;
        const username   = this.registry.get("playerName") || "friend";
        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";

        // Pause menu/global BGM if active
        try {
            const g = window.__GLOBAL_BGM__;
            if (g?.isPlaying) g.pause();
        } catch {}

        const playBgmNow = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            try { this.sound.context?.resume?.(); } catch {}
            let inst = this.sound.get(BGM_KEY);
            if (!inst) inst = this.sound.add(BGM_KEY, { loop: true, volume: 0.75 });
            if (!inst.isPlaying) inst.play();
            window.__MINI_BGM__ = inst;
            window.__GLOBAL_BGM__ = undefined;
        };

        this.input.once("pointerdown", playBgmNow);
        this.input.keyboard?.once("keydown", playBgmNow);

        // Background
        this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(1);

        //────────── Dialog Panel Centered ──────────
        let panel;
        const maxPanelW = Math.min(W * 1.5, 1500);
        const maxPanelH = Math.min(H * 2, 520);

        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H * 0.50, "DialogPanel")
                .setOrigin(0.5)
                .setDepth(2);
            const scale = Math.min(maxPanelW / panel.width, maxPanelH / panel.height);
            panel.setScale(scale);
        } else {
            panel = this.add.rectangle(W / 2, H * 0.55, maxPanelW, maxPanelH, 0xffffff)
                .setStrokeStyle(4, 0x7ec8ff)
                .setOrigin(0.5)
                .setDepth(2);
        }

        const panelW = panel.displayWidth;
        const panelH = panel.displayHeight;

        //────────── Kiko left of dialog ──────────
        this.kiko = this.add.sprite(
            panel.x - panelW * 0.70,
            panel.y + panelH * 0.47,
            "KikoBase"
        )
            .setOrigin(0.5, 1)
            .setDepth(3);

        const kikoMaxH = panelH * 0.95;
        this.kiko.setScale(kikoMaxH / this.kiko.height);

        //────────── Dialogue Text Setup ──────────
        const lines = [
            `${username}! Are you ready for the Soap Splasher game? Let’s play!`,
            `Here’s how it works!`,
            `Catch the clean WATER droplets and SOAP bubbles — they’re good for us!`,
            `But be careful — you have 3 LIVES. Avoid the germs from spreading! Don’t let them touch your hands.`,
            `You have 30 SECONDS to catch as much clean WATER and SOAP as you can!\nUse your MOUSE to move my hands.`,
            `Let’s see how many you can CATCH!`,
            `When you’re ready, click the green ARROW!`
        ];

        let i = 0;

        const style = {
            fontFamily: "Montserrat",
            fontSize: Math.max(30, panelH * 0.10) + "px",
            color: "#000000",
            wordWrap: { width: panelW * 0.85 },
            align: "center"
        };

        const text = this.add.text(
            panel.x,
            panel.y,
            lines[i],
            style
        ).setOrigin(0.5).setDepth(4);

        //────────── Next Button ──────────
        const nx = panel.x + panelW * 0.60;
        const ny = panel.y + panelH * 0.02;
        const nextBtn = this.add.image(nx, ny, "UI_Next")
            .setOrigin(0.5)
            .setDepth(4)
            .setInteractive({ useHandCursor: true });

        const btnScale = Math.min(120, H * 0.12) / nextBtn.height;
        nextBtn.setScale(btnScale);

        nextBtn.on("pointerdown", () => {
            playBgmNow();
            i++;
            if (i < lines.length) {
                text.setText(lines[i]);
                if (i % 2 === 0 && this.textures.exists("KikoCheer"))
                    this.kiko.setTexture("KikoCheer");
                else
                    this.kiko.setTexture("KikoBase");
            } else {
                this.tweens.add({
                    targets: [this.kiko, text, panel, nextBtn],
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        this.scene.start("CleanCatch", { difficulty });
                    }
                });
            }
        });

        this.input.keyboard.on("keydown-ENTER", () => nextBtn.emit("pointerdown"));
    }

}

