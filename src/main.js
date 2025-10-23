// entry point for the game
// loads global CONFIG and shared SYSTEMS modules first so scenes can read them
import "./config.js";
import "./systems.js";
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import GameScene from "./scenes/GameScene.js";
import PlaygroundScene from "./scenes/PlaygroundScene.js";
import SoapSplashScene from "./scenes/SoapSplashScene.js";
import CleanCatchScene from "./scenes/CleanCatchScene.js";
import SoapSplashExplain from "./scenes/SoapSplashExplain.js";
import CleanCatchExplain from "./scenes/CleanCatchExplain.js";
import SchoolBathroomScene from "./scenes/SchoolBathroomScene.js";
import EndingScene from "./scenes/EndingScene.js";
import HandwashAnimationScene from "./scenes/HandwashAnimationScene.js";

import { DB } from "./db.js";
DB.init();

/**
 * Load WordBank.json and populate:
 * - CONFIG.soapSplash.words = { 1:[], 2:[], 3:[] }  // Good words grouped by difficulty
 * - CONFIG.cleanCatcher.words = { good:[], bad:[] }
 * - CONFIG.words = flat original array (legacy/back-compat)
 * - CONFIG.soapslasher.words = alias to soapSplash.words (spelling safety)
 *
 * It accepts either:
 *   [ { word, type, difficulty }, ... ]
 * or:
 *   { WordBank: [ ... ] }
 *
 * Set path in CONFIG.assets.wordBank (recommended), else falls back to "assets/data/WordBank.json".
 */
// main.js (near the top, before new Phaser.Game(config))

async function loadWordBankToConfig() {
    const url = "assets/data/WordBank.json"; // <- ensure this path exists (fix 404)
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        const data = await res.json();

        // Word array can be plain [] or {WordBank:[...]}
        const WB = Array.isArray(data) ? data
            : Array.isArray(data?.WordBank) ? data.WordBank
                : [];

        const mapStrToNum = (v) => {
            if (typeof v === "number") return Phaser.Math.Clamp(Math.round(v), 1, 3);
            const m = { easy: 1, normal: 2, medium: 2, hard: 3 };
            return m[String(v ?? "").toLowerCase()] ?? null;
        };

        // Strict “Good” words per difficulty
        const buckets = { 1: [], 2: [], 3: [] };
        for (const w of WB) {
            if (!w || !w.word) continue;
            if (w.type !== "Good") continue;
            const d = mapStrToNum(w.difficulty ?? w.level ?? w.tier);
            if (d == null) continue;
            buckets[d].push(String(w.word).trim());
        }

        // CleanCatch good/bad (optional here, but you asked earlier)
        const ccGood = [];
        const ccBad  = [];
        for (const w of WB) {
            if (!w || !w.word) continue;
            if (w.type === "Good") ccGood.push(String(w.word).trim());
            if (w.type === "Bad")  ccBad.push(String(w.word).trim());
        }

        // Dedup + shuffle so you start with variety
        const uniqShuffle = (arr) => Phaser.Utils.Array.Shuffle([...new Set(arr.filter(Boolean))]);

        CONFIG.soapSplash = CONFIG.soapSplash || {};
        CONFIG.soapSplash.words = {
            1: uniqShuffle(buckets[1]),
            2: uniqShuffle(buckets[2]),
            3: uniqShuffle(buckets[3]),
        };

        CONFIG.cleanCatch = CONFIG.cleanCatch || {};
        CONFIG.cleanCatch.words = {
            good: uniqShuffle(ccGood),
            bad:  uniqShuffle(ccBad),
        };

        // Helpful logs
        console.log("[WordBank] SoapSplash counts:",
            { easy: CONFIG.soapSplash.words[1]?.length || 0,
                normal: CONFIG.soapSplash.words[2]?.length || 0,
                hard: CONFIG.soapSplash.words[3]?.length || 0 });

        console.log("[WordBank] CleanCatch counts:",
            { good: CONFIG.cleanCatch.words.good?.length || 0,
                bad: CONFIG.cleanCatch.words.bad?.length || 0 });

    } catch (err) {
        console.error("[WordBank] load failed:", err);
        // If it fails, don’t leave a single default like ["wash"].
        CONFIG.soapSplash = CONFIG.soapSplash || {};
        CONFIG.soapSplash.words = { 1: [], 2: [], 3: [] };
        CONFIG.cleanCatch = CONFIG.cleanCatch || {};
        CONFIG.cleanCatch.words = { good: [], bad: [] };
    }
}


// phaser game configuration object
const config = {
    type: Phaser.AUTO,
    parent: "game",
    width: window.CONFIG.width,
    height: window.CONFIG.height,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        expandParent: false
    },
    backgroundColor: "#1e1e1e",
    physics: { default: "arcade", arcade: { gravity: { y: 0 } } },
    scene: [
        PreloadScene,
        MenuScene,
        GameScene,
        PlaygroundScene,
        SoapSplashExplain,
        SoapSplashScene,
        CleanCatchExplain,
        CleanCatchScene,
        HandwashAnimationScene,
        SchoolBathroomScene,
        EndingScene
    ],
    dom: { createContainer: true },
};
(async () => {
    await loadWordBankToConfig();     // <-- IMPORTANT
    new Phaser.Game(config);
})();
