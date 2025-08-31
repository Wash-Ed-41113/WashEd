// basic config for geometry, timings and words

const CONFIG = {
    width: 1920,
    height: 1080,

    minSpawnSeparationPx: 160,
    maxSpawnAttempts: 12,


    useCornerAim: true,
    angleSpreadDeg: 20,
    cornerMargin: 120,
    cornerBandWidth: 360,


    rInner: 260,
    rOuter: 760,
    angleMinDeg: 0,
    angleMaxDeg: 90,


    spawnIntervalMs: 1800,
    germSpeed: 60,
    wobble: 0.50,
    rSink: 80,
    despawnMargin: 60,

    words: ['wash','soap','clean','water','tap','filter','boil','rinse','scrub'], // todo later replace with database

    DEBUG_BAND: false // set true later if wanna make visualise the matrix later
};