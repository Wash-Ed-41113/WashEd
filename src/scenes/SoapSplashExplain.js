/* global Phaser, CONFIG */
import systems from "../systems.js";
import { AudioManager } from "../systems.js";

const MINI_KEY  = "germ_scrubber_music";
const MINI_URLS = ["assets/sounds/germ-scrubber.mp3", "./assets/sounds/germ-scrubber.mp3"];

export default class SoapSplashExplain extends Phaser.Scene {
    constructor() {
        super("SoapSplashExplain");
        this._armed = false;
    }

    preload() {
        const explain = CONFIG.assets.kiko;
        this.load.image("KikoBase", explain.base);
        this.load.image("KikoCheer", explain.cheer);
        this.load.image("DialogPanel", CONFIG.assets.ui.dialogPanel);
        this.load.image("UI_Next", CONFIG.assets.ui.next);

        if (!this.cache.audio.exists(MINI_KEY)) this.load.audio(MINI_KEY, MINI_URLS);
        this.load.on("loaderror", (f) => { if (f?.key === MINI_KEY) console.warn("[Explain] BGM load failed:", f.src||f.url); });
    }

    create() {
        const { width: W, height: H } = this.scale;
        const username = this.registry.get("playerName") || "friend";
        systems.ui.placeLogo(this);

        // --- Master audio sanity ---
        try { this.sound.context?.resume?.(); } catch {}
        this.sound.pauseOnBlur = false;
        this.registry.set("mute", false);
        this.sound.mute = false;
        this.sound.setVolume?.(1);

        try { AudioManager.pauseGroup?.("global"); } catch {}
        try {
            this.sound.get("kikos_day")?.isPlaying && this.sound.get("kikos_day").pause();
            this.sound.get("global_bg")?.isPlaying && this.sound.get("global_bg").pause();
            if (typeof window !== "undefined" && window.__GLOBAL_BGM__?.isPlaying) window.__GLOBAL_BGM__.pause();
        } catch {}

        const ensurePlay = () => {
            try { this.sound.unlock?.(); } catch {}
            let inst = this.sound.get(MINI_KEY);

            const reallyPlay = () => {
                try {
                    AudioManager.play(this, MINI_KEY, { group: "game", loop: true, volume: 0.8 });
                    inst = this.sound.get(MINI_KEY);
                } catch {
                    if (!inst) inst = this.sound.add(MINI_KEY, { loop: true, volume: 0.8 });
                    if (!inst.isPlaying) inst.play();
                }
                if (inst) { inst.setMute?.(false); inst.setVolume?.(0.8); }
                if (typeof window !== "undefined") window.__SOAP_EXPLAIN_BGM__ = inst || null;
                console.log("[Explain] play check", { locked: this.sound.locked, ctx: this.sound.context?.state, playing: !!inst?.isPlaying });
            };

            // if webaudio is locked, wait for unlock once
            if (this.sound.locked) this.sound.once("unlocked", reallyPlay);
            else reallyPlay();
        };

        // immediate try + gesture/visibility fallbacks
        ensurePlay();
        if (!this._armed) {
            this._armed = true;
            const fire = () => ensurePlay();
            this.input.once("pointerdown", fire);
            this.input.keyboard?.once("keydown", fire);
            window.addEventListener("mousedown", fire, { once: true, passive: true });
            window.addEventListener("touchstart", fire, { once: true, passive: true });
            document.addEventListener("visibilitychange", () => { if (!document.hidden) { try { this.sound.context?.resume?.(); } catch {} ensurePlay(); }});
        }

        // keep music alive on exit (no stop here)
        const noop = () => {};
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, noop);
        this.events.once(Phaser.Scenes.Events.SLEEP,    noop);
        this.events.once(Phaser.Scenes.Events.DESTROY,  noop);

        // ---- UI ----
        this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.5);
        let kikoKey = "KikoBase";
        if (!this.textures.exists(kikoKey)) { const any = Object.keys(this.textures.list)[0]; if (any) kikoKey = any; }
        this.kiko = this.add.sprite(W*0.15, H*0.5, kikoKey).setOrigin(0.5).setScale(0.20);

        let panel;
        if (this.textures.exists("DialogPanel")) panel = this.add.image(W/2, H*0.50, "DialogPanel").setOrigin(0.5).setScale(0.5);
        else panel = this.add.rectangle(W/2, H*0.75, Math.min(W*0.8, 960), 260, 0xffffff, 1).setStrokeStyle(4, 0x7ec8ff).setOrigin(0.5);

        const panelW = panel.displayWidth || panel.width || Math.min(W*0.8, 900);
        const style = { fontFamily: CONFIG.ui.fontFamily, fontSize: "64px", color: "#000", wordWrap: { width: Math.max(120, Math.floor(panelW*0.8)) }, align: "center" };

        const lines = [
            `Okay, ${username}, it’s time for the Germ Scrubber Showdown!`,
            `The GERMS are coming and we need your HELP to STOP them.`,
            `You have 1 MINUTE to TYPE the clean WORDS to make the GERMS go away.`,
            `Each clean WORD helps you SCRUB better with SOAP so the GERMS disappear!`,
            `You have 3 LIVES. If you miss one, the GERMS reach the sink and you LOSE a LIFE.`,
            `Let’s fight the GERMS together!`,
        ];
        let i = 0;
        const text = this.add.text(panel.x, panel.y, lines[i], style).setOrigin(0.5).setDepth((panel.depth||0)+1);

        const nextLine = () => {
            ensurePlay(); // 버튼/엔터 제스처마다 재확인
            i++;
            if (i % 2 === 0 && this.textures.exists("KikoCheer")) this.kiko.setTexture("KikoCheer");
            else if (this.textures.exists("KikoBase")) this.kiko.setTexture("KikoBase");

            if (i < lines.length) text.setText(lines[i]);
            else {
                const fadeTargets = [this.kiko, text, panel, nextBtn]; if (nextText) fadeTargets.push(nextText);
                this.tweens.add({ targets: fadeTargets, alpha: 0, duration: 600, onComplete: () => { this.scene.stop(); this.scene.resume("SoapSplash"); }});
            }
        };

        let nextBtn, nextText = null;
        const nx = W*0.85, ny = H*0.5;
        if (this.textures.exists("UI_Next")) {
            nextBtn = this.add.image(nx, ny, "UI_Next").setOrigin(0.5).setDepth((panel.depth||0)+2)
                .setInteractive({ useHandCursor: true, pixelPerfect: true });
            const targetH = Math.min(120, H*0.12), s = targetH / (nextBtn.height || 1);
            nextBtn.setScale(s);
            nextBtn.on("pointerover", () => nextBtn.setScale(s*1.05));
            nextBtn.on("pointerout",  () => nextBtn.setScale(s));
            nextBtn.on("pointerdown", () => { nextBtn.setScale(s*0.97); nextLine(); });
            nextBtn.on("pointerup",   () => nextBtn.setScale(s*1.05));
        } else {
            nextBtn = this.add.rectangle(nx, ny, 160, 60, 0x0077cc).setStrokeStyle(3, 0xffffff).setOrigin(0.5).setDepth((panel.depth||0)+2)
                .setInteractive({ useHandCursor: true });
            nextText = this.add.text(nx, ny, "Next", { fontFamily: CONFIG.ui.fontFamily, fontSize: "26px", color: "#fff", fontStyle: "bold" })
                .setOrigin(0.5).setDepth((panel.depth||0)+3);
            nextBtn.on("pointerdown", nextLine);
        }
        this.input.keyboard.on("keydown-ENTER", nextLine);
    }
}
