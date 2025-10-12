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
    sampleAngle(minDeg, maxDeg) {
        const a0 = Phaser.Math.DegToRad(minDeg);
        const a1 = Phaser.Math.DegToRad(maxDeg);
        return Phaser.Math.FloatBetween(a0, a1);
    },

    isAliveText(t) {
    return !!(t && t.scene && !t.destroyed && t.active !== false);
    },

    sampleRadius(rInner, rOuter) {
        const u = Math.random();
        return Math.sqrt(u * (rOuter * rOuter - rInner * rInner) + rInner * rInner);
    },
    polarToWorld(origin, r, theta) {
        return { x: origin.x + Math.cos(theta) * r, y: origin.y - Math.sin(theta) * r };
    },
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    aabbIntersect(ax, ay, aw, ah, bx, by, bw, bh) {
        return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    },
    isOnScreen(scene, x, y, margin = 10) {
        const view = scene.cameras.main.worldView;
        return x >= view.x - margin && y >= view.y - margin &&
            x <= view.right + margin && y <= view.bottom + margin;
    },
    words: {
        soapSplashWords() { return SS.words || []; },
        cleanGood() { return (CC.words && CC.words.good) || []; },
        cleanBad()  { return (CC.words && CC.words.bad)  || []; },
        pick(list)  { return (list && list.length) ? list[Math.floor(Math.random() * list.length)] : ""; }
    },
    mmss(ms) {
        const mm = Math.floor(ms / 60000);
        const ss = Math.floor((ms % 60000) / 1000);
        const two = (n) => (n < 10 ? "0" + n : "" + n);
        return `${two(mm)}:${two(ss)}`;
    },
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
// -----------------------------
const ui = {
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

    nameDialog(scene, onOk) {
        const { width, height } = scene.scale;
        const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.55)
            .setOrigin(0, 0).setDepth(10).setInteractive();

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
        ).setOrigin(0.5).setDepth(12).setShadow(0, 3, "#00000055", 4);

        let kiko = null;
        if (scene.textures.exists("kiko_cheer")) {
            const pw = panel.displayWidth || 760, ph = panel.displayHeight || 360;
            kiko = scene.add.image(panel.x - pw/2 + 120, panel.y + ph/2 - 110, "kiko_cheer")
                .setOrigin(0.5, 1).setDepth(12);
            const kScale = Math.min(200 / kiko.width, 220 / kiko.height);
            kiko.setScale(kScale);
        }

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

        const inputEl = dom.getChildByID("nameInput");

        let close;
        const submit = () => {
            const name = (inputEl?.value || "").trim();
            if (!name) return;
            scene.registry.set("playerName", name);
            close();
            onOk?.(name);
        };

        const onKeyDown = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } };
        window.addEventListener("keydown", onKeyDown);
        inputEl?.addEventListener?.("keydown", onKeyDown);

        dom.addListener("click");
        dom.on("click", (e) => { if (e.target?.id === "okBtn") submit(); });

        setTimeout(() => inputEl?.focus(), 0);

        close = () => {
            window.removeEventListener("keydown", onKeyDown);
            inputEl?.removeEventListener?.("keydown", onKeyDown);
            dom.destroy(); headline.destroy(); panel.destroy(); overlay.destroy(); kiko?.destroy();
        };
    },

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

    pauseOverlay(scene, { onResume, onHome } = {}) {
        const { width, height } = scene.scale;
        const P = CONFIG.ui.pauseOverlay;

        const overlay = scene.add.rectangle(0, 0, width, height, P.bgColor, P.bgAlpha)
            .setOrigin(0, 0).setDepth(999);

        const panelW = 780, panelH = 420;
        const panel = scene.add.rectangle(width / 2, height / 2, panelW, panelH, P.panelColor, 1)
            .setOrigin(0.5).setDepth(1000).setStrokeStyle(4, P.panelStroke);

        const title = scene.add.text(width / 2, height / 2 - 150, "Paused", {
            fontFamily: CONFIG.ui.fontFamily,
            fontSize: `${P.titleSize}px`,
            color: "#ffffff"
        }).setOrigin(0.5).setDepth(1001);

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

        const y0 = height / 2 + 10;
        const mkBtn = (label, y, cb) => {
            const { btn, txt } = ui.button(scene, width / 2, y, label, cb);
            btn.setDepth(1001); txt.setDepth(1001);
            return { btn, txt };
        };

        const resumeBtn = mkBtn("Resume", y0, () => onResume?.());
        const homeBtn   = mkBtn("Main Menu", y0 + 90, () => onHome?.());

        const isMuted = !!scene.sound?.mute;
        let audioLabel = scene.add.text(width / 2, y0 + 155, isMuted ? "Unmute" : "Mute", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: "22px", color: "#ffffff",
            backgroundColor: "#2d344f", padding: { left: 14, right: 14, top: 8, bottom: 8 }
        }).setOrigin(0.5).setDepth(1001).setInteractive({ useHandCursor: true });

        const toggleAudio = () => {
            if (scene.sound) {
                scene.sound.mute = !scene.sound.mute;
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
        if (this._paused) {
            this._paused = false;
            this._pauseUi?.destroy(); this._pauseUi = null;
        } else {
            this._paused = true;
            this._pauseUi = systems.ui.pauseOverlay(this, {
                onResume: () => this.togglePause(),
                onHome: () => {
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
// -----------------------------
const streakScore = (() => {
    function create() {
        return {
            baseScore: 0, totalScore: 0, cleanRun: 0, streak: 0, bestStreak: 0,
            addBase(points) {
                this.baseScore = Math.max(0, this.baseScore + (points || 0));
                this._recompute();
            },
            onWord(clean) {
                if (clean) {
                    this.cleanRun += 1;
                    this.streak = Math.max(0, this.cleanRun - 1);
                    this.bestStreak = Math.max(this.bestStreak, this.streak);
                } else { this.cleanRun = 0; this.streak = 0; }
                this._recompute();
            },
            onMistake() { this.cleanRun = 0; this.streak = 0; this._recompute(); },
            multiplier() { return this.streak * 0.5; },
            _recompute() { this.totalScore = Math.floor(this.baseScore * this.multiplier()); }
        };
    }
    return { create };
})();

// -----------------------------
// soap splash engine
// -----------------------------
const soapsplash = (() => {

    function addGerm(scene, pos, word) {
        const id = ++scene.germSeq;

        const sprite = scene.add.sprite(pos.x, pos.y, "Germ")
            .setDepth(4)
            .setScale(SS.germSpriteSize);

        const ty = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, "", {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const rm = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, word, {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const C = SS.colors || {};
        ty.setColor(C.typed ?? "#000000");
        rm.setColor(C.remain ?? "#000000");

        const caretH = 3;
        const caretCol = 0xff7043;
        const cur = scene.add.rectangle(
            pos.x, pos.y + SS.verticalSpaceLabel,
            12, caretH, caretCol, 0.9
        ).setOrigin(0, 1).setDepth(6).setVisible(false);

        const derivedRadius = Math.round(sprite.displayWidth * (SS.germHitRadiusFromSprite ?? 0.35));
        const hitRadius = (SS.germHitRadiusPx ?? derivedRadius);

        let hitCircle = null;
        if (SS.debug?.showGermCircles) {
            hitCircle = scene.add.circle(
                pos.x, pos.y, hitRadius,
                SS.debug.germColor ?? 0xff00ff,
                SS.debug.germAlpha ?? 0.2
            ).setDepth(3);
        }

        const germ = {
            id, sprite,
            labelTyped: ty, labelRemain: rm, curBox: cur,
            word, typedIdx: 0, errors: 0, active: false,
            hitRadius, _hitCircle: hitCircle
        };
        scene.germs.push(germ);
        return germ;
    }

    function removeGermByIndex(scene, i) {
        const g = scene.germs[i]; if (!g) return;
        if (g.curBox) { scene.tweens.killTweensOf(g.curBox); g.curBox.destroy(); g.curBox = null; }
        if (g._add)   { scene.tweens.killTweensOf(g._add);   g._add.destroy();   g._add  = null; }
        if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }
        if (g._hitCircle) { g._hitCircle.destroy(); g._hitCircle = null; }
        g.sprite.destroy(); g.labelTyped.destroy(); g.labelRemain.destroy();
        scene.germs.splice(i, 1);
    }

    function pickWord() { return helpers.words.pick(helpers.words.soapSplashWords()); }

    // ---------------- spawn ----------------
    const spawn = {
        spawnGerm(scene) {
            if (scene.gameOver) return;
            const SS = CONFIG.soapSplash;
            const cap = SS.maxGerms ?? 5;
            if (scene.germs.length >= cap) return;

            const lanes = SS.spawner?.lanes || [];
            if (!lanes.length) return;

            const triesMax = SS.spawner?.maxSpawnAttempts ?? SS.maxSpawnAttempts ?? 24;
            const sep      = SS.spawner?.minSeparationPx ?? 0;
            const minSink  = SS.spawner?.minSinkDistancePx ?? 0;

            const entryOffset = SS.spawner?.entry?.offsetPx ?? 100;
            const entryMs     = SS.spawner?.entry?.fadeMs ?? 220;
            const entryScale  = SS.spawner?.entry?.scaleFrom ?? 0.92;
            const offM        = SS.spawner?.offscreenMarginPx ?? 24;

            const tex   = scene.textures.get("Germ");
            const texW  = tex?.getSourceImage()?.width || 64;
            const scale = SS.germSpriteSize ?? 1;
            const newR  = SS.germHitRadiusPx ?? Math.round(texW * scale * (SS.germHitRadiusFromSprite ?? 0.35));

            const W = SS.width, H = SS.height;

            function pickLane(ls) {
                const total = ls.reduce((s, l) => s + (l.weight || 0), 0) || 1;
                let r = Math.random() * total;
                for (const l of ls) { r -= (l.weight || 0); if (r <= 0) return l; }
                return ls[ls.length - 1];
            }
            function sampleInside(lane) {
                const [rx0, ry0, rx1, ry1] = lane.rect;
                const x = Phaser.Math.Between((rx0 * W) | 0, (rx1 * W) | 0);
                const y = Phaser.Math.Between((ry0 * H) | 0, (ry1 * H) | 0);
                return { x, y };
            }

            let posFinal = null;
            {
                let tries = triesMax;
                while (tries-- > 0) {
                    const lane = pickLane(lanes);
                    const p = sampleInside(lane);

                    if (minSink > 0) {
                        const ds = Phaser.Math.Distance.Between(p.x, p.y, scene.sinkPosition.x, scene.sinkPosition.y);
                        if (ds < (minSink + newR)) continue;
                    }

                    if (sep > 0 && scene.germs.length) {
                        let ok = true;
                        for (const g of scene.germs) {
                            const need = (g.hitRadius ?? 0) + newR + sep;
                            if (Phaser.Math.Distance.Between(p.x, p.y, g.sprite.x, g.sprite.y) < need) { ok = false; break; }
                        }
                        if (!ok) continue;
                    }

                    posFinal = p; break;
                }
            }
            if (!posFinal) return;

            const vx = posFinal.x - scene.sinkPosition.x;
            const vy = posFinal.y - scene.sinkPosition.y;
            const vlen = Math.hypot(vx, vy) || 1;
            const nx = vx / vlen, ny = vy / vlen;

            let startX = posFinal.x + nx * entryOffset;
            let startY = posFinal.y + ny * entryOffset;

            if (startX > W) startX = W + offM;
            if (startX < 0) startX = -offM;
            if (startY > H) startY = H + offM;
            if (startY < 0) startY = -offM;

            const word = pickWord();
            const germObj = addGerm(scene, { x: startX, y: startY }, word);

            const targets = [
                germObj?.sprite,
                germObj?.labelTyped,
                germObj?.labelRemain,
            ].filter(Boolean);

            targets.forEach(t => {
                t.setAlpha(0.0);
                if (t === germObj.sprite) t.setScale((t.scaleX || 1) * entryScale);
            });

            scene.tweens.add({
                targets,
                x: (_t, i) => (i === 0 ? posFinal.x : undefined),
                y: (_t, i) => (i === 0 ? posFinal.y : undefined),
                alpha: 1,
                duration: entryMs,
                ease: "Cubic.Out",
                onUpdate: () => {
                    if (germObj?.labelTyped && germObj?.sprite) {
                        const s = germObj.sprite;
                        const lx = s.x;
                        const ly = s.y + (SS.verticalSpaceLabel ?? 34);
                        germObj.labelTyped.setPosition(lx, ly);
                        germObj.labelRemain?.setPosition(lx, ly);
                    }
                },
                onComplete: () => {
                    if (germObj?.sprite) {
                        const baseScale = SS.germSpriteSize ?? 1;
                        germObj.sprite.setScale(baseScale);
                    }
                }
            });

            // ensure there is an active target (first-spawned, then chain)
            if (!scene.typing?.activeId) typing.hardRetarget(scene);
        },
    };

    // ---------------- movement ----------------
    const movement = {
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

                ux += (Math.random() - 0.5) * wobble;
                uy += (Math.random() - 0.5) * wobble;
                const mm = Math.hypot(ux, uy) || 1; ux /= mm; uy /= mm;

                g.sprite.x += ux * speed;
                g.sprite.y += uy * speed;

                if (g._halo) g._halo.setPosition(g.sprite.x, g.sprite.y);
                if (g._add)  g._add.setPosition(g.sprite.x, g.sprite.y);

                g.labelTyped.setPosition(g.sprite.x, g.sprite.y + 14);
                g.labelRemain.setPosition(g.sprite.x, g.sprite.y + 14);
                typing.renderTarget(g, scene);

                // off-screen cleanup
                if (g.sprite.x > SS.width + margin || g.sprite.y > SS.height + margin) {
                    const wasActive = (scene.germs[i]?.id === scene.typing?.activeId);
                    scene._lastRemovedPos = { x: g.sprite.x, y: g.sprite.y };
                    removeGermByIndex(scene, i);
                    if (wasActive) { scene.typing.activeId = null; typing.hardRetarget(scene); }
                }
            }
        }
    };

    // ---------------- rules ----------------
    const rules = {
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

                    scene._lastRemovedPos = { x: g.sprite.x, y: g.sprite.y };
                    removeGermByIndex(scene, i);

                    scene.breaches++;
                    scene.hud?.setText(`Breaches: ${scene.breaches}/${maxBreaches}`);

                    if (typeof scene.setSoapSplashBackground === "function") {
                        scene.setSoapSplashBackground(scene.breaches);
                    }

                    if (wasActive) {
                        scene.typing.activeId = null;
                        typing.hardRetarget(scene);
                    }

                    if (scene.streakSys) {
                        scene.streakSys.addBase(-penalty);
                        scene.typing.score = scene.streakSys.totalScore;
                        scene.typing.streak = scene.streakSys.streak;
                        scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.streakSys.bestStreak);
                        soapsplash.typing.updateHud(scene);
                    }

                    if (scene.breaches >= maxBreaches) timer.endGame(scene, "Too many breaches");
                }
            }
        }
    };

    // ---------------- timer ----------------
    const timer = {
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
        updateHUD(scene, now) {
            if (scene.gameStartAt == null) return;
            const remaining = Math.max(0, (SS.gameDurationMin * 60 * 1000) - (now - scene.gameStartAt));
            scene.timerHud.setText(`Time: ${helpers.mmss(remaining)}`);
        },
        endGame(scene, reason = SS.reason || "Game over") {
            if (scene.gameOver) return;
            scene.gameOver = true;

            for (let i = scene.germs.length - 1; i >= 0; i--) { removeGermByIndex(scene, i); }

            const { score = 0, bestStreak = 0 } = (scene.typing || {});
            scene.timerHud?.setText("Time: 00:00");
            scene.endEvent?.remove(false);

            if (typeof scene.finalizeRound === "function") scene.finalizeRound(reason);

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
        init(scene) {
            scene.typing = {
                activeId: null, keystrokes: 0, mistakes: 0, startedAt: null, locked: false,
                score: 0, streak: 0, bestStreak: 0, wordClean: true, wordsCompleted: 0,
                streakPops: 0,
            };
            scene.streakSys = streakScore.create();

            scene.typing._measure = scene.add.text(-9999, -9999, "", {
                fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
            }).setVisible(false);

            scene.typing.measureChar = (ch) => {
                const sizeNum = typeof SS.labelTextSize === "string"
                    ? parseInt(SS.labelTextSize, 10) : (SS.labelTextSize || 30);
                const s = ch && ch.length ? ch : " ";
                scene.typing._measure.setText(s);
                const b = scene.typing._measure.getTextBounds?.();
                return (b && b.local && b.local.width) ? b.local.width : (0.6 * sizeNum);
            };

            scene.input.keyboard.on("keydown", (e) => typing.onKey(e, scene));
        },

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

        // --- authoritative retarget (re-entrant safe) ---
        hardRetarget(scene) {
            if (scene._retargetBusy) { scene._retargetQueued = true; return; }
            scene._retargetBusy = true;

            const runOnce = () => {
                typing.selectAutoTarget(scene);
                typing.ensureActiveVisible(scene);
            };

            runOnce();

            if (!scene._retargetPostrender) {
                scene._retargetPostrender = true;
                scene.events.once('postrender', () => {
                    runOnce();
                    scene._retargetPostrender = false;

                    scene._retargetBusy = false;
                    if (scene._retargetQueued) {
                        scene._retargetQueued = false;
                        scene.events.once('postupdate', () => typing.hardRetarget(scene));
                    }
                });
                return;
            }

            scene._retargetBusy = false;
            if (scene._retargetQueued) {
                scene._retargetQueued = false;
                scene.events.once('postupdate', () => typing.hardRetarget(scene));
            }
        },

        ensureActiveVisible(scene) {
            const g = scene._activeGerm;
            if (!g || !g.sprite) return;

            scene.tweens.killTweensOf(g.sprite);
            scene.tweens.killTweensOf(g.labelTyped);
            scene.tweens.killTweensOf(g.labelRemain);

            g.sprite.setAlpha(1).setDepth(Math.max(6, g.sprite.depth || 6));
            g.labelTyped?.setAlpha(1).setDepth((g.sprite.depth || 6) + 1);
            g.labelRemain?.setAlpha(1).setDepth((g.sprite.depth || 6) + 1);

            if (g.curBox) g.curBox.setVisible(true).setAlpha(0.9);

            typing.renderTarget(g, scene);
        },

        // --- NEW: auto-select (first-spawned; then chain to last removed) ---
        selectAutoTarget(scene) {
            const germs = scene.germs;
            if (!germs || germs.length === 0) return null;

            if (!scene._lastRemovedPos) {
                let first = null;
                for (const g of germs) {
                    if (!g || !g.sprite) continue;
                    if (!first || g.id < first.id) first = g;
                }
                if (first) typing.setActiveGerm(scene, first);
                return first;
            }

            const last = scene._lastRemovedPos;
            let best = null, bestD2 = Infinity;
            for (const g of germs) {
                if (!g || !g.sprite) continue;
                const dx = g.sprite.x - last.x, dy = g.sprite.y - last.y;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestD2) { bestD2 = d2; best = g; }
            }
            if (best) typing.setActiveGerm(scene, best);
            return best;
        },

        setActiveGerm(scene, germ) {
            typing.activate(scene, germ);
            scene._activeGerm = germ;
            typing.ensureActiveVisible(scene);
        },

        setGermHighlight(germ, on) {
            if (!germ || !germ.sprite) return;
            germ.sprite.setTint(on ? 0xffffaa : 0xffffff);
            if (germ.labelRemain) germ.labelRemain.setAlpha(on ? 1 : 0.85);
        },

        activate(scene, g) {
            typing.deactivateAll(scene);
            if (g._caretPulse) { g._caretPulse.remove(); g._caretPulse = null; }
            if (g._halo) { scene.tweens.killTweensOf(g._halo); g._halo.destroy(); g._halo = null; }
            if (g._add)  { scene.tweens.killTweensOf(g._add);  g._add.destroy();  g._add  = null; }
            if (g._glow && g.sprite?.postFX?.remove) { g.sprite.postFX.remove(g._glow); g._glow = null; }

            const F = CONFIG.soapSplash?.focus ?? {};
            g.active = true;
            g.sprite.clearTint();

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

            if (g.curBox) {
                g.curBox.setVisible(true);
                scene.tweens.add({ targets: g.curBox, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });
            }

            scene.typing.activeId = g.id;
            g.sprite.setAlpha(1).setDepth(Math.max(6, g.sprite.depth));
            g.labelTyped.setAlpha(1).setDepth((g.sprite.depth || 6) + 1);
            g.labelRemain.setAlpha(1).setDepth((g.sprite.depth || 6) + 1);

            typing.renderTarget(g, scene);
        },

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

        renderTarget(g, scene) {
            // bail if anything we need is gone
            if (!g || !g.sprite || !helpers.isAliveText(g.labelTyped) || !helpers.isAliveText(g.labelRemain)) return;

            const sc = scene || g.labelTyped.scene || g.labelRemain.scene;
            const baseY = g.sprite.y + SS.verticalSpaceLabel;

            const theWord  = g.word || "";
            const typedStr = theWord.slice(0, g.typedIdx);
            const remainStr = theWord.slice(g.typedIdx);

            // update text safely
            if (helpers.isAliveText(g.labelTyped))  g.labelTyped.setText(typedStr);
            if (helpers.isAliveText(g.labelRemain)) g.labelRemain.setText(remainStr);

            const typedW  = g.labelTyped.displayWidth;
            const remainW = g.labelRemain.displayWidth;
            const totalW  = typedW + remainW;
            const leftX   = g.sprite.x - totalW / 2;

            if (helpers.isAliveText(g.labelTyped))  g.labelTyped.setOrigin(0, 0).setPosition(leftX, baseY);
            if (helpers.isAliveText(g.labelRemain)) g.labelRemain.setOrigin(0, 0).setPosition(leftX + typedW, baseY);

            const isActive = !!(sc?.typing?.activeId === g.id && g.active);
            if (!g.curBox) return;

            const sizeNum = (typeof SS.labelTextSize === "string")
                ? parseInt(SS.labelTextSize, 10) : (SS.labelTextSize || 30);
            const nextCh = g.word[g.typedIdx] || " ";
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

        onWordComplete(scene, g) {
            // remember where this one died for chaining target selection
            scene._lastRemovedPos = { x: g.sprite.x, y: g.sprite.y };

            // scoring bookkeeping before we destroy anything
            const oldStreak = scene.streakSys?.streak ?? 0;
            scene.typing.wordsCompleted++;
            const clean = !!scene.typing.wordClean;

            // update scores / streaks
            scene.streakSys.addBase(100);
            scene.streakSys.onWord(clean);
            scene.typing.streak = scene.streakSys.streak;
            scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.streakSys.bestStreak);
            scene.typing.score = scene.streakSys.totalScore;

            // log while g still exists
            telemetry.onWordComplete(scene, g, clean);  // :contentReference[oaicite:0]{index=0}

            // pop UI before destruction (uses g.sprite only)
            if (scene.typing.streak > oldStreak && scene.typing.streak >= 1) {
                const px = g.sprite?.x ?? (SS.width / 2);
                const py = (g.sprite?.y ?? (SS.height / 2)) - 10;
                helpers.streakPopup(scene, scene.typing.streak, px, py);   // :contentReference[oaicite:1]{index=1}
                scene.typing.streakPops += 1;
            }

            // now safely destroy the germ & its labels
            const idx = scene.germs.indexOf(g);
            if (idx >= 0) removeGermByIndex(scene, idx);                 // :contentReference[oaicite:2]{index=2}
            scene.typing.activeId = null;

            // reset per-word flags
            scene.typing.wordClean = true;

            // IMPORTANT: do NOT touch g.labelTyped / g.labelRemain after this point
            typing.updateHud(scene);                                     // :contentReference[oaicite:3]{index=3}
            typing.hardRetarget(scene);                                  // :contentReference[oaicite:4]{index=4}
            return; // guard against accidental fall-through
        },


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

    return { spawn, movement, rules, timer, typing };
})();

// -----------------------------
// clean catch engine
// -----------------------------
const cleancatcher = {
    create(canvas) {
        const CC = CONFIG.cleanCatch;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;

        canvas.width = CC.width;
        canvas.height = CC.height;

        const A = CONFIG.assets.cleanCatch || {};
        const background = new Image(); background.src = A.background || "";
        const germImg = new Image(); germImg.src = A.germ || "";
        const waterImg = new Image(); waterImg.src = A.waterDroplet || "";
        const soapImg = new Image(); soapImg.src = A.soap || "";

        const goodMessages = [
            "Nice work!","Good catch!","We love clean water!","We love soap!","Keep going!","Great job!"
        ];
        const badMessages = [
            "That’s a germ!","Oops, not that one!","Be careful! We don't want your hands to get more dirty!",
            "Yikes, dirty water!","Watch out for those germs!"
        ];

        let currentMessage = "";
        let messageTimer = 0;
        const messageDuration = 60;

        const goodWords = helpers.words.cleanGood();
        const badWords = helpers.words.cleanBad();

        function aspect(img){const w=img.naturalWidth||0,h=img.naturalHeight||0;return{w,h,r:(w&&h)?w/h:1};}
        function sizeFrom(img, opts={}, defaultSquare=120){
            const {w:iw,h:ih,r}=aspect(img); const fallback=opts.fallbackSize??defaultSquare;
            if (opts.width!=null && opts.height!=null){
                let W=opts.width,H=opts.height;
                if (opts.maxPixels){const k=Math.min(opts.maxPixels/W,opts.maxPixels/H,1);W=Math.round(W*k);H=Math.round(H*k);}
                return {w:W,h:H};
            }
            if (opts.width!=null) return {w:opts.width,h:Math.round(opts.width/(r||1))};
            if (opts.height!=null) return {w:Math.round(opts.height*(r||1)),h:opts.height};
            if (opts.scale!=null && iw>0 && ih>0){
                let W=Math.max(1,Math.round(iw*opts.scale));
                let H=Math.max(1,Math.round(ih*opts.scale));
                if (opts.maxPixels){const k=Math.min(opts.maxPixels/W,opts.maxPixels/H,1);W=Math.round(W*k);H=Math.round(H*k);}
                return {w:W,h:H};
            }
            return {w:fallback,h:fallback};
        }

        const P = CC.player || {};
        const playerImg = new Image(); playerImg.src = (A.player || "");
        let pSize = sizeFrom(playerImg, P, 290);
        const player = {
            x: (canvas.width - pSize.w) / 2,
            y: canvas.height - (P.bottom ?? 30) - pSize.h,
            width: pSize.w, height: pSize.h, dx: 0
        };
        playerImg.onload = () => {
            pSize = sizeFrom(playerImg, P, 180);
            const baseline = canvas.height - (P.bottom ?? 30);
            player.width = pSize.w; player.height = pSize.h;
            player.x = helpers.clamp(player.x, 0, canvas.width - player.width);
            player.y = baseline - player.height;
        };

        let items = [];
        let score = 0, lives = 3, timeLeft = 30, gameOver = false;

        function spawnItem() {
            const isGood = Math.random() > 0.4;
            const word = isGood ? helpers.words.pick(goodWords) : helpers.words.pick(badWords);
            let w,h,img;
            if (isGood) {
                img = Math.random() > 0.5 ? waterImg : soapImg;
                const gSize = sizeFrom(img, { width: 50, height: 50 });
                w=gSize.w; h=gSize.h;
            } else {
                img = germImg;
                const gSize = sizeFrom(germImg, CC.germ || {}, 56);
                w=gSize.w; h=gSize.h;
            }
            items.push({ x: Math.random()*Math.max(1,canvas.width-w), y:0, width:w, height:h,
                type: isGood ? "good" : "bad", word, img, speed: 2 + Math.random()*2 });
        }

        function drawPlayer() {
            if (playerImg.complete && playerImg.naturalWidth) ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
            else { ctx.fillStyle = "blue"; ctx.fillRect(player.x, player.y, player.width, player.height); }
        }

        function drawItems() {
            for (const item of items) {
                let img = item.type === "good" ? (item.img || (Math.random()>0.5?waterImg:soapImg)) : germImg;
                if (img && img.complete && img.naturalWidth) ctx.drawImage(img, item.x, item.y, item.width, item.height);
                else {
                    if (item.type === "good") {
                        ctx.fillStyle = "aqua";
                        ctx.beginPath();
                        ctx.moveTo(item.x + item.width/2, item.y);
                        ctx.bezierCurveTo(item.x + item.width*1.0, item.y + item.height*0.8,
                            item.x + item.width*0.8, item.y + item.height,
                            item.x + item.width/2, item.y + item.height);
                        ctx.bezierCurveTo(item.x + item.width*0.2, item.y + item.height,
                            item.x, item.y + item.height*0.8,
                            item.x + item.width/2, item.y);
                        ctx.closePath(); ctx.fill();
                    } else {
                        ctx.fillStyle = "red";
                        ctx.fillRect(item.x, item.y, item.width, item.height);
                    }
                }
                ctx.fillStyle = "black"; ctx.font = "24px Arial"; ctx.textAlign = "center";
                ctx.fillText(item.word, item.x + item.width/2, item.y + item.height + 24);
            }
        }

        function formatTime(seconds) {
            const m = Math.floor(seconds / 60).toString().padStart(2, "0");
            const s = (seconds % 60).toString().padStart(2, "0");
            return `${m}:${s}`;
        }

        function drawUI() {
            ctx.fillStyle = "black"; ctx.font = "18px Arial";
            ctx.fillText("Score: " + score, 10, 20);

            if (messageTimer > 0 && currentMessage) {
                ctx.fillStyle = "black"; ctx.font = "30px Montserrat"; ctx.textAlign = "center";
                ctx.fillText(currentMessage, canvas.width / 2, canvas.height / 2 - 100);
                messageTimer--;
            }

            const heartSize = 50;
            for (let i = 0; i < lives; i++) {
                ctx.beginPath();
                const x = 10 + i * (heartSize + 5), y = 40;
                ctx.moveTo(x + heartSize/2, y + heartSize/5);
                ctx.bezierCurveTo(x + heartSize/2, y, x, y, x, y + heartSize/3);
                ctx.bezierCurveTo(x, y + heartSize*2/3, x + heartSize/2, y + heartSize, x + heartSize/2, y + heartSize);
                ctx.bezierCurveTo(x + heartSize/2, y + heartSize, x + heartSize, y + heartSize*2/3, x + heartSize, y + heartSize/3);
                ctx.bezierCurveTo(x + heartSize, y, x + heartSize/2, y, x + heartSize/2, y + heartSize/5);
                ctx.fillStyle = "red"; ctx.fill();
            }

            const timerText = formatTime(timeLeft);
            ctx.font = "40px Arial";
            const textWidth = ctx.measureText(timerText).width;
            const padding = 10;
            const boxX = (canvas.width - textWidth) / 2 - padding;
            const boxY = 10;
            const boxWidth = textWidth + padding * 2;
            const boxHeight = 50;

            ctx.fillStyle = "white"; ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.fillStyle = "black"; ctx.fillText(timerText, canvas.width / 2 - textWidth / 2, 45);
        }

        ctx.fillStyle = "black";
        ctx.font = "40px Arial";
        ctx.fillText(formatTime(timeLeft), canvas.width - 120, 40);

        function updateItems() {
            for (let i = items.length - 1; i >= 0; i--) {
                const item = items[i];
                item.y += item.speed;

                if (helpers.aabbIntersect(item.x, item.y, item.width, item.height,
                    player.x, player.y, player.width, player.height)) {
                    if (item.type === "good") {
                        score += 10;
                        currentMessage = helpers.words.pick(goodMessages);
                    } else {
                        lives -= 1;
                        currentMessage = helpers.words.pick(badMessages);
                        if (lives <= 0) gameOver = true;
                    }
                    messageTimer = messageDuration;
                    items.splice(i, 1);
                    continue;
                }

                if (item.y > canvas.height) items.splice(i, 1);
            }
        }

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

        function movePlayer() {
            player.x = helpers.clamp(player.x + player.dx, 0, canvas.width - player.width);
        }

        let paused = false;
        let rafId = null, moveInterval = null, spawnInterval = null, timerInterval = null;

        function frame() {
            if (paused) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (background.complete && background.naturalWidth) ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
            else { ctx.fillStyle = "#add8e6"; ctx.fillRect(0, 0, canvas.width, canvas.height); }

            if (gameOver) {
                ctx.fillStyle = "black"; ctx.font = "40px Arial";
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

        function stopLoops() {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            if (moveInterval) { clearInterval(moveInterval); moveInterval = null; }
            if (spawnInterval) { clearInterval(spawnInterval); spawnInterval = null; }
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        }

        function setPaused(p) {
            p = !!p;
            if (paused === p) return;
            paused = p;
            if (paused) stopLoops(); else startLoops();
        }

        function destroy() {
            stopLoops();
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
            canvas.removeEventListener("pointermove", onPointerMove);
        }

        startLoops();
        return { destroy, setPaused };
    }
};

// -----------------------------
// simple menu builder
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
// -----------------------------
const systems = {
    helpers, ui, soapsplash, cleancatcher, menu,
    spawn: soapsplash.spawn, movement: soapsplash.movement,
    rules: soapsplash.rules, timer: soapsplash.timer, typing: soapsplash.typing
};

export default systems;
