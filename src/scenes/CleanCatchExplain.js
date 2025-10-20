// src/scenes/CleanCatchExplain.js
export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain");
    }

    preload() {
        const explain = CONFIG.assets.kiko;
        this.load.image("KikoBase", explain.base);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
    }

    create(data) {
        console.log("[Explain] Difficulty received:", data?.difficulty);

        const { width: W, height: H } = this.scale;
        const username = this.registry.get("playerName") || "friend";
        const difficulty = this.registry.get("difficulty") || "easy";

        // translucent overlay
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5);

        // kiko
        const kiko = this.add.image(W * 0.12, H * 0.75, "KikoBase")
            .setOrigin(0.5)
            .setScale(0.35);

        // panel
        let panel;
        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H * 0.75, "DialogPanel")
                .setOrigin(0.5)
                .setScale(0.5);
        } else {
            panel = this.add.rectangle(W / 2, H * 0.75, Math.min(W * 0.8, 960), 260, 0xffffff, 1)
                .setStrokeStyle(4, 0x7ec8ff)
                .setOrigin(0.5);
        }

        const panelW = panel.displayWidth || panel.width || Math.min(W * 0.8, 900);
        const style = {
            fontSize: "30px",
            font: "Chewy",
            color: "#000000",
            wordWrap: { width: Math.max(120, Math.floor(panelW * 0.8)) },
            align: "center"
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
        const text = this.add.text(panel.x, panel.y, lines[currentLine], style).setOrigin(0.5);

        // buttons
        const nextBtn = this.add.rectangle(W * 0.82, H * 0.9, 160, 60, 0x0077cc)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true });
        const nextText = this.add.text(nextBtn.x, nextBtn.y, "Next", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "26px",
            color: "#ffffff"
        }).setOrigin(0.5);

        const skipBtn = this.add.rectangle(W * 0.18, H * 0.9, 160, 60, 0xcc4444)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true });
        const skipText = this.add.text(skipBtn.x, skipBtn.y, "Skip", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "26px",
            color: "#ffffff"
        }).setOrigin(0.5);

        const playBtn = this.add.rectangle(W / 2, H * 0.9, 200, 70, 0x28a745)
            .setStrokeStyle(3, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .setVisible(false);
        const playText = this.add.text(playBtn.x, playBtn.y, "PLAY", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "30px",
            color: "#ffffff"
        }).setOrigin(0.5)
            .setVisible(false);

        const nextLine = () => {
            currentLine++;
            if (currentLine < lines.length - 1) {
                text.setText(lines[currentLine]);
            } else {
                text.setText(lines[currentLine]);
                nextBtn.setVisible(false);
                nextText.setVisible(false);
                skipBtn.setVisible(false);
                skipText.setVisible(false);
                playBtn.setVisible(true);
                playText.setVisible(true);
            }
        };

        nextBtn.on("pointerdown", nextLine);

        // skip straight to CleanCatchScene (preserving difficulty)
        const startGame = () => {
            const playerName = this.registry.get("playerName");
            this.scene.stop("CleanCatchExplain");
            const diff = data?.difficulty || this.registry.get("difficulty") || "easy";
            this.scene.start("CleanCatch", { playerName, difficulty: diff });

        };

        skipBtn.on("pointerdown", startGame);
        playBtn.on("pointerdown", startGame);

        this.input.keyboard.on("keydown-SPACE", nextLine);
    }
}


