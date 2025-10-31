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

        systems.ui.placeLogo(this);

        // --- pause any global bgm ---
        try {
            const g = window.__GLOBAL_BGM__;
            if (g?.isPlaying) g.pause();
        } catch {}

        // --- audio unlock setup ---
        this.sound.pauseOnBlur = false;
        this.sound.mute = false;

        const playBgmNow = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            try { this.sound.context?.resume?.(); } catch {}
            let inst = this.sound.get(BGM_KEY);
            if (inst?.isPlaying) return;
            if (!inst) inst = this.sound.add(BGM_KEY, { loop: true, volume: 0.75 });
            try { inst.play(); } catch (e) { console.warn("[CleanCatchExplain] play() failed:", e); }
            window.__MINI_BGM__ = inst;
            window.__GLOBAL_BGM__ = undefined;
        };

        const fireOnce = () => {
            if (this._gateFired) return;
            this._gateFired = true;
            playBgmNow();
        };
        this.input.once("pointerdown", fireOnce);
        this.input.keyboard?.once("keydown", fireOnce);
        window.addEventListener("mousedown", fireOnce, { once: true, passive: true });
        window.addEventListener("touchstart", fireOnce, { once: true, passive: true });
        if (!this.sound.locked) this.time.delayedCall(0, fireOnce);

        // --- background & overlay ---
        this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(1);

        // --- Kiko sprite ---
        this.kiko = this.add.sprite(W * 0.09, H * 0.7, "KikoBase")
            .setOrigin(0.5)
            .setScale(0.35)
            .setDepth(2);

        // --- Dialogue panel ---
        let panel;
        if (this.textures.exists("DialogPanel"))
            panel = this.add.image(W / 2, H * 0.75, "DialogPanel").setOrigin(0.5).setScale(0.5).setDepth(2);
        else
            panel = this.add.rectangle(W / 2, H * 0.75, Math.min(W * 0.8, 960), 260, 0xffffff, 1)
                .setStrokeStyle(4, 0x7ec8ff)
                .setOrigin(0.5)
                .setDepth(2);

        const panelW = panel.displayWidth || panel.width || Math.min(W * 0.8, 900);

        // --- preload Montserrat font to prevent fallback ---
        if (document.fonts) {
            document.fonts.load("10pt 'Montserrat'").then(() => {
                this.game.events.emit("fontloaded");
            });
        }

        const style = {
            fontFamily: "Montserrat",
            fontSize: "59px", //size of text
            color: "#000000",
            wordWrap: { width: Math.max(120, Math.floor(panelW * 0.8)) },
            align: "center",
        };

        const lines = [
            `${username}! Are you ready for the Soap Splash game? Let’s play!`,
            `Here’s how it works: Catch the clean water drops and soap bubbles — they’re good for us!`,
            `But be careful, you have 3 lives. Avoid the germs from spreading! Don’t let them touch your hands.`,
            `You have 30 seconds to catch as much clean water and soap as you can!
            Use your mouse to move my hands — let’s see how many you can catch!`,
            `When you’re ready, press PLAY!`,
        ];

        let i = 0;
        let text;
        const makeText = () => {
            text = this.add.text(panel.x, panel.y, lines[i], style).setOrigin(0.5).setDepth(3);
        };
        if (document.fonts) {
            document.fonts.ready.then(makeText);
        } else {
            makeText();
        }

        // --- Next button ---
        let nextBtn, nextText = null;
        const nx = W * 0.74, ny = H * 0.9;

        if (this.textures.exists("UI_Next")) {
            nextBtn = this.add.image(nx, ny, "UI_Next")
                .setOrigin(0.5)
                .setDepth(4)
                .setInteractive({ useHandCursor: true, pixelPerfect: true });
            const targetH = Math.min(120, H * 0.12);
            const s = targetH / (nextBtn.height || 1);
            nextBtn.setScale(s);
            nextBtn.on("pointerover", () => nextBtn.setScale(s * 1.05));
            nextBtn.on("pointerout",  () => nextBtn.setScale(s));
            nextBtn.on("pointerdown", () => { nextBtn.setScale(s * 0.97); nextLine(); });
            nextBtn.on("pointerup",   () => nextBtn.setScale(s * 1.05));
        } else {
            nextBtn = this.add.rectangle(nx, ny, 160, 60, 0x0077cc)
                .setStrokeStyle(3, 0xffffff)
                .setOrigin(0.5)
                .setDepth(4)
                .setInteractive({ useHandCursor: true });
            nextText = this.add.text(nx, ny, "Next", {
                fontFamily: "Montserrat",
                fontSize: "32px",
                color: "#fff",
                fontStyle: "bold"
            }).setOrigin(0.5).setDepth(5);
            nextBtn.on("pointerdown", () => nextLine());
        }

        // --- advance dialogue ---
        const nextLine = () => {
            playBgmNow();
            i++;
            if (i % 2 === 0 && this.textures.exists("KikoCheer"))
                this.kiko.setTexture("KikoCheer");
            else if (this.textures.exists("KikoBase"))
                this.kiko.setTexture("KikoBase");

            if (i < lines.length) {
                text.setText(lines[i]);
            } else {
                const fadeTargets = [this.kiko, text, panel, nextBtn];
                if (nextText) fadeTargets.push(nextText);
                this.tweens.add({
                    targets: fadeTargets,
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        this.scene.stop();
                        const playerName = this.registry.get("playerName");
                        console.log("[Explain →] starting CleanCatch with difficulty =", difficulty);
                        this.scene.start("CleanCatch", { playerName, difficulty });
                    }
                });
            }
        };

        // --- keyboard shortcut (Enter) ---
        this.input.keyboard.on("keydown-ENTER", nextLine);

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            try { this._unbinders.forEach(f => f && f()); } catch {}
            this._unbinders = [];
        });
    }
}

