
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



const gameScene = new Phaser.Scene('SopeSplash');

gameScene.preload = function () { // todo update assets
    this.load.image('Background', 'assets/images/created/background.png');
    this.load.image('Sink', 'assets/images/created/Sink.png');
    this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');

};


//  HELPERS
function sampleAngle(minDeg, maxDeg){ // gets a random angle in your cone
    const a0 = Phaser.Math.DegToRad(minDeg);
    const a1 = Phaser.Math.DegToRad(maxDeg);
    return Phaser.Math.FloatBetween(a0, a1);
}
/**
sample angle gets a random angle in the triangle and and converts them into radians from degree
* Phaser uses radians
* Returns a Uniform random angle in min and max  ie between angle theta and 1
*
* A uniform angle here defines angles with no probable bias, so each spawn is equally likely */


function sampleRadius(rInner, rOuter){
    const u = Math.random(); // the randomness...
    return Math.sqrt(u * (rOuter*rOuter - rInner*rInner) + rInner*rInner);
}
/**
* Gets a random distance form the sink...
* r^2 = U * (rOuter ^2 - rInner^2 ) + rInner^2
* */



function polarToWorld(origin, r, theta) { // converts polar cordinates to world cordinstes, x and y...
    return {x: origin.x + Math.cos(theta)*r, y: origin.y - Math.sin(theta) *r}; // its a -ve sin caus y grows downwards
}


/**
* germs are spawnning in an invisible wedge defined by direction and distance,
* cone - picks a direction from sink and is ranged at angleMinDeg to angleMaxDeg....
* radii - picks how far from the sink to spawn (rInner to rOuter)
* intersection of cone and radai is spawn zone...
* */




gameScene.spawnGerm = function () {
    let tries = CONFIG.maxSpawnAttempts; // necessary to limit cpu usage
    let pos = null;

    while (tries-- > 0) {  // no of times the loop runs in a frame... rn 12..
        const theta = sampleAngle(this.angleMinDeg, this.angleMaxDeg); // got direction
        const r     = sampleRadius(this.rInner, this.rOuter); // got distance
        const p     = polarToWorld(this.sinkPosition, r, theta); // got exact point where to spawn

        // this is what prevents clusters,
        const sep = CONFIG.minSpawnSeparationPx;   // how much distance we want among germs...
        if (sep > 0) {
            let ok = true;
            for (let i = 0; i < this.germs.length; i++) {
                if (Phaser.Math.Distance.Between(p.x, p.y, this.germs[i].sprite.x, this.germs[i].sprite.y) < sep) {
                    ok = false; break;
                }
            }
            if (!ok) continue;
        }

        pos = p; break; // valid spot found
    }
    if (!pos) return;

    const sprite = this.add.sprite(pos.x, pos.y, 'Germ').setDepth(4).setScale(0.12);      //  Germs Sprite TODO replace later
    const word   = CONFIG.words[(Math.random() * CONFIG.words.length) ];
    const label  = this.add.text(pos.x, pos.y + 14, word, { fontFamily:'monospace', fontSize:'12px', color:'#fff' })
        .setOrigin(0.5, 0).setDepth(5);
    this.germs.push({ sprite, label, word });
}; // as long as there optimal space.. system will spawn germs...
/*
* try upto max spawn attempts, enforce a minimum distance of space between germs, */





// World and scene creation
gameScene.create = function () {
    this.sinkPosition = {x: 0, y: CONFIG.height}; // bottom left position for sink

    this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background').setDepth(0).setScale(2);     //  Background Sprite TODO replace later
    this.sinkSprite = this.add.sprite(this.sinkPosition.x, this.sinkPosition.y, 'Sink').setOrigin(0,1).setScale(4).setDepth(4);   //  Sink's Sprite TODO replace later


    /** gets the center of img of sinks.. for breaching TODO later make this into a circle of diameter of width of sprite.
      todo maybe add jerky motion to sink when germs breach
        */

    this.getSinkHitPoint = () => ({
        x: this.sinkSprite.x + this.sinkSprite.displayWidth  * 0.5,
        y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5
    });

    // configure the intercection that spawnnner will use
    if(CONFIG.useSpawner){
        const cornerDist = Math.hypot(CONFIG.width - this.sinkPosition.x, 0 - this.sinkPosition.y);


        this.rOuter = Math.max(0, cornerDist - CONFIG.cornerMargin);
        this.rInner = Math.max(0, this.rOuter - CONFIG.cornerBandWidth);

        const centerDeg = Phaser.Math.RadToDeg(Math.atan2(CONFIG.height, CONFIG.width));
        this.angleMinDeg = Math.max(0,  centerDeg - CONFIG.angleSpreadDeg);
        this.angleMaxDeg = Math.min(90, centerDeg + CONFIG.angleSpreadDeg);
    }
    // todo later adjust population of germs and trigger spawnner once...  1st breach happens.



    this.germs = [];
    this.lastSpawn = 0;
    this.breaches = 0; // for UID later

    this.hud = this.add.text(15, 15, 'Breaches: 0/5', {
        fontFamily:'monospace', fontSize:'16px', color:'#fff'
    });
};


/**
 * Frame Loop
 */

gameScene.update = function (time, delta) {
    if (time - this.lastSpawn > CONFIG.spawnIntervalMs){ // if enough time has passed since last spawn make a new one..
        this.spawnGerm();
        this.lastSpawn = time;
    }
    this.moveGerms(delta);
    this.checkBreaches();
};

// movement


gameScene.moveGerms = function (delta) {

    const speed = CONFIG.germSpeed * (delta / 1000);

    for (let i = this.germs.length - 1; i >= 0; i--) {
        const germObject = this.germs[i];
        const dx = this.sinkPosition.x - germObject.sprite.x;
        const dy = this.sinkPosition.y - germObject.sprite.y;
        const magnitude = Math.hypot(dx, dy) || 1;

        let ux = dx / magnitude; // UX, UY are unit vectors
        let uy = dy / magnitude;

        const wobble = 0.15;
        ux += (Math.random() - 0.5) * wobble;
        uy += (Math.random() - 0.5) * wobble;
        const mm = Math.hypot(ux, uy) || 1; // new magnitude
        ux /= mm;
        uy /= mm;


    //     actual moving
        germObject.sprite.x += ux * speed;
        germObject.sprite.y += uy * speed;
        germObject.label.setPosition(germObject.sprite.x, germObject.sprite.y + 14);

    }
};



/**
 * Remove any germ that reaches the sink center within radius rSink.
 * Also increments the HUD counter. (Add lose-condition when breaches >= 5.)
 */

gameScene.checkBreaches = function () {
    const hit = this.getSinkHitPoint();
    for (let i = this.germs.length - 1; i >= 0; i--) {
        const g = this.germs[i];
        const d = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);

        if (d <= CONFIG.rSink) {
            g.sprite.destroy();
            g.label.destroy();
            this.germs.splice(i, 1);

            this.breaches++;
            this.hud.setText(`Breaches: ${this.breaches}/5`);
            console.log('breach', this.breaches); // optional debug line
        }
    }
};





const config = {
    type: Phaser.AUTO,
    backgroundColor: '#0b1520', // todo replace with assets probably
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: CONFIG.width,
        height: CONFIG.height,
    },
    scene: gameScene
};

new Phaser.Game(config);
