export default class LoadingScene extends Phaser.Scene {
    constructor() {
        super("LoadingScene");
    }

    words = ["TAP","WATER","RINSE","SOAP","TOWEL","WASH","HYGIENE","CLEAN"];

    preload() {
        this.load.image("assets/images/LoadingScene/");
        this.load.image("bubble", "bubble.png");
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        const cx = W / 2;
        const cy = H / 2;

        // 1) Full white background
        this.cameras.main.setBackgroundColor(0xffffff);

        // 2) Centered LOADING title
        this.add.text(cx, cy - 70, "LOADING", {
            fontFamily: "Arial",
            fontSize: "36px",
            color: "#333333",
            align: "center",
        }).setOrigin(0.5).setDepth(10);

        // 3) Rounded progress bar (centered)
        const barW = Math.min(300, W * 0.7);
        const barH = 44;
        const barX = cx - barW / 2;
        const barY = cy - barH / 2;

        const frame = this.add.graphics().setDepth(10);
        frame.lineStyle(6, 0x111111, 1);
        frame.fillStyle(0xffffff, 1);
        frame.fillRoundedRect(barX, barY, barW, barH, 14);
        frame.strokeRoundedRect(barX, barY, barW, barH, 14);

        const fillG = this.add.graphics().setDepth(11);
        const pad = 8;
        const innerH = barH - pad * 2;
        const innerY = barY + pad;
        const drawFill = (pct) => {
            const innerW = Math.max(1, (barW - pad * 2) * pct);
            fillG.clear();
            fillG.fillStyle(0x0f0f10, 1);
            fillG.fillRoundedRect(barX + pad, innerY, innerW, innerH, 10);
        };
        drawFill(0);

        // Tie to real loader if you queue assets here:
        this.load.on("progress", v => drawFill(v));
        // Demo fill to 100% so you can see it animate:
        this.tweens.addCounter({
            from: 0, to: 1, duration: 1500, ease: "Sine.easeInOut",
            onUpdate: (tw) => drawFill(tw.getValue()),
        });

        // 4) Smaller floating bubbles around the screen
        const bubbleScale = 0.15;       // <<< smaller bubbles
        const labelStyle = { font: "bold 14px Arial", color: "#0d2b4a" };

        // Place bubbles at angles around an ellipse so they frame the middle
        const rx = Math.max(120, Math.min(W * 0.42, 360));
        const ry = Math.max(90,  Math.min(H * 0.33, 260));

        this.words.forEach((word, i) => {
            const t = (i / this.words.length) * Math.PI * 2;  // angle
            const x = cx + Math.cos(t) * rx;
            const y = cy + Math.sin(t) * ry;

            const b = this.add.image(x, y, "bubble")
                .setScale(bubbleScale)
                .setAlpha(0.9)
                .setDepth(2);

            // gentle bobbing
            // this.tweens.add({
            //     targets: b,
            //     y: y - 8,
            //     duration: 1500,
            //     ease: "Sine.inOut",
            //     yoyo: true,
            //     repeat: -1,
            //     delay: Phaser.Math.Between(0, 600),
            // });

            this.add.text(x, y, word, labelStyle).setOrigin(0.5).setDepth(3);
        });
    }
}
