/*
* Centralised configuration for all scenes and systems.
*/
window.CONFIG = {
    // Base logical game size (Phaser scales it later)
    width: 1920,
    height: 1080,

    // === GLOBAL UI ===
    ui: {
        fontFamily: "Arial",
        titleFontSize: 230,

        button: {
            width: 300,
            height: 76,
            fill: 0x00c2ff,
            stroke: 0xffffff,
            strokeThickness: 4,
            fontSize: 28,
            fontColor: "#111",
        },
        topbar: {
            padding: 16,
            gap: 16,
            iconSize: 72,
        },
        pauseOverlay: {
            bgColor: 0x000000,
            bgAlpha: 0.55,
            panelColor: 0x101425,
            panelStroke: 0x00c2ff,
            titleSize: 56,
        }
    },

    // === MENU LAYOUT ===
    menu: {
        titleY: 0.35,
        buttonsY: { start: 0.58, soap: 0.70, cleanCatch: 0.82 },
    },

    // === ASSETS ===
    assets: {
        kiko: {
            base: "assets/images/Kiko/WashEd_kiko_sprite_base.png",
            cheer: "assets/images/Kiko/WashEd_kiko_sprite_thumbs-up.png"
        },
        backgrounds: {
            // main menu / general
            frontpage: "assets/images/Kikos day/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png",
            sand: "assets/images/backgrounds/sand.png", // replace later
            school: "assets/images/backgrounds/school.png", // replace later
        },
        ui: {
            pauseBut: "assets/images/UI/washed_kikos-day_UI-Button_PAUSE.png",
            settingsBut: "assets/images/UI/washed_kikos-day_UI-Button_SETTINGS.png",
            homeBut: "assets/images/UI/washed_kikos-day_UI-Button_HOME.png",
        },
        soapSplash: {
            sink: "assets/images/soap/sink.png", // todo replace later with kiko, no sprite needen sprite in bg
            germ: "assets/images/Germs/washed_kikos-day_LEVEL_01_scene_05_germ-catcher_GERM_01.png",
            // Backgrounds by #breaches (index 0..N)
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
    },

    // === SOAP SPLASH ===
    soapSplash: {
        width: 1920,
        height: 1080,

        // sink hit-point relative (for breach test)
        sinkHitRel: { x: 0.11, y: 0.82 }, // 0..1, relative to logical width/height (position)
        rSinkPx: 150,

        // geometry & spawn
        innerRadiusRel: 0.15,
        outerRadiusRel: 0.48,
        spawnAngleDeg: { min: 25, max: 155 },
        maxGerms: 8,

        // spawn pacing
        spawnEveryMs: 1200,        // base interval
        spawnJitterMs: 350,        // ± jitter added each spawn
        waveCap: 5,                // max on-screen at once


        // spacing
        minSpawnSeparationPx: 160, // min distance between new germ and any existing
        minSinkDistancePx: 260,    // don't spawn too close to sink

        // speeds (slower, more typeable)
        germBaseSpeed: 90,         // px/s
        germSpeedRand: 20,         // random ± component
        germHitRadiusPx: 20,

        // word labels
        fontFamily: "Arial",
        labelTextSize: "30px",
        verticalSpaceLabel: 60,
        germSpriteSize: 0.15,

        // scoring/hud
        timerMs: 60000,
        breachesAllowed: 5,

        // Timing / spawns
        spawnIntervalMs: 850,          // mirror of spawnEveryMs
        maxSpawnAttempts: 10,

        // Movement
        germSpeed: 110,                // mirror germBaseSpeed
        wobble: 0.12,
        despawnMargin: 64,

        // Breaches & sink
        rSink: 70,                     // ~6% of 1080
        maxBreaches: 5,                // mirror breachesAllowed
        breachPenalty: 100,

        // Timer / end text
        gameDurationMin: 1,
        gameDurationTextHud: "01:00",
        reason: "Time up",

        // Scene geometry flags (if you keep that branch)
        useSpawner: true,
        cornerMargin: 120,
        cornerBandWidth: 240,
        angleSpreadDeg: 35,

        debug: {
            showSinkCircle: true,           // draw translucent green sink circle
            sinkColor: 0x00ff00,
            sinkAlpha: 0.20,
            showGermCircles: true,         // draw per-germ hit circles (for tuning)
            germColor: 0xff00ff,
            germAlpha: 0.20
        },


        // dictionary
        words: [
            "wash", "soap", "clean", "rinse", "scrub",
            "foam", "shine", "fresh", "sparkle", "bubbles",
            "health", "habits", "safe", "germs", "water",
            "sink", "fingers", "thumb", "palm", "nails"
        ]
    },

    // === CLEAN CATCH (canvas mini-game host dims) ===
    cleanCatch: {
        width: 1920, height: 1080,
        player: { width: 220, bottom: 36, fallbackSize: 180 }, // or { scale: 0.12 }
        germ:   { height: 64, maxPixels: 128 },
        water:  { width: 64, height: 28 },
        words: { good: ["H2O","Clean","Fresh","Safe"], bad: ["Germ","Dirty","Ill","Sick"] }
    },

};
