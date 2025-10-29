// src/scenes/CleanCatchExplain.js
/* global Phaser, CONFIG */

import systems from "../systems.js";
// NOTE: Deliberately not using AudioManager here to remove interference sources.

const BGM_KEY  = "cleanCatcher_bgm";
const BGM_PATH = "assets/sounds/cleanCatcher.mp3";

export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain");
        this._started   = false; // guard against double-starts
        this._gateFired = false; // one-shot audio gate
        this._unbinders = [];
    }

    preload() {
        const explain = (CONFIG.assets && CONFIG.assets.kiko) || {};
        const A  = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
        const ui = (CONFIG.assets && CONFIG.assets.ui) || {};

        if (!this.textures.exists("KikoBase")  && explain.base)  this.load.image("KikoBase",  explain.base);
        if (!this.textures.exists("KikoCheer") && explain.cheer) this.load.image("KikoCheer", explain.cheer);
        if (!this.textures.exists("DialogPanel") && ui.dialogPanel) this.load.image("DialogPanel", ui.dialogPanel);
        if (!this.textures.exists("backgroundFullLives")) {
            this.load.image("backgroundFullLives", (A.background || "assets/images/CleanCatcher/1.jpg"));
        }

        // Load BGM — make sure the path/casing EXACTLY matches your file
        if (!this.cache.audio.exists(BGM_KEY)) {
            this.load.audio(BGM_KEY, [BGM_PATH]);
        }

        // Helpful logging if path/mime is wrong
        this.load.on("loaderror", (file) => {
            if (file?.key === BGM_KEY) {
                console.warn("[CleanCatchExplain] Failed to load:", file.src || file.url);
            }
        });
    }

    create(data) {
        const { width: W, height: H } = this.scale;
        const username   = this.registry.get("playerName") || "friend";
        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";

        systems.ui.placeLogo(this);

        // --- Pause menu/global BGM (do not destroy) ---
        try {
            const g = (typeof window !== "undefined") ? window.__GLOBAL_BGM__ : null;
            if (g?.isPlaying) g.pause();
        } catch {}

        // --- Explicitly ensure web audio is not muted/paused ---
        this.sound.pauseOnBlur = false;
        this.sound.mute = false;

        // ------- Create a simple, reliable audio gate tied to first gesture -------
        const playBgmNow = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            try { this.sound.context?.resume?.(); } catch {}

            // If already playing, do nothing
            let inst = this.sound.get(BGM_KEY);
            if (inst?.isPlaying) return;

            // Add (if needed) and play inside THIS same callstack
            if (!inst) inst = this.sound.add(BGM_KEY, { loop: true, volume: 0.75 });
            if (!inst.isPlaying) {
                try {
                    inst.play();
                    // Keep a handle globally if next scenes want to keep this track alive
                    if (typeof window !== "undefined") window.__MINI_BGM__ = inst;
                    // Also remember that we’re using a “game” track now
                    if (typeof window !== "undefined") window.__GLOBAL_BGM__ = undefined;
                } catch (e) {
                    console.warn("[CleanCatchExplain] play() failed:", e);
                }
            }
        };

        const fireOnce = () => {
            if (this._gateFired) return;
            this._gateFired = true;
            playBgmNow();
        };

        // Any first gesture counts; keep it simple
        this.input.once("pointerdown", fireOnce);
        this.input.keyboard?.once("keydown", fireOnce);
        window.addEventListener("mousedown",  fireOnce, { once: true, passive: true });
        window.addEventListener("touchstart", fireOnce, { once: true, passive: true });
        // If already unlocked (e.g., came from a scene that unlocked audio), try immediately
        if (!this.sound.locked) this.time.delayedCall(0, fireOnce);

        // -------------------- UI --------------------
        // Background + overlay
        if (this.textures.exists("backgroundFullLives")) {
            this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        }
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.40).setDepth(1);

        // Kiko
        const kikoKey = this.textures.exists("KikoCheer") ? "KikoCheer"
            : (this.textures.exists("KikoBase") ? "KikoBase" : null);
        if (kikoKey) {
            this.kiko = this.add.sprite(W * 0.12, H * 0.75, kikoKey)
                .setOrigin(0.5).setScale(0.35).setDepth(2);
        }

        // Dialog panel
        const panel = (this.textures.exists("DialogPanel")
            ? this.add.image(W / 2, H * 0.75, "DialogPanel").setOrigin(0.5).setScale(0.5).setDepth(2)
            : this.add.rectangle(W / 2, H * 0.75, Math.min(W * 0.8, 960), 260, 0xffffff, 1)
                .setStrokeStyle(4, 0x7ec8ff).setOrigin(0.5).setDepth(2));

        const panelW = panel.displayWidth || panel.width || Math.min(W * 0.8, 900);
        const style = {
            fontFamily: "Chewy",
            fontSize: "45px",
            color: "#000000",
            wordWrap: { width: Math.max(120, Math.floor(panelW * 0.8)) },
            align: "center",
        };

        const lines = [
            `${username}! Are you ready for the Clean Catch game? Let’s play!`,
            `Here’s how it works: Catch the clean water drops and soap bubbles — they’re good for us!
But be careful, you have 3 lives. Avoid the germs from spreading! Don’t let them touch your hands.`,
            `You have 30 seconds to catch as much clean water and soap as you can!
Use your mouse to move my hands — let’s see how many you can catch!`,
            `When you’re ready, press PLAY!`,
        ];

        let i = 0;
        const text = this.add.text(panel.x, panel.y, lines[i], style).setOrigin(0.5).setDepth(3);

        // Buttons
        const nextBtn = this.add.rectangle(W * 0.82, H * 0.9, 160, 60, 0x0077cc)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true }).setDepth(3);
        const nextTxt = this.add.text(nextBtn.x, nextBtn.y, "Next", { fontFamily: "Chewy", fontSize: "30px", color: "#fff", fontStyle: "bold" })
            .setOrigin(0.5).setDepth(3);

        const skipBtn = this.add.rectangle(W * 0.18, H * 0.9, 160, 60, 0xcc4444)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true }).setDepth(3);
        const skipTxt = this.add.text(skipBtn.x, skipBtn.y, "Skip", { fontFamily: "Chewy", fontSize: "30px", color: "#fff" })
            .setOrigin(0.5).setDepth(3);

        const playBtn = this.add.rectangle(W / 2, H * 0.9, 200, 70, 0x28a745)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true })
            .setVisible(false).setDepth(3);
        const playTxt = this.add.text(playBtn.x, playBtn.y, "PLAY", { fontFamily: "Chewy", fontSize: "34px", color: "#fff" })
            .setOrigin(0.5).setVisible(false).setDepth(3);

        const nextLine = () => {
            i++;
            if (this.kiko) {
                if (i % 2 === 0 && this.textures.exists("KikoCheer")) this.kiko.setTexture("KikoCheer");
                else if (this.textures.exists("KikoBase")) this.kiko.setTexture("KikoBase");
            }
            if (i < lines.length - 1) {
                text.setText(lines[i]);
            } else {
                text.setText(lines[i]);
                nextBtn.setVisible(false); nextTxt.setVisible(false);
                skipBtn.setVisible(false); skipTxt.setVisible(false);
                playBtn.setVisible(true);  playTxt.setVisible(true);
            }
        };

        // Ensure first click also triggers BGM (same callstack)
        const withBgm = (fn) => () => { playBgmNow(); fn(); };

        nextBtn.on("pointerdown", withBgm(nextLine));
        nextTxt.on("pointerdown", withBgm(nextLine));
        this.input.keyboard.on("keydown-SPACE", withBgm(nextLine));

        const startGame = () => {
            if (this._started) return;
            this._started = true;
            // Do NOT stop the BGM here; CleanCatchScene can keep it or manage it.
            const playerName = this.registry.get("playerName");
            this.scene.stop("CleanCatchExplain");
            this.scene.start("CleanCatch", { playerName, difficulty });
        };

        skipBtn.on("pointerdown", withBgm(startGame));
        skipTxt.on("pointerdown", withBgm(startGame));
        playBtn.on("pointerdown", withBgm(startGame));
        playTxt.on("pointerdown", withBgm(startGame));

        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            try { this._unbinders.forEach(f => f && f()); } catch {}
            this._unbinders = [];
        });
    }
}
