// db.js
// Lightweight in-memory DB (resets every time the tab/app closes)

export const DB = (() => {
    const STORAGE_KEY = "gameDatabase"; // name used to store data in sessionStorage

    // ----- in-memory database -----
    const state = {
        inited: false,
        ids: { session: 0, round: 0, event: 0 },
        games: [
            { game_id: 1, key: "SoapSplasher", title: "Soap Splasher" },
            { game_id: 2, key: "GermScrubber", title: "Germ Scrubber" }
        ],
        sessions: [],      // { session_id, started_at, player_name }
        rounds: [],        // per-play summary rows
        typing_events: []  // detailed events per round
    };

    // ---- load / save / clear ----
    function loadFromStorage() {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
            console.log("Database loaded from sessionStorage");
        } catch (e) {
            console.error("Failed to load from storage:", e);
        }
    }

    function saveToStorage() {
        try {
            const json = JSON.stringify(state);
            sessionStorage.setItem(STORAGE_KEY, json);
            console.log("Database saved to sessionStorage");
        } catch (e) {
            console.error("Failed to save to storage:", e);
        }
    }

    function clearStorage() {
        sessionStorage.removeItem(STORAGE_KEY);
        console.log("Storage cleared on tab close");
    }

    // ---- init (runs once per page lifetime) ----
    function init() {
        if (state.inited) return;
        state.inited = true;

        // If you want persistence across reloads in the *same* tab without closing it,
        // uncomment the next line. It has no effect if you close the tab, because we clear on beforeunload.
        // loadFromStorage();
    }

    // ---- helpers ----
    const now = () => Date.now();
    const nextId = k => (state.ids[k] += 1);
    const gameId = key => state.games.find(g => g.key === key)?.game_id ?? null;

    // ---- main API ----
    function beginSession(playerName = "Player") {
        init();
        const session_id = nextId("session");
        state.sessions.push({ session_id, started_at: now(), player_name: playerName });
        saveToStorage();
        return session_id;
    }

    function beginRound(sessionId, gameKey, difficulty = "normal") {
        init();
        const gid = gameId(gameKey);
        if (!gid) throw new Error(`Unknown game key: ${gameKey}`);
        const round_id = nextId("round");
        state.rounds.push({
            round_id,
            session_id: sessionId,
            game_id: gid,
            difficulty: String(difficulty),
            started_at: now(),
            ended_at: null,
            reason: null,
            score: 0,
            best_streak: 0,
            breaches: 0,
            base_score: 0,
            multiplier: 0
        });
        saveToStorage();
        return round_id;
    }

    function logTyping(roundId, kind, payload = {}) {
        init();
        const event_id = nextId("event");
        state.typing_events.push({
            event_id, round_id: roundId, ts: now(), kind,
            clean:        payload.clean ?? null,
            streak:       payload.streak ?? null,
            base_score:   payload.base_score ?? null,
            total_score:  payload.total_score ?? null,
            word:         payload.word ?? null
        });
        saveToStorage();
    }

    function finalizeRound(roundId, summary = {}) {
        const r = state.rounds.find(r => r.round_id === roundId);
        if (!r) return;
        r.ended_at    = now();
        r.reason      = summary.reason      ?? r.reason;
        r.score       = summary.score       ?? r.score;
        r.best_streak = summary.bestStreak  ?? r.best_streak;
        r.breaches    = summary.breaches    ?? r.breaches;
        r.base_score  = summary.baseScore   ?? r.base_score;
        r.multiplier  = summary.multiplier  ?? r.multiplier;
        saveToStorage();
    }

    // ---- queries (rounds) ----
    function topRounds({ gameKey = null, limit = 10 } = {}) {
        const gid = gameKey ? gameId(gameKey) : null;
        return state.rounds
            .filter(r => r.ended_at && (!gid || r.game_id === gid))
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(r => ({
                round_id: r.round_id,
                score: r.score,
                best_streak: r.best_streak,
                player_name: state.sessions.find(s => s.session_id === r.session_id)?.player_name ?? "Player",
                game: state.games.find(g => g.game_id === r.game_id)?.title ?? "Game",
                ended_at: r.ended_at,
                difficulty: r.difficulty
            }));
    }

    const roundsBySession = sid => state.rounds.filter(r => r.session_id === sid);
    const eventsByRound   = rid => state.typing_events.filter(e => e.round_id === rid);

    // ---- NEW: totals & leaderboard across sessions ----
    function sessionTotal(sessionId) {
        return state.rounds
            .filter(r => r.session_id === sessionId && r.ended_at)
            .reduce((sum, r) => sum + (r.score || 0), 0);
    }

    function topTotals({ limit = 10 } = {}) {
        const rows = state.sessions.map(s => ({
            session_id: s.session_id,
            player_name: s.player_name || "Player",
            total: sessionTotal(s.session_id),
            started_at: s.started_at
        }));
        return rows
            .sort((a, b) => (b.total - a.total) || (a.started_at - b.started_at))
            .slice(0, limit);
    }

    const dump = () => JSON.parse(JSON.stringify(state));

    // wipe everything when the tab/window closes
    window.addEventListener("beforeunload", clearStorage);

    return {
        init, beginSession, beginRound, logTyping, finalizeRound,
        query: {
            topRounds, roundsBySession, eventsByRound,
            sessionTotal, topTotals
        },
        dump,
        saveToStorage, loadFromStorage, clearStorage
    };
})();
