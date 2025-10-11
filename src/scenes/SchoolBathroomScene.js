// SchoolBathroomScene.js
// Scene after Kiko enters the school, background is wash-station.png

const BG_KEY = "wash_station";
const BG_PATH = "assets/images/background/wash-station.png";

export default class SchoolBathroomScene extends Phaser.Scene {
    constructor() {
        super("SchoolBathroomScene");
    }

    preload() {
        if (!this.textures.exists(BG_KEY)) {
            this.load.image(BG_KEY, BG_PATH);
        }
    }

    create() {
        const { width, height } = this.scale;

        // background
        const bg = this.add.image(width / 2, height / 2, BG_KEY)
            .setOrigin(0.5, 0.5);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // (Optional) add Kiko inside the bathroom scene
        const kiko = this.add.image(width * 0.5, height * 0.85, "kiko_base")
            .setDisplaySize(500, 500)
            .setOrigin(0.5, 1);

        // idle bounce
        this.tweens.add({
            targets: kiko,
            y: kiko.y - 10,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        // text
        this.add.text(width / 2, height * 0.15, "Kiko is washing hands...", {
            font: "36px Arial",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        // button to go ending scene
        const endingBtn = this.add.text(width / 2, height * 0.8, "Go to Ending", {
            font: "32px Arial",
            backgroundColor: "#ffcc00",
            color: "#000",
            padding: { x: 20, y: 10 },
            borderRadius: 20
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        //button hover effect
        endingBtn.on("pointerover", () => {
            endingBtn.setStyle({ backgroundColor: "#ffee33" });
        });

        endingBtn.on("pointerout", () => {
            endingBtn.setStyle({ backgroundColor: "#ffcc00" });
        });

        // go to ending when click the button
        endingBtn.on("pointerdown", () => {
            // this.sound.play("ui_click", { volume: 0.6 }); // 사운드 사용 시
            endingBtn.disableInteractive();
            this.tweens.add({
                targets: endingBtn,
                scale: 0.96,
                duration: 100,
                yoyo: true
            });
            // face out
            this.cameras.main.fadeOut(700, 0, 0, 0);
        });

        // fade out and entering ending scene
        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("EndingScene");
        });
        // fade in effect
        this.cameras.main.fadeIn(600, 0, 0, 0);
    }
}
