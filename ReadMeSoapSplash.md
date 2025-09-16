

Problem and Success Criteria 
– Type the word under each germ to pop it before it reaches the water source at the origin  (X-Y Coordinate)
– Plater wins if the timer ends and fewer than 5 germs reached the source  (can change later for different difficulties)
– Player Looses asap 5 germs reach the source 
– Playable on desktop 

Scope as of now.
In scope - Single scene, random spawns outside safe radius, constant-speed accelerating to origin, type‑to‑kill, fixed word list, single round timer, basic UI, database injections for words, Streaks and scores.

Stretch - Difficulty scaling, audio, pause/resume

Architecture Sketch
Scene - MainScene 
Systems - SpawnSystem, TypingSystem, GermSystem, UISystem, RoundSystem
State - {
         germs: Map, 
         breaches: number, 
         popped: number, 
         timeLeft: number, 
         currentTargetId?: string
        }


Module Breakdown 
Core Geometry - X-Y cordinate plane with 0,0 as center at bottom left, convert to screens bottom left as (origin - The sink )
        // Play area is a space made of 2 concnetric circles sliced via a rectangle... so basically 2 huge arcs.
Spawn System - every Variable mili sec, at randon cordinate within bounds (described by area under ARC BAND) 
Movement - per frame (update fx) set velocity. and update position 
Typing System - tagret selection -> nearest germ to safe line.. Pop on full match else reset on incorrect 
Collisions - if dictance of germ and origin is less that safe radius, evoprate germ and increment greach 
