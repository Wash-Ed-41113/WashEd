// scene overview
// CleanCatchExplain is a tutorial scene that introduces rules and controls then hands off to CleanCatch

// bgm constants
// defines BGM_KEY and BGM_PATH for scene specific looped music so this scene controls its own audio
const BGM_KEY  = "cleanCatcher_bgm";
const BGM_PATH = "assets/sounds/cleanCatcher.mp3";


// class setup
// declares CleanCatchExplain scene with simple flags for one time actions and an array for future unbinders
export default class CleanCatchExplain extends Phaser.Scene {
    constructor() {
        super("CleanCatchExplain");
        this._started = false;
        this._gateFired = false;
        this._unbinders = [];
    }

    // preload assets
    // pulls paths from CONFIG and loads KikoBase KikoCheer DialogPanel UI_Next and a fallback background
    // loads bgm if missing and warns once on load error so the scene still runs without audio
    preload() {
        const explain = CONFIG.assets?.kiko || {};
        const A  = CONFIG.assets?.cleanCatch || {};
        const ui = CONFIG.assets?.ui || {};

        if (!this.textures.exists("KikoBase") && explain.base) this.load.image("KikoBase", explain.base);
        if (!this.textures.exists("KikoCheer") && explain.cheer) this.load.image("KikoCheer", explain.cheer);
        if (!this.textures.exists("DialogPanel") && ui.dialogPanel) this.load.image("DialogPanel", ui.dialogPanel);
        if (!this.textures.exists("UI_Next") && ui.next) this.load.image("UI_Next", ui.next);

        if (!this.textures.exists("backgroundFullLives"))
            this.load.image("backgroundFullLives", A.background || "assets/images/CleanCatcher/1.jpg");

        if (!this.cache.audio.exists(BGM_KEY)) this.load.audio(BGM_KEY, [BGM_PATH]);

        // attach a one time loaderror so failed bgm does not crash the scene
        this.load.on("loaderror", (f) => { if (f?.key === BGM_KEY) console.warn("[CleanCatchExplain] BGM load failed:", f.src || f.url); });
    }

    // create resume and audio wiring
    // reads width height username and difficulty then pauses window __GLOBAL_BGM__ if any
    // defines playBgmNow to unlock web audio resume context add or get BGM_KEY loop and play it and store handle in window __MINI_BGM__
    create(data) {
        const { width: W, height: H } = this.scale;
        const username   = this.registry.get("playerName") || "friend";
        const difficulty = data?.difficulty || this.registry.get("difficulty") || "easy";


        try {
            const g = window.__GLOBAL_BGM__;
            if (g?.isPlaying) g.pause();
        } catch {}

        const playBgmNow = () => {
            try { if (this.sound.locked) this.sound.unlock(); } catch {}
            try { this.sound.context?.resume?.(); } catch {}
            let inst = this.sound.get(BGM_KEY);
            if (!inst) inst = this.sound.add(BGM_KEY, { loop: true, volume: 0.75 });
            if (!inst.isPlaying) inst.play();
            window.__MINI_BGM__ = inst;
            window.__GLOBAL_BGM__ = undefined;
        };

        // bind one time user gesture to satisfy browser audio policies for autoplay
        this.input.once("pointerdown", playBgmNow);
        this.input.keyboard?.once("keydown", playBgmNow);

        // background and dim
        // add full bleed background and a dark overlay to focus attention under the dialog ui
        this.add.image(W / 2, H / 2, "backgroundFullLives").setDisplaySize(W, H).setDepth(0);
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(1);


        // dialog panel
        // use DialogPanel texture when available else draw a styled rectangle and compute panelW and panelH for layout
        let panel;
        const maxPanelW = Math.min(W * 1.5, 1500);
        const maxPanelH = Math.min(H * 2, 520);

        if (this.textures.exists("DialogPanel")) {
            panel = this.add.image(W / 2, H * 0.50, "DialogPanel")
                .setOrigin(0.5)
                .setDepth(2);
            const scale = Math.min(maxPanelW / panel.width, maxPanelH / panel.height);
            panel.setScale(scale);
        } else {
            panel = this.add.rectangle(W / 2, H * 0.55, maxPanelW, maxPanelH, 0xffffff)
                .setStrokeStyle(4, 0x7ec8ff)
                .setOrigin(0.5)
                .setDepth(2);
        }

        const panelW = panel.displayWidth;
        const panelH = panel.displayHeight;

        // kiko sprite
        // position the guide avatar near panel corner and scale to fit panel height
        this.kiko = this.add.sprite(
            panel.x - panelW * 0.70,
            panel.y + panelH * 0.47,
            "KikoBase"
        )
            .setOrigin(0.5, 1)
            .setDepth(3);

        const kikoMaxH = panelH * 0.95;
        this.kiko.setScale(kikoMaxH / this.kiko.height);


        // tutorial copy
        // ordered lines that explain clean catch goals controls time limit and lives personalized with username
        const lines = [
            `${username}! Are you ready for the Soap Splasher game? Let’s play!`,
            `Here’s how it works!`,
            `Catch the clean WATER droplets and SOAP bubbles — they’re good for us!`,
            `But be careful — you have 3 LIVES. Avoid the germs from spreading! Don’t let them touch your hands.`,
            `You have 30 SECONDS to catch as much clean WATER and SOAP as you can!\nUse your MOUSE to move my hands.`,
            `Let’s see how many you can CATCH!`,
            `When you’re ready, click the green ARROW!`
        ];

        let i = 0;

        // text style and first line
        // montserrat font and word wrap sized from panel height then create centered text for lines[i]
        const style = {
            fontFamily: "Montserrat",
            fontSize: Math.max(30, panelH * 0.10) + "px",
            color: "#000000",
            wordWrap: { width: panelW * 0.85 },
            align: "center"
        };

        const text = this.add.text(
            panel.x,
            panel.y,
            lines[i],
            style
        ).setOrigin(0.5).setDepth(4);

        // next button
        // interactive UI_Next arrow positioned at panel edge scaled for consistent size and triggers playBgmNow
        const nx = panel.x + panelW * 0.60;
        const ny = panel.y + panelH * 0.02;
        const nextBtn = this.add.image(nx, ny, "UI_Next")
            .setOrigin(0.5)
            .setDepth(4)
            .setInteractive({ useHandCursor: true });

        const btnScale = Math.min(120, H * 0.12) / nextBtn.height;
        nextBtn.setScale(btnScale);

        // advance logic
        // step through lines swap KikoBase to KikoCheer on even steps then fade out and start CleanCatch with difficulty
        nextBtn.on("pointerdown", () => {
            playBgmNow();
            i++;
            if (i < lines.length) {
                text.setText(lines[i]);
                if (i % 2 === 0 && this.textures.exists("KikoCheer"))
                    this.kiko.setTexture("KikoCheer");
                else
                    this.kiko.setTexture("KikoBase");
            } else {
                this.tweens.add({
                    targets: [this.kiko, text, panel, nextBtn],
                    alpha: 0,
                    duration: 600,
                    onComplete: () => {
                        this.scene.start("CleanCatch", { difficulty });
                    }
                });
            }
        });

        // keyboard shortcut
        // pressing enter fires the same flow as clicking next for accessible progression
        this.input.keyboard.on("keydown-ENTER", () => nextBtn.emit("pointerdown"));
    }

}

