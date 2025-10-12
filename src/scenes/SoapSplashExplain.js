// src/scenes/SoapSplashExplain.js
export default class SoapSplashExplain extends Phaser.Scene {
    constructor() {
        super("SoapSplashExplain");
    }

    preload() {
        const explain = CONFIG.assets.kiko;

        this.load.image("KikoBase", explain.base);
        this.load.image("KikoCheer", explain.cheer);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);

    }

    create() {
        const { width: W, height: H } = this.scale;
        const username = this.registry.get("playerName") || "friend";

        // translucent background overlay
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5);

        // kiko sprite (base to start)
        this.kiko = this.add.sprite(W * 0.10, H * 0.7, "KikoBase")
            .setOrigin(0.5)
            .setScale(0.35);

        // dialog panel graphic from assets
        const panel = this.add.image(W / 2, H * 0.75, "DialogPanel")
            .setOrigin(0.5)
            .setScale(0.5);

        // ensure we know the actual visible size after scaling
        const panelW = panel.width * panel.scaleX;
        // const panelH = panel.height * panel.scaleY;

        // text style
        const style = {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "24px",
            color: "#000000",
            wordWrap: { width: panelW * 0.8 }, // wrap relative to panel width
            align: "center"
        };

        // explanation lines
        const lines = [
            `Okay, ${username}, it’s time for the Germ Scrubber showdown!`,
            `The germs are coming and we need your help to stop them. You have 1 minute to type out the clean words so the germs go away.`,
            `Each clean word helps you scrub better with the soap so the germs go away!`,
            `In this game, you have 3 lives. If you do not scrub a germ off in time, it will make you unhealthy and you will lose a life.`,
            `Let’s fight the germs together!`
        ];

        let currentLine = 0;

        // place text *anchored to the panel*
        const text = this.add.text(panel.x, panel.y, lines[currentLine], style)
            .setOrigin(0.5)
            .setDepth(panel.depth + 1);

        // next button
        const btnW = CONFIG.ui.button.width * 0.6;
        const btnH = CONFIG.ui.button.height * 0.6;
        const nextBtn = this.add.rectangle(W * 0.85, H * 0.9, btnW, btnH, CONFIG.ui.button.fill)
            .setStrokeStyle(3, CONFIG.ui.button.stroke)
            .setInteractive({ useHandCursor: true });

        const nextText = this.add.text(nextBtn.x, nextBtn.y, "Next", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "26px",
            color: "#ffffff",
            fontStyle: "bold"
        }).setOrigin(0.5);

        // advance lines + toggle kiko expression
        const nextLine = () => {
            currentLine++;
            if (currentLine % 2 === 0) this.kiko.setTexture("KikoCheer");
            else this.kiko.setTexture("KikoBase");

            if (currentLine < lines.length) {
                text.setText(lines[currentLine]);
            } else {
                this.tweens.add({
                    targets: [this.kiko, text, nextBtn, nextText, panel],
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        this.scene.stop();
                        this.scene.resume("SoapSplash");
                    }
                });
            }
        };

        nextBtn.on("pointerdown", nextLine);
        this.input.keyboard.on("keydown-SPACE", nextLine);
    }
}
