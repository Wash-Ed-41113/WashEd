// src/scenes/SoapSplashExplain.js
export default class SoapSplashExplain extends Phaser.Scene {
    constructor() {
        super("SoapSplashExplain");
    }

    //  dsbjsb
    preload() {
        const explain = CONFIG.assets.kiko;

        this.load.image("KikoBase", explain.base);
        this.load.image("KikoCheer", explain.cheer);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("UI_Next", CONFIG.assets.ui.next);

    }

    create() {
        const { width: W, height: H } = this.scale;
        const username = this.registry.get("playerName") || "friend";

        // translucent overlay
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5);

        // kiko sprite (fallback if missing)
        let kikoKey = "KikoBase";
        if (!this.textures.exists(kikoKey)) kikoKey = Object.keys(this.textures.list)[0];
        this.kiko = this.add.sprite(W * 0.09, H * 0.7, kikoKey)
            .setOrigin(0.5)
            .setScale(0.35);

        // panel fallback
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
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "64px",
            color: "#000000",
            wordWrap: { width: Math.max(120, Math.floor(panelW * 0.8)) },
            align: "center"
        };

        const lines = [
            `Okay, ${username}, it’s time for the Germ Scrubber showdown!`,
            `The germs are coming and we need your help to stop them.`,
            `You have 1 minute to type the clean words to make germs go away.`,
            `Each clean word helps you scrub better with soap so the germs disappear!`,
            `You have 3 lives. If you miss one, the germs reach the sink and you lose a life.`,
            `Let’s fight the germs together!`
        ];

        let currentLine = 0;
        const text = this.add.text(panel.x, panel.y, lines[currentLine], style)
            .setOrigin(0.5)
            .setDepth((panel.depth || 0) + 1);

        // --- NEXT button (image from config, fallback to rectangle+text) ---
        let nextBtn, nextText = null;
        const nx = W * 0.88;
        const ny = H * 0.9;

        if (this.textures.exists("UI_Next")) {
            nextBtn = this.add.image(nx, ny, "UI_Next")
                .setOrigin(0.5)
                .setDepth((panel.depth || 0) + 2)
                .setInteractive({ useHandCursor: true, pixelPerfect: true });

            // scale to a pleasant on-screen height while preserving aspect
            const targetH = Math.min(120, H * 0.12);
            const s = targetH / (nextBtn.height || 1);
            nextBtn.setScale(s);

            // hover/press feedback
            nextBtn.on("pointerover", () => nextBtn.setScale(s * 1.05));
            nextBtn.on("pointerout",  () => nextBtn.setScale(s));
            nextBtn.on("pointerdown", () => { nextBtn.setScale(s * 0.97); nextLine(); });
            nextBtn.on("pointerup",   () => nextBtn.setScale(s * 1.05));
        } else {
            // Fallback: rectangle + "Next" label
            nextBtn = this.add.rectangle(nx, ny, 160, 60, 0x0077cc)
                .setStrokeStyle(3, 0xffffff)
                .setOrigin(0.5)
                .setDepth((panel.depth || 0) + 2)
                .setInteractive({ useHandCursor: true });
            nextText = this.add.text(nx, ny, "Next", {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "26px",
                color: "#ffffff",
                fontStyle: "bold"
            }).setOrigin(0.5).setDepth((panel.depth || 0) + 3);
            nextBtn.on("pointerdown", () => nextLine());
        }

        const nextLine = () => {
            currentLine++;
            if (currentLine % 2 === 0 && this.textures.exists("KikoCheer")) this.kiko.setTexture("KikoCheer");
            else if (this.textures.exists("KikoBase")) this.kiko.setTexture("KikoBase");

            if (currentLine < lines.length) {
                text.setText(lines[currentLine]);
            } else {
                const fadeTargets = [this.kiko, text, panel, nextBtn];
                if (nextText) fadeTargets.push(nextText);

                this.tweens.add({
                    targets: fadeTargets,
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        // console.log("[Explain] finished → resuming SoapSplash");
                        this.scene.stop();
                        this.scene.resume("SoapSplash");
                    }
                });
            }
        };

        // keyboard shortcut
        this.input.keyboard.on("keydown-ENTER", nextLine);
    }



}
