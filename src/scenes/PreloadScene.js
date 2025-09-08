export default class PreloadScene extends Phaser.Scene {
    constructor() { super("PreloadScene"); }

    preload() {
        this.load.image('frontpage_background', 'assets/images/backgrounds/frontpage.png');

        this.load.image(
            'kiko_base',
            'assets/images/WashEd_kiko_sprite/WashEd_kiko_sprite_base.png'
        );
    }

    create() {
        this.scene.start("MenuScene");
    }
}
