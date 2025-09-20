// src/scenes/CleanCatchScene.js

import systems from "../systems.js";
import { createCleanCatch } from "../cleanCatchGame.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._teardown = null;
        this._dom = null;
    }

    create() {
        const CC = CONFIG.cleanCatch;
        const { width, height } = CC;

        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0b1520, 1).setOrigin(0);


        const html = `
          <div style="display:flex;align-items:center;justify-content:center;width:${this.scale.width}px;height:${this.scale.height}px;">
            <canvas id="cleanCatchCanvas" width="${width}" height="${height}"
              style="max-width:100%;max-height:100%;outline:none;pointer-events:auto;"></canvas>
          </div>`;
        this._dom = this.add.dom(this.scale.width / 2, this.scale.height / 2).createFromHTML(html);
        this._dom.setOrigin(0.5);

        const canvas = this._dom.getChildByID("cleanCatchCanvas");
        // Improve pointer behavior on Safari/iOS
        canvas.style.touchAction = "none";

        const { destroy } = createCleanCatch(canvas);
        this._teardown = destroy;

        // ESC → back to GameScene
        this.input.keyboard.once("keydown-ESC", () => {
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });

        const backBtn = this.add.text(20, 20, "↩ Back", {
            fontFamily: CONFIG?.ui?.fontFamily || "Arial",
            fontSize: "22px",
            color: "#ff6b6b",
            fontStyle: "bold",
            backgroundColor: "#222",
        })
            .setPadding(6)
            .setOrigin(0, 0)
            .setDepth(200)
            .setScrollFactor(0)
            .setInteractive({ useHandCursor: true });

        backBtn.on("pointerup", () => {
            const playerName = this.registry.get("playerName");
            this.scene.start("GameScene", { playerName });
        });

        // Ensure teardown is always called
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._teardown?.());
        this.events.once(Phaser.Scenes.Events.DESTROY,  () => this._teardown?.());
    }
}

