// import the shared systems module that holds helpers and ui widgets
import systems from "../systems.js";

// export a class named MenuScene which extends Phaser.Scene
// Phaser.Scene is the base class for all game scenes in phaser
export default class MenuScene extends Phaser.Scene {

    // constructor runs first when the scene is created
    // super("MenuScene") registers this scene with the key MenuScene
    constructor() { super("MenuScene"); }

    // preload runs before create
    // it is used to load images sounds or other assets
    preload() {
        // BG is a shortcut to the backgrounds section of CONFIG assets
        const BG = CONFIG.assets.backgrounds;

        // load.image loads a single image and assigns it a key
        // here the key is frontpage_background and the source path is BG.frontpage
        this.load.image("frontpage_background", BG.frontpage);
    }

    // create runs after preload once assets are loaded
    create() {
        // destructure the width and height of the game canvas from this.scale
        const { width, height } = this.scale;

        // add.image draws an image at the given position with the given key
        // (0,0) is top left corner
        // setOrigin(0,0) anchors the image at the top left
        // setDisplaySize(width,height) stretches the image to cover the whole screen
        this.add.image(0, 0, "frontpage_background").setOrigin(0, 0).setDisplaySize(width, height);

        // add.text draws text on the screen
        // x is width/2 (center horizontally)
        // y is height times CONFIG.menu.titleY (a fraction for vertical placement)
        // "Kiko's Day" is the displayed string
        // style uses CONFIG ui values for fontFamily and fontSize plus a stroke for outline
        // setOrigin(0.5) centers the text horizontally and vertically at its point
        this.add.text(width / 2, height * CONFIG.menu.titleY, "Kiko's Day", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: `${CONFIG.ui.titleFontSize}px`,
            color: "#ffffff", stroke: "#00c2ff", strokeThickness: 6
        }).setOrigin(0.5);

        // define a helper function startWithName
        // this checks if a playerName already exists in the registry
        // if it exists it starts GameScene with that name
        // if not it calls systems.ui.nameDialog to open a name input panel
        // once the user enters a name it stores it in the registry and then starts GameScene
        const startWithName = () => {
            // cached gets the playerName from registry storage
            const cached = this.registry.get("playerName");
            if (cached) {
                // if playerName exists then go straight to GameScene
                this.scene.start("GameScene", { playerName: cached });
            } else {
                // if not then open the name dialog ui
                // pass in this scene and a callback that receives the entered playerName
                systems.ui.nameDialog(this, (playerName) => {
                    // store the playerName in registry for later
                    this.registry.set("playerName", playerName);
                    // then start GameScene and pass the playerName forward
                    this.scene.start("GameScene", { playerName });
                });
            }
        };

        // calculate the vertical y position for the start button
        // it is height times CONFIG.menu.buttonsY.start
        const y = height * CONFIG.menu.buttonsY.start;

        // if texture ui_start exists in the loaded texture manager then use an image button
        if (this.textures.exists("ui_start")) {
            // create the image at width/2 (center) and y position
            // key is ui_start
            // setOrigin(0.5) centers the image anchor
            // setInteractive with useHandCursor true makes it clickable with a hand pointer
            const img = this.add.image(width / 2, y, "ui_start")
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true });

            // calculate a scale factor so the button size is 18 percent of screen width
            // divide that by the image native width
            const s = (width * 0.18) / img.width;
            img.setScale(s);

            // add event listener for pointerup
            // when clicked it runs startWithName
            img.on("pointerup", startWithName);

        } else {
            // if ui_start texture does not exist fallback to systems ui button
            // systems.ui.button builds a rectangle button with text
            // here label is START GAME and callback is startWithName
            systems.ui.button(this, width / 2, y, "START GAME", startWithName);
        }

    }
}
