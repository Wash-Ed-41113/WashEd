// SchoolBathroomScene.js

const BG_KEY = "washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";
const BG_PATH = "assets/images/Menu/washed_kikos-day_LEVEL_01_scene_02_action_01_bathroom_start.png";

const TAP_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";
const TAP_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Tap.png";

const SOAPBAR_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";
const SOAPBAR_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bar.png";

const SOAPBOTTLE_KEY = "washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";
const SOAPBOTTLE_PATH = "assets/images/UI/washed_day_UI_LEVEL_01_scene_02_bathroom__Soap-bottle.png";

const ARROW_RIGHT_KEY = "ui_arrow_right";
const ARROW_RIGHT_PATH = "assets/images/UI/washed_kikos-day_UI-Button_ARROW_Right.png";

const DIALOG_BALLOON_KEY = "dialog_balloon";
const DIALOG_BALLOON_PATH = "assets/images/UI/washed_kikos-day_UI-dialogue-box-v2.png";

export default class SchoolBathroomScene extends Phaser.Scene {
    constructor() {
        super("SchoolBathroomScene");
        this.nextSceneKey = null;
        this._dialogRoot = null;
        this._step1Done = false;

        // holders for glow controls
        this._hints = { tap: null, soapBar: null, soapBottle: null };
    }

    preload() {
        if (!this.textures.exists(BG_KEY)) this.load.image(BG_KEY, BG_PATH);
        if (!this.textures.exists(TAP_KEY)) this.load.image(TAP_KEY, TAP_PATH);
        if (!this.textures.exists(SOAPBAR_KEY)) this.load.image(SOAPBAR_KEY, SOAPBAR_PATH);
        if (!this.textures.exists(SOAPBOTTLE_KEY)) this.load.image(SOAPBOTTLE_KEY, SOAPBOTTLE_PATH);
        if (!this.textures.exists(ARROW_RIGHT_KEY)) this.load.image(ARROW_RIGHT_KEY, ARROW_RIGHT_PATH);
        if (!this.textures.exists("dialog_skin")) this.load.image("dialog_skin", "assets/images/Menu/washed_kikos-day_UI-dialogue-box-v1.png");
        if (!this.textures.exists("kiko_dialog")) this.load.image("kiko_dialog", "assets/images/Kiko/WashEd_kiko_sprite_base.png");
        if (!this.textures.exists(DIALOG_BALLOON_KEY)) this.load.image(DIALOG_BALLOON_KEY, DIALOG_BALLOON_PATH);
    }

    create(data = {}) {
        const { width, height } = this.scale;
        const skipIntro = !!data.skipIntro;

        if (skipIntro) {
            this._step1Done = true;
        }

        const onlyIfNoDialog = (fn) => () => {
            // If a dialog is already visible, remove it immediately
            if (this._dialogRoot) {
                this._dialogRoot.destroy(true);
                this._dialogRoot = null;
            }
            fn();
        };


        // Background
        const bg = this.add.image(width / 2, height / 2, BG_KEY).setOrigin(0.5, 0.5);
        bg.setScale(Math.max(width / bg.width, height / bg.height));

        // Layout
        const pos = {
            tap:        { x: width * 0.35, y: height * 0.73, h: height * 0.51 },
            soapBar:    { x: width * 0.75, y: height * 0.85, h: height * 0.35 },
            soapBottle: { x: width * 0.18, y: height * 0.80, h: height * 0.34 },
        };

        const fitH = (img, targetH) => img.setScale(targetH / img.height);

        // Tap → CleanCatch
        const tap = this.add.image(pos.tap.x, pos.tap.y, TAP_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(tap, pos.tap.h);

        // Soap bar → SoapSplash
        const soapBar = this.add.image(pos.soapBar.x, pos.soapBar.y, SOAPBAR_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(soapBar, pos.soapBar.h);

        // Soap bottle → SoapSplash
        const soapBottle = this.add.image(pos.soapBottle.x, pos.soapBottle.y, SOAPBOTTLE_KEY)
            .setOrigin(0.5)
            .setDepth(5)
            .setInteractive({ useHandCursor: true });
        fitH(soapBottle, pos.soapBottle.h);

        // Hover pulse
        const makeHover = (img, factor = 1.06, dur = 120) => {
            const baseX = img.scaleX;
            const baseY = img.scaleY;
            img.setData("baseScaleX", baseX);
            img.setData("baseScaleY", baseY);

            img.on("pointerover", () => {
                this.tweens.killTweensOf(img);
                this.tweens.add({
                    targets: img,
                    scaleX: baseX * factor,
                    scaleY: baseY * factor,
                    duration: dur,
                    ease: "Sine.easeOut"
                });
            });

            img.on("pointerout", () => {
                this.tweens.killTweensOf(img);
                this.tweens.add({
                    targets: img,
                    scaleX: baseX,
                    scaleY: baseY,
                    duration: dur,
                    ease: "Sine.easeOut"
                });
            });
        };

        makeHover(tap); makeHover(soapBar); makeHover(soapBottle);

        // --------- Hints: glow guidance ----------
        if (!this._step1Done) {
            this._enableStep1Hints(tap); // blue glow on tap
        } else {
            this._enableStep2Hints(soapBar, soapBottle); // green glow on soaps
        }

        // Click routing (blocked until dialog closes)
        // TAP is the FIRST correct step
        tap.on("pointerdown", onlyIfNoDialog(() => {
            if (!this._step1Done) {
                // First time: Tap is correct → show success dialog, then start CleanCatch
                this._step1Done = true;

                // switch hints from tap → soaps immediately
                this._enableStep2Hints(soapBar, soapBottle);

                this._showCorrectDialog(
                    "Good job! That’s the correct way to wash your hands. \n\n Now, let’s play Soap Splasher!",
                    () => {
                        this._fadeTo("CleanCatchExplain");
                    }, 3000
                );
                return;
            }

            // After returning from Clean Catch: Tap is WRONG
            this._showSmallDialog(
                "Oops, not that one. We need to scrub our hands to get the germs off.\nTry again, click the scrubbing hands!"
            );
        }));

        // SOAP is WRONG if tap not done yet
        const handleSoapClick = onlyIfNoDialog(() => {
            if (!this._step1Done) {
                // Wrong step — keep hint on tap
                this._enableStep1Hints(tap);
                this._showSmallDialog("Oops, that’s not the first step.\nLet's try again!\n\nRemember: we always start at the beginning.\nYou can do it!");
                return;
            }

            // Correct after step 1 — soaps are right
            this._showCorrectDialog(
                "That's right! Scrubbing our hands together is how we chase away all the germs. \n\n Let's start scrubbing and make those hands sparkle clean!",
                () => {
                    // turning off hints is optional here; next scene is starting anyway
                    this._clearHints();
                    this._fadeTo("SoapSplash");
                }
            );
        });

        soapBar.on("pointerdown", handleSoapClick);
        soapBottle.on("pointerdown", handleSoapClick);

        // Single fadeout handler — goes only where you clicked
        this.cameras.main.once("camerafadeoutcomplete", () => {
            // cleanup hints when leaving
            this._clearHints();
            if (this.nextSceneKey) {
                this.scene.start(this.nextSceneKey);
            } else {
                this.cameras.main.fadeIn(300, 0, 0, 0); // safety
            }
        });

        if (!skipIntro) {
            this._showEntryDialog();
        }

        // Also clean up hints on shutdown
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._clearHints());
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this._clearHints());
    }

    _fadeTo(sceneKey) {
        this.nextSceneKey = sceneKey; // must match your scene keys
        this.cameras.main.fadeOut(300, 0, 0, 0);
    }

    _showEntryDialog() {
        const { width, height } = this.scale;

        this._dialogRoot = this.add.container(0, 0).setDepth(9999);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.4)
            .setOrigin(0, 0)
            .setInteractive();
        this._dialogRoot.add(overlay);

        const panel = this.add.image(width / 2, height / 2, "dialog_skin").setOrigin(0.5);
        const s = Math.min((width * 0.8) / panel.width, (height * 0.5) / panel.height);
        panel.setScale(s);
        this._dialogRoot.add(panel);

        const panelW = panel.displayWidth;
        const panelH = panel.displayHeight;

        const kiko = this.add.image(panel.x - panelW / 2 - 200, panel.y + panelH * 0.45, "kiko_dialog")
            .setOrigin(0.5, 1);
        kiko.setScale((panelH * 0.90) / kiko.height);
        this._dialogRoot.add(kiko);

        this._dialogRoot.add(
            this.add.text(panel.x, panel.y - panelH * 0.25, "Let's Wash!", {
                fontFamily: CONFIG.ui.fontFamily, fontSize: "42px", color: "#000000"
            }).setOrigin(0.5)
        );

        this._dialogRoot.add(
            this.add.text(panel.x, panel.y, "We're here in the bathroom and it’s time to wash our hands!\n\nWhat should I do first? Can you help me choose?\n\nClick on the best choice!", {
                fontFamily: CONFIG.ui.fontFamily, fontSize: "34px", color: "#2a4155", align: "center"
            }).setOrigin(0.5)
        );

        // Green arrow (only closer)
        const arrowSize = Math.min(panelH * 0.22, 140);
        const arrow = this.add.image(
            panel.x + panelW * 0.35,
            panel.y + panelH * 0.25,
            ARROW_RIGHT_KEY
        ).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const scaleTo = arrowSize / Math.max(arrow.width, arrow.height);
        arrow.setScale(scaleTo);

        // IMPORTANT: Add arrow INTO the dialog container (so it appears above overlay)
        this._dialogRoot.add(arrow);

        // Close the dialog ONLY when arrow is clicked
        arrow.on("pointerdown", () => {
            this._dialogRoot.destroy(true);
            this._dialogRoot = null;
        });
    }

    _showSmallDialog(message, duration = 5000) {
        const onlyIfNoDialog = (fn) => () => {
            if (this._dialogRoot) {
                this._dialogRoot.destroy(true);
                this._dialogRoot = null;
            }
            fn();
        };

        const { width, height } = this.scale;

        // Block background clicks while this small dialog is up
        this._dialogRoot = this.add.container(0, 0).setDepth(9999);

        // Very light overlay to catch clicks
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
            .setOrigin(0, 0);
        this._dialogRoot.add(overlay);

        // Balloon image
        const balloon = this.add.image(width / 2 + 180, height * 0.15, DIALOG_BALLOON_KEY)
            .setOrigin(0.5);
        const scale = Math.min((width * 0.6) / balloon.width, (height * 0.2) / balloon.height);
        balloon.setScale(scale * 1.5);
        this._dialogRoot.add(balloon);

        // Text
        const text = this.add.text(balloon.x, balloon.y - 15, message, {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "25px",
            color: "#000000",
            align: "center",
            wordWrap: { width: balloon.displayWidth * 0.8 }
        }).setOrigin(0.5);
        this._dialogRoot.add(text);

        // Auto close
        this.time.delayedCall(duration, () => {
            this._dialogRoot?.destroy(true);
            this._dialogRoot = null;
        });
    }

    _showCorrectDialog(message, onDone, duration = 5000) {
        const onlyIfNoDialog = (fn) => () => {
            if (this._dialogRoot) {
                this._dialogRoot.destroy(true);
                this._dialogRoot = null;
            }
            fn();
        };

        const { width, height } = this.scale;

        this._dialogRoot = this.add.container(0, 0).setDepth(9999);

        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
            .setOrigin(0, 0)
            .setInteractive();
        this._dialogRoot.add(overlay);

        const balloon = this.add.image(width / 2 + 180, height * 0.15, DIALOG_BALLOON_KEY)
            .setOrigin(0.5);
        const scale = Math.min((width * 0.6) / balloon.width, (height * 0.2) / balloon.height);
        balloon.setScale(scale * 1.5);
        this._dialogRoot.add(balloon);

        const text = this.add.text(balloon.x, balloon.y - 15, message, {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: "25px",
            color: "#000000",
            align: "center",
            wordWrap: { width: balloon.displayWidth * 0.8 }
        }).setOrigin(0.5);
        this._dialogRoot.add(text);

        // use the provided duration
        this.time.delayedCall(duration, () => {
            this._dialogRoot?.destroy(true);
            this._dialogRoot = null;
            if (onDone) onDone();
        });
    }

    // ---------------- Glow helpers & hint control ----------------

    /** Create a subtle pulsing glow around an image.
     *  Prefers postFX glow; falls back to an additive aura.
     *  Returns { stop() } which cleans up the effect.
     */
    _makeGlow(target, {
        color = 0xffffff,
        alpha = 0.35,
        scale = 1,
        pulseMs = 1600
    } = {}) {
        if (!target) return { stop() {} };

        // Prefer Phaser postFX glow if available
        if (target.postFX && typeof target.postFX.addGlow === "function") {
            const g = target.postFX.addGlow(color, 6, 1, false);
            const tw = this.tweens.add({
                targets: g,
                outerStrength: { from: 4.5, to: 8.0 },
                duration: pulseMs,
                ease: "Sine.inOut",
                yoyo: true,
                repeat: -1
            });
            return {
                stop: () => { try { tw?.stop(); target.postFX.remove(g); } catch(e) {} }
            };
        }

        // Fallback: additive duplicate “aura”
        const aura = this.add.image(target.x, target.y, target.texture.key, target.frame?.name)
            .setDepth((target.depth ?? 0) - 1)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setTint(color)
            .setAlpha(alpha)
            .setScale(target.scaleX * scale, target.scaleY * scale)
            .setOrigin(target.originX, target.originY);

        const sync = () => {
            aura.x = target.x; aura.y = target.y;
            aura.scaleX = target.scaleX * scale;
            aura.scaleY = target.scaleY * scale;
            aura.setDepth((target.depth ?? 0) - 1);
        };
        target.on("destroy", () => aura.destroy());

        const tw = this.tweens.add({
            targets: aura,
            alpha: { from: alpha * 0.7, to: alpha },
            duration: pulseMs,
            ease: "Sine.inOut",
            yoyo: true,
            repeat: -1,
            onUpdate: sync
        });

        return {
            stop: () => { try { tw?.stop(); aura.destroy(); } catch(e) {} }
        };
    }

    _clearHints() {
        try { this._hints?.tap?.stop?.(); } catch(e) {}
        try { this._hints?.soapBar?.stop?.(); } catch(e) {}
        try { this._hints?.soapBottle?.stop?.(); } catch(e) {}
        this._hints = { tap: null, soapBar: null, soapBottle: null };
    }

    _enableStep1Hints(tapImg) {
        this._clearHints();
        this._hints.tap = this._makeGlow(tapImg, { color: 0xffffff, alpha: 0.35, scale: 1, pulseMs: 1600 });

    }

    _enableStep2Hints(soapBarImg, soapBottleImg) {
        this._clearHints();
        this._hints.soapBar    = this._makeGlow(soapBarImg,    { color: 0xffffff, alpha: 0.35, scale: 1 });
        this._hints.soapBottle = this._makeGlow(soapBottleImg, { color: 0xffffff, alpha: 0.35, scale: 1 });

    }
}
