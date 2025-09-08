(function () {
    const h = {
        sampleAngle(minDeg, maxDeg) {
            const a0 = Phaser.Math.DegToRad(minDeg);
            const a1 = Phaser.Math.DegToRad(maxDeg);
            return Phaser.Math.FloatBetween(a0, a1);
        },
        /**
         sample angle gets a random angle in the triangle and and converts them into radians from degree
         * Phaser uses radians
         * Returns a Uniform random angle in min and max  ie between angle theta and 1
         *
         * A uniform angle here defines angles with no probable bias, so each spawn is equally likely */

        sampleRadius(rInner, rOuter) {
            const u = Math.random();
            return Math.sqrt(u * (rOuter*rOuter - rInner*rInner) + rInner*rInner);
        },


        /**
         * Gets a random distance form the sink...
         * r^2 = U * (rOuter ^2 - rInner^2 ) + rInner^2
         * */




        polarToWorld(origin, r, theta) {
            return { x: origin.x + Math.cos(theta)*r, y: origin.y - Math.sin(theta)*r };
        },



        /**
         * germs are spawnning in an invisible wedge defined by direction and distance,
         * cone - picks a direction from sink and is ranged at angleMinDeg to angleMaxDeg....
         * radii - picks how far from the sink to spawn (rInner to rOuter)
         * intersection of cone and radai is spawn zone...
         * */



        addGerm(scene, pos, word) {
            const id = ++scene.germSeq;
            const sprite = scene.add.sprite(pos.x, pos.y, 'Germ')
                .setDepth(4).setScale(CONFIG.germSpriteSize);

            const labelTyped = scene.add.text(pos.x, pos.y + CONFIG.verticalSpaceLabel, '', {
                fontFamily: 'monospace', fontSize: CONFIG.labelTextSize + 'px', color: '#6cf96c'
            }).setOrigin(0.5, 0).setDepth(5);

            const labelRemain = scene.add.text(pos.x, pos.y + CONFIG.verticalSpaceLabel, word, {
                fontFamily: 'monospace', fontSize: CONFIG.labelTextSize + 'px', color: '#ffffff'
            }).setOrigin(0.5, 0).setDepth(5);

            /**
             * The idea is to split the word into 2 parts
             * Green - what has already been typed
             * White - what's left to type...**/

            const cur = scene.add.rectangle(
                pos.x, pos.y + CONFIG.verticalSpaceLabel,
                4, CONFIG.labelTextSize,
                0xffd166
            ).setOrigin(0, 0).setDepth(6).setVisible(false);

            const germObject = { id, sprite, labelTyped, labelRemain, cur, word, typedIdx: 0, errors: 0, active: false };
            scene.germs.push(germObject);
            return id;
        },


        removeGermByIndex(scene, i) {
            const g = scene.germs[i];
            if (!g) return;

            // NEW: stop caret tween and remove caret
            if (g.cur) {
                scene.tweens.killTweensOf(g.cur);
                g.cur.destroy();
            }

            // existing cleanup
            g.sprite.destroy();
            g.labelTyped.destroy();
            g.labelRemain.destroy();

            scene.germs.splice(i, 1);
        },



        pickWord() {
            const idx = Math.floor(Math.random() * CONFIG.words.length);
            return CONFIG.words[idx];
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

                    const sep = CONFIG.minSpawnSeparationPx;
                    if (sep > 0) {
                        let ok = true;
                        for (let i = 0; i < scene.germs.length; i++) {
                            if (Phaser.Math.Distance.Between(
                                p.x, p.y, scene.germs[i].sprite.x, scene.germs[i].sprite.y
                            ) < sep) { ok = false; break; }
                        }
                        if (!ok) continue;
                    }
                    pos = p; break;
                }
                if (!pos) return;

                const word = h.pickWord();
                h.addGerm(scene, pos, word);

                if (!scene.typing?.activeId) {
                    systems.typing.pickRandom(scene);
                }

            },
        },

        movement: {
            // Corrected signature and references
            moveGerms(scene, delta) {
                const speed = CONFIG.germSpeed * (delta / 1000);

                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    const g = scene.germs[i];

                    // vector toward sink
                    const dx = scene.sinkPosition.x - g.sprite.x;
                    const dy = scene.sinkPosition.y - g.sprite.y;
                    const mag = Math.hypot(dx, dy) || 1;

                    let ux = dx / mag, uy = dy / mag;

                    // wobble
                    const wobble = CONFIG.wobble;
                    ux += (Math.random() - 0.5) * wobble;
                    uy += (Math.random() - 0.5) * wobble;
                    const mm = Math.hypot(ux, uy);
                    ux /= mm; uy /= mm;

                    // move sprite
                    g.sprite.x += ux * speed;
                    g.sprite.y += uy * speed;

                    // keep both labels glued to the sprite
                    g.labelTyped.setPosition(g.sprite.x, g.sprite.y + 14);
                    g.labelRemain.setPosition(g.sprite.x, g.sprite.y + 14);

                    // keep caret right after the typed part
                    if (systems.typing && systems.typing.renderTarget) {
                        systems.typing.renderTarget(g);
                    }

                    // despawn if far outside
                    const m = CONFIG.despawnMargin;
                    if (g.sprite.x > CONFIG.width + m || g.sprite.y > CONFIG.height + m) {
                        systems.helpers.removeGermByIndex(scene, i);
                        // // optional: retarget if we just removed the active one
                        if (systems.typing && systems.typing.pickActive) systems.typing.pickActive(scene);
                    }
                }
            }
        },

        rules: {

            /**
             * Remove any germ that reaches the sink center within radius rSink.
             * Also increments the HUD counter. (Add lose-condition when breaches >= 5.)
             */


            checkBreaches(scene) {
                const hit = scene.getSinkHitPoint();
                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    const g = scene.germs[i];
                    const dist = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);
                    if (dist <= CONFIG.rSink) {
                        h.removeGermByIndex(scene, i);
                        scene.breaches++;
                        if (systems.typing && systems.typing.pickActive) systems.typing.pickActive(scene);
                        scene.hud.setText(`Breaches: ${scene.breaches}/5`);
                        // TODO: if (scene.breaches >= 5) systems.timer.endGame(scene);
                    }
                }
            }
        },

        timer: {
            init(scene) {
                scene.gameOver = false;
                scene.timerHud = scene.add.text(
                    CONFIG.width - 140, 15, 'Time: 01:00',
                    { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }
                ).setDepth(10);

                // schedule end of game
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

            endGame(scene) {
                if (scene.gameOver) return;
                scene.gameOver = true;

                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    h.removeGermByIndex(scene, i);
                }

                scene.timerHud?.setText('Time: 00:00');
                scene.endEvent?.remove(false);

                const overlay = scene.add.text(
                    CONFIG.width / 2, CONFIG.height / 2,
                    `Time's up!\nBreaches: ${scene.breaches}/5\nTap to restart`,
                    { fontFamily: 'monospace', fontSize: '28px', color: '#fff', align: 'center' }
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
              };

              scene.typeHud = scene.add.text(15, CONFIG.height - 40, `Streak: 0`,
                  { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }).setDepth(10);

              scene.input.keyboard.on('keydown', (e) => this.onKey(e, scene));
          },

            deactivateAll(scene) {
                for (const s of scene.germs) {
                    s.active = false;
                    if (s.cur) {
                        s.cur.setVisible(false);
                        scene.tweens.killTweensOf(s.cur);
                    }
                    s.sprite.clearTint();
                    s.labelTyped.setAlpha(0.7);
                    s.labelRemain.setAlpha(1);
                }
            },

            activate(scene, g) {
                this.deactivateAll(scene);
                g.active = true;
                g.sprite.setTint(0xffe29f);
                if (g.cur) {
                    g.cur.setVisible(true);
                    scene.tweens.add({ targets: g.cur, alpha: 0, duration: 500, yoyo: true, repeat: -1 });
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

                const hit = scene.getSinkHitPoint();
                let best = null, bestDist = Infinity;
                for (const g of scene.germs) {
                    const d = Phaser.Math.Distance.Between(g.sprite.x, g.sprite.y, hit.x, hit.y);
                    if (d < bestDist) { bestDist = d; best = g; }
                }
                if (best) this.activate(scene, best);
            },

            // pickActive(scene){
            //     if (scene.typing.locked && scene.typing.activeId) {
            //         const g = scene.germs.find(x => x.id === scene.typing.activeId);
            //         if (g) {
            //             // ensure highlight stays correct
            //             for (const s of scene.germs) {
            //                 const isActive = (s === g);
            //                 s.active = isActive;
            //                 s.cur.setVisible(isActive);
            //                 s.sprite.setTint(isActive ? 0xffe29f : 0xffffff);
            //                 s.labelTyped.setAlpha(isActive ? 1 : 0.7);
            //                 s.labelRemain.setAlpha(1);
            //             }
            //             systems.typing.renderTarget(g);
            //             return;
            //         }
            //     }
            //
            //   const hit = scene.getSinkHitPoint();
            //   let best = null, bestDist = Infinity;
            //
            //   for (const germObject of scene.germs) {
            //       const distance = Phaser.Math.Distance.Between(germObject.sprite.x, germObject.sprite.y, hit.x, hit.y);
            //       if (distance < bestDist) { bestDist = distance; best = germObject; }
            //   }
            //
            //     // clear previous
            //     for (const germObject of scene.germs) {
            //         germObject.active = false;
            //         germObject.cur.setVisible(false);
            //         germObject.sprite.clearTint();
            //         germObject.labelTyped.setAlpha(0.7);
            //         germObject.labelRemain.setAlpha(1);
            //     }
            //
            //     // set active
            //     if (best) {
            //         best.active = true;
            //         best.cur.setVisible(true);
            //         best.sprite.setTint(0xffe29f);
            //         scene.typing.activeId = best.id;
            //         systems.typing.renderTarget(best);
            //     }
            //
            // },

            renderTarget(g) {
                const baseY = g.sprite.y + CONFIG.verticalSpaceLabel;

                // split typed/remaining
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

                // caret (rectangle) placed right after typed text
                g.cur?.setPosition(leftX + typedW, baseY);
            },




            onKey(e, scene) {
                if (scene.gameOver) return;
                if (!scene.typing.startedAt) scene.typing.startedAt = scene.time.now;

                // If we don't have an active yet, start with a RANDOM pick
                if (!scene.typing.activeId) this.pickRandom(scene);

                const g = scene.germs.find(x => x.id === scene.typing.activeId);
                if (!g) return;

                const key = e.key;

                // Backspace
                if (key === 'Backspace') {
                    if (g.typedIdx > 0) g.typedIdx--;
                    this.renderTarget(g);
                    this.updateHud(scene);
                    e.preventDefault();
                    return;
                }

                // Ignore non-character keys
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
                if (idx >= 0) {
                    systems.helpers.removeGermByIndex(scene, idx);
                }
                scene.typing.activeId = null;
                this.locked = false;

                // NEW LOGIC: jump to nearest-to-sink next
                this.pickNearest(scene);
            },

            updateHud(scene) {
                let streak = 0;
                scene.typeHud.setText(`Streak: ${streak}`);
            },






        },
    };

    // expose globally
    window.systems = systems;
})();
