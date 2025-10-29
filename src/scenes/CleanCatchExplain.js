// src/scenes/CleanCatchExplain.js
import systems from "../systems.js";
import { AudioManager } from "../systems.js";

export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain");
    }

    preload() {
        const explain = (CONFIG.assets && CONFIG.assets.kiko) || {};
        const A = (CONFIG.assets && CONFIG.assets.cleanCatch) || {};
        const ui = (CONFIG.assets && CONFIG.assets.ui) || {};

        // Kiko art (load only if not already in cache)
        if (!this.textures.exists("KikoBase")  && explain.base)  this.load.image("KikoBase",  explain.base);
        if (!this.textures.exists("KikoCheer") && explain.cheer) this.load.image("KikoCheer", explain.cheer);

        // Dialog panel (optional custom UI)
        if (!this.textures.exists("DialogPanel") && ui.dialogPanel) {
            this.load.image("DialogPanel", ui.dialogPanel);
        }

        // Background image for explain scene
        if (!this.textures.exists("backgroundFullLives")) {
            this.load.image("backgroundFullLives", (A.background || "assets/images/CleanCatcher/1.jpg"));
        }
    }

    create(data) {
        const { width: W, height: H } = this.scale;
        const username   = this.registry.get("playerName") || "friend";
        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";
// --- AUDIO: menus off, game on ---
        AudioManager.pauseGroup("global");
        AudioManager.stopGroup("game");
        AudioManager.play(this, "clean_catch_music", { group: "game", volume: 0.4, loop: true });

// Stop only this scene’s own sounds when it ends (CleanCatchScene will manage group)
        const stopSceneAudio = () => { try { AudioManager.stop(this); } catch (_) {} };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopSceneAudio);
        this.events.once(Phaser.Scenes.Events.SLEEP,    stopSceneAudio);
        this.events.once(Phaser.Scenes.Events.DESTROY,  stopSceneAudio);

        // Background image
        if (this.textures.exists("backgroundFullLives")) {
            this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        }

        // Translucent overlay
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.4).setDepth(1);

        // Kiko sprite (start with Cheer if available)
        const kikoStartKey = this.textures.exists("KikoCheer") ? "KikoCheer" :
            (this.textures.exists("KikoBase") ? "KikoBase" : null);
        if (kikoStartKey) {
            this.kiko = this.add.sprite(W * 0.12, H * 0.75, kikoStartKey)
                .setOrigin(0.5)
                .setScale(0.35)
                .setDepth(2);
        }

        // Dialog panel (fallback shape if missing)
        let panel;
        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H * 0.75, "DialogPanel").setOrigin(0.5).setScale(0.5).setDepth(2);
        } else {
            panel = this.add.rectangle(W / 2, H * 0.75, Math.min(W * 0.8, 960), 260, 0xffffff, 1)
                .setStrokeStyle(4, 0x7ec8ff).setOrigin(0.5).setDepth(2);
        }

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
            `When you’re ready, press PLAY!`
        ];

        let currentLine = 0;
        const text = this.add.text(panel.x, panel.y, lines[currentLine], style).setOrigin(0.5).setDepth(3);

        // Buttons
        const nextBtn = this.add.rectangle(W * 0.82, H * 0.9, 160, 60, 0x0077cc)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true }).setDepth(3);
        const nextText = this.add.text(nextBtn.x, nextBtn.y, "Next", {
            fontFamily: "Chewy", fontSize: "30px", color: "#ffffff", fontStyle: "bold",
        }).setOrigin(0.5).setDepth(3);

        const skipBtn = this.add.rectangle(W * 0.18, H * 0.9, 160, 60, 0xcc4444)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true }).setDepth(3);
        const skipText = this.add.text(skipBtn.x, skipBtn.y, "Skip", {
            fontFamily: "Chewy", fontSize: "30px", color: "#ffffff",
        }).setOrigin(0.5).setDepth(3);

        const playBtn = this.add.rectangle(W / 2, H * 0.9, 200, 70, 0x28a745)
            .setStrokeStyle(3, 0xffffff).setInteractive({ useHandCursor: true })
            .setVisible(false).setDepth(3);
        const playText = this.add.text(playBtn.x, playBtn.y, "PLAY", {
            fontFamily: "Chewy", fontSize: "34px", color: "#ffffff",
        }).setOrigin(0.5).setVisible(false).setDepth(3);

        const nextLine = () => {
            currentLine++;
            // Toggle expression if we have both textures
            if (this.kiko) {
                if (currentLine % 2 === 0 && this.textures.exists("KikoCheer")) this.kiko.setTexture("KikoCheer");
                else if (this.textures.exists("KikoBase")) this.kiko.setTexture("KikoBase");
            }

            if (currentLine < lines.length - 1) {
                text.setText(lines[currentLine]);
            } else {
                text.setText(lines[currentLine]);
                nextBtn.setVisible(false); nextText.setVisible(false);
                skipBtn.setVisible(false); skipText.setVisible(false);
                playBtn.setVisible(true);  playText.setVisible(true);
            }
        };
        nextBtn.on("pointerdown", nextLine);
        this.input.keyboard.on("keydown-SPACE", nextLine);

        const startGame = () => {
            // Do NOT stop the "game" group here; let CleanCatchScene own it.
            const playerName = this.registry.get("playerName");
            this.scene.stop("CleanCatchExplain");
            this.scene.start("CleanCatch", { playerName, difficulty });
        };
        skipBtn.on("pointerdown", startGame);
        playBtn.on("pointerdown", startGame);
    }
}
