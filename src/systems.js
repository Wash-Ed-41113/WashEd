// this module collects all shared helpers ui widgets mini game engines and simple menus
// scenes import this module as systems to access these features
// everything below is inline documented so you can read top to bottom and understand the flow
import { DB } from "./db.js";
// === AudioManager ============================================================
// Groups:
//  - "global": your story bg (Bathroom → Handwash → Ending)
//  - "game": per-mini-game music (CleanCatch / SoapSplash)
// Behavior:
//  - When any "game" track starts, we PAUSE the "global" group (with fade).
//  - When the game scene shuts down, we RESUME the "global" group (with fade).
export const AudioManager = (() => {
    const SCENE_OWNERS = new Map(); // scene => Set(Phaser.Sound.BaseSound)
    const GROUPS = new Map();       // group => Set(sound)
    const CURRENT = new Map();      // key => sound

    const FADE_MS = 400;

    function _ensureSets(scene, group) {
        if (!SCENE_OWNERS.has(scene)) SCENE_OWNERS.set(scene, new Set());
        if (group && !GROUPS.has(group)) GROUPS.set(group, new Set());
    }

    function _fadeTo(sound, vol, ms = FADE_MS, onComplete) {
        if (!sound || !sound.scene?.tweens) return onComplete?.();
        try {
            sound.scene.tweens.add({
                targets: sound,
                volume: vol,
                duration: ms,
                onComplete
            });
        } catch { onComplete?.(); }
    }

    function _addToGroup(sound, group) {
        if (!group) return;
        const set = GROUPS.get(group);
        if (set) set.add(sound);
        sound._amGroup = group;
    }

    function _remove(sound) {
        try {
            const g = sound._amGroup;
            if (g && GROUPS.has(g)) GROUPS.get(g).delete(sound);
            CURRENT.forEach((s, k) => { if (s === sound) CURRENT.delete(k); });
            sound.destroy();
        } catch {}
    }

    function _trackScene(scene, sound) {
        SCENE_OWNERS.get(scene)?.add(sound);
        // Auto-clean on SHUTDOWN
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            stop(scene); // stop everything this scene owns
            // If this was a game scene ending, resume the global bg
            resumeGroup("global");
        });
    }

    function play(scene, key, opts = {}) {
        const { loop = true, volume = 1, group = "global", fadeIn = FADE_MS } = opts;
        if (!scene?.sound || !scene.cache.audio.exists(key)) {
            console.warn("[AudioManager] missing key:", key);
            return null;
        }
        _ensureSets(scene, group);

        // If same key already playing, just ensure it’s in the right state
        let snd = CURRENT.get(key);
        if (!snd || !snd.isPlaying) {
            snd = scene.sound.add(key, { loop, volume: 0 });
            CURRENT.set(key, snd);
            _addToGroup(snd, group);
            _trackScene(scene, snd);
            snd.play();
            _fadeTo(snd, volume, fadeIn);
        } else {
            // bring volume up if it’s mid-paused/faded
            _fadeTo(snd, volume, fadeIn);
        }

        // If a game track began, duck/pause global
        if (group === "game") pauseGroup("global");

        return snd;
    }

    function stop(scene) {
        const set = SCENE_OWNERS.get(scene);
        if (!set) return;
        for (const snd of Array.from(set)) {
            try {
                _fadeTo(snd, 0, FADE_MS, () => _remove(snd));
            } catch { _remove(snd); }
            set.delete(snd);
        }
    }

    function pauseGroup(group, fadeMs = FADE_MS) {
        const set = GROUPS.get(group); if (!set) return;
        for (const s of set) {
            if (!s || !s.isPlaying) continue;
            _fadeTo(s, 0, fadeMs, () => { try { s.pause(); } catch {} });
        }
    }

    function stopGroup(group, fadeMs = 150) {
        const set = GROUPS.get(group); if (!set) return;
        for (const s of Array.from(set)) {
            try { _fadeTo(s, 0, fadeMs, () => _remove(s)); }
            catch { _remove(s); }
        }
    }

    function hardReset() {
        // Brutal safety: stop EVERYTHING we’re tracking
        for (const [group] of GROUPS) stopGroup(group, 0);
        GROUPS.clear();
        CURRENT.clear();
        SCENE_OWNERS.clear();
    }

    return { play, stop, pauseGroup, resumeGroup, stopGroup, hardReset };


    function resumeGroup(group, fadeMs = FADE_MS, toVol = 1) {
        const set = GROUPS.get(group); if (!set) return;
        for (const s of set) {
            if (!s) continue;
            try {
                if (s.isPaused) {
                    s.resume(); s.setVolume(0);
                    _fadeTo(s, toVol, fadeMs);
                } else if (s.isPlaying) {
                    _fadeTo(s, toVol, fadeMs);
                }
            } catch {}
        }
    }

    return { play, stop, pauseGroup, resumeGroup, stopGroup, hardReset };
})();



// short names for config sections used throughout
const SS = CONFIG.soapSplash;   // soap splash game config values
const CC = CONFIG.cleanCatch;   // clean catch game config values


const safeDB = {
    // accepts ("event", payload) OR (roundId, "event", payload)
    logTyping: (...args) => {
        try {
            let event, payload;
            if (args.length === 3 && typeof args[1] === "string") {
                event = args[1];
                payload = args[2];
            } else if (args.length >= 2 && typeof args[0] === "string") {
                event = args[0];
                payload = args[1];
            } else {
                return; // unknown shape; ignore
            }
            // forward to DB in the canonical shape your db.js implements
            DB?.logTyping?.(event, payload);
        } catch (_) {
            // never let telemetry break gameplay
        }
    }
};


// -----------------------------
// helpers
// small pure functions that do math picking words formatting time and simple checks
// -----------------------------
const helpers = {
    // pick a random angle between two degrees inclusive
    // returned angle is in radians because trig functions use radians
    sampleAngle(minDeg, maxDeg) {
        const a0 = Phaser.Math.DegToRad(minDeg);
        const a1 = Phaser.Math.DegToRad(maxDeg);
        return Phaser.Math.FloatBetween(a0, a1);
    },

    // pick a random radius in a ring area so density is uniform
    // uses inverse transform sampling for a disk annulus
    sampleRadius(rInner, rOuter) {
        const u = Math.random();
        return Math.sqrt(u * (rOuter * rOuter - rInner * rInner) + rInner * rInner);
    },

    // convert polar coordinates relative to an origin into world x y
    // note y uses minus sin to point up in screen space
    polarToWorld(origin, r, theta) {
        return { x: origin.x + Math.cos(theta) * r, y: origin.y - Math.sin(theta) * r };
    },

    // clamp a value between lo and hi
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },

    // test axis aligned rectangle overlap
    aabbIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },

    // check if a point is on screen within a small margin
    isOnScreen(scene, x, y, margin = 10) {
        const view = scene.cameras.main.worldView;
        return x >= view.x - margin && y >= view.y - margin &&
            x <= view.right + margin && y <= view.bottom + margin;
    },

    // word helpers provide lists and a picker
    words: {
        soapSplashWords() { return SS.words || []; },
        cleanGood() { return (CC.words && CC.words.good) || []; },
        cleanBad()  { return (CC.words && CC.words.bad)  || []; },
        pick(list)  { return (list && list.length) ? list[Math.floor(Math.random() * list.length)] : ""; }

    },

    // format milliseconds as mm ss string for hud
    mmss(ms) {
        const mm = Math.floor(ms / 60000);
        const ss = Math.floor((ms % 60000) / 1000);
        const two = (n) => (n < 10 ? "0" + n : "" + n);
        return `${two(mm)}:${two(ss)}`;
    },
    // show a simple floating "+N" streak popup
    // show a clean "+N" streak popup (Chewy, light purple, no bg/outline)
    streakPopup(scene, _ignored, x, y) {
        const s = scene.streakSys?.streak ?? 0;
        if (s < 1) return;

        const t = scene.add.text(x, y, `+${s}`, {
            fontFamily: (CONFIG.soapSplash?.fontFamily || "Chewy, Arial, sans-serif"),
            fontSize: "36px",
            fontStyle: "bold",
            color: "#BD66C9",           // Germ Scrubber pink-purple
            align: "center",
            padding: { left: 8, right: 8, top: 4, bottom: 4 },
        })
            .setOrigin(0.5)
            .setDepth(200)
            .setShadow(0, 2, "#BD66C955", 6); // subtle soft purple shadow

        scene.tweens.add({
            targets: t,
            y: y - 40,
            alpha: { from: 1, to: 0 },
            scale: { from: 1.0, to: 1.08 },
            duration: 800,
            ease: "Cubic.Out",
            onComplete: () => t.destroy()
        });
    },
};

const telemetry = {
    onWordComplete(scene, g, clean) {
        if (!scene.roundId) return;
        safeDB.logTyping(scene.roundId, "word_complete", {
            clean: clean ? 1 : 0,
            streak: scene.streakSys?.streak ?? 0,
            base_score: scene.streakSys?.baseScore ?? 0,
            total_score: scene.streakSys?.totalScore ?? 0,
            word: g?.word ?? null
        });
    },
    onMistake(scene) {
        if (!scene.roundId) return;
        safeDB.logTyping(scene.roundId, "mistake", {
            streak: scene.streakSys?.streak ?? 0,
            base_score: scene.streakSys?.baseScore ?? 0,
            total_score: scene.streakSys?.totalScore ?? 0
        });
    }
};


// -----------------------------
// ui
// immediate mode ui helpers built on phaser primitives
// -----------------------------
const ui = {

    // bottom-right sticky logo (fixed to screen, auto-resizes, easy cleanup)
    placeLogo(scene, opts = {}) {
        const key     = opts.key ?? "app_logo";
        const margin  = opts.margin ?? 16;
        const maxW    = opts.maxWidth ?? 125;  // cap visual width so it stays tidy
        const depth   = opts.depth ?? 199;     // under topbar (which is ~200), above bg
        const alpha   = opts.alpha ?? 0.95;

        if (!scene.textures.exists(key)) return null;

        const { width, height } = scene.scale;

        // create
        const img = scene.add.image(width - margin, height - margin, key)
            .setOrigin(1, 1)
            .setDepth(depth)
            .setScrollFactor(0)
            .setAlpha(alpha);

        // scale to maxW while keeping aspect
        const src = scene.textures.get(key).getSourceImage();
        const scale = Math.min(1, maxW / (src?.width || maxW));
        img.setScale(scale);

        // keep in the corner on resize
        const onResize = (gameSize) => {
            img.setPosition(gameSize.width - margin, gameSize.height - margin);
        };
        scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);

        // clean up on shutdown
        scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
            img.destroy();
        });

        return img; // (optional) if you want to keep a reference
    },



    // draw a rectangle button with a text label and a click handler
    button(scene, x, y, label, onClick) {
        const B = CONFIG.ui.button;
        const btn = scene.add.rectangle(x, y, B.width, B.height, B.fill, 1)
            .setOrigin(0.5).setStrokeStyle(B.strokeThickness, B.stroke)
            .setInteractive({ useHandCursor: true });
        const txt = scene.add.text(x, y, label, {
            fontFamily: CONFIG.ui.fontFamily, fontSize: `${B.fontSize}px`, color: B.fontColor, fontStyle: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const handler = () => onClick?.();
        btn.on("pointerdown", handler); txt.on("pointerdown", handler);
        return { btn, txt };
    },

    // modal dialog for player name entry made from a dim overlay a panel some text and a dom input
    nameDialog(scene, onOk) {
        const { width, height } = scene.scale;

        // dark overlay to block interactions behind
        const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55)
            .setOrigin(0, 0).setDepth(10).setInteractive();

        // choose an image panel if loaded otherwise draw a rectangle panel
        const useImg = scene.textures.exists("ui_dialog");
        let panel;
        if (useImg) {
            panel = scene.add.image(width/2, height/2, "ui_dialog")
                .setOrigin(0.5).setDepth(11);
            const s = Math.min((width*0.62)/panel.width, (height*0.48)/panel.height);
            panel.setScale(s);
        } else {
            panel = scene.add.rectangle(width/2, height/2, 760, 360, 0xffffff, 1)
                .setOrigin(0.5).setDepth(11).setStrokeStyle(4, 0x7ec8ff);
        }

        // headline message
        const headline = scene.add.text(width/2, (height/2)-(useImg?110:120),
            "Hey, I’m Kiko — what’s your name?",
            {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "44px",
                color: "#2a4155",
                stroke: "#ffffff",
                strokeThickness: 2,
                align: "center",
                wordWrap: { width: Math.min(900, width*0.7) }
            }
        ).setOrigin(0.5).setDepth(12)
            .setShadow(0, 3, "#00000055", 4);

        // optional kiko image for personality and delight
        let kiko = null;
        if (scene.textures.exists("kiko_cheer")) {
            const pw = panel.displayWidth || 760, ph = panel.displayHeight || 360;
            kiko = scene.add.image(panel.x - pw/2 + 120, panel.y + ph/2 - 110, "kiko_cheer")
                .setOrigin(0.5, 1).setDepth(12);
            const kScale = Math.min(200 / kiko.width, 220 / kiko.height);
            kiko.setScale(kScale);
        }

        // dom content for input and button
        const html = `
            <div style="display:flex;flex-direction:column;align-items:center;gap:14px;">
              <input id="nameInput" type="text" maxlength="20" placeholder="Type your name…"
                style="padding:12px 14px;font-size:22px;width:360px;border-radius:12px;border:2px solid #89bfff;outline:none;" />
              <button id="okBtn"
                style="padding:10px 18px;font-size:18px;cursor:pointer;border-radius:10px;border:1px solid #89bfff;background:#cfe8ff;">
                Continue
              </button>
              <div style="font-size:14px;color:#3a5070;opacity:0.85;margin-top:-4px;">Press Enter to continue…</div>
            </div>`;
        const dom = scene.add.dom(width/2, (height/2) + (useImg ? 22 : 10))
            .createFromHTML(html).setDepth(12);

        // cache the input
        const inputEl = dom.getChildByID("nameInput");

        // submit function validates stores and calls back then closes
        let close;
        const submit = () => {
            const name = (inputEl?.value || "").trim();
            if (!name) return;
            scene.registry.set("playerName", name);
            close();
            onOk?.(name);
        };

        // handlers for enter key and click on continue
        const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };
        window.addEventListener("keydown", onKeyDown);
        inputEl?.addEventListener?.("keydown", onKeyDown);

        dom.addListener("click");
        dom.on("click", (e) => { if (e.target?.id === "okBtn") submit(); });

        // focus the input after mount
        setTimeout(() => inputEl?.focus(), 0);

        // close cleans up listeners and visuals
        close = () => {
            window.removeEventListener("keydown", onKeyDown);
            inputEl?.removeEventListener?.("keydown", onKeyDown);
            dom.destroy();
            headline.destroy();
            panel.destroy();
            overlay.destroy();
            kiko?.destroy();
        };
    },

    // top bar with optional home, pause, and settings icons anchored to top-right
// now also includes a styled Mute/Unmute toggle (dark rectangle) below icons
    topbar(scene, { onHome, onPause, onSettings, showMute = false } = {}) {
        // scale icons relative to current screen size
        const scaleFactor = Math.max(0.5, Math.min(1, scene.scale.width / 1920));
        const T = {
            iconSize: 140 * scaleFactor,
            gap: 40 * scaleFactor,
            top: 140 * scaleFactor,
        };
        T.padding = 24 * scaleFactor; // define padding used below

        const B = CONFIG.ui.button || { width: 520, height: 64 }; // fallback

        let x = scene.scale.width - T.padding;
        const y = T.padding + T.iconSize / 2;

        // helper to spawn each icon safely
        const makeIcon = (key, cb) => {
            if (!scene.textures.exists(key) || !cb) return null; // avoid missing sprite
            x -= T.iconSize / 2;
            const img = scene.add.image(x, y, key)
                .setOrigin(0.5)
                .setDisplaySize(T.iconSize, T.iconSize)
                .setScale(1)
                .setDepth(200)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });

            // lock scale; just click
            img.on("pointerup", cb);
            x -= T.iconSize + T.gap;
            return img;
        };

        // build optional icons
        const home = makeIcon("ui_home", onHome || null);
        const pause = makeIcon("ui_pause", onPause || null);
        const settings = makeIcon("ui_settings", onSettings || null);

        // create Mute/Unmute dark rectangle toggle
        let muteRect = null, muteTxt = null;
        if (showMute) {
            const W = B.width, H = B.height;
            const bx = scene.scale.width - (W / 2 + T.padding);
            const by = y + T.iconSize / 2 + 12 + H / 2; // just below icons

            const fillIdle  = 0x142038;
            const fillHover = 0x1d2b52;

            muteRect = scene.add.rectangle(bx, by, W, H, fillIdle, 1)
                .setOrigin(0.5)
                .setStrokeStyle(2, 0xffffff)
                .setDepth(200)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });

            muteTxt = scene.add.text(bx, by, (scene.sound?.mute ? "Unmute" : "Mute"), {
                fontFamily: CONFIG.ui.fontFamily,
                fontSize: "26px",
                color: "#ffffff",
                align: "center",
                fixedWidth: W
            })
                .setOrigin(0.5)
                .setDepth(201)
                .setScrollFactor(0);

            const toggleMute = () => {
                if (!scene.sound) return;
                scene.sound.mute = !scene.sound.mute;
                scene.registry.set("mute", !!scene.sound.mute);
                muteTxt.setText(scene.sound.mute ? "Unmute" : "Mute");
            };

            muteRect
                .on("pointerover", () => muteRect.setFillStyle(fillHover))
                .on("pointerout",  () => muteRect.setFillStyle(fillIdle))
                .on("pointerup",   toggleMute);
            muteTxt.on("pointerup", toggleMute);
        }

        const destroy = () => {
            home?.destroy();
            pause?.destroy();
            settings?.destroy();
            muteRect?.destroy();
            muteTxt?.destroy();
        };

        return { home, pause, settings, destroy };
    },


    // pause overlay with menu, resume, audio toggle, and live stats
    pauseOverlay(scene, { onResume, onHome } = {}) {
        const { width, height } = scene.scale;
        const P = CONFIG.ui.pauseOverlay;

        const overlay = scene.add.rectangle(0, 0, width, height, P.bgColor, P.bgAlpha)
            .setOrigin(0, 0).setDepth(999).setInteractive(); // blocks clicks behind

        const panelW = 780, panelH = 420;
        const panel = scene.add.rectangle(width / 2, height / 2, panelW, panelH, P.panelColor, 1)
            .setOrigin(0.5).setDepth(1000).setStrokeStyle(4, P.panelStroke);

        // Title
        const title = scene.add.text(width / 2, height / 2 - 150, "Paused", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: `${P.titleSize}px`, color: "#ffffff"
        }).setOrigin(0.5).setDepth(1001);

        // Close button (top-right of panel)
        const close = scene.add.image(panel.x + panelW/2 - 26, panel.y - panelH/2 + 26, "ui_close")
            .setOrigin(0.5).setDepth(1002).setDisplaySize(36,36)
            .setInteractive({ useHandCursor: true });

        close.on("pointerup", () => {
            // CLOSE is the only way to unpause now
            destroyAll();
            scene._paused = false;
            scene._pauseUi = null;
            // re-enable your game loop, timers etc if you pause them elsewhere
        });

        // Live stats (engine is the single source of truth)
        const base  = scene.streakSys?.baseScore ?? 0;
        const mult  = scene.streakSys?.multiplier?.() ?? 1.0; // correct fallback
        const total = scene.streakSys?.totalScore ?? 0;
        const s     = scene.streakSys?.streak ?? 0;
        const best  = scene.streakSys?.bestStreak ?? 0;

        const stats = scene.add.text(
            width / 2, height / 2 - 70,
            `Score: ${total}  (base ${base} × ${mult.toFixed(1)})\n` + // remove “x” duplication
            `Streak: ${s}   Best: ${best}`,
            { fontFamily: CONFIG.ui.fontFamily, fontSize: "24px", color: "#ffffff", align: "center" }
        ).setOrigin(0.5).setDepth(1001);

        // Keep a “Main Menu” button if you like
        const mkBtn = (label, y, cb) => {
            const { btn, txt } = ui.button(scene, width / 2, y, label, cb);
            btn.setDepth(1001); txt.setDepth(1001);
            return { btn, txt };
        };
        const y0 = height / 2 + 40;
        const homeBtn = mkBtn("Play Again", y0, () => onHome?.());

        function destroyAll() {
            try {
                console.log("[pauseOverlay@systems] destroyAll()");
                overlay?.destroy(); panel?.destroy(); title?.destroy(); stats?.destroy();
                homeBtn?.btn?.destroy(); homeBtn?.txt?.destroy();
                close?.destroy();
            } catch (e) {
                console.warn("[pauseOverlay@systems] destroy error", e);
            } finally {
                scene._pauseUi = null;
                scene._paused = false;
                // hard unpause guarantees
                scene.time.timeScale   = 1;
                scene.tweens.timeScale = 1;
                scene.physics?.world && (scene.physics.world.isPaused = false);
                scene.sound?.resumeAll?.();
                scene.input?.keyboard && (scene.input.keyboard.enabled = true);
            }
        }

        return { destroy: destroyAll };
    },


    togglePause() {
        // if already paused, unpause and clean up
        if (this._paused) {
            this._paused = false;
            if (this._pauseUi?.destroy) this._pauseUi.destroy();
            this._pauseUi = null;

            this.time.timeScale   = 1;
            this.tweens.timeScale = 1;
            this.physics?.world && (this.physics.world.isPaused = false);
            this.sound?.resumeAll?.();
            this.input?.keyboard && (this.input.keyboard.enabled = true);
            return;
        }

        // otherwise, pause and build overlay
        this._paused = true;
        this.time.timeScale   = 0;
        this.tweens.timeScale = 0;
        if (this.physics?.world) this.physics.world.isPaused = true;
        this.sound?.pauseAll?.();
        this.input?.keyboard && (this.input.keyboard.enabled = false);

        this._pauseUi = systems.ui.pauseOverlay(this, {
            onResume: () => {
                // close overlay when resume is clicked
                if (this._pauseUi?.destroy) this._pauseUi.destroy();
                this._paused = false;
                this.time.timeScale   = 1;
                this.tweens.timeScale = 1;
                this.physics?.world && (this.physics.world.isPaused = false);
                this.sound?.resumeAll?.();
                this.input?.keyboard && (this.input.keyboard.enabled = true);
            },
            onHome: () => {
                // home or play again → unpause then switch scene
                if (this._pauseUi?.destroy) this._pauseUi.destroy();
                this._paused = false;
                this.scene.start("PlaygroundScene");
            }
        });
    }
};

// -----------------------------
// streak / score engine
// rules:
// - keep a "clean run" count of consecutive clean completions (no mistakes in that word)
// - a streak starts ONLY after two clean words in a row:
// - totalScore = baseScore * (streak * 0.5)
// - any mistake before a word completes resets cleanRun and streak to 0
// -----------------------------
const streakScore = (() => {
    function create() {
        return {
            baseScore: 0,
            totalScore: 0,
            cleanRun: 0,
            streak: 0,
            bestStreak: 0,

            // Add or subtract base points, then recompute total
            addBase(points) {
                this.baseScore = Math.max(0, this.baseScore + (points || 0));
                this._recompute();
            },

            // Call when a word finishes; pass clean=true if no mistakes for that word
            onWord(clean) {
                if (clean) {
                    this.cleanRun += 1;
                    // streak begins at the second clean word and then increments
                    this.streak = Math.max(0, this.cleanRun - 1);
                    this.bestStreak = Math.max(this.bestStreak, this.streak);
                } else {
                    this.cleanRun = 0;
                    this.streak = 0;
                }
                this._recompute();
            },

            // Call on any keystroke error
            onMistake() {
                this.cleanRun = 0;
                this.streak = 0;
                this._recompute();
            },

            // Multiplier now has a base 1.0 so the first clean word scores visibly.
            // 1st clean: 1.0x, 2nd: 1.5x, 3rd: 2.0x, etc.
            multiplier() { return 1 + this.streak * 0.5; },

            _recompute() {
                // total = baseScore * multiplier
                this.totalScore = Math.floor(this.baseScore * this.multiplier());
            }
        };
    }
    return { create };
})();

// -----------------------------
// soap splash engine
// includes spawn movement rules timer and typing logic
// implemented as an iife that returns namespaces
// -----------------------------
const soapsplash = (() => {
    // create a germ with sprite labels caret and optional debug circle
    function addGerm(scene, pos, word) {
        const id = ++scene.germSeq;

        // visual sprite
        const sprite = scene.add.sprite(pos.x, pos.y, "Germ")
            .setDepth(4)
            .setScale(SS.germSpriteSize);

        // typed and remaining labels stacked starting at same x y then laid out in renderTarget
        const ty = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, "", {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const rm = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, word, {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const C = SS.colors || {};
        ty.setColor(C.typed ?? "#000000");
        rm.setColor(C.remain ?? "#000000");

        // caret underline to highlight the next character width is adjusted dynamically
        const caretH = 3;
        const caretCol = 0xff7043;
        const cur = scene.add.rectangle(
            pos.x, pos.y + SS.verticalSpaceLabel,
            12, caretH, caretCol, 0.9
        )
            .setOrigin(0, 1)
            .setDepth(6)
            .setVisible(false);

        // hit radius decides collision with sink either from config or derived from sprite
        const derivedRadius = Math.round(sprite.displayWidth * (SS.germHitRadiusFromSprite ?? 0.35));
        const hitRadius = (SS.germHitRadiusPx ?? derivedRadius);

        // optional debug hit circle
        let hitCircle = null;
        if (SS.debug?.showGermCircles) {
            hitCircle = scene.add.circle(
                pos.x, pos.y, hitRadius,
                SS.debug.germColor ?? 0xff00ff,
                SS.debug.germAlpha ?? 0.2
            ).setDepth(3);
        }

        // store runtime data on the germ
        const germ = {
            id, sprite,
            labelTyped: ty, labelRemain: rm, curBox: cur,
            word, typedIdx: 0, errors: 0, active: false,
            hitRadius, _hitCircle: hitCircle
        };
        scene.germs.push(germ);
        return id;
    }

    // remove germ and all its visual parts by array index
    function removeGermByIndex(scene, i) {
        const g = scene.germs[i];
        if (!g) { scene.germs.splice(i, 1); return; }

        try {
            if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
            if (g.curBox)      { scene.tweens.killTweensOf(g.curBox); g.curBox.destroy(); g.curBox = null; }
            if (g._add)        { scene.tweens.killTweensOf(g._add);   g._add.destroy();   g._add  = null; }
            if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }
            if (g._hitCircle)  { g._hitCircle.destroy(); g._hitCircle = null; }
            g.labelTyped?.destroy?.();
            g.labelRemain?.destroy?.();
            g.sprite?.destroy?.();
        } catch (e) {
            console.warn("[SoapSplash] removeGermByIndex cleanup error", e);
        } finally {
            scene.germs.splice(i, 1);
        }
    }


    // pick a word for a new germ (strict-aware, but with fallback)
    function pickWord(scene) {
        // primary: scene-provided strict supplier
        const fn = CONFIG?.soapSplash?.nextWordFn;
        let w = (typeof fn === "function") ? fn() : null;

        // fallback A: what's currently in SS.words (the list your scene set)
        if (!w || typeof w !== "string" || !w.length) {
            const list = SS.words || [];
            if (Array.isArray(list) && list.length) {
                w = list[Math.floor(Math.random() * list.length)];
            }
        }

        // fallback B: helpers list (in case SS.words is not an array)
        if (!w || typeof w !== "string" || !w.length) {
            const list = helpers.words.soapSplashWords();
            if (Array.isArray(list) && list.length) {
                w = list[Math.floor(Math.random() * list.length)];
            }
        }

        // fallback C: tiny safe default
        if (!w || typeof w !== "string" || !w.length) {
            w = "wash";
        }

        return w;
    }


    // ---------------- spawn ----------------
    const spawn = {
        // attempt to spawn one germ in the corner ring with separation and min sink distance
        spawnGerm(scene) {
            if (scene.gameOver) return;

            const cap = SS.waveCap ?? SS.maxGerms ?? 5;
            if (scene.germs.length >= cap) return;

            const triesMax = SS.maxSpawnAttempts ?? 24;
            const sep      = SS.minSpawnSeparationPx ?? 0;
            const minSink  = SS.minSinkDistancePx ?? 0;

            // ---- Ensure we have sane geometry even if useSpawner wasn't initialized ----
            // If rOuter is 0, build a default corner-band around the top-right corner.
            let rInner = scene.rInner, rOuter = scene.rOuter;
            let aMin   = scene.angleMinDeg, aMax = scene.angleMaxDeg;

            if (!rOuter || rOuter <= 0) {
                const W = SS.width, H = SS.height;
                // default: top-right corner wedge pointing toward sink
                const corner = { x: W, y: 0 };
                const dx = scene.sinkPosition.x - corner.x;
                const dy = scene.sinkPosition.y - corner.y;
                const centerDeg = Phaser.Math.RadToDeg(Math.atan2(Math.abs(dy), Math.abs(dx))); // ~ angle in 0..90

                const margin = SS.cornerMargin ?? 40;
                const band   = SS.cornerBandWidth ?? 180;
                const cornerDist = Math.hypot(dx, dy);

                rOuter = Math.max(60, cornerDist - margin);
                rInner = Math.max(10, rOuter - band);

                const spread = SS.angleSpreadDeg ?? 18;
                aMin = Math.max(0, centerDeg - spread);
                aMax = Math.min(90, centerDeg + spread);
                if (aMin > aMax) { const t = aMin; aMin = aMax; aMax = t; }
            }

            // ---- Estimate new germ hit radius for spacing ----
            const tex   = scene.textures.get("Germ");
            const texW  = tex?.getSourceImage()?.width || 64;
            const scaledW = (SS.germSpriteSize ?? 1) * texW;
            const newR  = SS.germHitRadiusPx ?? Math.round(scaledW * (SS.germHitRadiusFromSprite ?? 0.35));

            // ---- Find a valid spawn point ----
            let tries = triesMax;
            let pos   = null;

            while (tries-- > 0) {
                const theta = helpers.sampleAngle(aMin, aMax);
                const r     = helpers.sampleRadius(rInner, rOuter);
                const p     = helpers.polarToWorld(scene.sinkPosition, r, theta);

                // minimum distance from sink
                if (minSink > 0) {
                    const ds = Phaser.Math.Distance.Between(p.x, p.y, scene.sinkPosition.x, scene.sinkPosition.y);
                    if (ds < (minSink + newR)) continue;
                }

                // separation from existing germs
                if (sep > 0 && scene.germs.length) {
                    let ok = true;
                    for (let i = 0; i < scene.germs.length; i++) {
                        const g = scene.germs[i];
                        const need = (g.hitRadius ?? 0) + newR + sep;
                        if (Phaser.Math.Distance.Between(p.x, p.y, g.sprite.x, g.sprite.y) < need) { ok = false; break; }
                    }
                    if (!ok) continue;
                }

                pos = p; break;
            }

            if (!pos) {
                // last-chance: drop one somewhere near the top-right quadrant
                pos = { x: SS.width * 0.82, y: SS.height * 0.18 };
            }

            // ---- Word selection (robust) ----
            const word = pickWord(scene); // now guaranteed non-empty string

            addGerm(scene, pos, word);

            // ensure there is an active target
            if (!scene.typing?.activeId) typing.pickNearest(scene);
        },

    };

    // ---------------- movement ----------------
    const movement = {
        removeGermById(scene, id) {
            if (id == null) return;
            const i = scene.germs.findIndex(g => g?.id === id);
            if (i >= 0) removeGermByIndex(scene, i);
        },

        // move germs toward sink with small wobble and update their labels and effects
        moveGerms(scene, delta) {
            const base = SS.germBaseSpeed ?? 110;
            const rand = SS.germSpeedRand ?? 0;
            const speed = (base + (Math.random() * 2 - 1) * rand) * (delta / 1000);
            const wobble = SS.wobble ?? 0.06;
            const margin = SS.despawnMargin ?? 64;

            for (let i = scene.germs.length - 1; i >= 0; i--) {
                const g = scene.germs[i];
                const dx = scene.sinkPosition.x - g.sprite.x;
                const dy = scene.sinkPosition.y - g.sprite.y;
                const mag = Math.hypot(dx, dy) || 1;
                let ux = dx / mag, uy = dy / mag;

                // add tiny random offsets so paths are not perfectly straight
                ux += (Math.random() - 0.5) * wobble;
                uy += (Math.random() - 0.5) * wobble;
                const mm = Math.hypot(ux, uy) || 1; ux /= mm; uy /= mm;

                // move sprite
                g.sprite.x += ux * speed;
                g.sprite.y += uy * speed;

                // keep attached effects centered
                if (g._halo) g._halo.setPosition(g.sprite.x, g.sprite.y);
                if (g._add)  g._add.setPosition(g.sprite.x, g.sprite.y);

                // position labels just under the germ and re render target text
                g.labelTyped.setPosition(g.sprite.x, g.sprite.y + 14);
                g.labelRemain.setPosition(g.sprite.x, g.sprite.y + 14);
                typing.renderTarget(g, scene);

                // if a germ leaves the screen clean it up and retarget typing
                if (g.sprite.x > SS.width + margin || g.sprite.y > SS.height + margin) {
                    const wasActive = (scene.germs[i]?.id === scene.typing?.activeId);
                    removeGermByIndex(scene, i);
                    if (wasActive) { scene.typing.activeId = null; typing.pickNearest(scene); }
                }
            }
        }
    };

    // ---------------- rules ----------------
    const rules = {
        // check collision between each germ and the sink hit circle then update hud and state
        checkBreaches(scene) {
            const hit = scene.getSinkHitPoint();
            const rSink = scene.rSink ?? SS.rSink ?? Math.max(16, Math.round(SS.height * 0.06));
            const maxBreaches = SS.maxBreaches ?? SS.breachesAllowed ?? 5;
            const penalty = SS.breachPenalty ?? 100;

            for (let i = scene.germs.length - 1; i >= 0; i--) {
                const g = scene.germs[i];
                const d = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);
                const gR = g.hitRadius ?? Math.round(g.sprite.displayWidth * 0.30);

                if (d <= rSink + gR) {
                    const wasActive = (g.id === scene.typing?.activeId);
                    removeGermByIndex(scene, i);

                    scene.breaches++;
                    scene.hud?.setText(`Breaches: ${scene.breaches}/${maxBreaches}`);

                    if (typeof scene.setSoapSplashBackground === "function") {
                        scene.setSoapSplashBackground(scene.breaches);
                    }

                    if (wasActive) {
                        scene.typing.activeId = null;
                        if (scene.germs.length) typing.pickNearest(scene);
                    }

                    if (scene.streakSys) {
                        // Deduct from BASE so total recomputes with the (streak * 0.5) multiplier
                        // Flat penalty in TOTAL points (not scaled by multiplier)
                        const P = SS.breachPenalty ?? 100;
                        const m = scene.streakSys?.multiplier?.() ?? 1;
                        scene.streakSys.addBase(-(P / Math.max(1, m)));


                        // Sync legacy fields used by overlay & any other UI
                        scene.typing.score = scene.streakSys.totalScore;
                        scene.typing.streak = scene.streakSys.streak;
                        scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.streakSys.bestStreak);

                        // Refresh HUD so the penalty is visible immediately
                        soapsplash.typing.updateHud(scene);
                    }

                    if (scene.breaches >= maxBreaches) timer.endGame(scene, "Too many breaches");
                }
            }
        }
    };


    // ---------------- timer ----------------
    const timer = {
        // create hud and schedule round end
        init(scene) {
            // scene.gameOver = false;
            // scene.timerHud = scene.add.text(
            //     SS.width - 140, 15,
            //     "Time: " + SS.gameDurationTextHud,
            //     { fontFamily: SS.fontFamily, fontSize: "16px", color: "#fff" }
            // ).setDepth(10);

            scene.endEvent = scene.time.delayedCall(
                SS.gameDurationMin * 60 * 1000,
                () => timer.endGame(scene, "Time up")
            );
        },
        // update remaining time label every frame from start time
        // update remaining time label every frame from start time
        updateHUD(scene, now) {
            if (!scene?.gameStartAt) return;
            const hud = scene?.timerHud;
            if (!hud || !hud.active || !hud.scene?.sys?.isActive()) return;
            try {
                const remaining = Math.max(0, (SS.gameDurationMin * 60 * 1000) - (now - scene.gameStartAt));
                hud.setText(`Time: ${helpers.mmss(remaining)}`);
            } catch (_) {
                // ignore one-frame teardown races
            }
        },


        endGame(scene, reason = SS.reason || "Game over") {
            if (scene.gameOver) return;
            scene.gameOver = true;

            // Remove all germs
            for (let i = scene.germs.length - 1; i >= 0; i--) { removeGermByIndex(scene, i); }

            // Finalize timer + score
            const score = scene.streakSys ? scene.streakSys.totalScore : 0;
            const bestStreak = scene.streakSys ? scene.streakSys.bestStreak : 0;

            // scene.timerHud?.setText("Time: 00:00");
            scene.endEvent?.remove(false);

            if (typeof scene.finalizeRound === "function") {
                scene.finalizeRound(reason);
            }

            // --- Dialog (same style as Clean Catch) ---
            const { width, height } = scene.scale;

            // Optional background image behind dialog
            if (scene.textures.exists("ss_end_bg")) {
                scene.add.image(0, 0, "ss_end_bg")
                    .setOrigin(0, 0)
                    .setDisplaySize(width, height)
                    .setDepth(9997);
            }

            const dialogRoot = scene.add.container(0, 0).setDepth(9999);

            // Dim overlay (clickable, but not needed to intercept)
            const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.35)
                .setOrigin(0, 0)
                .setInteractive();
            dialogRoot.add(overlay);

            // Panel (image skin or fallback rectangle)
            const hasSkin = scene.textures.exists("dialog_skin");
            const skinImg = hasSkin
                ? scene.textures.get("dialog_skin").getSourceImage()
                : { width: 1200, height: 800 };

            const baseS = Math.min((width * 0.82) / skinImg.width, (height * 0.62) / skinImg.height);
            const s = baseS * 0.9;

            const panel = hasSkin
                ? scene.add.image(width / 2, height / 2, "dialog_skin").setScale(s)
                : scene.add
                    .rectangle(width / 2, height / 2,
                        Math.min(width * 0.75, 740),
                        Math.min(height * 0.55, 460),
                        0xffffff, 1)
                    .setStrokeStyle(4, 0x9edcff);
            dialogRoot.add(panel);

            const panelW = (panel.displayWidth || skinImg.width * s);
            const panelH = (panel.displayHeight || skinImg.height * s);

            // Kiko on the left
            if (scene.textures.exists("kiko_dialog")) {
                const KIKO_X = 175;
                const KIKO_BOTTOMY = panel.y + panelH / 2.88;
                const KIKO_HEIGHT = Math.min(panelH * 2, 450);
                const kiko = scene.add.image(KIKO_X, KIKO_BOTTOMY, "kiko_dialog")
                    .setOrigin(0.5, 1)
                    .setScale(KIKO_HEIGHT / scene.textures.get("kiko_dialog").getSourceImage().height);
                dialogRoot.add(kiko);
            }

            const uiFont = "Chewy";
            const uiFontBody = "Montserrat";

            // Title
            const title = scene.add.text(panel.x, panel.y - panelH * 0.28, "GAME OVER", {
                fontFamily: uiFont,
                color: "#000000"
            }).setOrigin(0.5);
            title.setFontSize(Math.max(45, Math.round(44 * s)));
            dialogRoot.add(title);

            // Score + Best Streak
            const scoreText = scene.add.text(panel.x, panel.y - panelH * 0.09,
                `Score: ${score}\nBest Streak: ${bestStreak}`, {
                    fontFamily: uiFontBody,
                    color: "#2a4155",
                    align: "center"
                }).setOrigin(0.5);
            scoreText.setFontSize(Math.max(30, Math.round(26 * s)));
            dialogRoot.add(scoreText);

            // Pick result message by score
            const hiMsgs = [
                "Wow! You typed so many words correctly — the germs don’t stand a chance!",
                "You are a champion!"
            ];
            const loMsgs = [
                "The germs were hard to scrub off this time. But with more practice, you’ll be even stronger!",
                "Next time, you’ll do even better!"
            ];
            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
            const resultMsg = (score >= 80) ? pick(hiMsgs) : pick(loMsgs);

            const msgText = scene.add.text(panel.x, panel.y + panelH * 0.10, resultMsg, {
                fontFamily: uiFontBody,
                color: "#2a4155",
                align: "center",
                wordWrap: { width: panelW * 0.90 }
            }).setOrigin(0.5);
            msgText.setFontSize(Math.max(30, Math.round(22 * s)));
            dialogRoot.add(msgText);

            // Continue button → back to Bathroom (skipIntro so soap step is active)
            const BTN_W = Math.min(panelW * 0.38, 320);
            const BTN_H = 64;
            const btnY = panel.y + panelH * 0.28;

            const btn = scene.add.rectangle(panel.x, btnY, BTN_W, BTN_H, 0x2ecc71, 1)
                .setOrigin(0.5)
                .setStrokeStyle(3, 0x1b8f52)
                .setInteractive({ useHandCursor: true });
            dialogRoot.add(btn);

            const btnLabel = scene.add.text(panel.x, btnY, "Continue", {
                fontFamily: uiFont,
                color: "#ffffff",
                fontStyle: "bold"
            }).setOrigin(0.5);
            btnLabel.setFontSize(Math.max(26, Math.round(26 * s)));
            dialogRoot.add(btnLabel);

            scene.tweens.add({
                targets: btn,
                scaleX: { from: 1.0, to: 1.03 },
                scaleY: { from: 1.0, to: 1.03 },
                duration: 900,
                ease: "Sine.inOut",
                yoyo: true,
                repeat: -1
            });

            // Save Soap Splash score for leaderboard
            const finalScore = scene.streakSys ? scene.streakSys.totalScore : 0;
            scene.registry.set("ss_score", finalScore);
            window.__SS_LAST_SCORE__ = { total: finalScore };
            localStorage.setItem("ss_score", finalScore);


            const goBack = () => {
                // ✅ Persist Soap Splash score
                try {
                    const finalScore = scene.streakSys ? scene.streakSys.totalScore : 0;
                    window.__SS_LAST_SCORE__ = { total: finalScore };
                    localStorage.setItem("ss_score", finalScore);
                    scene.game.registry.set("ss_score", finalScore);
                    console.log("[SoapSplash] Saved score:", finalScore);
                } catch (err) {
                    console.warn("Failed to save Soap Splash score", err);
                }

                try {
                    AudioManager.stopGroup?.("game");
                    AudioManager.resumeGroup?.("global");
                } catch {}
                dialogRoot.destroy(true);
                scene.scene.start("HandwashAnimationScene", { skipIntro: true });
            };

            btn.on("pointerup", goBack);
            btnLabel.setInteractive({ useHandCursor: true }).on("pointerup", goBack);
        },

    };



    const typing = {
        // initialize typing state create measurement helper and keyboard handler
        init(scene) {
            scene.typing = {
                activeId: null, keystrokes: 0, mistakes: 0, startedAt: null, locked: false,
                // legacy mirrors kept for back-compat (UI must NOT read these)
                score: 0, streak: 0, bestStreak: 0,
                wordClean: true, wordsCompleted: 0,
                streakPops: 0,
            };

            // attach reusable streak/score engine
            // Spec note (matches code): totalScore = baseScore * (1 + 0.5 * streak)
            scene.streakSys = streakScore.create();

            // --- one place to mirror legacy fields (write-through only) ---
            scene.typing.syncLegacy = () => {
                const s = scene.streakSys;
                if (!s) return;
                scene.typing.score      = s.totalScore;
                scene.typing.streak     = s.streak;
                scene.typing.bestStreak = s.bestStreak; // s.bestStreak already tracks the max
            };

            // hidden text for measuring caret etc (unchanged)
            scene.typing._measure = scene.add.text(-9999, -9999, "", {
                fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
            }).setVisible(false);

            scene.typing.measureChar = (ch) => {
                const sizeNum = typeof SS.labelTextSize === "string"
                    ? parseInt(SS.labelTextSize, 10)
                    : (SS.labelTextSize || 30);
                const s = ch && ch.length ? ch : " ";
                scene.typing._measure.setText(s);
                const b = scene.typing._measure.getTextBounds?.();
                return (b && b.local && b.local.width) ? b.local.width : (0.6 * sizeNum);
            };

            scene.input.keyboard.on("keydown", (e) => typing.onKey(e, scene));
        },

        // clear highlights and caret for all germs
        deactivateAll(scene) {
            for (const g of scene.germs) {
                g.active = false;
                if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
                if (g.curBox) { scene.tweens.killTweensOf(g.curBox); g.curBox.setVisible(false); }
                if (g._add)   { scene.tweens.killTweensOf(g._add);   g._add.setAlpha(0); }
                if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }
                g.sprite.clearTint();
                g.labelTyped.setAlpha(0.7);
                g.labelRemain.setAlpha(1);
            }
        },

        // activate a target germ add glow additive sprite and caret pulse
        activate(scene, g) {
            typing.deactivateAll(scene);
            if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
            if (g._halo) { scene.tweens.killTweensOf(g._halo); g._halo.destroy(); g._halo = null; }
            if (g._add)  { scene.tweens.killTweensOf(g._add);  g._add.destroy();  g._add  = null; }
            if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }

            const F = CONFIG.soapSplash?.focus ?? {};
            g.active = true;
            g.sprite.clearTint();

            // start each NEW word as “clean”
            scene.typing.wordClean = true;

            // soft outer glow…
            if (F.useGlow && g.sprite?.postFX?.addGlow) {
                const baseOuter = (F.glowOuter ?? 6);
                g._glow = g.sprite.postFX.addGlow(
                    F.glowColor ?? 0xffffff,
                    baseOuter,
                    F.glowInner ?? 1,
                    F.glowKnockout ?? false
                );
                if (g._glow) {
                    scene.tweens.add({
                        targets: g._glow,
                        outerStrength: { from: baseOuter * 0.7, to: baseOuter * 1.2 },
                        duration: F.glowPulseMs ?? 1100,
                        ease: "Sine.inOut",
                        yoyo: true,
                        repeat: -1
                    });
                }
            }

            // additive duplicate sprite…
            if (F.additiveSprite !== false) {
                const baseAlpha = F.addAlpha ?? 0.18;
                const addScale  = F.addScale ?? 1.10;
                g._add = scene.add.image(g.sprite.x, g.sprite.y, g.sprite.texture.key, g.sprite.frame.name)
                    .setOrigin(0.5)
                    .setScale(g.sprite.scaleX * addScale, g.sprite.scaleY * addScale)
                    .setTint(F.addColor ?? 0xffffff)
                    .setAlpha(baseAlpha * 0.8)
                    .setBlendMode(Phaser.BlendModes.ADD)
                    .setDepth(g.sprite.depth - 1);

                scene.tweens.add({
                    targets: g._add,
                    alpha:  { from: baseAlpha * 0.6, to: baseAlpha },
                    scaleX: g._add.scaleX * 1.02,
                    scaleY: g._add.scaleY * 1.02,
                    duration: F.addPulseMs ?? 1100,
                    ease: "Sine.inOut",
                    yoyo: true,
                    repeat: -1
                });
            }

            // show caret underline…
            if (g.curBox) {
                g.curBox.setVisible(true);
                scene.tweens.add({ targets: g.curBox, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });
            }

            scene.typing.activeId = g.id;
            typing.renderTarget(g, scene);
        },

        pickRandom(scene) {
            if (!scene.germs.length) { scene.typing.activeId = null; return; }
            const idx = Math.floor(Math.random() * scene.germs.length);
            typing.activate(scene, scene.germs[idx]);
        },
        pickNearest(scene) {
            if (!scene.germs.length) { scene.typing.activeId = null; return; }
            const cand = scene.germs;
            if (!cand.length) { scene.typing.activeId = null; return; }
            const hit = scene.getSinkHitPoint();
            let best = null, bestDist = Infinity;
            for (const g of cand) {
                const d = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);
                if (d < bestDist) { bestDist = d; best = g; }
            }
            if (best) typing.activate(scene, best);
        },

        // lay out typed and remaining strings and position caret box
        renderTarget(g, scene) {
            const sc = scene || g.labelTyped?.scene || g.labelRemain?.scene;

            const baseY = g.sprite.y + SS.verticalSpaceLabel;
            const theWord   = g.word || "";
            const typedStr  = theWord.slice(0, g.typedIdx);
            const remainStr = theWord.slice(g.typedIdx);

            g.labelTyped.setText(typedStr);
            g.labelRemain.setText(remainStr);

            // hide caret once fully typed
            if (g.typedIdx >= theWord.length) {
                if (g.curBox) {
                    if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
                    g.curBox.setVisible(false);
                }
                return;
            }

            const typedW  = g.labelTyped.displayWidth;
            const remainW = g.labelRemain.displayWidth;
            const totalW  = typedW + remainW;
            const leftX   = g.sprite.x - totalW / 2;

            g.labelTyped.setOrigin(0, 0).setPosition(leftX, baseY);
            g.labelRemain.setOrigin(0, 0).setPosition(leftX + typedW, baseY);

            const isActive = !!(sc?.typing?.activeId === g.id && g.active);
            if (!g.curBox) return;

            const sizeNum = (typeof SS.labelTextSize === "string") ? parseInt(SS.labelTextSize, 10) : (SS.labelTextSize || 30);
            const nextCh  = g.word[g.typedIdx] || " ";
            const cw      = (sc?.typing?.measureChar) ? sc.typing.measureChar(nextCh) : 0.6 * sizeNum;
            const underlineY = baseY + sizeNum + 2;

            if (!isActive) {
                if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
                g.curBox.setVisible(false);
                return;
            }

            g.curBox
                .setVisible(true)
                .setPosition(leftX + typedW, underlineY)
                .setSize(Math.max(6, cw), 3)
                .setAlpha(0.85);

            if (!g._caretPulse && sc?.tweens) {
                g._caretPulse = sc.tweens.add({
                    targets: g.curBox,
                    alpha: { from: 0.55, to: 0.95 },
                    duration: 700,
                    ease: "Sine.inOut",
                    yoyo: true,
                    repeat: -1
                });
            }
        },

        // key handling for typing game including backspace correct and incorrect letters
        onKey(e, scene) {
            if (scene.gameOver || scene._paused) return;
            if (!scene.typing.startedAt) scene.typing.startedAt = scene.time.now;

            if (!scene.typing.activeId) typing.pickNearest(scene);

            // self-heal stale/removed target
            let g = scene.germs.find(x => x.id === scene.typing.activeId);
            if (!g) {
                scene.typing.activeId = null;
                typing.pickNearest(scene);
                g = scene.germs.find(x => x.id === scene.typing.activeId);
                if (!g) return; // nothing to type yet
            }

            const key = e.key;

            // handle backspace (no engine change)
            if (key === "Backspace") {
                if (g.typedIdx > 0) g.typedIdx--;
                typing.renderTarget(g, scene);
                typing.updateHud(scene);
                e.preventDefault();
                return;
            }

            // ignore non-printable
            if (key.length !== 1) return;

            // prevent accidental browser actions
            e.preventDefault();

            scene.typing.keystrokes++;
            const ch = key;
            const expected = g.word[g.typedIdx];
            if (!expected) return;

            if (ch.toLowerCase() === expected.toLowerCase()) {
                // clamp so we never overshoot
                g.typedIdx = Math.min(g.typedIdx + 1, g.word.length);

                // reset error tint once user gets back on track
                const C = CONFIG.soapSplash.colors || {};
                g.labelRemain.setColor(C.remain ?? "#000000");
                g.labelTyped.setColor(C.typed ?? "#000000");

                typing.renderTarget(g, scene);

                // if complete, score immediately
                if (g.typedIdx >= g.word.length) {
                    const perWord   = (CONFIG.soapSplash?.pointsPerWord ?? 10);
                    const perLetter = (CONFIG.soapSplash?.pointsPerLetter ?? 1);
                    const addBase   = perWord + perLetter * (g.word?.length || 0);

                    if (scene.streakSys) {
                        scene.streakSys.addBase(addBase);
                        scene.streakSys.onWord(!!scene.typing.wordClean);
                        scene.typing.syncLegacy?.();
                    }

                    // small “+N” popup
                    try { systems.helpers.streakPopup?.(scene, addBase, g.sprite.x, g.sprite.y - 28); } catch {}

                    // telemetry (generic; keep soapsplash.* if you actually implement it)
                    try { systems.telemetry?.onWordComplete?.(scene, g, !!scene.typing.wordClean); } catch {}


                    // remove the germ
                    if (systems?.soapsplash?.movement?.removeGermById && g?.id != null) {
                        systems.soapsplash.movement.removeGermById(scene, g.id);
                    } else if (systems?.soapsplash?.movement?.removeGermByIndex) {
                        const i = scene.germs.indexOf(g);
                        if (i >= 0) systems.soapsplash.movement.removeGermByIndex(scene, i);
                    } else {
                        try { g.labelTyped?.destroy(); g.labelRemain?.destroy(); g.sprite?.destroy(); } catch {}
                        const i2 = scene.germs.indexOf(g);
                        if (i2 >= 0) scene.germs.splice(i2, 1);
                    }

                    // next target starts clean
                    scene.typing.activeId = null;
                    scene.typing.wordClean = true;

                    // pick a new target if any remain
                    if (scene.germs.length) typing.pickNearest(scene);

                    typing.updateHud(scene);
                    return;
                }
            } else {
                // wrong character
                g.errors++;
                scene.typing.mistakes++;
                scene.typing.wordClean = false; // this word is no longer “clean”

                const C = CONFIG.soapSplash.colors || {};
                g.labelRemain.setColor(C.errorRemain ?? C.error ?? "#bb2222");
                g.labelTyped.setColor(C.errorTyped ?? g.labelTyped.style.color);

                // shake feedback
                scene.tweens.add({ targets: g.labelRemain, x: g.labelRemain.x + 4, duration: 40, yoyo: true, repeat: 2 });

                // Streak policy (intended): Any keystroke error instantly resets streak.
                if (scene.streakSys) {
                    scene.streakSys.onMistake();
                    scene.typing.syncLegacy?.();
                }

                typing.renderTarget(g, scene);
            }

            typing.updateHud(scene);
        },

        // NOTE: legacy convenience for callers that auto-finish a word
        onWordComplete(scene, g) {
            try {
                const perWord   = (CONFIG.soapSplash?.pointsPerWord ?? 10);
                const perLetter = (CONFIG.soapSplash?.pointsPerLetter ?? 1);
                const addBase   = perWord + perLetter * (g?.word?.length || 0);

                scene.streakSys?.addBase?.(addBase);
                scene.streakSys?.onWord?.(!!scene.typing.wordClean);
                scene.typing.syncLegacy?.();

                try { systems?.helpers?.streakPopup?.(scene, addBase, g?.sprite?.x ?? 0, (g?.sprite?.y ?? 0) - 28); } catch {}
                try { systems?.telemetry?.onWordComplete?.(scene, g, !!scene.typing.wordClean); } catch {}


                if (systems?.soapsplash?.movement?.removeGermById && g?.id != null) {
                    systems.soapsplash.movement.removeGermById(scene, g.id);
                } else {
                    const idx = scene.germs.indexOf(g);
                    if (idx >= 0 && systems?.soapsplash?.movement?.removeGermByIndex) {
                        systems.soapsplash.movement.removeGermByIndex(scene, idx);
                    } else {
                        try { g.labelTyped?.destroy(); g.labelRemain?.destroy(); g.sprite?.destroy(); } catch {}
                        const i2 = scene.germs.indexOf(g);
                        if (i2 >= 0) scene.germs.splice(i2, 1);
                    }
                }
            } finally {
                scene.typing.wordClean = true;
                try { systems?.soapsplash?.typing?.updateHud?.(scene); } catch {}
                if (scene.germs.length) {
                    systems?.soapsplash?.typing?.pickNearest?.(scene);
                } else {
                    scene.typing.activeId = null;
                }
            }
        },

        // refresh the score and streak hud text
        updateHud(scene) {
            // UI must read from streakSys only (no legacy fallbacks)
            const base  = scene.streakSys?.baseScore ?? 0;
            const mult  = scene.streakSys?.multiplier?.() ?? 1.0; // fallback fixed
            const total = scene.streakSys?.totalScore ?? 0;
            const s     = scene.streakSys?.streak ?? 0;

            // Show a single multiply symbol (no “× x” duplication)
            scene.typeHud?.setText(
                `Score: ${total}  (base ${base} × ${mult.toFixed(1)})   Streak: ${s}`
            );
        },
    };




    // expose all namespaces to scenes through systems so they can call systems.soapsplash.whatever
    return { spawn, movement, rules, timer, typing };
})();

// -----------------------------
// clean catch engine
// returns an object with destroy and setPaused so the scene can control it
// -----------------------------
const cleancatcher = {
    create(scene, canvas, difficulty = "easy") {
        //difficulty levels
        if (difficulty === 1) difficulty = "easy";
        else if (difficulty === 2) difficulty = "normal";
        else if (difficulty === 3) difficulty = "hard";
        else difficulty = String(difficulty).toLowerCase();

        const CC = CONFIG.cleanCatch;
        const ctx = canvas.getContext("2d");
        //toast system for dialogue
        let activeToasts = [];
        const kikoCheer = new Image();
        kikoCheer.src = CONFIG.assets.kiko?.cheer || "assets/images/Kiko/WashEd_kiko_sprite_cheer.png";
        const kikoSad = new Image();
        kikoSad.src = CONFIG.assets.kiko?.sad || "assets/images/Kiko/WashEd_kiko_sprite_sad.png";

        ctx.imageSmoothingEnabled = true;

        // images and word lists
        const A = CONFIG.assets.cleanCatch || {};
        const background = new Image();
        background.src = A.background || "";
        const germImg = new Image();
        germImg.src = A.germ || "";
        const waterImg = new Image();
        waterImg.src = A.waterDroplet || "";
        const soapImg = new Image();
        soapImg.src = A.soap || "";
        const backgroundFullLives = new Image();
        backgroundFullLives.src = A.backgroundFullLives || "";
        const backgroundTwoLives = new Image();
        backgroundTwoLives.src = A.backgroundTwoLives || "";
        const backgroundOneLife = new Image();
        backgroundOneLife.src = A.backgroundOneLife || "";
        const backgroundNoLife = new Image();
        backgroundNoLife.src = A.backgroundNoLife || "";

        //count for water/soap catched for dialogues
        let goodCatchCount = 0;

        //  Sound Effects Setup
        let catchGoodSound = null;
        let catchBadSound = null;
        let timerBeepSound = null;

        // Initialise Phaser sounds if available
        if (scene.sound) {
            catchGoodSound = scene.sound.add("sfx_goodCatch", { volume: 0.5 });
            catchBadSound = scene.sound.add("sfx_badCatch", { volume: 0.5 });
            timerBeepSound = scene.sound.add("sfx_beep", { volume: 0.7 });
        } else {
            console.warn("[CleanCatch] No Phaser sound system found — skipping sound effects.");
        }



        const goodMessages = [
            "Nice work!",
            "Good catch!",
            "We love clean water!",
            "We love soap!",
            "Keep going!",
            "Great job!"
        ];

        const badMessages = [
            "That’s a germ!",
            "Oops, not that one!",
            "Be careful! We don't want your hands to get more dirty!",
            "Yikes, dirty water!",
            "Watch out for those germs!"
        ];

        // --- Kiko Toast Builder ---
        function makeToast(mood, text, ttl = 1800) {
            activeToasts.push({
                mood,
                text,
                createdAt: performance.now(),
                ttl
            });
        }


        // current message to display and timer
        let currentMessage = "";       // the text to show
        let messageTimer = 0;          // countdown for how long to display
        let endDialogShown = false;
        const messageDuration = 60;    // frames (about 1 sec at 60fps)


        const goodWords = helpers.words.cleanGood();
        const badWords = helpers.words.cleanBad();

        // helpers for sizing images with aspect ratio and constraints
        function aspect(img) {
            const w = img.naturalWidth || 0, h = img.naturalHeight || 0;
            return {w, h, r: (w && h) ? w / h : 1};
        }

        function sizeFrom(img, opts = {}, defaultSquare = 120) {
            const {w: iw, h: ih, r} = aspect(img);
            const fallback = opts.fallbackSize ?? defaultSquare;


            if (opts.width != null && opts.height != null) {
                let W = opts.width, H = opts.height;
                if (opts.maxPixels) {
                    const k = Math.min(opts.maxPixels / W, opts.maxPixels / H, 1);
                    W = Math.round(W * k);
                    H = Math.round(H * k);
                }
                return {w: W, h: H};
            }
            if (opts.width != null) return {w: opts.width, h: Math.round(opts.width / (r || 1))};
            if (opts.height != null) return {w: Math.round(opts.height * (r || 1)), h: opts.height};

            if (opts.scale != null && iw > 0 && ih > 0) {
                let W = Math.max(1, Math.round(iw * opts.scale));
                let H = Math.max(1, Math.round(ih * opts.scale));
                if (opts.maxPixels) {
                    const k = Math.min(opts.maxPixels / W, opts.maxPixels / H, 1);
                    W = Math.round(W * k);
                    H = Math.round(H * k);
                }
                return {w: W, h: H};
            }
            return {w: fallback, h: fallback};
        }

        // build player state and apply image sizing
        const P = CC.player || {};
        const playerImg = new Image();
        playerImg.src = (A.player || "");

        let pSize = sizeFrom(playerImg, P, 450);
        const player = {
            x: (canvas.width - pSize.w) / 2,
            y: canvas.height - (P.bottom ?? 30) - pSize.h,
            width: pSize.w,
            height: pSize.h,
            dx: 0
        };

        // when the player image finishes loading recompute size and keep player inside bounds
        playerImg.onload = () => {
            pSize = sizeFrom(playerImg, P, 450);
            const baseline = canvas.height - (P.bottom ?? 30);
            player.width = pSize.w;
            player.height = pSize.h;
            player.x = helpers.clamp(player.x, 0, canvas.width - player.width);
            player.y = baseline - player.height;
        };

        // falling items list and game stats
        let items = [];
        let score = 0, lives = 3, timeLeft = 30, gameOver = false;


        // difficulty adjustments
        let spawnRate = 1000;
        let baseSpeed = 2;
        let goodProb = 0.6;
        if (difficulty === "normal") {
            spawnRate = 700;
            baseSpeed = 3;
            goodProb = 0.4;
        }
        // hard uses same as easy, but no images drawn

        // spawn either water or germ with a label and speed
        function spawnItem() {
            const isGood = Math.random() < goodProb;
            const word = isGood ? helpers.words.pick(goodWords) : helpers.words.pick(badWords);

            let w, h, img;

            if (isGood) {
                // randomly pick water or soap
                img = Math.random() > 0.5 ? waterImg : soapImg;

                if (img === soapImg) {
                    // soap
                    const gSize = sizeFrom(img, { width: 85, height: 85 });
                    w = gSize.w;
                    h = gSize.h;
                } else {
                    // water
                    const gSize = sizeFrom(img, { width: 95, height: 95 });
                    w = gSize.w;
                    h = gSize.h;
                }

            } else {
                // germs normal size
                img = germImg;
                const gSize = sizeFrom(germImg, CC.germ || {}, 125);
                w = gSize.w;
                h = gSize.h;
            }

            items.push({
                x: Math.random() * Math.max(1, canvas.width - w),
                y: 0,
                width: w,
                height: h,
                type: isGood ? "good" : "bad",
                word,
                img,
                speed: baseSpeed + Math.random() * baseSpeed
            });
        }

        // draw player sprite or a rectangle fallback
        function drawPlayer() {
            if (playerImg.complete && playerImg.naturalWidth) {
                ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
            } else {
                ctx.fillStyle = "blue";
                ctx.fillRect(player.x, player.y, player.width, player.height);
            }
        }


        // draw all items with labels, hard no img
        function drawItems() {
            for (const item of items) {
                // If not hard mode, draw the item image (water/soap/germ)
                if (difficulty !== "hard") {
                    let img;

                    if (item.type === "good") {
                        // randomly pick between water or soap
                        img = item.img || (Math.random() > 0.5 ? waterImg : soapImg);
                    } else {
                        img = germImg;
                    }

                    if (img && img.complete && img.naturalWidth) {
                        ctx.drawImage(img, item.x, item.y, item.width, item.height);
                    } else {
                        // fallback shape if image missing
                        if (item.type === "good") {
                            ctx.fillStyle = "aqua";
                            ctx.beginPath();
                            ctx.moveTo(item.x + item.width / 2, item.y);
                            ctx.bezierCurveTo(
                                item.x + item.width * 1.0, item.y + item.height * 0.8,
                                item.x + item.width * 0.8, item.y + item.height,
                                item.x + item.width / 2, item.y + item.height
                            );
                            ctx.bezierCurveTo(
                                item.x + item.width * 0.2, item.y + item.height,
                                item.x, item.y + item.height * 0.8,
                                item.x + item.width / 2, item.y
                            );
                            ctx.closePath();
                            ctx.fill();
                        } else {
                            ctx.fillStyle = "red";
                            ctx.fillRect(item.x, item.y, item.width, item.height);
                        }
                    }
                }

                // Draw the label (text)
                ctx.fillStyle = "black";
                ctx.font = "50px Chewy";
                ctx.textAlign = "center";

                if (difficulty === "hard") {
                    // Only text centered — no images
                    ctx.fillText(item.word, item.x + item.width / 2, item.y + item.height / 2 + 8);
                } else {
                    // Text below the image
                    ctx.fillText(item.word, item.x + item.width / 2, item.y + item.height + 24);
                }
            }
        }

        //better time display - 5 seconds turns red
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, "0");
            const s = (seconds % 60).toString().padStart(2, "0");
            return `${s}`;}

        // draw score and timer
        function drawUI() {
            // SCORE
            ctx.fillStyle = "black";
            ctx.font = "50px Chewy";
            ctx.textAlign = "left";
            const scoreText = score.toString().padStart(2, "0");
            ctx.fillText(scoreText, 85, 95);

            // TIMER //
            const timerText = formatTime(timeLeft);
            ctx.font = "52px Chewy";
            ctx.textAlign = "center";

            // Turn red when timer hits 5 or less
            if (timeLeft <= 5) {
                ctx.fillStyle = "#ff0000"; // bright red
            } else {
                ctx.fillStyle = "white";   // normal color
            }

            ctx.fillText(timerText, canvas.width / 2, 105);


            //NEW kiko dialogue - change this for changing size
            for (let i = activeToasts.length - 1; i >= 0; i--) {
                const t = activeToasts[i];
                const age = performance.now() - t.createdAt;
                const p = age / t.ttl;

                if (p >= 1) {
                    activeToasts.splice(i, 1);
                    continue;
                }

                const alpha = p < 0.1 ? p / 0.1 : (p > 0.9 ? (1 - p) / 0.1 : 1);
                const bounce = 1 + 0.05 * Math.sin(p * Math.PI);
                const x = canvas.width - 100;
                const y = canvas.height - 100 - i * 160;

                ctx.save();
                ctx.globalAlpha = alpha;
                // scale around the toast's anchor (x, y) instead of the top-left (0,0)
                ctx.translate(x, y);
                ctx.scale(bounce, bounce);
                ctx.translate(-x, -y);

                // Kiko sprite — ~0.23 scale equivalent (~250–280 px tall)>
                const img = t.mood === "sad" ? kikoSad : kikoCheer;
                if (img && img.complete && img.naturalWidth > 0) {
                    const baseH = Math.min(280, Math.round(canvas.height * 0.28)); // responsive, capped
                    // target visual height
                    const aspect = img.naturalWidth / img.naturalHeight;
                    const baseW = baseH * aspect;
                    ctx.drawImage(img, x - baseW, y - baseH + 30, baseW, baseH);
                }

                // Text (Chewy, white with black stroke, right-aligned)
                ctx.font = "44px Chewy";
                ctx.textAlign = "right";
                ctx.lineWidth = 6;
                ctx.strokeStyle = "#000000";
                ctx.fillStyle = "#ffffff";
                ctx.shadowColor = "#00000000";
                ctx.shadowBlur = 8;
                ctx.strokeText(t.text, x - 80, y + 15);
                ctx.fillText(t.text, x - 80, y + 15);

                ctx.restore();
            }
        }

        // move items down, check collisions, update stats, remove offscreen
        function updateItems() {
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                item.y += item.speed;

                // check collision with player
                if (helpers.aabbIntersect(
                    item.x, item.y, item.width, item.height,
                    player.x, player.y, player.width, player.height
                )) {
                    if (item.type === "good") {
                        score += 10;
                        goodCatchCount++;
                        if (catchGoodSound) catchGoodSound.play();

                        if (goodCatchCount % 3 === 0) {
                            makeToast("happy", helpers.words.pick(goodMessages)); //  new toast
                        }
                    } else {
                        lives -= 1;
                        if (catchBadSound) catchBadSound.play();
                        makeToast("sad", helpers.words.pick(badMessages)); // new toast
                        if (lives <= 0) gameOver = true;
                    }


                    // remove the item from the array
                    items.splice(i, 1);
                    continue;
                }


                // remove items that fall off the screen
                if (item.y > canvas.height) items.splice(i, 1);
            }
        }

        // input events arrow keys and mouse move
        const onKeyDown = (e) => {
            if (e.key === "ArrowLeft") player.dx = -5;
            if (e.key === "ArrowRight") player.dx = 5;
        };
        const onKeyUp = (e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") player.dx = 0;
        };
        const onPointerMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;  // adjust for scaling of full screen
            const mouseX = (e.clientX - rect.left) * scaleX;
            player.x = helpers.clamp(mouseX - player.width / 2, 0, canvas.width - player.width);
        };
        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        canvas.addEventListener("pointermove", onPointerMove);

        // continuous player motion from key state
        function movePlayer() {
            player.x = helpers.clamp(player.x + player.dx, 0, canvas.width - player.width);
        }

        // main loop control flags and ids
        let paused = false;
        let rafId = null, moveInterval = null, spawnInterval = null, timerInterval = null;


        // animation frame loop draws background, player, items, UI, and updates items
        function frame() {
            if (paused) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // choose background based on current lives
            let targetBackground;
            if (lives >= 3 && backgroundFullLives.complete && backgroundFullLives.naturalWidth > 0) {
                targetBackground = backgroundFullLives;
            } else if (lives === 2 && backgroundTwoLives.complete && backgroundTwoLives.naturalWidth > 0) {
                targetBackground = backgroundTwoLives;
            } else if (lives === 1 && backgroundOneLife.complete && backgroundOneLife.naturalWidth > 0) {
                targetBackground = backgroundOneLife;
            } else {
                targetBackground = backgroundFullLives; // fallback
            }

            // smooth fade transition between backgrounds
            if (!frame.lastBackground) frame.lastBackground = targetBackground;
            if (frame.lastBackground !== targetBackground) {
                if (!frame.fadeStart) frame.fadeStart = performance.now();
            }

            const fadeDuration = 500; // ms
            let alpha = 1.0;
            if (frame.fadeStart) {
                const elapsed = performance.now() - frame.fadeStart;
                alpha = Math.min(elapsed / fadeDuration, 1.0);

                // draw previous background fading out
                if (frame.lastBackground && frame.lastBackground.naturalWidth) {
                    ctx.globalAlpha = 1 - alpha;
                    ctx.drawImage(frame.lastBackground, 0, 0, canvas.width, canvas.height);
                }

                // draw new background fading in
                if (targetBackground && targetBackground.naturalWidth) {
                    ctx.globalAlpha = alpha;
                    ctx.drawImage(targetBackground, 0, 0, canvas.width, canvas.height);
                }
                ctx.globalAlpha = 1.0;

                // transition finished
                if (alpha >= 1.0) {
                    frame.lastBackground = targetBackground;
                    frame.fadeStart = null;
                }
            } else {
                // draw static background normally
                if (targetBackground && targetBackground.naturalWidth) {
                    ctx.drawImage(targetBackground, 0, 0, canvas.width, canvas.height);
                } else {
                    ctx.fillStyle = "#add8e6";
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
            }

            if (gameOver) {
                if (!endDialogShown) {
                    endDialogShown = true;
                    stopLoops();                        // freeze gameplay loops

                    // hide the drawing canvas so the Phaser overlay is fully visible
                    canvas.style.display = "none";
                    canvas.style.pointerEvents = "none";

                    const { width, height } = scene.scale;

                    // optional: background behind the dialog (so it doesn't look black)
                    if (scene.textures.exists("cc_sink_bg")) {
                        scene.add.image(0, 0, "cc_sink_bg")
                            .setOrigin(0, 0)
                            .setDisplaySize(width, height)
                            .setDepth(9997);
                    }

                    // root container for everything in the dialog
                    const dialogRoot = scene.add.container(0, 0).setDepth(9999);

                    // dim overlay (clickable)
                    const overlay = scene.add
                        .rectangle(0, 0, width, height, 0x000000, 0.35)
                        .setOrigin(0, 0)
                        .setInteractive();
                    dialogRoot.add(overlay);

                    // panel skin (or simple rectangle fallback)
                    const hasSkin = scene.textures.exists("dialog_skin");
                    const skinImg = hasSkin
                        ? scene.textures.get("dialog_skin").getSourceImage()
                        : { width: 1200, height: 800 };

                    const baseS = Math.min((width * 0.82) / skinImg.width, (height * 0.62) / skinImg.height);
                    const s = baseS * 0.9;

                    const panel = hasSkin
                        ? scene.add.image(width / 2, height / 2, "dialog_skin").setScale(s)
                        : scene.add
                            .rectangle(width / 2, height / 2, Math.min(width * 0.75, 740), Math.min(height * 0.55, 460), 0xffffff, 1)
                            .setStrokeStyle(4, 0x9edcff);
                    dialogRoot.add(panel);

                    const panelW = (panel.displayWidth || skinImg.width * s);
                    const panelH = (panel.displayHeight || skinImg.height * s);

                    // Kiko! (left column inside panel)
                    if (scene.textures.exists("kiko_dialog")) {
                        // ---- tweak these three values to position/size Kiko ----
                        const KIKO_X = 175;                     // pixels from left edge of screen
                        const KIKO_BOTTOMY = panel.y + panelH / 2.88;    // bottom aligned with panel bottom
                        const KIKO_HEIGHT  = Math.min(panelH * 2, 450);  // on-screen height in pixels
                        // --------------------------------------------------------

                        const kiko = scene.add.image(KIKO_X, KIKO_BOTTOMY, "kiko_dialog")
                            .setOrigin(0.5, 1);                         // anchor at bottom-center

                        // scale by desired on-screen height
                        kiko.setScale(KIKO_HEIGHT / kiko.height);

                        dialogRoot.add(kiko);                         // keep it in the dialog container
                    }

                    const uiFont = "Chewy";
                    const uiFont_1 = "Montserrat"

                    // Title
                    const title = scene.add.text(panel.x, panel.y - panelH * 0.28, "GAME OVER!", {
                        fontFamily: uiFont,
                        color: "#000000",

                    }).setOrigin(0.5);
                    title.setFontSize(Math.max(45, Math.round(44 * s)));
                    // title.setFontStyle("bold");
                    dialogRoot.add(title);

                    // Score
                    const scoreText = scene.add.text(panel.x, panel.y - panelH * 0.09, `Score: ${score}`, {
                        fontFamily: uiFont_1,
                        color: "#2a4155",
                    }).setOrigin(0.5);
                    scoreText.setFontSize(Math.max(35, Math.round(30 * s)));
                    dialogRoot.add(scoreText);

                    /* === NEW: result message + green button === */

// pick a message based on score
                    const msgsGood = [
                        "Wow! You caught so much clean water — Great job!",
                        "You’re a Soap Splasher champion — Keep it up!",
                        "Yay! Look at that score — you did amazing!"
                    ];
                    const msgsTry = [
                        "Oh no, that was challenging. But don’t worry you can try again and do even better!",
                        "Next time, I know you’ll catch more clean water and soap bubbles!",
                        "Not your top score… but remember to keep trying your best. Let’s go!"
                    ];
                    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
                    const resultMsg = (score >= 80) ? pick(msgsGood) : pick(msgsTry);

// message under the score (inside the big dialog panel)
                    const msgText = scene.add.text(panel.x, panel.y + panelH * 0.10, resultMsg, {
                        fontFamily: uiFont_1,
                        color: "#2a4155",
                        align: "center",
                        wordWrap: { width: panelW * 0.90 }
                    }).setOrigin(0.5);
                    msgText.setFontSize(Math.max(30, Math.round(22 * s)));
                    dialogRoot.add(msgText);

// green "Continue" button → back to bathroom
                    const BTN_W = Math.min(panelW * 0.38, 320);
                    const BTN_H = 64;
                    const btnY  = panel.y + panelH * 0.28;

                    const btn = scene.add.rectangle(panel.x, btnY, BTN_W, BTN_H, 0x2ecc71, 1)
                        .setOrigin(0.5)
                        .setStrokeStyle(3, 0x1b8f52)
                        .setInteractive({ useHandCursor: true });
                    dialogRoot.add(btn);

                    const btnLabel = scene.add.text(panel.x, btnY, "Continue", {
                        fontFamily: uiFont,
                        color: "#ffffff",
                        fontStyle: "bold"
                    }).setOrigin(0.5);
                    btnLabel.setFontSize(Math.max(26, Math.round(26 * s)));
                    dialogRoot.add(btnLabel);

// hover/pulse
                    scene.tweens.add({
                        targets: btn,
                        scaleX: { from: 1.0, to: 1.03 },
                        scaleY: { from: 1.0, to: 1.03 },
                        duration: 900,
                        ease: "Sine.inOut",
                        yoyo: true,
                        repeat: -1
                    });

                    // Save Clean Catch score for leaderboard
                    scene.registry.set("cc_score", score);
                    window.__CLEAN_CATCH_SCORE__ = score;
                    localStorage.setItem("cc_score", score);


                    const goBack = () => {
                        // Persist Clean Catch score
                        try {
                            window.__CLEAN_CATCH_SCORE__ = score;
                            localStorage.setItem("cc_score", score);
                            scene.game.registry.set("cc_score", score);
                            console.log("[CleanCatch] Saved score:", score);
                        } catch (err) {
                            console.warn("Failed to save Clean Catch score", err);
                        }

                        dialogRoot.destroy(true);
                        scene.scene.start("SchoolBathroomScene", { skipIntro: true, showScrubDialog: true });
                    };

                    btn.on("pointerup", goBack);
                    btnLabel.setInteractive({ useHandCursor: true }).on("pointerup", goBack);


                }
                return;
            }

            drawPlayer();
            drawItems();
            drawUI();
            updateItems();

            rafId = requestAnimationFrame(frame);
        }

        // start all periodic loops: animation, item spawning, and timer countdown
        function startLoops() {
            // ensure no duplicate loops running
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(frame);

            // start continuous player movement (≈60fps)
            if (!moveInterval) moveInterval = setInterval(movePlayer, 16);

            // spawn new items periodically based on difficulty
            if (!spawnInterval) spawnInterval = setInterval(spawnItem, spawnRate);

            // countdown timer logic
            if (!timerInterval) timerInterval = setInterval(() => {
                if (!paused && !gameOver) {
                    timeLeft--;

                    // stop the game when time is up
                    if (timeLeft <= 0) {
                        gameOver = true;
                    }
                }
            }, 1000);
        }


        // stop every loop and clear ids
        function stopLoops() {
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            if (moveInterval) {
                clearInterval(moveInterval);
                moveInterval = null;
            }
            if (spawnInterval) {
                clearInterval(spawnInterval);
                spawnInterval = null;
            }
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }

        // allow external control of pause state from the phaser scene
        function setPaused(p) {
            p = !!p;
            if (paused === p) return;
            paused = p;
            if (paused) stopLoops(); else startLoops();
        }

        // cleanup when the scene leaves or dom is removed
        function destroy() {
            stopLoops();
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
            canvas.removeEventListener("pointermove", onPointerMove);
            catchGoodSound?.destroy();
            catchBadSound?.destroy();
            timerBeepSound?.destroy();

        }

        // kick off the game
        startLoops();

        // expose control surface to the owning scene
        return {destroy, setPaused};
    }
};

// -----------------------------
// simple menu builder for vertical stacks of buttons
// -----------------------------
const menu = {
    build(scene, spec) {
        const {width, height} = scene.scale;
        const gap = 96;
        const startY = height * 0.45;
        return spec.map((s, i) => {
            const y = startY + i * gap;
            return ui.button(scene, width / 2, y, s.label, s.onClick);
        });
    }
};

// -----------------------------
// public systems object
// scenes import this default to access helpers ui and game engines
// legacy aliases are included for convenience
// -----------------------------
const systems = {
    helpers, ui, soapsplash, cleancatcher, menu,
    spawn: soapsplash.spawn, movement: soapsplash.movement,
    rules: soapsplash.rules, timer: soapsplash.timer, typing: soapsplash.typing
};

export default systems;
