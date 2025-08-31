

const gameScene = new Phaser.Scene('SopeSplash');

gameScene.preload = function () { // todo update assets
    this.load.image('Background', 'assets/images/created/background.png');
    this.load.image('Sink', 'assets/images/created/Sink.png');
    this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');

};


//  HELPERS
function sampleAngle(minDeg, maxDeg){
    const a0 = Phaser.Math.DegToRad(minDeg);
    const a1 = Phaser.Math.DegToRad(maxDeg);
    return Phaser.Math.FloatBetween(a0, a1);
}
function sampleRadius(rInner, rOuter){
    const u = Math.random();
    return Math.sqrt(u * (rOuter*rOuter - rInner*rInner) + rInner*rInner);
}

function polarToWorld(origin, r, theta) {
    return {x: origin.x + Math.cos(theta)*r, y: origin.y - Math.sin(theta)*r};
}


gameScene.spawnGerm = function () {
    let tries = CONFIG.maxSpawnAttempts || 10;
    let pos = null;

    while (tries-- > 0) {
        const theta = sampleAngle(this.angleMinDeg, this.angleMaxDeg);
        const r     = sampleRadius(this.rInner, this.rOuter);
        const p     = polarToWorld(this.sinkPosition, r, theta);

        const sep = CONFIG.minSpawnSeparationPx || 0;
        if (sep > 0) {
            let ok = true;
            for (let i = 0; i < this.germs.length; i++) {
                if (Phaser.Math.Distance.Between(p.x, p.y, this.germs[i].sprite.x, this.germs[i].sprite.y) < sep) {
                    ok = false; break;
                }
            }
            if (!ok) continue;
        }

        pos = p; break;
    }
    if (!pos) return;

    const sprite = this.add.sprite(pos.x, pos.y, 'Germ').setDepth(4).setScale(0.12);
    const word   = CONFIG.words[(Math.random() * CONFIG.words.length) | 0];
    const label  = this.add.text(pos.x, pos.y + 14, word, { fontFamily:'monospace', fontSize:'12px', color:'#fff' })
        .setOrigin(0.5, 0).setDepth(5);
    this.germs.push({ sprite, label, word });
};


gameScene.create = function () {
    this.sinkPosition = {x: 0, y: CONFIG.height}; // bottom left position for sink

    this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background').setDepth(0).setScale(2);
    this.sinkSprite = this.add.sprite(this.sinkPosition.x, this.sinkPosition.y, 'Sink').setOrigin(0,1).setScale(4).setDepth(4);

    this.getSinkHitPoint = () => ({
        x: this.sinkSprite.x + this.sinkSprite.displayWidth  * 0.5,
        y: this.sinkSprite.y - this.sinkSprite.displayHeight * 0.5
    });

    if(CONFIG.useCornerAim){
        const cornerDist = Math.hypot(CONFIG.width - this.sinkPosition.x, 0 - this.sinkPosition.y);


        this.rOuter = Math.max(0, cornerDist - CONFIG.cornerMargin);
        this.rInner = Math.max(0, this.rOuter - CONFIG.cornerBandWidth);

        const centerDeg = Phaser.Math.RadToDeg(Math.atan2(CONFIG.height, CONFIG.width));
        this.angleMinDeg = Math.max(0,  centerDeg - CONFIG.angleSpreadDeg);
        this.angleMaxDeg = Math.min(90, centerDeg + CONFIG.angleSpreadDeg);
    } else {
        this.rInner = CONFIG.rInner;
        this.rOuter = CONFIG.rOuter;
        this.angleMinDeg = CONFIG.angleMinDeg;
        this.angleMaxDeg = CONFIG.angleMaxDeg;
    }

    console.log('spawn band:', { rInner: this.rInner, rOuter: this.rOuter, angleMinDeg: this.angleMinDeg, angleMaxDeg: this.angleMaxDeg });

    this.germs = [];
    this.lastSpawn = 0;
    this.breaches = 0; // for UID later

    this.hud = this.add.text(15, 15, 'Breaches: 0/5', {
        fontFamily:'monospace', fontSize:'16px', color:'#fff'
    });
};

gameScene.update = function (time, delta) {
    if (time - this.lastSpawn > CONFIG.spawnIntervalMs){
        this.spawnGerm();
        this.lastSpawn = time;
    }
    this.moveGerms(delta);
    this.checkBreaches();
};

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
