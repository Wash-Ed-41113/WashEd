export default class MenuScene extends Phaser.Scene {
    constructor() { super("MenuScene"); }

    create() {
        const { width, height } = this.scale;

        this.add.text(width/2, height*0.35, "Kiko's Day", {
            fontFamily: "Arial",
            fontSize: "64px",
            color: "#ffffff",
            stroke: "#00c2ff",
            strokeThickness: 6
        }).setOrigin(0.5);

        const btn = this.add.rectangle(width/2, height*0.6, 240, 70, 0x00c2ff)
            .setStrokeStyle(4, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const label = this.add.text(btn.x, btn.y, "START GAME", {
            fontFamily: "Arial",
            fontSize: "28px",
            color: "#111",
            fontStyle: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const goGame = () => this.scene.start("GameScene");
        btn.on("pointerdown", goGame);
        label.on("pointerdown", goGame);
        this.input.keyboard.on("keydown-ENTER", goGame);
    }
}
