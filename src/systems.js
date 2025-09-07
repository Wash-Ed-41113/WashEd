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
            const label = scene.add.text(pos.x, pos.y + 14, word, {
                fontFamily: 'monospace', fontSize: '12px', color: '#fff'
            }).setOrigin(0.5, 0).setDepth(5);
            scene.germs.push({ id, sprite, label, word });
            return id;
        },
        removeGermByIndex(scene, i) {
            const g = scene.germs[i];
            if (!g) return;
            g.sprite.destroy();
            g.label.destroy();
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
            },
        },

        movement: {
            // Corrected signature and references
            moveGerms(scene, delta) {
                const speed = CONFIG.germSpeed * (delta / 1000);
                for (let i = scene.germs.length - 1; i >= 0; i--) {
                    const g = scene.germs[i];
                    const dx = scene.sinkPosition.x - g.sprite.x;
                    const dy = scene.sinkPosition.y - g.sprite.y;
                    const mag = Math.hypot(dx, dy) || 1;

                    let ux = dx / mag, uy = dy / mag;
                    const wobble = CONFIG.wobble;
                    ux += (Math.random() - 0.5) * wobble;
                    uy += (Math.random() - 0.5) * wobble;
                    const mm = Math.hypot(ux, uy);
                    ux /= mm; uy /= mm;

                    g.sprite.x += ux * speed;
                    g.sprite.y += uy * speed;
                    g.label.setPosition(g.sprite.x, g.sprite.y + 14);

                    const m = CONFIG.despawnMargin;
                    if (g.sprite.x > CONFIG.width + m || g.sprite.y > CONFIG.height + m) {
                        h.removeGermByIndex(scene, i);
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

                scene.gameStartAt = null;

                scene.endEvent = scene.time.delayedCall(
                    CONFIG.gameDurationMin * 60 * 1000,
                    () => systems.timer.endGame(scene)
                );

                scene.timerEvent = scene.time.addEvent({
                    delay: 200,
                    loop: true,
                    callback: () => systems.timer.updateHUD(scene, scene.time.now),
                    callbackScope: scene
                });
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

                scene.timerEvent?.remove(false);
                scene.timerHud?.setText('Time: 00:00');

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
    };

    // expose globally
    window.systems = systems;
})();
