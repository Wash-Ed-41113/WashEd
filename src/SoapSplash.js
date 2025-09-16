export default class SoapSplash extends Phaser.Scene {
    constructor() { super('SoapSplash'); }

    preload() {
        this.load.image('Background', 'assets/images/created/background.png');
        this.load.image('Sink', 'assets/images/created/Sink.png');
        this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');
    }

    create() {
        this.sinkPosition = { x: 0, y: CONFIG.height };

        this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background')
            .setDepth(0).setScale(2);

        this.sinkSprite = this.add.sprite(this.sinkPosition.x, this.sinkPosition.y, 'Sink')
            .setOrigin(0, 1).setScale(4).setDepth(4);

        this.getSinkHitPoint = () => ({
            x: this.sinkSprite.x + this.sinkSprite.displayWidth * 0.5,
            y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5,
        });

        // === game state ===
        this.germs = [];
        this.lastSpawn = 0;
        this.breaches = 0;
        this.gameOver = false;

        // === HUD ===
        this.hud = this.add.text(15, 15, 'Breaches: 0/5', {
            fontFamily: 'monospace',
            fontSize: CONFIG.breachesFontSize + 'px',
            color: '#fff',
        });

        // === timer + typing ===
        systems.timer.init(this);
        this.gameStartAt = this.time.now;
        systems.typing.init(this);

        // === back to menu button ===
        const backBtn = this.add.text(CONFIG.width - 20, 20, '↩ Menu', {
            fontFamily: 'Arial',
            fontSize: '22px',
            color: '#ff6b6b',
            fontStyle: 'bold',
            backgroundColor: '#222'
        })
            .setOrigin(1, 0)             // top-right corner
            .setPadding(6)
            .setInteractive({ useHandCursor: true });

        backBtn.on('pointerup', () => {
            this.scene.start('MenuScene');   // 👈 go back to main menu
        });
    }


    update(time, delta) {
        if (!this.gameOver && time - this.lastSpawn > CONFIG.spawnIntervalMs) {
            if (this.germs.length < CONFIG.maxGerms) {
                systems.spawn.spawnGerm(this);
                this.lastSpawn = time;
            }
        }

        if (!this.gameOver) {
            systems.movement.moveGerms(this, delta);
            systems.rules.checkBreaches(this);
        }

        systems.timer.updateHUD(this, this.time.now);
    }
}
