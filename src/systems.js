// ---------- Shared helpers ----------
const SS = CONFIG.soapSplash;
const CC = CONFIG.cleanCatch;
const helpers = {
    sampleAngle(minDeg, maxDeg) {
        const a0 = Phaser.Math.DegToRad(minDeg);
        const a1 = Phaser.Math.DegToRad(maxDeg);
        return Phaser.Math.FloatBetween(a0, a1);
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
        soapSplashWords() { return SS.words; },
        cleanGood() { return CC.words.good; },
        cleanBad()  { return CC.words.bad;  },
        pick(list)  { return list[Math.floor(Math.random() * list.length)]; }
    },

    mmss(ms) {
        const mm = Math.floor(ms / 60000);
        const ss = Math.floor((ms % 60000) / 1000);
        const two = (n) => (n < 10 ? "0" + n : "" + n);
        return `${two(mm)}:${two(ss)}`;
    },
};

// ---------- UI (shared) ----------
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

        const panel = scene.add.rectangle(width / 2, height / 2, 600, 280, 0x101425, 1)
            .setOrigin(0.5).setDepth(11).setStrokeStyle(4, 0x00c2ff);
        scene.add.text(width / 2, height / 2 - 90, "Enter Your Name", {
            fontFamily: CONFIG.ui.fontFamily, fontSize: "36px", color: "#fff"
        }).setOrigin(0.5).setDepth(12);

        const html = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:18px;">
        <input id="nameInput" type="text" maxlength="20" placeholder="Your name…"
          style="padding:10px;font-size:20px;width:320px;border-radius:8px;border:1px solid #89bfff;outline:none;" />
        <div>
          <button id="okBtn" style="padding:10px 16px;font-size:18px;margin:0 6px;cursor:pointer;">OK</button>
          <button id="cancelBtn" style="padding:10px 16px;font-size:18px;margin:0 6px;cursor:pointer;">Cancel</button>
        </div>
      </div>`;
        const dom = scene.add.dom(width / 2, height / 2 + 10).createFromHTML(html).setDepth(12);

        const close = () => { dom.destroy(); panel.destroy(); overlay.destroy(); };
        const submit = () => {
            const input = dom.getChildByID("nameInput"); const name = (input?.value || "").trim();
            if (!name) return;
            scene.registry.set("playerName", name);
            close(); onOk?.(name);
        };
        dom.addListener("click");
        dom.on("click", (e) => { if (e.target?.id === "okBtn") submit(); if (e.target?.id === "cancelBtn") close(); });
        setTimeout(() => dom.getChildByID("nameInput")?.focus(), 0);
    },
    // ADD inside your existing `const ui = { ... }` object:

// Reusable Top Bar: Home (wired), Pause (optional), Settings (optional)
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


    // inside const ui = { ... }
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

// ---------- SoapSplash ----------
const soapsplash = (() => {
    function addGerm(scene, pos, word) {
        const id = ++scene.germSeq;

        // sprite
        const sprite = scene.add.sprite(pos.x, pos.y, "Germ")
            .setDepth(4)
            .setScale(SS.germSpriteSize);

        // labels
        const ty = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, "", {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const rm = scene.add.text(pos.x, pos.y + SS.verticalSpaceLabel, word, {
            fontFamily: SS.fontFamily, fontSize: SS.labelTextSize, color: "#000000"
        }).setOrigin(0.5, 0).setDepth(5);

        const sizeNum = typeof SS.labelTextSize === "string"
            ? parseInt(SS.labelTextSize, 10)
            : (SS.labelTextSize || 30);

        const cur = scene.add.rectangle(
            pos.x, pos.y + SS.verticalSpaceLabel,
            0.6 * sizeNum, sizeNum,
            0x888888, 0.35
        ).setOrigin(0, 0).setDepth(5).setVisible(false);

        // hit radius + optional debug circle
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
        return id;
    }

    function removeGermByIndex(scene, i) {
        const g = scene.germs[i]; if (!g) return;
        if (g.curBox) { scene.tweens.killTweensOf(g.curBox); g.curBox.destroy(); }
        if (g._hitCircle) { g._hitCircle.destroy(); g._hitCircle = null; }
        g.sprite.destroy();
        g.labelTyped.destroy();
        g.labelRemain.destroy();
        scene.germs.splice(i, 1);
    }

    function removeGermById(scene, id) {
        const idx = scene.germs.findIndex(x => x.id === id);
        if (idx >= 0) {
            const g = scene.germs[idx];
            if (g.curBox) { scene.tweens.killTweensOf(g.curBox); g.curBox.destroy(); }
            if (g._hitCircle) { g._hitCircle.destroy(); g._hitCircle = null; }
            g.sprite.destroy();
            g.labelTyped.destroy();
            g.labelRemain?.destroy?.();
            g.labelRemaining?.destroy?.();
            scene.germs.splice(idx, 1);
        }
    }

    function pickWord() { return helpers.words.pick(helpers.words.soapSplashWords()); }

    const spawn = {
        spawnGerm(scene) {
            if (scene.gameOver) return;

            const cap = SS.waveCap ?? SS.maxGerms ?? 5;
            if (scene.germs.length >= cap) return;

            const triesMax = SS.maxSpawnAttempts ?? 24;
            const sep = SS.minSpawnSeparationPx ?? 0;
            const minSink = SS.minSinkDistancePx ?? 0;

            // approximate radius of the new germ before creating its sprite
            const tex = scene.textures.get("Germ");
            const texW = tex?.getSourceImage()?.width || 64;
            const scaledW = (SS.germSpriteSize ?? 1) * texW;
            const newR = SS.germHitRadiusPx ?? Math.round(scaledW * (SS.germHitRadiusFromSprite ?? 0.35));

            let tries = triesMax;
            let pos = null;

            while (tries-- > 0) {
                const theta = helpers.sampleAngle(scene.angleMinDeg, scene.angleMaxDeg);
                const r = helpers.sampleRadius(scene.rInner, scene.rOuter);
                const p = helpers.polarToWorld(scene.sinkPosition, r, theta);

                // keep away from sink
                if (minSink > 0) {
                    const ds = Phaser.Math.Distance.Between(p.x, p.y, scene.sinkPosition.x, scene.sinkPosition.y);
                    if (ds < (minSink + newR)) continue;
                }

                // keep away from existing germs
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
            if (!scene.typing?.activeId) typing.pickNearest(scene);
        },
    };

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

                if (g._hitCircle) g._hitCircle.setPosition(g.sprite.x, g.sprite.y);

                g.labelTyped.setPosition(g.sprite.x, g.sprite.y + 14);
                g.labelRemain.setPosition(g.sprite.x, g.sprite.y + 14);
                typing.renderTarget(g);

                if (g.sprite.x > SS.width + margin || g.sprite.y > SS.height + margin) {
                    const wasActive = (scene.germs[i]?.id === scene.typing?.activeId);
                    removeGermByIndex(scene, i);
                    if (wasActive) { scene.typing.activeId = null; typing.pickNearest(scene); }
                }
            }
        }
    };

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
                () => timer.endGame(scene)
            );
        },
        updateHUD(scene, now) {
            if (scene.gameStartAt == null) return;
            const remaining = Math.max(0, (SS.gameDurationMin * 60 * 1000) - (now - scene.gameStartAt));
            scene.timerHud.setText(`Time: ${helpers.mmss(remaining)}`);
        },
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

    const typing = {
        init(scene) {
            scene.typing = {
                activeId: null, keystrokes: 0, mistakes: 0, startedAt: null, locked: false,
                score: 0, streak: 0, bestStreak: 0, wordClean: true, wordsCompleted: 0,
            };
            scene.typeHud = scene.add.text(15, SS.height - 40,
                `Score: 0   Streak: 0`, { fontFamily: SS.fontFamily, fontSize: "16px", color: "#fff" }
            ).setDepth(10);

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

        deactivateAll(scene) {
            for (const g of scene.germs) {
                g.active = false;
                if (g.curBox) { g.curBox.setVisible(false); scene.tweens.killTweensOf(g.curBox); }
                g.sprite.clearTint(); g.labelTyped.setAlpha(0.7); g.labelRemain.setAlpha(1);
            }
        },
        activate(scene, g) {
            typing.deactivateAll(scene);
            g.active = true;
            g.sprite.setTint(0xffe29f);
            if (g.curBox) {
                g.curBox.setVisible(true);
                scene.tweens.add({ targets: g.curBox, alpha: 0.05, duration: 500, yoyo: true, repeat: -1 });
            }
            scene.typing.activeId = g.id;
            typing.renderTarget(g);
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
        renderTarget(g) {
            const baseY = g.sprite.y + SS.verticalSpaceLabel;
            const typedStr  = g.word.slice(0, g.typedIdx);
            const remainStr = g.word.slice(g.typedIdx);
            g.labelTyped.setText(typedStr);
            g.labelRemain.setText(remainStr);

            const typedW  = g.labelTyped.displayWidth;
            const remainW = g.labelRemain.displayWidth;
            const totalW  = typedW + remainW;
            const leftX = g.sprite.x - totalW / 2;

            g.labelTyped.setOrigin(0, 0).setPosition(leftX, baseY);
            g.labelRemain.setOrigin(0, 0).setPosition(leftX + typedW, baseY);
            g.curBox?.setPosition(leftX + typedW, baseY);
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
                typing.renderTarget(g); typing.updateHud(scene); e.preventDefault(); return;
            }
            if (key.length !== 1) return;

            scene.typing.keystrokes++;
            const ch = key, expected = g.word[g.typedIdx];
            if (!expected) return;

            if (ch.toLowerCase() === expected.toLowerCase()) {
                g.typedIdx++; typing.renderTarget(g);
                if (g.typedIdx >= g.word.length) typing.onWordComplete(scene, g);
            } else {
                g.errors++; scene.typing.mistakes++; scene.typing.wordClean = false;
                scene.tweens.add({
                    targets: g.labelRemain, color: "#ff6b6b", duration: 70, yoyo: true,
                    onYoyo: () => g.labelRemain.setColor("#ffffff")
                });
            }
            typing.updateHud(scene);
        },
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
            typing.updateHud(scene); typing.pickNearest(scene);
        },
        updateHud(scene) {
            const { score = 0, streak = 0 } = scene.typing || {};
            scene.typeHud?.setText(`Score: ${score}   Streak: ${streak}`);
        },
    };

    return { spawn, movement, rules, timer, typing };
})();


// ---------- CleanCatcher ----------
const cleancatcher = {
    create(canvas) {
        const ctx = canvas.getContext("2d");
        canvas.width = 1080; canvas.height = 920;

        // assets
        const background = new Image();
        background.src = CONFIG.assets.backgrounds.cleanCatch; // <-- fixed key

        const germImg = new Image();
        germImg.src = CONFIG.assets.germs.cleanCatcherGerm;

        const goodWords = helpers.words.cleanGood();
        const badWords  = helpers.words.cleanBad();

        const player = { x: canvas.width/2 - 40, y: canvas.height - 60, width: 80, height: 30, dx: 0 };
        let items = [];
        let score = 0, lives = 3, timeLeft = 30, gameOver = false;

        function spawnItem() {
            const isWater = Math.random() > 0.4;
            const word = isWater ? helpers.words.pick(goodWords) : helpers.words.pick(badWords); // <-- fixed
            items.push({
                x: Math.random() * (canvas.width - 60),
                y: 0, width: 60, height: 30,
                type: isWater ? "water" : "germ",
                word,
                speed: 2 + Math.random() * 2
            });
        }

        // (rest unchanged) ...
        // NOTE: keep your original draw/update loops; omitted here for brevity.
        // ---- v keep from your version v ----
        function drawPlayer(){ctx.fillStyle="blue";ctx.fillRect(player.x,player.y,player.width,player.height);}
        function drawItems(){items.forEach(item=>{if(item.type==="water"){ctx.fillStyle="aqua";ctx.fillRect(item.x,item.y,item.width,item.height);}else if(item.type==="germ"&&germImg.complete&&germImg.naturalWidth!==0){ctx.drawImage(germImg,item.x,item.y,item.width,item.height);}else{ctx.fillStyle="red";ctx.fillRect(item.x,item.y,item.width,item.height);}ctx.fillStyle="black";ctx.font="12px Arial";ctx.fillText(item.word,item.x+5,item.y+item.height/1.5);});}
        function drawUI(){ctx.fillStyle="black";ctx.font="16px Arial";ctx.fillText("Score: "+score,10,20);ctx.fillText("Lives: "+lives,10,40);ctx.fillText("Time: "+timeLeft,canvas.width-100,20);}
        function updateItems(){items.forEach((item,idx)=>{item.y+=item.speed;if(helpers.aabbIntersect(item.x,item.y,item.width,item.height,player.x,player.y,player.width,player.height)){if(item.type==="water")score+=10;else{lives-=1;if(lives<=0)gameOver=true;}items.splice(idx,1);}if(item.y>canvas.height)items.splice(idx,1);});}
        const onKeyDown=(e)=>{if(e.key==="ArrowLeft")player.dx=-5;if(e.key==="ArrowRight")player.dx=5;};
        const onKeyUp=(e)=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight")player.dx=0;};
        const onPointerMove=(e)=>{const rect=canvas.getBoundingClientRect();const mouseX=e.clientX-rect.left;player.x=helpers.clamp(mouseX-player.width/2,0,canvas.width-player.width);};
        document.addEventListener("keydown",onKeyDown);document.addEventListener("keyup",onKeyUp);canvas.addEventListener("pointermove",onPointerMove);
        function movePlayer(){player.x=helpers.clamp(player.x+player.dx,0,canvas.width-player.width);}
        let rafId=null;const moveInterval=setInterval(movePlayer,16);const spawnInterval=setInterval(spawnItem,1000);const timerInterval=setInterval(()=>{if(!gameOver){timeLeft--;if(timeLeft<=0)gameOver=true;}},1000);
        function frame(){ctx.clearRect(0,0,canvas.width,canvas.height);if(background.complete&&background.naturalWidth!==0)ctx.drawImage(background,0,0,canvas.width,canvas.height);else{ctx.fillStyle="#add8e6";ctx.fillRect(0,0,canvas.width,canvas.height);}if(gameOver){ctx.fillStyle="black";ctx.font="30px Arial";ctx.fillText("Game Over!",canvas.width/2-80,canvas.height/2);ctx.fillText("Score: "+score,canvas.width/2-60,canvas.height/2+40);return;}drawPlayer();drawItems();drawUI();updateItems();rafId=requestAnimationFrame(frame);}frame();
        function destroy(){if(rafId)cancelAnimationFrame(rafId);clearInterval(moveInterval);clearInterval(spawnInterval);clearInterval(timerInterval);document.removeEventListener("keydown",onKeyDown);document.removeEventListener("keyup",onKeyUp);canvas.removeEventListener("pointermove",onPointerMove);}
        return { destroy };
    }
};

// ---------- Menu helpers ----------
const menu = {
    build(scene, spec) {
        const { width, height } = scene.scale;
        const gap = 96;
        const startY = height * 0.45;
        return spec.map((s, i) => {
            const y = startY + i * gap;
            return ui.button(scene, width / 2, y, s.label, s.onClick);
        });
    }
};

const systems = { helpers, ui, soapsplash, cleancatcher, menu,
    spawn: soapsplash.spawn, movement: soapsplash.movement,
    rules: soapsplash.rules, timer: soapsplash.timer, typing: soapsplash.typing,
};
export default systems;
