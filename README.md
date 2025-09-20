# Kiko's Day

Kiko’s Day is a mini-game suite built in *Phaser 3* to teach hygiene and handwashing through playful mechanics.  
The project is structured around a single shared logic hub: [`src/systems.js`](src/systems.js).

---

## Games included

- **Soap Splash** – type words to defeat germs before they reach the sink.
- **Clean Catch** – catch clean water, avoid germs, simple canvas-based game.
- **Playground** – animated sandbox scene with Kiko. Later updates to bathrom main menu

---

## systems.js

This file exports a single object with all game logic.  
Scenes stay thin and call into **namespaced systems**.

### Namespaces

- **helpers** → math, geometry, collisions, word lists, time formatting
- **ui** → shared UI widgets (buttons, name dialog)
- **soapsplash** → Soap Splash logic (`spawn`, `movement`, `rules`, `timer`, `typing`)
- **cleancatcher** → Clean Catch canvas game (`create(canvas)`)
- **menu** → helper to build vertical button stacks

---

## How to contribute

Follow these rules to keep the codebase clean and easy to extend:

### 1. Add logic in the right place
- **Game mechanics, rules, timers, spawners** → put inside the right namespace in `systems.js`  
  _(e.g., new spawn rule for Soap Splash → `systems.soapsplash.spawn`)_
- **Shared math, collisions, formatting, word lists** → `systems.helpers`
- **Reusable buttons, dialogs, overlays** → `systems.ui`
- **Game-specific loops or teardown** → create a new namespace (`systems.newgame`)

### 2. Keep scenes thin
- Scenes (`MenuScene.js`, `SoapSplashScene.js`, etc.) should only:
    - Load assets (`preload()`)
    - Place sprites/UI in `create()`
    - Call into `systems.*` for logic
    - Handle transitions between scenes (`this.scene.start("OtherScene")`)

_No heavy logic inside scenes._

### 3. Config first
- Always check `CONFIG` before editing logic.  
  Many tunables (speeds, spawn intervals, colors, word lists) are defined there.  
  Designers can change difficulty without touching code.

### 4. Add new mini-games
1. Add a namespace in `systems.js` (e.g., `systems.newgame = { init, update, destroy }`).
2. Create a scene in `src/scenes/NewGameScene.js` that just sets up visuals and calls the namespace.
3. Add a button in `MenuScene` using `systems.menu.build` or `systems.ui.button`.

### 5. Asset management
- Put images under `assets/images/...` in the right folder.
- Update preload paths in scenes.
- Always confirm in console that no 404s occur.

### 6. Test before commit
- Run through **all scenes** via Menu.
- Check console for errors or missing textures.
- Verify Soap Splash spawns + typing, Clean Catch teardown works, Playground animates, and menu navigation is smooth.

---
