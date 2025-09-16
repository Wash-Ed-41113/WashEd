export default class GameScene extends Phaser.Scene {
    constructor() { super("GameScene"); }

    create() {
        const { width, height } = this.scale;

        // text
        this.add.text(width/2, height/2, "Game Scene!", {
            fontFamily: "Arial",
            fontSize: "48px",
            color: "#00ff88"
        }).setOrigin(0.5);

        // box
        const btn = this.add.rectangle(width/2, height*0.7, 220, 60, 0x00ff88)
            .setStrokeStyle(4, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const label = this.add.text(btn.x, btn.y, "NEXT", {
            fontFamily: "Arial",
            fontSize: "28px",
            color: "#111",
            fontStyle: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const goGame = () => this.scene.start("LoadingScene");
        btn.on("pointerdown", goGame);
        label.on("pointerdown", goGame);
        this.input.keyboard.on("keydown-ENTER", goGame);
    }
}
