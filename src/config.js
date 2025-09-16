
/*
* All functions and magic numbers have been
* annotated to explain what they do, how they interact, and what they depend on.
*/

window.CONFIG = {
    width: 1920,
    height: 1080,


    fontFamily: 'montserrat',//montserrat
    useSpawner: true,
    maxGerms: 5,
    germSpriteSize: 0.12,
    verticalSpaceLabel:55,
    labelTextSize: 30,
    breachPenalty: 25,
    breachStatement: "Its Okay try again!",
    reason: "Time's Up!!",

    gameDurationMin: 1,
    gameDurationTextHud: '01:00',

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
