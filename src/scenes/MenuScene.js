import systems from "../systems.js";
export default class MenuScene extends Phaser.Scene {
    constructor() { super("MenuScene"); }

    preload() {
        const BG = CONFIG.assets.backgrounds;
        this.load.image("frontpage_background", BG.frontpage);
    }

    create() {
        const { width, height } = this.scale;
        this.add.image(0, 0, "frontpage_background").setOrigin(0, 0).setDisplaySize(width, height);

        this.add.text(width / 2, height * CONFIG.menu.titleY, "Kiko's Day", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: `${CONFIG.ui.titleFontSize}px`,
            color: "#ffffff", stroke: "#00c2ff", strokeThickness: 6
        }).setOrigin(0.5);

        const startWithName = () => {
            const cached = this.registry.get("playerName");
            if (cached) {
                this.scene.start("GameScene", { playerName: cached });
            } else {
                systems.ui.nameDialog(this, (playerName) => {
                    this.registry.set("playerName", playerName);
                    this.scene.start("GameScene", { playerName });
                });
            }
        };

        systems.ui.button(this, width/2, height*CONFIG.menu.buttonsY.start, "START GAME", startWithName);
    }
}
