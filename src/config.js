// this file defines the global CONFIG object
// CONFIG stores all numbers sizes asset paths and rules for the game
// every scene reads values from here instead of hardcoding

window.CONFIG = {

    // base width and height of the game canvas
    width: 1920,
    height: 1080,

    // feature flags and switches for build variants or in-dev behavior
    isLeaderboardsSwas: false,

    // ui defaults: fonts, sizes, and common widget styling read by systems.ui helpers
    // keep these generic so scenes don’t hardcode visuals
    ui: {
        fontFamily: "Montserrat",   // default font for text
        titleFontSize: 230,         // large font size for title text
        typeSpeedMs: 120,           // default typewriter speed for dialog

        // shared button styling (width/height/colors/typography)
        button: {
            width: 300,             // button rectangle width
            height: 76,             // button rectangle height
            fill: 0x00c2ff,         // fill colour
            stroke: 0xffffff,       // border colour
            strokeThickness: 4,     // border thickness
            fontSize: 28,           // button text font size
            fontColor: "#111",      // button text color
        },

        // top navigation bar layout used by systems.ui.buildTopbar
        topbar: {
            padding: 16,            // spacing around icons
            gap: 16,                // space between icons
            iconSize: 72,           // size of each topbar icon
        },

        // pause overlay panel look and feel (semi-transparent backdrop + framed panel)
        pauseOverlay: {
            bgColor: 0x000000,      // overlay background color
            bgAlpha: 0.55,          // overlay transparency
            panelColor: 0x101425,   // panel background color
            panelStroke: 0x00c2ff,  // border color of panel
            titleSize: 56,          // font size of pause overlay title
        }
    },

    // menu screen layout: relative y positions to place title and buttons responsively
    menu: {
        titleY: 0.35,               // vertical placement of menu title
        buttonsY: {                 // relative y positions of buttons
            start: 0.58,
            soap: 0.70,
            cleanCatch: 0.82
        },
    },

    // development toggle: enables keyboard shortcuts, logs, and faster loops when true
    isDevMode: true,

    // asset catalog: all image/audio paths grouped by feature area so loaders can reference by key
    assets: {
        logo : "assets/images/washed_day_UI-Logo__WashEd.png",

        // kiko character sprites used in dialogs/toasts/animations
        kiko: {
            base: "assets/images/Kiko/WashEd_kiko_sprite_base.png",
            cheer: "assets/images/Kiko/WashEd_kiko_sprite_thumbs-up.png",
            jump: "assets/images/Kiko/WashEd_kiko_sprite_side-jump.png",
            sad: "assets/images/Kiko/WashEd_kiko_sprite_sad.png",
        },

        // generic backgrounds (frontpage and placeholders for future scenes)
        backgrounds: {
            frontpage: "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png",
            sand: "assets/images/backgrounds/sand.png",     // placeholder
            school: "assets/images/backgrounds/school.png", // placeholder
        },

        // shared UI components: buttons, dialog panels, and navigation affordances
        ui: {
            pauseBut: "assets/images/UI/washed_kikos-day_UI-Button_PAUSE.png",
            settingsBut: "assets/images/UI/washed_kikos-day_UI-Button_SETTINGS.png",
            homeBut: "assets/images/UI/washed_kikos-day_UI-Button_HOME.png",
            startBut: "assets/images/UI/washed_kikos-day_UI-Button_Main_START.png",
            dialogPanel: "assets/images/UI/washed_kikos-day_UI-dialogue-box-v1.png",
            next: "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png",
            closeBut: "assets/images/UI/washed_kikos-day_UI-Button_EXIT.png"
        },

        // Soap Splash mini-game art/sfx/video; backgrounds progress as breaches increase
        soapSplash: {
            sink: "assets/images/soap/sink.png", // sink sprite
            germ: "assets/images/Germs/washed_kikos-day_LEVEL_01_scene_05_germ-catcher_GERM_01.png",
            // backgrounds change as breaches increase
            backgrounds: [
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-catcher_HIT-zero.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_01_germ-scrubber_HIT-one.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_02_germ-scrubber_HIT-two.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_03_germ-scrubber_HIT-three.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_04_germ-scrubber_HIT-four.png",
                "assets/images/SopaSplash/washed_kikos-day_LEVEL_01_scene_05_action_05_germ-scrubber_HIT-five.png"
            ],
            backgroundVid: "assets/images/SopaSplash/hands_alpha.webm",
            backgroundAud: "assets/sounds/germ_scrubber.mp3",
            correctAud: "assets/sounds/typed-correctly-Germ-Scrubber.mp3",
            incorrectAud: "assets/sounds/Typed-incorrectly-Germ-scrubber.mp3",

        },

        // Clean Catch mini-game art and background set keyed by remaining lives
        cleanCatch: {
            germ: "assets/images/Germs/washed_kikos-day_LEVEL_01_scene_05_germ-catcher_GERM_01.png",
            player: "assets/images/CleanCatcher/washed_day_UI_LEVEL_01_scene_04_soap-splasher_Hands-outline.png",
            waterDroplet: "assets/images/CleanCatcher/washed_day_UI_LEVEL_01_scene_04_soap-splasher_droplet__Water.png",
            soap: "assets/images/CleanCatcher/washed_day_UI_LEVEL_01_scene_04_soap-splasher_droplet__Soap-water.png",
            backgroundFullLives: "assets/images/CleanCatcher/1.jpg",
            backgroundTwoLives: "assets/images/CleanCatcher/2.jpg",
            backgroundOneLife: "assets/images/CleanCatcher/3.jpg",
            backgroundNoLife: "assets/images/CleanCatcher/4.jpg",
            backgroundAud: "assets/images/CleanCatcher/5.jpg",
        },

        // menu specific art (front page / landing background)
        menu: {
            frontpage: "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png",
        },

        // ending / scoreboard screen assets including music and celebration overlays
        endingScreen: {
            classroom_bg: "assets/images/background/updatedClassroom.png",
            kiko_cheer: "assets/images/WashEd_kiko_sprite/kiko_cheer.png",
            confetti: "assets/images/background/confetti.png",
            endingMusic: "assets/sounds/kikos day.mp3"
        },
    },

    // Soap Splash rules: geometry, spawn parameters, speeds, visuals, fx, and wordbank
    // scenes read these live to adapt difficulty and presentation without code edits
    soapSplash: {
        width: 1920,
        height: 1080,

        // sink hit target (relative coords) and radius in px
        sinkHitRel: { x: 0.11, y: 0.82 }, // relative sink position
        rSinkPx: 150,                     // sink radius in pixels

        // spawn band geometry and spread used by systems.soapsplash.spawn
        innerRadiusRel: 0.15,
        outerRadiusRel: 0.48,
        spawnAngleDeg: { min: 25, max: 155 }, // germ spawn angle range
        maxGerms: 8,                          // limit of germs on screen

        // cadence of germ waves (base/jitter/cap) and movement tuning
        spawnEveryMs: 1200, // base spawn interval
        spawnJitterMs: 350, // random spawn variation
        waveCap: 5,         // max germs per wave

        germBaseSpeed: 50,
        germSpeedRand: 20,
        germHitRadiusPx: 50,

        // typography and sizing for on-germ labels
        fontFamily: "Montserrat",
        labelTextSize: "40px",
        verticalSpaceLabel: 60,
        germSpriteSize: 0.15,

        // round timing and failure limits
        timerMs: 60000,          // round length
        breachesAllowed: 5,      // max failures allowed

        // legacy/alt timer + spawn controls (kept for compatibility with systems.timer)
        spawnIntervalMs: 1500,
        maxSpawnAttempts: 7,

        // additional motion/cleanup tunables (used by movement + rules)
        germSpeed: 110,
        wobble: 0.12,
        despawnMargin: 64,

        // sink + scoring rules (duplicated keys kept for older modules)
        rSink: 70,
        maxBreaches: 5,
        breachPenalty: 100,

        // HUD formatting hints for text timers
        gameDurationMin: 1,
        gameDurationTextHud: "01:00",
        reason: "Time up",

        // spatial spawn helper configuration for the “corner band” method
        useSpawner: true,          // <- must be true
        cornerMargin: 40,          // distance from the corner to start the band
        cornerBandWidth: 140,      // thickness of the band
        angleSpreadDeg: 10,        // narrow cone aimed at the top-right (0..90°)
        minSpawnSeparationPx: 32,  // avoid overlaps
        minSinkDistancePx: 220,

        // debug overlays: enable to visualize sink and germ hit radii
        debug: {
            showSinkCircle: false,
            sinkColor: 0x00ff00,
            sinkAlpha: 0.20,
            showGermCircles: false,
            germColor: 0xff00ff,
            germAlpha: 0.20
        },

        // post-processing blur spot used to emphasize focused germ
        spotBlur: {
            enabled: true,
            strength: 0.9,
            radiusPad: 22,
            feather: 28,
            steps: 7
        },

        // focus highlight style for the active target (tints/halo/glow/additive sprite)
        focusTint: 0xfff4b1,
        focusHaloPadding: 18,
        focusHaloFill: 0xfff176,
        focusHaloAlpha: 0.22,
        focusHaloStroke: 0xffd54f,
        focusHaloStrokeW: 4,
        focusHaloPulseMs: 800,

        // finer control of focus effects (glow cycle + additive sprite “aura”)
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

        // text color palette for typed vs remaining letters and error states
        colors: {
            typed: "#000000",
            remain: "#000000",
            errorTyped: "#ff9e80",
            errorRemain: "#ff4d4d"
        },

        // word bank injected at runtime (e.g., by deck builder based on difficulty)
        words: []
    },

    // Clean Catch rules: canvas size, player/germ droplet sizes, and word pools
    // kept minimal; scene implements physics and scoring around these values
    cleanCatch: {
        width: 1920, height: 1080,
        player: { width: 220, bottom: 36, fallbackSize: 180 },
        germ:   { height: 64, maxPixels: 128 },
        water:  { width: 64, height: 28 },
        words: { good: [],
            bad: []
        }
    },

};
