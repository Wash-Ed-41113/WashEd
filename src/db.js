// src/db.js
// Lightweight in-memory DB with sessionStorage persistence (clears when tab closes)

export const DB = (() => {
    const STORAGE_KEY = "washed_game_db_v2";

    const state = {
        inited: false,
        ids: { session: 0, round: 0 },
        games: [
            { game_id: 1, key: "SoapSplash", title: "Soap Splash" },
            { game_id: 2, key: "CleanCatch", title: "Clean Catch" }
        ],
        sessions: [],  // { session_id, player_name, started_at, ended_at? }
        rounds: []     // { round_id, session_id, game_key, started_at, ended_at, score, best_streak, breaches, base_score, bonus_score, reason }
        // _telemetry: [] // optional; created on demand if you enable it in logTyping
    };

    // ---------- persistence ----------
    function save() {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn("[DB] save failed:", e);
        }
    }
    function load() {
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            // basic shape guard
            if (parsed && parsed.sessions && parsed.rounds) {
                Object.assign(state, parsed);
            }
        } catch (e) {
            console.warn("[DB] load failed:", e);
        }
    }
    function clearAll() {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    }

    // ---------- time/id helpers ----------
    const now = () => new Date().toISOString();
    const nextId = (k) => ++state.ids[k];

    // ---------- lifecycle ----------
    function init() {
        if (state.inited) return;
        load();
        state.inited = true;
        // soft migrate
        state.ids.session = Number(state.ids.session) || 0;
        state.ids.round   = Number(state.ids.round)   || 0;
        save();
    }

    function beginSession(playerName) {
        const session_id = nextId("session");
        state.sessions.push({
            session_id,
            player_name: (playerName || "Player").trim() || "Player",
            started_at: now(),
        });
        save();
        return session_id;
    }

    function endSession(session_id) {
        const s = state.sessions.find(s => s.session_id === session_id);
        if (s && !s.ended_at) { s.ended_at = now(); save(); }
    }

    function beginRound(session_id, game_key) {
        const s = state.sessions.find(s => s.session_id === session_id);
        if (!s) throw new Error("beginRound: invalid session_id");
        const round_id = nextId("round");
        state.rounds.push({
            round_id, session_id, game_key,
            started_at: now(),
            ended_at: null,
            score: 0,
            best_streak: 0,
            breaches: 0,
            base_score: 0,
            bonus_score: 0,
            reason: null
        });
        save();
        return round_id;
    }

    function finalizeRound(round_id, summary = {}) {
        const r = state.rounds.find(r => r.round_id === round_id);
        if (!r) return;
        r.ended_at    = now();
        r.score       = Number(summary.score ?? r.score ?? 0);
        r.best_streak = Number(summary.best_streak ?? summary.bestStreak ?? r.best_streak ?? 0);
        r.breaches    = Number(summary.breaches ?? r.breaches ?? 0);
        r.base_score  = Number(summary.base_score ?? summary.baseScore ?? r.base_score ?? 0);
        r.bonus_score = Number(summary.bonus_score ?? summary.bonusScore ?? r.bonus_score ?? 0);
        r.reason      = summary.reason ?? r.reason ?? null;
        save();
    }

    // ---------- telemetry (safe no-op by default) ----------
    /**
     * Logs typing-related events from systems.js (mistake/complete/keypress/etc).
     * This is intentionally a no-op to avoid any gameplay side-effects.
     * To persist telemetry, uncomment the lines below.
     */
    function logTyping(event, payload = {}) {
        try {
            // // OPTIONAL: enable if you want to persist telemetry
            // state._telemetry = state._telemetry || [];
            // state._telemetry.push({ event, ...payload, at: now() });
            // save();
        } catch (_) {
            // never throw from telemetry
        }
    }

    // ---------- queries ----------
    function players() {
        // unique player list with counts
        const map = new Map();
        for (const s of state.sessions) {
            const name = s.player_name || "Player";
            const v = map.get(name) || { name, sessions: 0, last_seen: "" };
            v.sessions += 1;
            v.last_seen = s.started_at > v.last_seen ? s.started_at : v.last_seen;
            map.set(name, v);
        }
        return Array.from(map.values())
            .sort((a, b) => b.sessions - a.sessions || (b.last_seen || "").localeCompare(a.last_seen || ""));
    }

    function roundsBySession(session_id) {
        return state.rounds
            .filter(r => r.session_id === session_id && typeof r.score === "number")
            .sort((a, b) => b.score - a.score || (b.ended_at || "").localeCompare(a.ended_at || ""));
    }

    function topRoundsBySession(session_id, n = 3) {
        return roundsBySession(session_id).slice(0, n);
    }

    function sessionTotal(session_id) {
        return state.rounds
            .filter(r => r.session_id === session_id)
            .reduce((acc, r) => acc + (r.score || 0), 0);
    }

    function topTotals(n = 10) {
        // Top sessions by total score
        const totals = new Map(); // session_id -> total
        for (const r of state.rounds) {
            totals.set(r.session_id, (totals.get(r.session_id) || 0) + (r.score || 0));
        }
        const rows = state.sessions.map(s => ({
            session_id: s.session_id,
            player_name: s.player_name,
            total: totals.get(s.session_id) || 0,
            started_at: s.started_at
        }));
        return rows.sort((a, b) => b.total - a.total || (b.started_at || "").localeCompare(a.started_at || "")).slice(0, n);
    }

    // NEW: total for a specific game within a session
    function sessionGameTotal(session_id, game_key) {
        if (!session_id || !game_key) return 0;
        return state.rounds
            .filter(r => r.session_id === session_id && r.game_key === game_key)
            .reduce((acc, r) => acc + (r.score || 0), 0);
    }

    // NEW: best overall session totals (top N sessions)
    function bestSessionTotals(n = 1) {
        const totals = new Map(); // session_id -> total
        for (const r of state.rounds) {
            totals.set(r.session_id, (totals.get(r.session_id) || 0) + (r.score || 0));
        }
        const rows = state.sessions.map(s => ({
            session_id: s.session_id,
            player_name: s.player_name,
            total: totals.get(s.session_id) || 0,
            started_at: s.started_at
        }));
        return rows
            .sort((a, b) => b.total - a.total || (b.started_at || "").localeCompare(a.started_at || ""))
            .slice(0, n);
    }

    function dump() { return JSON.parse(JSON.stringify(state)); }

    // clear DB when tab/window closes (keeps memory for this tab life)
    window.addEventListener("beforeunload", clearAll);

    return {
        // lifecycle
        init, beginSession, endSession, beginRound, finalizeRound,
        // queries
        query: {
            players, roundsBySession, topRoundsBySession, sessionTotal, topTotals,
            sessionGameTotal, bestSessionTotals
        },
        // telemetry
        logTyping,
        // debug
        dump
    };
})();
