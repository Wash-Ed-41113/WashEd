const GameWidth =640;
const GameHeight = 360;



let gameScene = new Phaser.Scene("Game");
//njnsjksnjs
let config = {
    type: Phaser.AUTO,
    width: GameWidth,
    height: GameHeight,
    scene: gameScene
};

let game = new Phaser.Game(config);

gameScene.preload = function(){
    // this.load.image('background', 'assets/background.jpeg');
};

gameScene.create = function() {
    // this.add.sprite(0,0,'background').setPosition(GameWidth/2, GameHeight/2).setScale(0.9,0.9);
};


