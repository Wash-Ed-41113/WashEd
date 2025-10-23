// this module collects all shared helpers ui widgets mini game engines and simple menus
// scenes import this module as systems to access these features
// everything below is inline documented so you can read top to bottom and understand the flow
import { DB } from "./db.js";

// short names for config sections used throughout
const SS = CONFIG.soapSplash;   // soap splash game config values
const CC = CONFIG.cleanCatch;   // clean catch game config values

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
    streakPopup(scene, value, x, y) {
        const t = scene.add.text(x, y, `+${value}`, {
            fontFamily: SS.fontFamily,
            fontSize: "22px",
            color: "#ffffff",
            fontStyle: "bold",
            backgroundColor: "#2aa84a",
            padding: { left: 10, right: 10, top: 6, bottom: 6 },
            align: "center"
        }).setOrigin(0.5).setDepth(200);

        t.setScale(0.9);
        scene.tweens.add({
            targets: t,
            y: y - 35,
            alpha: { from: 1, to: 0 },
            scale: { from: 0.95, to: 1.07 },
            duration: 750,
            ease: "Cubic.Out",
            onComplete: () => t.destroy()
        });
    },


};

const telemetry = {
    onWordComplete(scene, g, clean) {
        if (!scene.roundId) return;
        DB.logTyping(scene.roundId, "word_complete", {
            clean: clean ? 1 : 0,
            streak: scene.streakSys?.streak ?? 0,
            base_score: scene.streakSys?.baseScore ?? 0,
            total_score: scene.streakSys?.totalScore ?? 0,
            word: g?.word ?? null
        });
    },
    onMistake(scene) {
        if (!scene.roundId) return;
        DB.logTyping(scene.roundId, "mistake", {
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

    // top bar with optional home pause settings icons anchored to top right
    topbar(scene, { onHome, onPause, onSettings } = {}) {
        const T = CONFIG.ui.topbar;
        let x = scene.scale.width - T.padding;
        const y = T.padding + T.iconSize / 2;

        const make = (key, cb) => {
            x -= T.iconSize / 2;
            const img = scene.add.image(x, y, key).setOrigin(0.5)
                .setDisplaySize(T.iconSize, T.iconSize)
                .setDepth(200)
                .setScrollFactor(0)
                .setInteractive({ useHandCursor: true });
            if (cb) img.on("pointerup", cb);
            x -= T.iconSize + T.gap;
            return img;
        };

        const home = make("ui_home", onHome || null);
        const pause = make("ui_pause", onPause || null);
        const settings = make("ui_settings", onSettings || null);
        return { home, pause, settings };
    },

    // pause overlay with menu, resume, audio toggle, and live stats
    pauseOverlay(scene, { onResume, onHome } = {}) {
        const { width, height } = scene.scale;
        const P = CONFIG.ui.pauseOverlay;

        const overlay = scene.add.rectangle(0, 0, width, height, P.bgColor, P.bgAlpha)
            .setOrigin(0, 0).setDepth(999);

        const panelW = 780, panelH = 420;
        const panel = scene.add.rectangle(width / 2, height / 2, panelW, panelH, P.panelColor, 1)
            .setOrigin(0.5).setDepth(1000).setStrokeStyle(4, P.panelStroke);

        // Title
        const title = scene.add.text(width / 2, height / 2 - 150, "Paused", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: `${P.titleSize}px`,
            color: "#ffffff"
        }).setOrigin(0.5).setDepth(1001);

        // Live stats: score + streak (reads from streakSys if present)
        const base  = scene.streakSys?.baseScore ?? 0;
        const mult  = scene.streakSys?.multiplier?.() ?? 0;
        const total = scene.streakSys?.totalScore ?? scene.typing?.score ?? 0;
        const s     = scene.streakSys?.streak ?? scene.typing?.streak ?? 0;
        const best  = scene.streakSys?.bestStreak ?? scene.typing?.bestStreak ?? 0;

        const stats = scene.add.text(width / 2, height / 2 - 70,
            `Score: ${total}  (base ${base} × x${mult.toFixed(1)})\n` +
            `Streak: ${s}   Best: ${best}`,
            { fontFamily: CONFIG.ui.fontFamily, fontSize: "24px", color: "#ffffff", align: "center" }
        ).setOrigin(0.5).setDepth(1001);

        // Buttons (reuse your ui.button helper)
        const y0 = height / 2 + 10;
        const mkBtn = (label, y, cb) => {
            const { btn, txt } = ui.button(scene, width / 2, y, label, cb);
            btn.setDepth(1001); txt.setDepth(1001);
            return { btn, txt };
        };

        const resumeBtn = mkBtn("Resume", y0, () => onResume?.());
        const homeBtn   = mkBtn("Main Menu", y0 + 90, () => onHome?.());

        // Mute/Unmute toggle
        const isMuted = !!scene.sound?.mute;
        let audioLabel = scene.add.text(width / 2, y0 + 155, isMuted ? "Unmute" : "Mute", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: "22px", color: "#ffffff",
            backgroundColor: "#2d344f", padding: { left: 14, right: 14, top: 8, bottom: 8 }
        }).setOrigin(0.5).setDepth(1001).setInteractive({ useHandCursor: true });

        const toggleAudio = () => {
            if (scene.sound) {
                scene.sound.mute = !scene.sound.mute;
                // persist mute across scenes
                scene.registry.set("mute", scene.sound.mute);
                audioLabel.setText(scene.sound.mute ? "Unmute" : "Mute");
            }
        };

        audioLabel.on("pointerup", toggleAudio);

        return {
            destroy() {
                overlay.destroy(); panel.destroy(); title.destroy(); stats.destroy();
                resumeBtn.btn.destroy(); resumeBtn.txt.destroy();
                homeBtn.btn.destroy(); homeBtn.txt.destroy();
                audioLabel.destroy();
            }
        };
    },

    togglePause() {
        // flip paused state
        if (this._paused) {
            this._paused = false;

            // unpause SoapSplash timers/motion if you gate them elsewhere
            this._pauseUi?.destroy();
            this._pauseUi = null;
        } else {
            this._paused = true;

            // build the rich pause overlay from systems.js
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
                    // wrap up the round politely, then bounce to your hub/menu scene
                    this.finalizeRound?.("Paused → Main Menu");
                    const playerName = this.registry.get("playerName");
                    this.scene.start("GameScene", { playerName });
                }
            });
        }
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

            multiplier() { return this.streak * 0.5; },

            _recompute() {
                // spec: total = (streak * 0.5) * baseScore
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
        const g = scene.germs[i]; if (!g) return;

        if (g.curBox) { scene.tweens.killTweensOf(g.curBox); g.curBox.destroy(); g.curBox = null; }
        if (g._add)   { scene.tweens.killTweensOf(g._add);   g._add.destroy();   g._add  = null; }
        if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }
        if (g._hitCircle) { g._hitCircle.destroy(); g._hitCircle = null; }

        g.sprite.destroy();
        g.labelTyped.destroy();
        g.labelRemain.destroy();
        scene.germs.splice(i, 1);
    }

    // pick a word for a new germ
    // pick a word for a new germ (uses scene's sequential bag if available)
    function pickWord(scene) {
        const fn = CONFIG?.soapSplash?.nextWordFn;
        if (typeof fn === "function") return fn();                  // ← sequential, no repeats until cycle
        return Phaser.Utils.Array.GetRandom(CONFIG.soapSplash.words || []); // ← legacy fallback
    }


    // ---------------- spawn ----------------
    const spawn = {
        // attempt to spawn one germ in the corner ring with separation and min sink distance
        spawnGerm(scene) {
            if (scene.gameOver) return;

            const cap = SS.waveCap ?? SS.maxGerms ?? 5;
            if (scene.germs.length >= cap) return;

            const triesMax = SS.maxSpawnAttempts ?? 24;
            const sep = SS.minSpawnSeparationPx ?? 0;
            const minSink = SS.minSinkDistancePx ?? 0;

            // estimate hit radius of a new germ from texture size and sprite scale so spacing feels right
            const tex = scene.textures.get("Germ");
            const texW = tex?.getSourceImage()?.width || 64;
            const scaledW = (SS.germSpriteSize ?? 1) * texW;
            const newR = SS.germHitRadiusPx ?? Math.round(scaledW * (SS.germHitRadiusFromSprite ?? 0.35));

            let tries = triesMax;
            let pos = null;

            while (tries-- > 0) {
                // sample position in ring sector
                const theta = helpers.sampleAngle(scene.angleMinDeg, scene.angleMaxDeg);
                const r = helpers.sampleRadius(scene.rInner, scene.rOuter);
                const p = helpers.polarToWorld(scene.sinkPosition, r, theta);

                // enforce minimum distance from sink
                if (minSink > 0) {
                    const ds = Phaser.Math.Distance.Between(p.x, p.y, scene.sinkPosition.x, scene.sinkPosition.y);
                    if (ds < (minSink + newR)) continue;
                }

                // enforce separation from existing germs
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

            if (!pos) return;
            const word = pickWord(scene);
            addGerm(scene, pos, word);

            // ensure there is an active target
            if (!scene.typing?.activeId) typing.pickNearest(scene);
        },
    };

    // ---------------- movement ----------------
    const movement = {
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
                        scene.streakSys.addBase(-penalty);

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
            scene.gameOver = false;
            scene.timerHud = scene.add.text(
                SS.width - 140, 15,
                "Time: " + SS.gameDurationTextHud,
                { fontFamily: SS.fontFamily, fontSize: "16px", color: "#fff" }
            ).setDepth(10);

            scene.endEvent = scene.time.delayedCall(
                SS.gameDurationMin * 60 * 1000,
                () => timer.endGame(scene, "Time up")
            );
        },
        // update remaining time label every frame from start time
            updateHUD(scene, now) {
                if (scene.gameStartAt == null) return;
                if (!scene.timerHud) return;        // ← add this guard
                const remaining = Math.max(0, (SS.gameDurationMin * 60 * 1000) - (now - scene.gameStartAt));
                scene.timerHud.setText(`Time: ${helpers.mmss(remaining)}`);
            },

        endGame(scene, reason = SS.reason || "Game over") {
            if (scene.gameOver) return;
            scene.gameOver = true;

            // Remove all germs
            for (let i = scene.germs.length - 1; i >= 0; i--) { removeGermByIndex(scene, i); }

            // Finalize timer + score
            const score = scene.streakSys?.totalScore ?? scene.typing?.score ?? 0;
            const bestStreak = scene.streakSys?.bestStreak ?? scene.typing?.bestStreak ?? 0;
            scene.timerHud?.setText("Time: 00:00");
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
            const title = scene.add.text(panel.x, panel.y - panelH * 0.28, "GAME OVER!", {
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
                "Next time, you’ll win!"
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

            const goBack = () => {
                dialogRoot.destroy(true);
                scene.scene.start("HandwashAnimationScene", { skipIntro: true });
            };
            btn.on("pointerup", goBack);
            btnLabel.setInteractive({ useHandCursor: true }).on("pointerup", goBack);
        },

    };

    function showStreakPopup(scene, value, x, y) {
        const msg = `+${value}`;
        const t = scene.add.text(x, y, msg, {
            fontFamily: SS.fontFamily,
            fontSize: "22px",
            color: "#ffffff",
            fontStyle: "bold",
            backgroundColor: "#2aa84a",
            padding: { left: 10, right: 10, top: 6, bottom: 6 },
            align: "center"
        }).setOrigin(0.5).setDepth(200);

        // small scale pop + float up + fade
        t.setScale(0.8);
        scene.tweens.add({
            targets: t,
            y: y - 35,
            alpha: { from: 1, to: 0 },
            scale: { from: 0.95, to: 1.05 },
            duration: 750,
            ease: "Cubic.Out",
            onComplete: () => t.destroy()
        });
    }

    // ---------------- typing ----------------
    const typing = {
        // initialize typing state create measurement helper and keyboard handler
        init(scene) {
            scene.typing = {
                activeId: null, keystrokes: 0, mistakes: 0, startedAt: null, locked: false,
                // score shown on the “summary” must still live here for compatibility
                score: 0, streak: 0, bestStreak: 0, wordClean: true, wordsCompleted: 0,
                streakPops: 0, // include here on first (and only) assignment
            };

            // attach reusable streak/score engine
            scene.streakSys = streakScore.create();


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

            // soft outer glow using postfx if available and pulsing over time
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

            // additive duplicate sprite for a bright focus aura
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

            // show caret underline with a slow pulse
            if (g.curBox) {
                g.curBox.setVisible(true);
                scene.tweens.add({ targets: g.curBox, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });
            }

            // mark as active and lay out labels and caret
            scene.typing.activeId = g.id;
            typing.renderTarget(g, scene);
        },

        // choose a random target or the nearest to the sink depending on strategy
        pickRandom(scene) {
            if (!scene.germs.length) { scene.typing.activeId = null; return; }
            const idx = Math.floor(Math.random() * scene.germs.length);
            typing.activate(scene, scene.germs[idx]);
        },
        pickNearest(scene) {
            if (!scene.germs.length) { scene.typing.activeId = null; return; }
            // either: no on-screen filter
            const cand = scene.germs; // was: filter by helpers.isOnScreen(...)
            // or: keep the filter but with a generous margin
            // const cand = scene.germs.filter(g => helpers.isOnScreen(scene, g.sprite.x, g.sprite.y, 64));

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

            const typedW  = g.labelTyped.displayWidth;
            const remainW = g.labelRemain.displayWidth;
            const totalW  = typedW + remainW;
            const leftX   = g.sprite.x - totalW / 2;

            g.labelTyped.setOrigin(0, 0).setPosition(leftX, baseY);
            g.labelRemain.setOrigin(0, 0).setPosition(leftX + typedW, baseY);

            const isActive = !!(sc?.typing?.activeId === g.id && g.active);
            if (!g.curBox) return;

            const sizeNum = (typeof SS.labelTextSize === "string")
                ? parseInt(SS.labelTextSize, 10) : (SS.labelTextSize || 30);
            const nextCh  = g.word[g.typedIdx] || " ";
            const cw = (sc?.typing?.measureChar) ? sc.typing.measureChar(nextCh) : 0.6 * sizeNum;
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

            // if no target yet, pick one
            if (!scene.typing.activeId) typing.pickNearest(scene);

            // self-heal stale/removed target (e.g., it breached or was cleared)
            let g = scene.germs.find(x => x.id === scene.typing.activeId);
            if (!g) {
                scene.typing.activeId = null;
                typing.pickNearest(scene);
                g = scene.germs.find(x => x.id === scene.typing.activeId);
                if (!g) return; // nothing to type yet
            }

            const key = e.key;

            // handle backspace
            if (key === "Backspace") {
                if (g.typedIdx > 0) g.typedIdx--;
                typing.renderTarget(g, scene);
                typing.updateHud(scene);
                e.preventDefault();
                return;
            }

            // ignore non-printable
            if (key.length !== 1) return;

            // prevent accidental browser focus/scroll on printable keys
            e.preventDefault();

            scene.typing.keystrokes++;
            const ch = key;
            const expected = g.word[g.typedIdx];
            if (!expected) return;

            if (ch.toLowerCase() === expected.toLowerCase()) {
                g.typedIdx++;
                // reset error tint once user gets back on track
                const C = CONFIG.soapSplash.colors || {};
                g.labelRemain.setColor(C.remain ?? "#000000");
                g.labelTyped.setColor(C.typed ?? "#000000");

                typing.renderTarget(g, scene);
                if (g.typedIdx >= g.word.length) typing.onWordComplete(scene, g);
            } else {
                g.errors++;
                scene.typing.mistakes++;
                scene.typing.wordClean = false;
                scene.streakSys.onMistake();
                telemetry.onMistake(scene);

                const C = CONFIG.soapSplash.colors || {};
                g.labelRemain.setColor(C.errorRemain ?? "#ff4d4d");
                g.labelTyped.setColor(C.errorTyped ?? g.labelTyped.style.color);

                scene.tweens.add({
                    targets: g.labelRemain,
                    x: g.labelRemain.x + 4,
                    duration: 40,
                    yoyo: true,
                    repeat: 2
                });
            }

            typing.updateHud(scene);
        },

        // when a word is completed remove germ update score and streak and retarget
        onWordComplete(scene, g) {
            // 1) cache anything you need from g BEFORE removal
            const px = g.sprite?.x ?? (SS.width / 2);
            const py = (g.sprite?.y ?? (SS.height / 2)) - 10;

            // 2) scoring & telemetry (no UI mutation on g here)
            const oldStreak = scene.streakSys?.streak ?? 0;
            scene.typing.wordsCompleted++;

            const clean = !!scene.typing.wordClean;
            scene.streakSys.addBase(100);        // award base points
            scene.streakSys.onWord(clean);       // apply streak rule

            // keep legacy fields in sync
            scene.typing.streak = scene.streakSys.streak;
            scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.streakSys.bestStreak);
            scene.typing.score = scene.streakSys.totalScore;

            // telemetry
            telemetry.onWordComplete(scene, g, clean);

            // streak popup (uses cached px/py)
            if (scene.typing.streak > oldStreak && scene.typing.streak >= 1) {
                helpers.streakPopup(scene, scene.typing.streak, px, py);
                scene.typing.streakPops += 1;
            }

            // reset cleanliness for the NEXT word
            scene.typing.wordClean = true;

            // 3) NOW remove the germ visuals and clear target
            const idx = scene.germs.indexOf(g);
            if (idx >= 0) removeGermByIndex(scene, idx);
            scene.typing.activeId = null;

            // 4) refresh HUD and auto-select next target
            typing.updateHud(scene);
            typing.pickNearest(scene);
        },

        // refresh the score and streak hud text
        updateHud(scene) {
            const base = scene.streakSys?.baseScore ?? 0;
            const mult = scene.streakSys?.multiplier?.() ?? 0;
            const total = scene.streakSys?.totalScore ?? 0;
            const s = scene.streakSys?.streak ?? 0;

            scene.typeHud?.setText(
                `Score: ${total}  (base ${base} × x${mult.toFixed(1)})   Streak: ${s}`
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
        difficulty = String(difficulty).toLowerCase();
        const CC = CONFIG.cleanCatch;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;

        // set canvas resolution to the game size so drawing is crisp
        canvas.width = CC.width;
        canvas.height = CC.height;

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
            pSize = sizeFrom(playerImg, P, 300);
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


        // draw all items with labels
        function drawItems() {
            for (const item of items) {
                // Draw the assigned image for this item
                let img;
                if (item.type === "good") {
                    // randomly pick water or soap for good items
                    img = item.img || (Math.random() > 0.5 ? waterImg : soapImg);
                } else {
                    img = germImg;
                }

                if (difficulty !== "hard") {
                    if (img && img.complete && img.naturalWidth) {
                        ctx.drawImage(img, item.x, item.y, item.width, item.height);
                    } else {
                        // fallback shapes
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

                // Draw word below the image (or centered if hard)
                ctx.fillStyle = "black";
                ctx.font = "50px Chewy";
                ctx.textAlign = "center";
                if (difficulty === "hard") {
                    ctx.fillText(item.word, item.x + item.width / 2, item.y + item.height / 2 + 8);
                } else {
                    ctx.fillText(item.word, item.x + item.width / 2, item.y + item.height + 24);
                }
            }
        }

        //better time display
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

            // TIMER
            const timerText = formatTime(timeLeft);
            ctx.font = "52px Chewy";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText(timerText, canvas.width / 2, 105);

            // message display (dialogues) animated pop up effect
            if (messageTimer > 0 && currentMessage) {
                const progress = messageTimer / messageDuration; // 1 → 0 as it fades
                const popupScale = 1 + 0.2 * Math.sin(progress * Math.PI); // pop effect
                const yOffset = 140 + (1 - progress) * 10; // move slightly upward as it fades

                ctx.save();
                ctx.translate(canvas.width - 80, canvas.height - yOffset);
                ctx.scale(popupScale, popupScale);

                ctx.font = "65px Chewy";
                ctx.fillStyle = "black";
                ctx.textAlign = "right";
                ctx.shadowColor = "white";
                ctx.shadowBlur = 10;

                ctx.fillText(currentMessage, 0, 0);

                ctx.restore();
                messageTimer--;
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

                        // Play good catch sound
                        if (catchGoodSound) catchGoodSound.play();

                        // Only show a message every 3 good catches
                        if (goodCatchCount % 3 === 0) {
                            currentMessage = helpers.words.pick(goodMessages);
                            messageTimer = messageDuration;
                        }
                    } else {
                        lives -= 1;
                        if (catchBadSound) catchBadSound.play(); // 🔊 germ caught
                        currentMessage = helpers.words.pick(badMessages);
                        messageTimer = messageDuration;
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

// click → back to bathroom scene
                    const goBack = () => {
                        dialogRoot.destroy(true);
                        scene.scene.start("SchoolBathroomScene", { skipIntro: true }); // <-- pass flag
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
        // start all periodic loops animation item spawning movement and timer countdown
        function startLoops() {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(frame);

            if (!moveInterval) moveInterval = setInterval(movePlayer, 16);
            if (!spawnInterval) spawnInterval = setInterval(spawnItem, spawnRate);
            if (!timerInterval) timerInterval = setInterval(() => {
                if (!paused && !gameOver) {
                    timeLeft--;

                    // Play beep in last 5 seconds
                    if (timeLeft <= 5 && timeLeft > 0 && timerBeepSound) {
                        timerBeepSound.play();
                    }

                    if (timeLeft <= 0) gameOver = true;
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
