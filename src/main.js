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

// === Single source of truth for WordBank.json ===
// (Add/replace this whole block after CONFIG is created and before starting Phaser)

window.CONFIG.wordsReady = false;
window.CONFIG.soapSplash = window.CONFIG.soapSplash || {};
window.CONFIG.cleanCatch = window.CONFIG.cleanCatch || {};

// helpers
const byDifficulty = () => ({ 1: [], 2: [], 3: [] });
const shuffle = (arr) => Phaser.Utils.Array.Shuffle(arr.slice()); // pure shuffle copy

// build a no-repeat deck iterator
function makeDeck(array) {
    const base = Array.isArray(array) ? array.filter(Boolean) : [];
    let bag = shuffle(base);
    let i = 0;
    return () => {
        if (!bag.length) return "";        // fail-safe if empty
        const w = bag[i++];
        if (i >= bag.length) { bag = shuffle(base); i = 0; }
        return w;
    };
}

async function loadWordBankOnce() {
    try {
        // prefer explicit config path if provided
        const tryPaths = [
            window.CONFIG?.assets?.wordBank,          // e.g., "assets/data/WordBank.json"
            "assets/WordBank.json",
            "assets/data/WordBank.json",
            "WordBank.json",
            "/WordBank.json"
        ].filter(Boolean);

        let json = null;
        let lastErr = null;

        for (const p of tryPaths) {
            try {
                const r = await fetch(p, { cache: "no-store" });
                if (r.ok) { json = await r.json(); break; }
                lastErr = new Error(`HTTP ${r.status} for ${p}`);
            } catch (e) { lastErr = e; }
        }

        if (!json) {
            console.warn("[WordBank] Missing JSON; using empty pools. Last error:", lastErr);
            json = { WordBank: [] };
        }

        // Support either plain array or { WordBank: [...] }
        const rows = Array.isArray(json) ? json
            : Array.isArray(json?.WordBank) ? json.WordBank
                : [];

        // buckets
        const ss = byDifficulty();     // SoapSplash uses Good words by difficulty
        const ccGood = [];
        const ccBad  = [];

        for (const row of rows) {
            if (!row) continue;
            const word = (row.word ?? row.Word ?? "").toString().trim();
            const type = (row.type ?? row.Type ?? "").toString().trim().toLowerCase();

            // normalise difficulty: accept number or strings like easy/medium/hard
            let diff = row.difficulty ?? row.Difficulty ?? row.level ?? row.Level ?? row.tier ?? row.Tier;
            if (typeof diff === "string") {
                const m = { easy: 1, normal: 2, medium: 2, hard: 3 };
                diff = m[diff.toLowerCase()];
            } else {
                diff = Number(diff);
            }

            if (!word) continue;

            if (type === "good") {
                if ([1, 2, 3].includes(diff)) ss[diff].push(word);
                ccGood.push(word);
            } else if (type === "bad") {
                ccBad.push(word);
            }
        }

        // expose raw pools
        window.CONFIG.soapSplash.words = ss;                 // {1:[],2:[],3:[]}
        window.CONFIG.cleanCatch.words = { good: ccGood, bad: ccBad };

        // expose per-game deck APIs (no-repeat suppliers) for SoapSplash
        window.CONFIG.soapSplash._decks = {};                // keyed by difficulty number
        window.CONFIG.soapSplash.getDeck = (levelNum) => {
            const lvl = Number(levelNum) || 1;
            if (!window.CONFIG.soapSplash._decks[lvl]) {
                window.CONFIG.soapSplash._decks[lvl] = makeDeck(window.CONFIG.soapSplash.words[lvl] || []);
            }
            return window.CONFIG.soapSplash._decks[lvl];
        };
        window.CONFIG.soapSplash.resetDeck = (levelNum) => {
            const lvl = Number(levelNum) || 1;
            window.CONFIG.soapSplash._decks[lvl] = makeDeck(window.CONFIG.soapSplash.words[lvl] || []);
        };

        // CleanCatch: separate suppliers for good and bad
        window.CONFIG.cleanCatch._goodDeck = makeDeck(ccGood);
        window.CONFIG.cleanCatch._badDeck  = makeDeck(ccBad);
        window.CONFIG.cleanCatch.nextGood  = () => window.CONFIG.cleanCatch._goodDeck();
        window.CONFIG.cleanCatch.nextBad   = () => window.CONFIG.cleanCatch._badDeck();
        window.CONFIG.cleanCatch.resetDecks = () => {
            window.CONFIG.cleanCatch._goodDeck = makeDeck(ccGood);
            window.CONFIG.cleanCatch._badDeck  = makeDeck(ccBad);
        };

        // ready flag
        window.CONFIG.wordsReady = true;

        // quick visibility in DevTools
        console.log("[WordBank] SoapSplash counts:", {
            easy: ss[1].length, normal: ss[2].length, hard: ss[3].length
        });
        console.log("[WordBank] CleanCatch counts:", {
            good: ccGood.length, bad: ccBad.length
        });

    } catch (e) {
        console.error("[WordBank] Fatal load error:", e);
        window.CONFIG.wordsReady = true; // let the game proceed (with empty decks)
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

// boot: load words once, then start Phaser
(async () => {
    await loadWordBankOnce();   // <-- IMPORTANT (single source of truth)
    new Phaser.Game(config);
})();
