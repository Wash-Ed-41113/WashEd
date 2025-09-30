// this module collects all shared helpers ui widgets mini game engines and simple menus
// scenes import this module as systems to access these features
// everything below is inline documented so you can read top to bottom and understand the flow

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
        soapSplashWords() { return SS.words; },
        cleanGood() { return CC.words.good; },
        cleanBad()  { return CC.words.bad;  },
        pick(list)  { return list[Math.floor(Math.random() * list.length)]; }
    },

    // format milliseconds as mm ss string for hud
    mmss(ms) {
        const mm = Math.floor(ms / 60000);
        const ss = Math.floor((ms % 60000) / 1000);
        const two = (n) => (n < 10 ? "0" + n : "" + n);
        return `${two(mm)}:${two(ss)}`;
    },
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

    // pause overlay with resume button returns an object with destroy to clean up
    pauseOverlay(scene, onResume) {
        const { width, height } = scene.scale;
        const P = CONFIG.ui.pauseOverlay;

        const overlay = scene.add.rectangle(0, 0, width, height, P.bgColor, P.bgAlpha)
            .setOrigin(0, 0).setDepth(999);

        const panel = scene.add.rectangle(width / 2, height / 2, 700, 320, P.panelColor, 1)
            .setOrigin(0.5).setDepth(1000).setStrokeStyle(4, P.panelStroke);

        scene.add.text(width / 2, height / 2 - 90, "Paused", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: `${P.titleSize}px`,
            color: "#ffffff"
        }).setOrigin(0.5).setDepth(1001);

        const { btn, txt } = ui.button(scene, width / 2, height / 2 + 40, "Resume", onResume);
        btn.setDepth(1001);
        txt.setDepth(1001);

        return {
            destroy() {
                overlay.destroy();
                panel.destroy();
                btn.destroy();
                txt.destroy();
            }
        };
    },
};

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
    function pickWord() { return helpers.words.pick(helpers.words.soapSplashWords()); }

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
            const word = pickWord();
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

                    if (scene.typing) {
                        scene.typing.score = Math.max(0, scene.typing.score - penalty);
                    }

                    if (scene.breaches >= maxBreaches) timer.endGame(scene);
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
                () => timer.endGame(scene)
            );
        },
        // update remaining time label every frame from start time
        updateHUD(scene, now) {
            if (scene.gameStartAt == null) return;
            const remaining = Math.max(0, (SS.gameDurationMin * 60 * 1000) - (now - scene.gameStartAt));
            scene.timerHud.setText(`Time: ${helpers.mmss(remaining)}`);
        },
        // end round clean up germs show summary and allow tap to restart
        endGame(scene, reason = SS.reason) {
            if (scene.gameOver) return;
            scene.gameOver = true;

            for (let i = scene.germs.length - 1; i >= 0; i--) { removeGermByIndex(scene, i); }

            const { score = 0, bestStreak = 0 } = (scene.typing || {});
            scene.timerHud?.setText("Time: 00:00");
            scene.endEvent?.remove(false);

            const overlay = scene.add.text(
                SS.width / 2, SS.height / 2,
                `Game Over – ${reason}\nScore: ${score}\nBest Streak: ${bestStreak}\nBreaches: ${scene.breaches}/${SS.maxBreaches}\n\nTap to restart`,
                { fontFamily: SS.fontFamily, fontSize: "28px", color: "#fff", align: "center" }
            ).setOrigin(0.5).setDepth(20);

            scene.input.once("pointerdown", () => { overlay.destroy(); scene.scene.restart(); });
        },
    };

    // ---------------- typing ----------------
    const typing = {
        // initialize typing state create measurement helper and keyboard handler
        init(scene) {
            scene.typing = {
                activeId: null, keystrokes: 0, mistakes: 0, startedAt: null, locked: false,
                score: 0, streak: 0, bestStreak: 0, wordClean: true, wordsCompleted: 0,
            };
            scene.typeHud = scene.add.text(15, SS.height - 40,
                `Score: 0   Streak: 0`, { fontFamily: SS.fontFamily, fontSize: "16px", color: "#fff" }
            ).setDepth(10);

            // hidden text object for measuring character widths reliably in current font size
            scene.typing._measure = scene.add.text(-9999, -9999, "", {
                fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
            }).setVisible(false);

            // function that returns approximate width of a character for caret sizing and layout
            scene.typing.measureChar = (ch) => {
                const sizeNum = typeof SS.labelTextSize === "string"
                    ? parseInt(SS.labelTextSize, 10)
                    : (SS.labelTextSize || 30);
                const s = ch && ch.length ? ch : " ";
                scene.typing._measure.setText(s);
                const b = scene.typing._measure.getTextBounds?.();
                return (b && b.local && b.local.width) ? b.local.width : (0.6 * sizeNum);
            };

            // keyboard input handler routes to onKey
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
            const cand = scene.germs.filter(g => helpers.isOnScreen(scene, g.sprite.x, g.sprite.y, 0));
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
            const typedStr  = g.word.slice(0, g.typedIdx);
            const remainStr = g.word.slice(g.typedIdx);
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
            if (!scene.typing.activeId) typing.pickNearest(scene);

            const g = scene.germs.find(x => x.id === scene.typing.activeId);
            if (!g) return;

            const key = e.key;
            if (key === "Backspace") {
                if (g.typedIdx > 0) g.typedIdx--;
                typing.renderTarget(g, scene);
                typing.updateHud(scene); e.preventDefault(); return;
            }
            if (key.length !== 1) return;

            scene.typing.keystrokes++;
            const ch = key, expected = g.word[g.typedIdx];
            if (!expected) return;

            if (ch.toLowerCase() === expected.toLowerCase()) {
                g.typedIdx++; typing.renderTarget(g, scene);
                if (g.typedIdx >= g.word.length) typing.onWordComplete(scene, g);
            } else {
                g.errors++;
                scene.typing.mistakes++;
                scene.typing.wordClean = false;

                const C = CONFIG.soapSplash.colors || {};
                g.labelRemain.setColor(C.errorRemain ?? "#ff4d4d");      // keep red after error
                g.labelTyped.setColor(C.errorTyped ?? g.labelTyped.style.color);

                // small shake feedback on error
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
            const idx = scene.germs.indexOf(g);
            if (idx >= 0) removeGermByIndex(scene, idx);
            scene.typing.activeId = null;

            scene.typing.wordsCompleted++;
            if (scene.typing.wordClean) {
                scene.typing.streak++; scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.typing.streak);
                scene.typing.score += 100;
            } else {
                scene.typing.streak = 0; scene.typing.score += 50;
            }
            scene.typing.wordClean = true;

            const C = CONFIG.soapSplash.colors || {};
            g.labelTyped.setColor(C.typed ?? "#000000");
            g.labelRemain.setColor(C.remain ?? "#000000");

            typing.updateHud(scene); typing.pickNearest(scene);
        },

        // refresh the score and streak hud text
        updateHud(scene) {
            const { score = 0, streak = 0 } = scene.typing || {};
            scene.typeHud?.setText(`Score: ${score}   Streak: ${streak}`);
        },
    };

    // expose all namespaces to scenes through systems so they can call systems.soapsplash.whatever
    return { spawn, movement, rules, timer, typing };
})();

// -----------------------------
// clean catch engine
// simple html canvas arcade mini game running inside a phaser scene
// returns an object with destroy and setPaused so the scene can control it
// -----------------------------
const cleancatcher = {
    create(canvas) {
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

        let pSize = sizeFrom(playerImg, P, 180);
        const player = {
            x: (canvas.width - pSize.w) / 2,
            y: canvas.height - (P.bottom ?? 30) - pSize.h,
            width: pSize.w,
            height: pSize.h,
            dx: 0
        };

        // when the player image finishes loading recompute size and keep player inside bounds
        playerImg.onload = () => {
            pSize = sizeFrom(playerImg, P, 180);
            const baseline = canvas.height - (P.bottom ?? 30);
            player.width = pSize.w;
            player.height = pSize.h;
            player.x = helpers.clamp(player.x, 0, canvas.width - player.width);
            player.y = baseline - player.height;
        };

        // falling items list and game stats
        let items = [];
        let score = 0, lives = 3, timeLeft = 30, gameOver = false;

        // spawn either water or germ with a label and speed
        function spawnItem() {
            const isWater = Math.random() > 0.4;
            const word = isWater ? helpers.words.pick(goodWords) : helpers.words.pick(badWords);

            let w, h;
            if (isWater) {
                w = CC.water?.width ?? 60;
                h = CC.water?.height ?? 28;
            } else {
                const gSize = sizeFrom(germImg, CC.germ || {}, 56);
                w = gSize.w;
                h = gSize.h;
            }

            items.push({
                x: Math.random() * Math.max(1, (canvas.width - w)),
                y: 0,
                width: w,
                height: h,
                type: isWater ? "water" : "germ",
                word,
                speed: 2 + Math.random() * 2
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
                if (item.type === "water") {
                    // draw droplet shape (teardrop)
                    ctx.beginPath();
                    ctx.moveTo(item.x + item.width / 2, item.y); // sharp top point

                    // right curve down
                    ctx.bezierCurveTo(
                        item.x + item.width * 1.0, item.y + item.height * 1,  // outward control
                        item.x + item.width * 0.8, item.y + item.height,        // bulging bottom right
                        item.x + item.width / 2, item.y + item.height           // bottom center
                    );

                    // left curve up
                    ctx.bezierCurveTo(
                        item.x + item.width * 0.2, item.y + item.height,        // bulging bottom left
                        item.x, item.y + item.height * 1,                     // outward control
                        item.x + item.width / 2, item.y                         // back to top point
                    );

                    ctx.closePath();
                    ctx.fillStyle = "aqua";
                    ctx.fill();

                } else {
                    if (germImg.complete && germImg.naturalWidth) {
                        ctx.drawImage(germImg, item.x, item.y, item.width, item.height);
                    } else {
                        ctx.fillStyle = "red";
                        ctx.fillRect(item.x, item.y, item.width, item.height);
                    }
                }
                ctx.fillStyle = "black";
                ctx.font = "20px Arial";
                ctx.fillText(item.word, item.x + 5, item.y + item.height / 1.5);
            }
        }

        //better time display
        function formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, "0");
            const s = (seconds % 60).toString().padStart(2, "0");
            return `${m}:${s}`;}

        // draw score, lives and time
        function drawUI() {
            ctx.fillStyle = "black";
            ctx.font = "18px Arial";
            ctx.fillText("Score: " + score, 10, 20);

            // draw hearts
            const heartSize = 50;
            for (let i = 0; i < lives; i++) {
                ctx.beginPath();
                const x = 10 + i * (heartSize + 5);
                const y = 40;
                ctx.moveTo(x + heartSize / 2, y + heartSize / 5);
                ctx.bezierCurveTo(x + heartSize / 2, y, x, y, x, y + heartSize / 3);
                ctx.bezierCurveTo(x, y + heartSize * 2 / 3, x + heartSize / 2, y + heartSize, x + heartSize / 2, y + heartSize);
                ctx.bezierCurveTo(x + heartSize / 2, y + heartSize, x + heartSize, y + heartSize * 2 / 3, x + heartSize, y + heartSize / 3);
                ctx.bezierCurveTo(x + heartSize, y, x + heartSize / 2, y, x + heartSize / 2, y + heartSize / 5);
                ctx.fillStyle = "red";
                ctx.fill();
            }

            // time display
            ctx.fillStyle = "black";
            ctx.font = "40px Arial";
            ctx.fillText(formatTime(timeLeft), canvas.width - 120, 40);
        }

        // move items down, check collisions, update stats, remove offscreen
        function updateItems() {
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                item.y += item.speed;

                if (helpers.aabbIntersect(
                    item.x, item.y, item.width, item.height,
                    player.x, player.y, player.width, player.height
                )) {
                    if (item.type === "water") {
                        score += 10;
                    } else {
                        lives -= 1;
                        if (lives <= 0) gameOver = true;
                    }
                    items.splice(i, 1);
                    continue;
                }

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
            const mouseX = e.clientX - rect.left;
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

        // animation frame loop draws background player items ui and updates items
        function frame() {
            if (paused) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (background.complete && background.naturalWidth) {
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
            } else {
                ctx.fillStyle = "#add8e6";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            if (gameOver) {
                ctx.fillStyle = "black";
                ctx.font = "30px Arial";
                ctx.fillText("Game Over!", canvas.width / 2 - 80, canvas.height / 2);
                ctx.fillText("Score: " + score, canvas.width / 2 - 60, canvas.height / 2 + 40);
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
            if (!spawnInterval) spawnInterval = setInterval(spawnItem, 1000);
            if (!timerInterval) timerInterval = setInterval(() => {
                if (!paused && !gameOver) {
                    timeLeft--;
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
