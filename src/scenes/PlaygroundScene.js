// src/scenes/PlaygroundScene.js
export default class PlaygroundScene extends Phaser.Scene {
    constructor() {
        super("PlaygroundScene");
        this.bg = null;
    }

    preload() {
        // Safety: clear previous loader base/path to avoid double paths like /assets/assets/...
        this.load.reset();

        // Debug logs (optional)
        this.load.on("filecomplete-image-bg_playground", () =>
            console.log("[OK] bg_playground loaded")
        );
        this.load.on("loaderror", (file) =>
            console.error("[ERR] loaderror:", file?.src || file)
        );

        // Load the background image (served from /public)
        // Ensure the file exists at: <project-root>/public/assets/images/backgrounds/playground.jpg
        this.load.image("bg_playground", "/assets/images/backgrounds/playground.jpg");
    }

    create() {
        const { width, height } = this.scale;

        // If the texture is missing, bail out with a clear console error
        if (!this.textures.exists("bg_playground")) {
            console.error("Texture 'bg_playground' not found. Check the file path.");
            return;
        }

        // Add background image and keep it behind everything
        this.bg = this.add
            .image(width / 2, height / 2, "bg_playground")
            .setOrigin(0.5, 0.5)
            .setDepth(-100)
            .setScrollFactor(0);

        // Cover-fit the background to fill the screen
        const fitCover = () => {
            const w = this.scale.width;
            const h = this.scale.height;
            const iw = this.bg.width;
            const ih = this.bg.height;
            const scale = Math.max(w / iw, h / ih);
            this.bg.setScale(scale).setPosition(w / 2, h / 2);
        };

        fitCover();
        this.scale.on("resize", fitCover);

        // Read difficulty from registry
        const difficulty = this.registry.get("difficulty") || "easy";

        // Title text on top of background
        this.add
            .text(width / 2, height * 0.1, `Difficulty: ${difficulty}`, {
                fontFamily: "Arial",
                fontSize: "36px",
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5);

        // (Optional) Back to menu with ESC
        this.input.keyboard.on("keydown-ESC", () => {
            this.scene.start("MenuScene"); // change to your actual menu scene key if different
        });
    }
}
