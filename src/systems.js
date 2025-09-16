(function () {
    const h = {
        sampleAngle(minDeg, maxDeg) {
            const a0 = Phaser.Math.DegToRad(minDeg);
            const a1 = Phaser.Math.DegToRad(maxDeg);
            return Phaser.Math.FloatBetween(a0, a1);
        },

        sampleRadius(rInner, rOuter) {
            const u = Math.random();
            return Math.sqrt(u * (rOuter*rOuter - rInner*rInner) + rInner*rInner);
        },

        polarToWorld(origin, r, theta) {
            return { x: origin.x + Math.cos(theta)*r, y: origin.y - Math.sin(theta)*r };
        },

        addGerm(scene, pos, word) {
            const id = ++scene.germSeq;
            const sprite = scene.add.sprite(pos.x, pos.y, 'Germ')
                .setDepth(4).setScale(CONFIG.germSpriteSize);

            const labelTyped = scene.add.text(pos.x, pos.y + CONFIG.verticalSpaceLabel, '', {
                fontFamily: CONFIG.fontFamily, fontSize: CONFIG.labelTextSize , color: '#6cf96c'
            }).setOrigin(0.5, 0).setDepth(5);

            const labelRemain = scene.add.text(pos.x, pos.y + CONFIG.verticalSpaceLabel, word, {
                fontFamily: CONFIG.fontFamily, fontSize: CONFIG.labelTextSize , color: '#ffffff'
            }).setOrigin(0.5, 0).setDepth(5);

            const curBox = scene.add.rectangle(
                pos.x, pos.y + CONFIG.verticalSpaceLabel, (0.6 * CONFIG.labelTextSize), CONFIG.labelTextSize, 0xffff, 0.50 ).setOrigin(0, 0)
                .setDepth(5).setVisible(false);

            const germObject = { id, sprite, labelTyped, labelRemain, curBox, word, typedIdx: 0, errors: 0, active: false };
            scene.germs.push(germObject);
            return id;
        },


        removeGermByIndex(scene, i) {
            const germ = scene.germs[i];
            if (!germ) return;

            if (germ.curBox) {
                scene.tweens.killTweensOf(germ.curBox);
                germ.curBox.destroy();
            }

            germ.sprite.destroy();
            germ.labelTyped.destroy();
            germ.labelRemain.destroy();

            scene.germs.splice(i, 1);
        },



        pickWord() {
            const idx = Math.floor(Math.random() * CONFIG.words.length);
            return CONFIG.words[idx];
        },

        isOnScreen(scene, x, y, margin = 10) {
            const view = scene.cameras.main.worldView;
            return (
                x >= view.x - margin &&
                y >= view.y - margin &&
                x <= view.right + margin &&
                y <= view.bottom + margin
            );
        },


    };

    const systems = {
        helpers: h,

        spawn: {
            spawnGerm(scene) {
                if (scene.gameOver) return;
                if (scene.germs.length >= CONFIG.maxGerms) return;

                let tries = CONFIG.maxSpawnAttempts;
                let pos = null;

                while (tries-- > 0) {
                    const theta = h.sampleAngle(scene.angleMinDeg, scene.angleMaxDeg);
                    const r = h.sampleRadius(scene.rInner, scene.rOuter);
                    const p = h.polarToWorld(scene.sinkPosition, r, theta);

                    const seperation = CONFIG.minSpawnSeparationPx;
                    if (seperation > 0) {
                        let ok = true;
                        for (let i = 0; i < scene.germs.length; i++) {
                            if (Phaser.Math.Distance.Between(
                                p.x, p.y, scene.germs[i].sprite.x, scene.germs[i].sprite.y
                            ) < seperation) { ok = false; break; }
                        }
                        if (!ok) continue;
                    }
                    pos = p;
                    break;
                }
                if (!pos) return;

                const word = h.pickWord();
                h.addGerm(scene, pos, word);

                if (!scene.typing?.activeId) {
                    systems.typing.pickNearest(scene);
                }

            },
        },

        movement: {
            moveGerms(scene, delta) {
                const speed = CONFIG.germSpeed * (delta / 1000);

                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    const germ = scene.germs[i];

                    const dx = scene.sinkPosition.x - germ.sprite.x;
                    const dy = scene.sinkPosition.y - germ.sprite.y;
                    const mag = Math.hypot(dx, dy) || 1;

                    let ux = dx / mag, uy = dy / mag;

                    const wobble = CONFIG.wobble;
                    ux += (Math.random() - 0.5) * wobble;
                    uy += (Math.random() - 0.5) * wobble;
                    const mm = Math.hypot(ux, uy);
                    ux /= mm; uy /= mm;

                    germ.sprite.x += ux * speed;
                    germ.sprite.y += uy * speed;

                    germ.labelTyped.setPosition(germ.sprite.x, germ.sprite.y + 14);
                    germ.labelRemain.setPosition(germ.sprite.x, germ.sprite.y + 14);

                    if (systems.typing && systems.typing.renderTarget) {
                        systems.typing.renderTarget(germ);
                    }

                    const margin = CONFIG.despawnMargin;
                    if (germ.sprite.x > CONFIG.width + margin || germ.sprite.y > CONFIG.height + margin) {
                        const wasActive = (scene.germs[i]?.id === scene.typing?.activeId);
                        systems.helpers.removeGermByIndex(scene, i);
                        if (wasActive) {
                            scene.typing.activeId = null;
                            systems.typing.pickNearest(scene);
                        }
                    }
                }
            }
        },

        rules: {
            checkBreaches(scene) {
                const hit = scene.getSinkHitPoint();
                for (let i = scene.germs.length - 1; i >= 0; i--) {

                    const germ = scene.germs[i];
                    const distance = Phaser.Math.Distance.Between(germ.sprite.x, germ.sprite.y, hit.x, hit.y);
                    if (distance <= CONFIG.rSink) {
                        const wasActive = (germ.id === scene.typing?.activeId);

                        systems.helpers.removeGermByIndex(scene, i);
                        scene.breaches++;

                        scene.hud?.setText(`Breaches: ${scene.breaches}/5`);

                        if (wasActive) {
                            scene.typing.activeId = null;
                            if (scene.germs.length > 0) {
                                systems.typing.pickNearest(scene);
                            }
                        }

                        if (scene.typing) {
                            scene.typing.score = Math.max(0, scene.typing.score - CONFIG.breachPenalty);
                        }

                        if (scene.breaches >= 5) {
                            systems.timer.endGame(scene);
                        }


                    }
                }
            }

        },

        timer: {
            init(scene) {
                scene.gameOver = false;
                scene.timerHud = scene.add.text(
                    CONFIG.width - 140, 15, 'Time: ' + CONFIG.gameDurationTextHud,
                    { fontFamily: CONFIG.fontFamily, fontSize: '16px', color: '#fff' }
                ).setDepth(10);

                scene.endEvent = scene.time.delayedCall(
                    CONFIG.gameDurationMin * 60 * 1000,
                    () => systems.timer.endGame(scene)
                );
            },


            updateHUD(scene, now) {
                if (scene.gameStartAt == null) return;
                const elapsed = now - scene.gameStartAt;
                const remaining = Math.max(0, (CONFIG.gameDurationMin * 60 * 1000) - elapsed);
                const mm = Math.floor(remaining / 60000);
                const ss = Math.floor((remaining % 60000) / 1000);
                const two = (n) => (n < 10 ? '0' + n : '' + n);
                scene.timerHud.setText(`Time: ${two(mm)}:${two(ss)}`);
            },

            endGame(scene, reason = CONFIG.reason) {
                if (scene.gameOver) return;
                scene.gameOver = true;

                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    h.removeGermByIndex(scene, i);
                }

                const { score = 0, bestStreak = 0 } = (scene.typing || {});


                scene.timerHud?.setText('Time: 00:00');
                scene.endEvent?.remove(false);

                const overlay = scene.add.text(
                    CONFIG.width / 2, CONFIG.height / 2,
                    `Game Over – ${reason}\nScore: ${score}\nBest Streak: ${bestStreak}\nBreaches: ${scene.breaches}/5\n\nTap to restart`,
                    { fontFamily: CONFIG.fontFamily, fontSize: '28px', color: '#fff', align: 'center' }
                ).setOrigin(0.5).setDepth(20);

                scene.input.once('pointerdown', () => {
                    overlay.destroy();
                    scene.scene.restart();
                });
            },
        },

        typing: {
          init(scene) {
              scene.typing = {
                  activeId: null,
                  keystrokes: 0,
                  mistakes: 0,
                  startedAt: null,
                  locked: false,

                  score: 0,
                  streak: 0,
                  bestStreak: 0,
                  wordClean: true,
                  wordsCompleted: 0,
              };

              scene.typeHud = scene.add.text(15, CONFIG.height - 40,
                  `Score: 0   Streak: 0`, { fontFamily: CONFIG.fontFamily, fontSize: '16px', color: '#fff'
              }).setDepth(10);

              scene.input.keyboard.on('keydown', (e) => this.onKey(e, scene));
          },

            deactivateAll(scene) {
                for (const g of scene.germs) {
                    g.active = false;
                    if (g.curBox) {
                        g.curBox.setVisible(false);
                        scene.tweens.killTweensOf(g.curBox);
                    }
                    g.sprite.clearTint();
                    g.labelTyped.setAlpha(0.7);
                    g.labelRemain.setAlpha(1);
                }
            },


            activate(scene, g) {
                this.deactivateAll(scene);
                g.active = true;
                g.sprite.setTint(0xffe29f);
                if (g.curBox) {
                    g.curBox.setVisible(true);
                    scene.tweens.add({
                        targets: g.curBox,
                        alpha: 0.05,
                        duration: 500,
                        yoyo: true,
                        repeat: -1
                    });
                }
                scene.typing.activeId = g.id;
                this.renderTarget(g);
            },

            pickRandom(scene) {
                if (!scene.germs.length) { scene.typing.activeId = null; return; }
                const idx = Math.floor(Math.random() * scene.germs.length);
                this.activate(scene, scene.germs[idx]);
            },

            pickNearest(scene) {
                if (!scene.germs.length) { scene.typing.activeId = null; return; }

                const candidates = scene.germs.filter(g =>
                    h.isOnScreen(scene, g.sprite.x, g.sprite.y, 0)
                );
                if (!candidates.length) {
                    scene.typing.activeId = null;
                    return;
                }

                const hit = scene.getSinkHitPoint();
                let best = null, bestDist = Infinity;
                for (const g of candidates) {
                    const d = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);
                    if (d < bestDist) { bestDist = d; best = g; }
                }
                if (best) this.activate(scene, best);
            },



            renderTarget(g) {
                const baseY = g.sprite.y + CONFIG.verticalSpaceLabel;

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
                if (scene.gameOver) return;
                if (!scene.typing.startedAt) scene.typing.startedAt = scene.time.now;

                if (!scene.typing.activeId) this.pickNearest(scene);

                const g = scene.germs.find(x => x.id === scene.typing.activeId);
                if (!g) return;

                const key = e.key;

                if (key === 'Backspace') {
                    if (g.typedIdx > 0) g.typedIdx--;
                    this.renderTarget(g);
                    this.updateHud(scene);
                    e.preventDefault();
                    return;
                }

                if (key.length !== 1) return;

                scene.typing.keystrokes++;

                const ch = key;
                const expected = g.word[g.typedIdx];
                if (!expected) return;

                if (ch.toLowerCase() === expected.toLowerCase()) {
                    g.typedIdx++;
                    this.locked = true;
                    this.renderTarget(g);

                    if (g.typedIdx >= g.word.length) {
                        this.onWordComplete(scene, g);
                    }
                } else {
                    g.errors++;
                    scene.typing.mistakes++;
                    scene.typing.wordClean = false;
                    scene.tweens.add({
                        targets: g.labelRemain,
                        color: '#ff6b6b',
                        duration: 70,
                        yoyo: true,
                        onYoyo: () => g.labelRemain.setColor('#ffffff')
                    });
                }

                this.updateHud(scene);
            },




            onWordComplete(scene, g) {
                const idx = scene.germs.indexOf(g);
                if (idx >= 0) systems.helpers.removeGermByIndex(scene, idx);
                scene.typing.activeId = null;

                scene.typing.wordsCompleted++;
                if (scene.typing.wordClean) {
                    scene.typing.streak++;
                    scene.typing.bestStreak = Math.max(scene.typing.bestStreak, scene.typing.streak);
                    scene.typing.score += 100;
                } else {
                    scene.typing.streak = 0;
                    scene.typing.score += 50;
                }
                scene.typing.wordClean = true;

                this.updateHud(scene);
                this.pickNearest(scene);

            },

            updateHud(scene) {
                const { score = 0, streak = 0 } = scene.typing || {};
                scene.typeHud?.setText(`Score: ${score}   Streak: ${streak}`);
            },







        },
    };

    window.systems = systems;
})();
