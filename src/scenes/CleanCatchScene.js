// src/scenes/CleanCatchScene.js
import { createCleanCatch } from "../cleanCatchGame.js";

export default class CleanCatchScene extends Phaser.Scene {
    constructor() {
        super("CleanCatch");
        this._teardown = null;
        this._dom = null;
    }

    create() {
        const { width, height } = this.scale;

        // Background (optional dim)
        this.add.rectangle(0, 0, width, height, 0x0b1520, 1).setOrigin(0);

        // Panel container with a canvas we control
        const html = `
      <div style="display:flex;align-items:center;justify-content:center;width:${width}px;height:${height}px;">
        <canvas id="cleanCatchCanvas" width="${Math.floor(width)}" height="${Math.floor(height)}" style="max-width:100%;max-height:100%;outline:none;"></canvas>
      </div>`;
        this._dom = this.add.dom(width/2, height/2).createFromHTML(html);
        this._dom.setOrigin(0.5);

        const canvas = this._dom.getChildByID("cleanCatchCanvas");
        // Kick off the vanilla game inside our canvas
        const { destroy } = createCleanCatch(canvas);
        this._teardown = destroy;

        // Simple ESC to return to menu
        this.input.keyboard.once("keydown-ESC", () => this.scene.start("MenuScene"));
    }

    shutdown() {
        if (this._teardown) this._teardown();
    }

    destroy() {
        if (this._teardown) this._teardown();
        super.destroy();
    }
}
