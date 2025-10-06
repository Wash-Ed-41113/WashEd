// SchoolBathroomScene.js
// Scene after Kiko enters the school, background is wash-station.png

const BG_KEY = "washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";
const BG_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";

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

        // // (Optional) add Kiko inside the bathroom scene
        // const kiko = this.add.image(width * 0.5, height * 0.85, "kiko_base")
        //     .setDisplaySize(500, 500)
        //     .setOrigin(0.5, 1);
        //
        // // idle bounce
        // this.tweens.add({
        //     targets: kiko,
        //     y: kiko.y - 10,
        //     duration: 1200,
        //     yoyo: true,
        //     repeat: -1,
        //     ease: "Sine.easeInOut",
        // });

    }
}
