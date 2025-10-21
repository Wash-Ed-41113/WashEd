// db.js
// Lightweight in-memory DB (resets every time the tab/app closes)

export const DB = (() => {
    const STORAGE_KEY = "gameDatabase"; // name used to store data in sessionStorage

    //-----in memory database-----
    const state = {
        inited: false, // tracks if DB has been initialized
        ids: { session: 0, round: 0, event: 0 }, // counters for unique IDs
        games: [ // list of available games
            { game_id: 1, key: "SoapSplasher", title: "Soap Splasher" },
            { game_id: 2, key: "GermScrubber", title: "Germ Scrubber" }
        ],
        sessions: [],      // each session = {session_id, started_at, player_name}
        rounds: [],        // each round = gameplay info for a session
        typing_events: []  // each typing event = player input during a round
    };

    //---- load data from storage ----
    function loadFromStorage() {
        const saved = sessionStorage.getItem(STORAGE_KEY); // get saved data
        if (!saved) return; // nothing saved yet

        try {
            const parsed = JSON.parse(saved); // convert saved string to object
            Object.assign(state, parsed); // copy saved data into current state
            console.log("Database loaded from sessionStorage");
        } catch (e) {
            console.error("Failed to load from storage:", e); // error if JSON is bad - for debugging
        }
    }

    // ---- SAVE DATA TO STORAGE ----
    function saveToStorage() {
        try {
            const json = JSON.stringify(state); // convert state to string
            sessionStorage.setItem(STORAGE_KEY, json); // save to sessionStorage
            console.log("Database saved to sessionStorage");
        } catch (e) {
            console.error("Failed to save to storage:", e); // error if save fails - for debugging
        }
    }

    // ---- CLEAR STORAGE ON TAB CLOSE ----
    function clearStorage() {
        sessionStorage.removeItem(STORAGE_KEY); // delete saved data
        console.log("Storage cleared on tab close");
    }

    //----INIT - runs once ----
    function init() {
        if (state.inited) return; // skip if already initialized
        state.inited = true; // mark as initialized
//-----------PLACEHOLDER DATA FOR NOW-------------------------
        if (state.sessions.length === 0 && state.rounds.length === 0) {
            const jordan = beginSession("Jordan");
            const riya   = beginSession("Riya");
            const alex   = beginSession("Alex");

            const r1 = beginRound(jordan, "GermScrubber", "hard");
            const r2 = beginRound(riya, "GermScrubber", "medium");
            const r3 = beginRound(alex, "GermScrubber", "easy");

            finalizeRound(r1, { score: 1007 });
            finalizeRound(r2, { score: 120 });
            finalizeRound(r3, { score: 98 });
        }
    }

    //id and time helpers
    const now = () => Date.now(); // get current time in ms
    const nextId = k => (state.ids[k] += 1); // increment and return next ID

    //-----main functions-----
    function beginSession(playerName = "Player") {
        init(); // make sure DB is ready
        const session_id = nextId("session"); // get new session ID
        state.sessions.push({ session_id, started_at: now(), player_name: playerName }); // add session
        saveToStorage(); // save after change
        return session_id; // return new session ID
    }

    const gameId = key => state.games.find(g => g.key === key)?.game_id ?? null; // get game_id from key

    function beginRound(sessionId, gameKey, difficulty = "normal") {
        init(); // make sure DB is ready
        const gid = gameId(gameKey); // get game ID
        if (!gid) throw new Error(`Unknown game key: ${gameKey}`); // error if game not found
        const round_id = nextId("round"); // get new round ID
        state.rounds.push({ // add round info
            round_id, session_id: sessionId, game_id: gid,
            difficulty: String(difficulty),
            started_at: now(), ended_at: null, reason: null,
            score: 0, best_streak: 0, breaches: 0, base_score: 0, multiplier: 0
        });
        saveToStorage(); // save after change
        return round_id; // return new round ID
    }

    function logTyping(roundId, kind, payload = {}) {
        init(); // make sure DB is ready
        const event_id = nextId("event"); // get new event ID
        state.typing_events.push({ // add typing event
            event_id, round_id: roundId, ts: now(), kind,
            clean: payload.clean ?? null,
            streak: payload.streak ?? null,
            base_score: payload.base_score ?? null,
            total_score: payload.total_score ?? null,
            word: payload.word ?? null
        });
        saveToStorage(); // save after change
    }

    function finalizeRound(roundId, summary = {}) {
        const r = state.rounds.find(r => r.round_id === roundId); // find round
        if (!r) return; // skip if not found
        r.ended_at   = now(); // set end time
        r.reason     = summary.reason ?? r.reason; // update reason
        r.score      = summary.score ?? r.score; // update score
        r.best_streak= summary.bestStreak ?? r.best_streak; // update streak
        r.breaches   = summary.breaches ?? r.breaches; // update breaches
        r.base_score = summary.baseScore ?? r.base_score; // update base score
        r.multiplier = summary.multiplier ?? r.multiplier; // update multiplier
        saveToStorage(); // save after change
    }

    // simple queries for debug/leaderboards
    function topRounds({ gameKey = null, limit = 10 } = {}) {
        const gid = gameKey ? gameId(gameKey) : null; // get game ID if provided
        return state.rounds
            .filter(r => r.ended_at && (!gid || r.game_id === gid)) // only finished rounds
            .sort((a,b) => b.score - a.score) // sort by score, high to low
            .slice(0, limit) // take top N
            .map(r => ({ // format result
                round_id: r.round_id,
                score: r.score,
                best_streak: r.best_streak,
                player_name: state.sessions.find(s => s.session_id === r.session_id)?.player_name ?? "Player",
                game: state.games.find(g => g.game_id === r.game_id)?.title ?? "Game",
                ended_at: r.ended_at,
                difficulty: r.difficulty
            }));
    }

    const roundsBySession = sid => state.rounds.filter(r => r.session_id === sid); // get rounds for a session
    const eventsByRound   = rid => state.typing_events.filter(e => e.round_id === rid); // get events for a round
    const dump            = () => JSON.parse(JSON.stringify(state)); // deep copy of current state

    // ---- EVENT LISTENER TO CLEAR STORAGE ----
    window.addEventListener("beforeunload", clearStorage); // clear when tab closes

    return {
        init, beginSession, beginRound, logTyping, finalizeRound, // main functions
        query: { topRounds, roundsBySession, eventsByRound }, // query helpers
        dump, // get full state
        saveToStorage, loadFromStorage, clearStorage // optional external access
    };
})();