// this file defines the global CONFIG object
// CONFIG stores all numbers sizes asset paths and rules for the game
// every scene reads values from here instead of hardcoding

window.CONFIG = {

    // base width and height of the game canvas
    width: 1920,
    height: 1080,

    // ui related defaults for fonts buttons topbar and pause overlay
    ui: {
        fontFamily: "Arial",        // default font for text
        titleFontSize: 230,         // large font size for title text

        button: {
            width: 300,             // button rectangle width
            height: 76,             // button rectangle height
            fill: 0x00c2ff,         // fill color
            stroke: 0xffffff,       // border color
            strokeThickness: 4,     // border thickness
            fontSize: 28,           // button text font size
            fontColor: "#111",      // button text color
        },
        topbar: {
            padding: 16,            // spacing around icons
            gap: 16,                // space between icons
            iconSize: 72,           // size of each topbar icon
        },
        pauseOverlay: {
            bgColor: 0x000000,      // overlay background color
            bgAlpha: 0.55,          // overlay transparency
            panelColor: 0x101425,   // panel background color
            panelStroke: 0x00c2ff,  // border color of panel
            titleSize: 56,          // font size of pause overlay title
        }
    },

    // menu layout config
    menu: {
        titleY: 0.35,               // vertical placement of menu title
        buttonsY: {                 // relative y positions of buttons
            start: 0.58,
            soap: 0.70,
            cleanCatch: 0.82
        },
    },

    // file paths for all images used in the game
    assets: {
        kiko: {
            base: "assets/images/Kiko/WashEd_kiko_sprite_base.png",
            cheer: "assets/images/Kiko/WashEd_kiko_sprite_thumbs-up.png"
        },
        backgrounds: {
            frontpage: "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png",
            sand: "assets/images/backgrounds/sand.png",     // placeholder
            school: "assets/images/backgrounds/school.png", // placeholder
        },
        ui: {  // skinksnksdxcsdc
            pauseBut: "assets/images/UI/washed_kikos-day_UI-Button_PAUSE.png",
            settingsBut: "assets/images/UI/washed_kikos-day_UI-Button_SETTINGS.png",
            homeBut: "assets/images/UI/washed_kikos-day_UI-Button_HOME.png",
            startBut: "assets/images/UI/washed_kikos-day_UI-Button_Main_START.png",
            dialogPanel: "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png",
        },
        soapSplash: {
            sink: "assets/images/soap/sink.png", // sink sprite
            germ: "assets/images/Germs/washed_kikos-day_LEVEL_01_scene_05_germ-catcher_GERM_01.png",
            // backgrounds change as breaches increase
            backgrounds: [
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_02_germ-catcher_HIT-one.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_03_germ-catcher_HIT-two.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_04_germ-catcher_HIT-three.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_05_germ-catcher_HIT-four.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_06_germ-catcher_HIT-five.png"
            ]
        },
        cleanCatch: {
            background: "assets/images/CleanCatcher/washed_kikos-day_LEVEL_01_scene_04_action_01_soap-splasher_start.png",
            germ: "assets/images/Germs/washed_kikos-day_LEVEL_01_scene_05_germ-catcher_GERM_01.png",
            player: 'assets/images/CleanCatcher/washed_kikos-day_LEVEL_01_scene_04_soap-splasher_Hands.png',
        },
        menu: {
            frontpage: "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png",
        },
    },

    // rules and parameters for the soap splash mini game
    soapSplash: {
        width: 1920,
        height: 1080,

        sinkHitRel: { x: 0.11, y: 0.82 }, // relative sink position
        rSinkPx: 150,                     // sink radius in pixels

        innerRadiusRel: 0.15,
        outerRadiusRel: 0.48,
        spawnAngleDeg: { min: 25, max: 155 }, // germ spawn angle range
        maxGerms: 8,                          // limit of germs on screen

        spawnEveryMs: 1200, // base spawn interval
        spawnJitterMs: 350, // random spawn variation
        waveCap: 5,         // max germs per wave

        minSpawnSeparationPx: 190,
        minSinkDistancePx: 260,

        germBaseSpeed: 50,
        germSpeedRand: 20,
        germHitRadiusPx: 50,

        fontFamily: "Arial",
        labelTextSize: "30px",
        verticalSpaceLabel: 60,
        germSpriteSize: 0.15,

        timerMs: 60000,          // round length
        breachesAllowed: 5,      // max failures allowed

        spawnIntervalMs: 1500,
        maxSpawnAttempts: 7,

        germSpeed: 110,
        wobble: 0.12,
        despawnMargin: 64,

        rSink: 70,
        maxBreaches: 5,
        breachPenalty: 100,

        gameDurationMin: 1,
        gameDurationTextHud: "01:00",
        reason: "Time up",

        useSpawner: true,
        cornerMargin: 120,
        cornerBandWidth: 240,
        angleSpreadDeg: 35,

        // debug options to show circles for sink and germs
        debug: {
            showSinkCircle: false,
            sinkColor: 0x00ff00,
            sinkAlpha: 0.20,
            showGermCircles: false,
            germColor: 0xff00ff,
            germAlpha: 0.20
        },

        // blur effect settings
        spotBlur: {
            enabled: true,
            strength: 0.9,
            radiusPad: 22,
            feather: 28,
            steps: 7
        },

        // highlighting style when germ is focused
        focusTint: 0xfff4b1,
        focusHaloPadding: 18,
        focusHaloFill: 0xfff176,
        focusHaloAlpha: 0.22,
        focusHaloStroke: 0xffd54f,
        focusHaloStrokeW: 4,
        focusHaloPulseMs: 800,

        // extra focus effects
        focus: {
            useGlow: true,
            glowColor: 0xffffff,
            glowOuter: 12,
            glowInner: 1,
            glowKnockout: false,
            glowPulseMs: 1900,

            additiveSprite: true,
            addColor: 0xffffff,
            addAlpha: 0.18,
            addScale: 1.10,
            addPulseMs: 1100,

            haloPadding: 14,
            haloColor: 0x000000,
            haloStrokeW: 0,
            haloAlpha: 0.0,
            haloPulseMs: 900,
        },

        // text colors for word typing
        colors: {
            typed: "#000000",
            remain: "#000000",
            errorTyped: "#ff9e80",
            errorRemain: "#ff4d4d"
        },

        // word bank for typing
        words: [
            "wash", "soap", "clean", "rinse", "scrub",
            "foam", "shine", "fresh", "sparkle", "bubbles",
            "health", "habits", "safe", "germs", "water",
            "sink", "fingers", "thumb", "palm", "nails"
        ]
    },

    // rules and parameters for the clean catch mini game
    cleanCatch: {
        width: 1920, height: 1080,
        player: { width: 220, bottom: 36, fallbackSize: 180 },
        germ:   { height: 64, maxPixels: 128 },
        water:  { width: 64, height: 28 },
        words: { good: ["soap", "bath", "wash", "cup", "tap", "well", "pure", "safe", "care", "flow", "clean", "fresh", "water", "rinse", "towel", "health", "filter", "toilet", "shower", "dry"],
                  bad: ["dirt", "germ", "sick", "mud", "virus", "waste", "leak", "rust", "mold", "scum", "slime", "crud", "filth", "ooze", "rot", "odor", "pest", "fly", "bug", "oil"] }
    },

};
