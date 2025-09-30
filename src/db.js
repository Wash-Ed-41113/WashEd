// db.js
// Lightweight in-memory DB (resets every time the tab/app closes)

export const DB = (() => {
    const state = {
        inited: false,
        ids: { session: 0, round: 0, event: 0 },
        games: [
            { game_id: 1, key: "SoapSplash", title: "Soap Splash" },
            { game_id: 2, key: "CleanCatch", title: "Clean Catch" }
        ],
        sessions: [],      // {session_id, started_at, player_name}
        rounds: [],        // {round_id, session_id, game_id, difficulty, started_at, ended_at, reason, score, best_streak, breaches, base_score, multiplier}
        typing_events: []  // {event_id, round_id, ts, kind, clean, streak, base_score, total_score, word}
    };

    function init() {
        if (state.inited) return;
        state.inited = true;
    }
    const now = () => Date.now();
    const nextId = k => (state.ids[k] += 1);

    function beginSession(playerName = "Player") {
        init();
        const session_id = nextId("session");
        state.sessions.push({ session_id, started_at: now(), player_name: playerName });
        return session_id;
    }
    const gameId = key => state.games.find(g => g.key === key)?.game_id ?? null;

    function beginRound(sessionId, gameKey, difficulty = "normal") {
        init();
        const gid = gameId(gameKey);
        if (!gid) throw new Error(`Unknown game key: ${gameKey}`);
        const round_id = nextId("round");
        state.rounds.push({
            round_id, session_id: sessionId, game_id: gid,
            difficulty: String(difficulty),
            started_at: now(), ended_at: null, reason: null,
            score: 0, best_streak: 0, breaches: 0, base_score: 0, multiplier: 0
        });
        return round_id;
    }

    function logTyping(roundId, kind, payload = {}) {
        init();
        const event_id = nextId("event");
        state.typing_events.push({
            event_id, round_id: roundId, ts: now(), kind,
            clean: payload.clean ?? null,
            streak: payload.streak ?? null,
            base_score: payload.base_score ?? null,
            total_score: payload.total_score ?? null,
            word: payload.word ?? null
        });
    }

    function finalizeRound(roundId, summary = {}) {
        const r = state.rounds.find(r => r.round_id === roundId);
        if (!r) return;
        r.ended_at   = now();
        r.reason     = summary.reason ?? r.reason;
        r.score      = summary.score ?? r.score;
        r.best_streak= summary.bestStreak ?? r.best_streak;
        r.breaches   = summary.breaches ?? r.breaches;
        r.base_score = summary.baseScore ?? r.base_score;
        r.multiplier = summary.multiplier ?? r.multiplier;
    }

    // simple queries for debug/leaderboards
    function topRounds({ gameKey = null, limit = 10 } = {}) {
        const gid = gameKey ? gameId(gameKey) : null;
        return state.rounds
            .filter(r => r.ended_at && (!gid || r.game_id === gid))
            .sort((a,b) => b.score - a.score)
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
    const dump            = () => JSON.parse(JSON.stringify(state));

    return {
        init, beginSession, beginRound, logTyping, finalizeRound,
        query: { topRounds, roundsBySession, eventsByRound },
        dump
    };
})();
