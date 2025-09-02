/*
* CONFIG - all tunable knobs are here as in global configs
* Everything is in world-pixels and milliseconds not css pixels. */
const CONFIG = {
    // canvas / main world dimensions
    width: 1920,
    height: 1080,


    useSpawner: true, // weather to spawn germs or not..



    angleSpreadDeg: 20,
    cornerMargin: 120,
    cornerBandWidth: 360,



    // SPAWN SHAPE
    /* A Triangle w. its acute angle pointing at the sink...
    * Spawn angle in degrees measuerd from the sink's +ve Xaxis */
    angleMinDeg: 0,
    angleMaxDeg: 90,

    // anti clumping...
    minSpawnSeparationPx: 160, // reject new spawn too close to existing ones
    maxSpawnAttempts: 12, // how many tries per spawn to find a spot per tick


    // Pacing
    spawnIntervalMs: 1800,
    germSpeed: 60,
    wobble: 0.50,

    // game rules
    rSink: 80,  // sinks collision radius
    despawnMargin: 60,  // kill germs if wanters far off screen

    words: ['wash','soap','clean','water','tap','filter','boil','rinse','scrub'], // todo later replace with database

};