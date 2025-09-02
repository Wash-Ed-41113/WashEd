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
        const box = this.add.rectangle(width/2, height*0.7, 60, 60, 0x00ff88);
        box.setStrokeStyle(4, 0xffffff);
    }
}
