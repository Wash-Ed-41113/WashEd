/**
 * -----------------------------------------------------
 * THINGS TO KNOW
 * ---------------------------------------------------
 *
 * Scene lifecycle...
 * Phaser calls preload() once -> this loads every asset.
 * Phaser calls create() once after preload, This creates the login and sprites... as in adds in the logic
 * Phaser calls Update() every frame... this makes everything move...
 *
 *
 * Invisible spawn area
 * A triangel/ cone with its head (acute angle / smallest angle ) pointing at the sink..
 *
 *
 *
 * */


const gameScene = new Phaser.Scene('SoapSplash');

gameScene.preload = function () {
    this.load.image('Background', 'assets/images/created/background.png');
    this.load.image('Sink', 'assets/images/created/Sink.png');
    this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');
};


// World and scene creation

gameScene.create = function () {
    this.sinkPosition = { x: 0, y: CONFIG.height }; // bottom left position for sink

    this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background')
        .setDepth(0).setScale(2);    //  Background Sprite TODO replace later
    this.sinkSprite = this.add.sprite(this.sinkPosition.x, this.sinkPosition.y, 'Sink')
        .setOrigin(0, 1).setScale(4).setDepth(4);    //  Sink's Sprite TODO replace later

    /** gets the center of img of sinks.. for breaching TODO later make this into a circle of diameter of width of sprite.
     todo maybe add jerky motion to sink when germs breach
     */
    this.getSinkHitPoint = () => ({
        x: this.sinkSprite.x + this.sinkSprite.displayWidth * 0.5,
        y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5
    });



    // configure the intercection that spawnnner will use

    if (CONFIG.useSpawner) {
        const cornerDist = Math.hypot(CONFIG.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
        this.rOuter = Math.max(0, cornerDist - CONFIG.cornerMargin);
        this.rInner = Math.max(0, this.rOuter - CONFIG.cornerBandWidth);

        const centerDeg = Phaser.Math.RadToDeg(Math.atan2(CONFIG.height, CONFIG.width));
        this.angleMinDeg = Math.max(0,  centerDeg - CONFIG.angleSpreadDeg);
        this.angleMaxDeg = Math.min(90, centerDeg + CONFIG.angleSpreadDeg);
    }


// todo later adjust population of germs and trigger spawnner once...  1st breach happens.

    this.germs = []; // Entire population of germs. everything that spawns gets pushed here
    this.lastSpawn = 0;
    this.germSeq = 0; // todo auto increment
    this.breaches = 0; // for UID later
    this.gameOver = false;



    this.hud = this.add.text(15, 15, 'Breaches: 0/5', {
        fontFamily: 'monospace',
        fontSize: CONFIG.breachesFontSize + 'px',
        color: '#fff'
    });

    systems.timer.init(this);
    this.gameStartAt = this.time.now;

    systems.typing.init(this);

    // (Optional) seed an initial target if germs already exist at create-time
    if (!this.typing?.activeId && this.germs.length > 0) {
        systems.typing.pickRandom(this);
    }

};

gameScene.update = function (time, delta) {
    if (this.gameStartAt == null) this.gameStartAt = time;

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
};

const config = {
    type: Phaser.AUTO,
    backgroundColor: '#0b1520',   // todo replace with assets probably
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: CONFIG.width,
        height: CONFIG.height,
    },
    scene: gameScene
};

new Phaser.Game(config);
