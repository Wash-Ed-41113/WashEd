// explains top level asset constants and keys used by PlaygroundScene to load images and layer depths
// keeps visual elements like sand background kiko sprites speech bubble and sandcastle frames organized
// constants like LAYERS CASTLE_FRAMES and positions control layout and animation scale across the scene
const KI = CONFIG.assets.kiko;

import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const SAND_KEY  = "school_yard";
const SAND_PATH = "assets/images/background/school-yard.png";

const KIKO_BASE_KEY   = "kiko_base";
const KIKO_CHEER_KEY  = "kiko_cheer";
const KIKO_CHEER_PATH = KI.cheer;

const KIKO_ENTER_KEY  = "kiko_side_jump";
const KIKO_ENTER_PATH = "assets/images/Kiko/WashEd_kiko_sprite_side-jump.png";

const BUBBLE_KEY  = "bubble_box";
const BUBBLE_PATH = "assets/images/UI/washed_kikos-day_UI-dialogue-box-v2.png";

const LAYERS = { BG: 0, OBJECTS: 9, KIKO: 10, UI: 20 };

const CASTLE_FRAMES = [
    { key: "sandcastle01", path: "assets/images/sandground/sandcastle01.png" },
    { key: "sandcastle02", path: "assets/images/sandground/sandcastle02.png" },
    { key: "sandcastle03", path: "assets/images/sandground/sandcastle03.png" },
    { key: "sandcastle04", path: "assets/images/sandground/sandcastle04.png" },
];

const CASTLE_SIZE   = 0.4;
const DOOR_X_FRAC   = 0.65;
const DOOR_Y_OFFSET = 0;

// SpeechBubble is a lightweight ui dialog container
// anchors near a target or at fixed coords scales a panel image and renders typewriter text
// say types characters and can auto hide while hide fades out the whole container
// uses CONFIG ui font family for consistency and leaves cleanup to caller on scene shutdown
class SpeechBubble extends Phaser.GameObjects.Container {
    constructor(scene, anchor, opts = {}) {
        super(scene, 0, 0);
        scene.add.existing(this);

        this.maxWidth = opts.maxWidth ?? 550;
        this.padding  = 22;
        this.gap      = opts.gap ?? 25;

        this.bg = scene.add.image(0, 0, BUBBLE_KEY).setOrigin(0.5);
        const nativeW = this.bg.width || 1435;
        this.bg.setScale(this.maxWidth / nativeW);

        this.label = scene.add.text(0, 0, "", {
            fontFamily: (window.CONFIG?.ui?.fontFamily),
            fontSize: 30,
            color: "#073B4C",
            wordWrap: { width: this.maxWidth - this.padding * 2 },
            align: "left",
        }).setOrigin(0.5);

        this.add([this.bg, this.label]);
        this.setDepth(LAYERS.UI).setAlpha(1);

        if (Number.isFinite(opts.x) && Number.isFinite(opts.y)) {
            this.setPosition(opts.x, opts.y);
        } else if (anchor) {
            let worldX = anchor.x, worldY = anchor.y;
            if (typeof anchor.getWorldTransformMatrix === "function") {
                const m = anchor.getWorldTransformMatrix();
                worldX = m.tx;
                worldY = m.ty;
            }

            const anchorH = (anchor.displayHeight ?? anchor.height ?? 0) || 200;
            const headTop = worldY - anchorH;
            const bubbleHalfH = (this.bg.height * (this.bg.scaleY || this.bg.scaleX)) / 2;

            this.setPosition(worldX, headTop - this.gap - bubbleHalfH);
        } else {
            this.setPosition(scene.scale.width * 0.5, scene.scale.height * 0.25);
        }
    }

    say(text, duration = 0) {
        if (this._typeEvt) this._typeEvt.remove(false);

        const chars = [...text];
        let i = 0;
        this.label.setText("");
        this._typeEvt = this.scene.time.addEvent({
            delay: 20,
            loop: true,
            callback: () => {
                this.label.setText(chars.slice(0, ++i).join(""));
                if (i >= chars.length) this._typeEvt.remove(false);
            },
        });

        if (this._hideEvt) this._hideEvt.remove(false);
        if (duration && duration > 0) {
            this._hideEvt = this.scene.time.delayedCall(duration, () => this.hide());
        } else {
            this.setAlpha(1);
        }
    }

    hide() {
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 180, ease: "Sine.easeOut" });
    }
}


// PlaygroundScene is the opening hub on the beach before transitioning to bathroom
// owns sand tap area progressive sandcastle and kiko rig and drives the onboarding dialog
// tracks castle stage and input gating so taps do not double fire and schedules dialog timers
export default class PlaygroundScene extends Phaser.Scene {
    constructor() {
        super("PlaygroundScene");
        this._castleStage = -1;
        this._castleImage = null;
        this.sandArea = null;
        this.speech = null;
        this.canTap = true;
        this._dlgTimers = [];

        this._kiko = null;
        this._kikoRig = null;
    }

    // preload reads all textures used here and only loads missing ones to avoid duplicate work across visits
    preload() {
        if (!this.textures.exists(SAND_KEY))       this.load.image(SAND_KEY, SAND_PATH);
        if (!this.textures.exists(KIKO_CHEER_KEY)) this.load.image(KIKO_CHEER_KEY, KIKO_CHEER_PATH);
        if (!this.textures.exists(KIKO_ENTER_KEY)) this.load.image(KIKO_ENTER_KEY, KIKO_ENTER_PATH);
        if (!this.textures.exists(BUBBLE_KEY))     this.load.image(BUBBLE_KEY, BUBBLE_PATH);
        for (const f of CASTLE_FRAMES) {
            if (!this.textures.exists(f.key)) this.load.image(f.key, f.path);
        }
    }

    // create resets state cleans lingering effects and prepares layout audio and input
    // removes any running mini game scenes resumes global audio and stops menu
    // places logo and sets up sand area background kiko rig float tween and greeting bubble
    create() {
        const { width, height } = this.scale;

        this._leaving = false;
        this._castleStage = -1;
        this.canTap = true;
        if (this._castleImage) { this._castleImage.destroy(); this._castleImage = null; }
        this.input.enabled = true;
        this.tweens.killAll();
        this.cameras.main.resetFX();
        this.input.topOnly = false;

        systems.ui.placeLogo(this);
        try {
            this.scene.stop("CleanCatchScene");
            this.scene.stop("CleanCatchExplain");
            this.scene.stop("SoapSplashScene");
            this.scene.stop("SoapSplashExplain");
        } catch {}

        try {
            AudioManager.stopGroup?.("game");
            AudioManager.resumeGroup?.("global");
        } catch {}

        let bgm =
            (typeof window !== "undefined" && window.__GLOBAL_BGM__) ||
            this.sound.get("kikos_day");

        if (bgm && typeof window !== "undefined") window.__GLOBAL_BGM__ = bgm;

        try { this.sound.context?.resume?.(); } catch {}

        if (bgm) {
            if (bgm.isPaused) {
                try { bgm.resume(); } catch {}
            }
        }
        this.scene.get("MenuScene")?.scene.stop();
        this.registry.remove("playground_done");

        this.sandArea = new Phaser.Geom.Rectangle(width * 0.15, height * 0.65, width * 0.70, height * 0.25);

        const bg = this.add.image(width / 2, height / 2, SAND_KEY).setOrigin(0.5).setDepth(LAYERS.BG);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        const centerY = this.sandArea.bottom - 10;
        const centerX = this.sandArea.centerX;

        const castleX = centerX - 200;
        const castleY = centerY;

        if (this.textures.exists(KIKO_BASE_KEY)) {
            this._kiko = this.add.image(0, 0, KIKO_BASE_KEY)
                .setDisplaySize(600, 600)
                .setOrigin(0.5, 1);
        } else {
            const g = this.add.graphics({ x: 0, y: 0 });
            g.fillStyle(0x2a4cff, 1).fillCircle(0, 0, 60);
            this._kiko = g;
        }
        this._kikoRig = this.add.container(centerX + 220, centerY, [this._kiko]).setDepth(LAYERS.KIKO);

        this.tweens.add({
            targets: this._kiko,
            y: -10,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.speech = this.speech = new SpeechBubble(this, this._kiko, {
            maxWidth: 650,
            x: this.scale.width * 0.7,
            y: this.scale.height * 0.22
        });
        const name = (this.registry.get("playerName") || "friend");
        this.speech.say(`Hello, ${name}! My name is Kiko.\nLook! Let's make a sandcastle!\nTap the sand!`);

        // buildNext advances the castle frame plays a pop tween updates dialog and if finished schedules exit
        // queueLine spaces messages by content length for natural pacing then _enterDoor begins transition
        const buildNext = () => {
            this._castleStage = Math.min(this._castleStage + 1, CASTLE_FRAMES.length - 1);
            const { key } = CASTLE_FRAMES[this._castleStage];

            if (!this._castleImage) {
                this._castleImage = this.add.image(castleX, castleY, key)
                    .setOrigin(0.5, 1)
                    .setDepth(LAYERS.OBJECTS)
                    .setScale(CASTLE_SIZE);
            } else {
                this._castleImage.setTexture(key).setPosition(castleX, castleY);
            }


            this._castleImage.setScale(CASTLE_SIZE - 0.1);
            this.tweens.add({ targets: this._castleImage, scale: CASTLE_SIZE, duration: 180, ease: "Back.Out" });

            if (this._castleStage === 0) {
                this.speech.say(`It's so much fun! Tap again!`);
            } else if (this._castleStage === 1) {
                this.speech.say(`Again!`);
            } else if (this._castleStage === 2) {
                this.speech.say(`Last one!`);
            }

            if (this._castleStage === 3) {
                this.canTap = false;

                const typeMsPerChar = 20;
                const padMs        = 2000;
                let t = 0;

                const queueLine = (text) => {
                    const ms = Math.max(800, text.length * typeMsPerChar + padMs);
                    const h = this.time.delayedCall(t, () => this.speech.say(text, 0 /* keep visible */));
                    this._dlgTimers.push(h);
                    t += ms;
                };

                queueLine(`Oh no... my hands have gotten dirty.`);
                queueLine(`Hmm, what should we do? \nOf course — it's hand washing time!`);
                queueLine(`Washing our hands keeps us clean and healthy.`);
                queueLine(`Will you help me wash my hands? \nCome with me!`);

                this.time.delayedCall(t, () => this._enterDoor());
            }
        };

        // onPointer accepts taps inside sandArea when enabled flashes cheer pose then calls buildNext
        // rate limits input so only one stage advances per tap frame
        const onPointer = (pointer) => {
            const { worldX: x, worldY: y } = pointer;
            if (!this.canTap) return;
            if (!Phaser.Geom.Rectangle.Contains(this.sandArea, x, y)) return;

            this.canTap = false;

            if (this._castleStage < CASTLE_FRAMES.length - 1 &&
                this.textures.exists(KIKO_CHEER_KEY) && this._kiko.setTexture) {
                this._kiko.setTexture(KIKO_CHEER_KEY).setDisplaySize(600, 600);
                this.time.delayedCall(220, () =>
                    (this.textures.exists(KIKO_BASE_KEY) && this._kiko.setTexture)
                        ? this._kiko.setTexture(KIKO_BASE_KEY).setDisplaySize(600, 600)
                        : null
                );
            }

            buildNext();

            if (this._castleStage < CASTLE_FRAMES.length - 1) {
                this.time.delayedCall(220, () => (this.canTap = true));
            }
        };

        // reflow recalculates background scale sand area and positions of kiko rig and castle for any viewport
        const reflow = (w, h) => {
            const bg = this.children.list.find(c => c.texture?.key === SAND_KEY) || null;
            if (bg) bg.setPosition(w / 2, h / 2).setScale(Math.max(w / bg.width, h / bg.height));
            this.sandArea.setTo(w * 0.15, h * 0.65, w * 0.70, h * 0.25);

            const cx = this.sandArea.centerX;
            const cy = this.sandArea.bottom - 10;

            if (this._kikoRig) this._kikoRig.setPosition(cx + 220, cy);
            if (this._castleImage) this._castleImage.setPosition(cx - 220, cy);
        };
        const onResize = ({ width: w, height: h }) => reflow(w, h);

        // hook inputs and resize handlers then perform initial layout
        this.input.on("pointerdown", onPointer);
        this.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        reflow(width, height);

        // on shutdown remove listeners destroy temps and reset flags to avoid leaks across scene swaps
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.input.off("pointerdown", onPointer);
            this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            this.speech?.destroy();
            this._castleImage?.destroy();
            this.speech = null;
            this._castleImage = null;
            this.canTap = true;
            this._castleStage = -1;
        });
    }

    // _enterDoor handles transition to bathroom
    // hides dialog switches kiko to side jump animates toward doorway scales down and fades to SchoolBathroomScene
    // clears pending timers blocks input and stops bob tween on completion
    _enterDoor() {
        this.canTap = false;

        if (this._leaving) return;
        this._leaving = true;

        if (this._dlgTimers) {
            for (const h of this._dlgTimers) { try { h.remove(false); } catch {} }
            this._dlgTimers.length = 0;
        }

        if (this.speech) {
            try { this.speech.hide(); } catch {}
            this.time.delayedCall(220, () => { try { this.speech.destroy(); } catch {} this.speech = null; });
        }

        if (this._kiko.setTexture && this.textures.exists(KIKO_ENTER_KEY)) {
            this._kiko.setTexture(KIKO_ENTER_KEY).setDisplaySize(600, 600);
            this._kiko.setFlipX(true).setAngle(8).setOrigin(0.5, 1);
        }

        const walkBob = this.tweens.add({
            targets: this._kiko,
            y: -10,
            yoyo: true,
            duration: 180,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        const doorX = this.scale.width * DOOR_X_FRAC;
        const doorY = this.sandArea.bottom - 150 + DOOR_Y_OFFSET;

        const startScale = this._kikoRig.scale || 1;
        const endScale   = startScale * 0.55;

        this.tweens.add({
            targets: this._kikoRig,
            x: doorX,
            y: doorY,
            scale: endScale,
            duration: 2800,
            ease: "Sine.easeInOut",
            onComplete: () => {
                try { walkBob.stop(); } catch {}
                if (this._kiko) this._kiko.y = 0;

                this.input.enabled = false;
                this.cameras.main.once("camerafadeoutcomplete", () => {
                    this.scene.start("SchoolBathroomScene");
                });
                this.cameras.main.fadeOut(300, 0, 0, 0);
            },
        });
    }
}
