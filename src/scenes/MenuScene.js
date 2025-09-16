export default class MenuScene extends Phaser.Scene {
    constructor() { super("MenuScene"); }

    preload() {
        this.load.image('frontpage_background', 'assets/images/backgrounds/frontpage.png');
    }

    create() {
        const { width, height } = this.scale;

        // === add background ==
        this.add.image(0, 0, 'frontpage_background')
            .setOrigin(0, 0)
            .setDisplaySize(width, height);

        // === title text ==
        this.add.text(width / 2, height * 0.35, "Kiko's Day", {
            fontFamily: "Arial",
            fontSize: "230px",
            color: "#ffffff",
            stroke: "#00c2ff",
            strokeThickness: 6
        }).setOrigin(0.5);

        // === button ===
        const btn = this.add.rectangle(width / 2, height * 0.6, 240, 70, 0x00c2ff)
            .setStrokeStyle(4, 0xffffff)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const label = this.add.text(btn.x, btn.y, "START GAME", {
            fontFamily: "Arial",
            fontSize: "28px",
            color: "#111",
            fontStyle: "bold"
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        // when click botton: name input popup
        const openDialog = () => this.showNameDialog();
        btn.on("pointerdown", openDialog);
        label.on("pointerdown", openDialog);

        // open pop up with enter (optional)
        this.input.keyboard.once("keydown-ENTER", openDialog);
    }

    // === name input popup ===
    showNameDialog() {
        const { width, height } = this.scale;

        // semi clear overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.55)
            .setOrigin(0, 0)
            .setDepth(10)
            .setInteractive();

        // panel
        const panelW = 600, panelH = 280;
        const panel = this.add.rectangle(width / 2, height / 2, panelW, panelH, 0x101425, 1)
            .setStrokeStyle(4, 0x00c2ff)
            .setOrigin(0.5)
            .setDepth(11);

        this.add.text(width / 2, height / 2 - 90, 'Enter Your Name', {
            fontFamily: 'Arial',
            fontSize: '36px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(12);

        // HTML DOM (input + button)
        const html = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:18px;">
        <input id="nameInput" type="text" maxlength="20" placeholder="Your name…" 
               style="padding:10px;font-size:20px;width:320px;border-radius:8px;border:1px solid #89bfff;outline:none;" />
        <div>
          <button id="okBtn" style="padding:10px 16px;font-size:18px;margin:0 6px;cursor:pointer;">OK</button>
          <button id="cancelBtn" style="padding:10px 16px;font-size:18px;margin:0 6px;cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
        const dom = this.add.dom(width / 2, height / 2 + 10).createFromHTML(html);
        dom.setDepth(12);

        // focus
        setTimeout(() => {
            const input = dom.getChildByID('nameInput');
            if (input) input.focus();
        }, 0);

        // ornanise function
        const close = () => {
            dom.destroy();
            panel.destroy();
            overlay.destroy();
            // 혹시 남아있을 수 있는 일회성 키 리스너 제거
            this.input.keyboard.removeListener('keydown-ENTER', onEnterSubmit);
            this.input.keyboard.removeListener('keydown-ESC', onEscClose);
        };

        // submit function
        const submit = () => {
            const input = dom.getChildByID('nameInput');
            const name = (input?.value || '').trim();
            if (!name) return; // ignore if it is empty
            this.registry.set('playerName', name);
            close();
            this.scene.start("GameScene");
        };

        // listener
        dom.addListener('click');
        dom.on('click', (evt) => {
            const id = evt.target?.id;
            if (id === 'okBtn') submit();
            if (id === 'cancelBtn') close();
        });

        const onEnterSubmit = () => submit();
        const onEscClose = () => close();

        this.input.keyboard.once('keydown-ENTER', onEnterSubmit);
        this.input.keyboard.once('keydown-ESC', onEscClose);
    }
}
