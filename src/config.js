/*
* Centralised configuration for all scenes and systems.
* Existing keys preserved; new blocks added for UI/menu/assets/cleanCatch.
*/
window.CONFIG = {
    // Base logical game size (Phaser scales it later on)
    width: 1920,
    height: 1080,

    // === GLOBAL UI ===
    ui: {
        fontFamily: 'Arial',         // used by systems.ui.button + scene text
        titleFontSize: 230,
        button: {
            width: 300,
            height: 76,
            fill: 0x00c2ff,
            stroke: 0xffffff,
            strokeThickness: 4,
            fontSize: 28,
            fontColor: '#111'
        }
    },

    // === MENU LAYOUT ===
    menu: {
        titleY: 0.35,
        buttonsY: { start: 0.58, soap: 0.70, cleanCatch: 0.82 }
    },

    // === ASSET PATHS ===
    assets: {
        backgrounds: {
            frontpage: 'assets/images/backgrounds/frontpage.png',
            sand:      'assets/images/backgrounds/sand.png',
            school:    'assets/images/backgrounds/school.png',
        },
        kiko: {
            base:  'assets/images/WashEd_kiko_sprite/WashEd_kiko_sprite_base.png',
            run:   'assets/images/WashEd_kiko_sprite/kiko_run.png',
            size:  600
        }
    },

    // === CLEAN CATCH mini-game ===
    cleanCatch: {
        width: 1080,
        height: 920,
        spawnMs: 1000,
        itemBaseSpeed: 2,
        itemRandSpeed: 2,
        lives: 3,
        timeSec: 30,
        sprites: {
            background: "assets/images/washed_mod_2/SINK3.png",
            germ: "assets/images/washed_mod_2/washed_mod_2_disease_water-ATHRO-VECT-ex__MALA.png"
        },
        words: {
            good: ["Soap","Bath","Wash","Cup","Tap","Well","Pure","Safe","Care","Flow","Clean","Fresh","Water","Rinse","Towel","Health","Filter","Toilet","Shower","Dry"],
            bad:  ["Germ","Dirt","Sick","Mud","Virus","Waste","Leak","Rust","Mold","Scum","Slime","Crud","Filth","Ooze","Rot","Odor","Pest"]
        }
    },

    soapSplash: {
        width: 1920,
        height: 1080,
        fontFamily: 'montserrat', // used inside SoapSplash HUD
        useSpawner: true,
        maxGerms: 5,
        germSpriteSize: 0.12,
        verticalSpaceLabel: 55,
        labelTextSize: 30,
        breachPenalty: 25,
        breachStatement: "Its Okay try again!",
        reason: "Time's Up!!",

        gameDurationMin: 1,
        gameDurationTextHud: '01:00',
        breachesFontSize: 20,

        angleSpreadDeg: 20,
        cornerMargin: 120,
        cornerBandWidth: 360,

        angleMinDeg: 0,
        angleMaxDeg: 90,

        minSpawnSeparationPx: 200,
        maxSpawnAttempts: 12,

        spawnIntervalMs: 1800,
        germSpeed: 120,
        wobble: 0.50,

        rSink: 80,
        despawnMargin: 60,

        words: ['wash','soap','clean','water','tap','filter','boil','rinse','scrub'],

    },



};
