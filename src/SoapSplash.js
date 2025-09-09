/*
*
* Key ideas:
* - Phaser lifecycle: preload() -> create() -> update() runs every frame
* - We spawn "germs" in an intersection of triangular ray and a curved band near the top‑right relative to the sink
* - Germs drift toward the sink; if they touch it, it's a BREACH
* - Player types words over germs to remove them before they breach
* - Score/streak increase for clean (error‑free) word completions; breaches penalize score
*
* Namespaces:
* - window.CONFIG: Tuning constants
* - systems.helpers (h): Math helpers and germ create/destroy utilities
* - systems.spawn: Chooses spawn points and creates germs
* - systems.movement: Moves germs toward sink in each frame
* - systems.rules: Detects sink breaches and applies penalties / game over
* - systems.timer: HUD timer and unified endGame() logic
* - systems.typing: Input handling, targeting, scoring, and HUD for typing.
*/


/**
 * -----------------------------------------------------
 * THINGS TO KNOW
 * ---------------------------------------------------
 * Scene lifecycle...
 * Phaser calls preload() once -> this loads every asset
 * Phaser calls create() once after preload -> this builds sprites and state
 * Phaser calls update() every frame -> this is the main loop
 *
 * Invisible spawn area:
 * We sample polar coordinates (r, theta) in a band (rInner..rOuter) and angles
 * (angleMinDeg..angleMaxDeg) with origin at the sink. That approximates a cone/triangle
 * pointing at the sink. See systems.helpers.sampleAngle/sampleRadius.
 */
const gameScene = new Phaser.Scene('SoapSplash');

// Load textures into Phaser's cache. Keys are later used by add.sprite(..., key)
// If an asset path changes, update only here.
gameScene.preload = function () { // TODO Update assets.
    this.load.image('Background', 'assets/images/created/background.png');
    this.load.image('Sink', 'assets/images/created/Sink.png');
    this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');
};


// Build the world and initialize game state.
// Executed exactly once after preload() completes.
gameScene.create = function () {

    this.sinkPosition = { x: 0, y: CONFIG.height }; // Logical anchor for skin

    this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background')
        .setDepth(0).setScale(2); // Background sprite, depth 0 means behind everything else.

    this.sinkSprite = this.add.sprite(this.sinkPosition.x, this.sinkPosition.y, 'Sink')
        .setOrigin(0, 1).setScale(4).setDepth(4); // Sink sprite, at bottom left

    /**
     TODO later make this into a circle of diameter of width of sprite.
     todo maybe add jerky motion to sink when germs breach
     */

    /*
     * getSinkHitPoint(): centralized point to test for breaches.
     */
    this.getSinkHitPoint = () => ({
        x: this.sinkSprite.x + this.sinkSprite.displayWidth * 0.5,
        y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5
    });


    // Configure spawn geometry (outer/inner radii and angle window (the Triangle))
    if (CONFIG.useSpawner) {  /*The spawner only works when on screen tehre are less than 5 germs.*/
        const cornerDist = Math.hypot(CONFIG.width - this.sinkPosition.x, 0 - this.sinkPosition.y);
        this.rOuter = Math.max(0, cornerDist - CONFIG.cornerMargin);
        this.rInner = Math.max(0, this.rOuter - CONFIG.cornerBandWidth);

        const centerDeg = Phaser.Math.RadToDeg(Math.atan2(CONFIG.height, CONFIG.width));
        this.angleMinDeg = Math.max(0,  centerDeg - CONFIG.angleSpreadDeg);
        this.angleMaxDeg = Math.min(90, centerDeg + CONFIG.angleSpreadDeg);
    }

    this.germs = [];    //active germ objects, sprites and lables...
    this.lastSpawn = 0; //timestamp of previous spawn
    this.germSeq = 0;
    this.breaches = 0;
    this.gameOver = false;

    // Breach HUD Top left
    this.hud = this.add.text(15, 15, 'Breaches: 0/5', {
        fontFamily: 'monospace',
        fontSize: CONFIG.breachesFontSize + 'px',
        color: '#fff'
    });


    // Start timer system
    systems.timer.init(this);
    this.gameStartAt = this.time.now;

    // initialise tyoing system
    systems.typing.init(this);

    // If germs already exists, choose a target, a selection
    if (!this.typing?.activeId && this.germs.length > 0) {
        systems.typing.pickRandom(this);
    }

};


// Pre frame loop, controls spawn, movement rule checks and HUD update.
gameScene.update = function (time, delta) {
    if (this.gameStartAt == null) this.gameStartAt = time;

    // only spawn if cooldown elapsed and on screen population is under control..
    if (!this.gameOver && time - this.lastSpawn > CONFIG.spawnIntervalMs) {
        if (this.germs.length < CONFIG.maxGerms) {
            systems.spawn.spawnGerm(this);
            this.lastSpawn = time;
        }
    }

    if (!this.gameOver) { // while game is not over move germs and check for breaches.
        systems.movement.moveGerms(this, delta);
        systems.rules.checkBreaches(this);
    }

    systems.timer.updateHUD(this, this.time.now);  // keep updating timer ..
};

const config = {
    type: Phaser.AUTO,
    backgroundColor: '#0b1520',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: CONFIG.width,
        height: CONFIG.height,
    },
    scene: gameScene
};

new Phaser.Game(config);
