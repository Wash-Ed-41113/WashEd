

const gameScene = new Phaser.Scene('SopeSplash');

gameScene.preload = function () { // todo update assets
    this.load.image('Background', 'assets/images/created/background.png');
    this.load.image('Sink', 'assets/soap2.png');
    this.load.image('Germ', 'assets/images/washed_mod_2/washed_mod_2_disease_water-BORN-ex__GASTRO.png');

};

function sampleRadius(rInner, rOuter){
    const u = Math.random();

}

gameScene.create = function () {
    this.sinkPostion = {x: 0, y: CONFIG.height}; // bottom left position for sink
    this.add.sprite(CONFIG.width/2, CONFIG.height/2, 'Background').setDepth(0).setScale(2);
    this.add.sprite(this.sinkPostion.x, this.sinkPostion.y, 'Sink').setOrigin(0,1).setScale(4).setDepth(4);

    this.add.text(10, 10, 'SopaSPlash!!', {setFontFamily: 'monospace', fontSize: '16px', setColor: '#fff'});
};

gameScene.update = function () {
//     spawn and move logic
};





const config = {
    type: Phaser.AUTO,
    backgroundColour: '#ob1520', // todo replace with assets probably
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: CONFIG.width,
        height: CONFIG.height,
    },
    scene: gameScene
};

new Phaser.Game(config);
