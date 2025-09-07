/*
* CONFIG - all tunable knobs are here as in global configs
* Everything is in world-pixels and milliseconds not css pixels. */// Make CONFIG global for non-module scripts
window.CONFIG = {
    width: 1920,
    height: 1080,

    useSpawner: true,
    maxGerms: 5,
    germSpriteSize: 0.12,

    gameDurationMin: 1,

    breachesFontSize: 20,

    angleSpreadDeg: 20,
    cornerMargin: 120,
    cornerBandWidth: 360,

    angleMinDeg: 0,
    angleMaxDeg: 90,

    minSpawnSeparationPx: 200,
    maxSpawnAttempts: 12,

    spawnIntervalMs: 1800,
    germSpeed: 120,
    wobble: 0.50,

    rSink: 80,
    despawnMargin: 60,

    words: ['wash','soap','clean','water','tap','filter','boil','rinse','scrub'],
};
