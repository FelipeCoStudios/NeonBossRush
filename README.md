# NEON BOSS RUSH

3D arcade boss-rush game built with HTML5, CSS3, JavaScript and Three.js.

## How to run

1. Unzip the archive.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge).
3. Or publish the folder to any static host / GitHub Pages.

No build step, no Node.js, no backend required.

## Controls

**Keyboard**
- WASD / Arrows — move
- Mouse — aim
- Left click (hold) — shoot
- Space — dash
- Q — special attack
- E — pick nearby power-up
- ESC — pause

**Mobile**
- Left virtual joystick — move
- ATK / DASH / SPEC buttons

## Characters

| Name        | Role       | HP  | Speed | Damage | Special      |
|-------------|------------|-----|-------|--------|--------------|
| THE SOLDIER | Balanced   | 100 | 7     | 10     | Heavy Burst  |
| THE RUNNER  | Speed      | 75  | 11    | 7      | Dash Strike  |
| THE TANK    | Tank       | 150 | 5     | 13     | Ground Slam  |
| THE TECH    | Specialist | 90  | 8     | 8      | Plasma Orb   |

## Bosses

1. IRON BEAST — mechanical beast, projectiles, charge, missiles
2. THE NECRO CORE — floating sphere, rings, teleport, summons
3. INFERNO TITAN — fire giant, shockwaves, meteors
4. VOID HUNTER — fast teleporter, clones
5. THE OVERLORD — final boss, mixed mechanics, 3 phases

## Power-ups

- BLOOD BATTERY — restore 25% HP
- OVERDRIVE — +40% speed, +30% damage, faster fire (8s)
- PHASE SHIFT — heavy damage reduction (5s)
- TRIPLE CORE — triple projectiles (7s)
- GRAVITY BREAKER — slow enemies (4s)
- SOUL MIRROR — reflect part of damage (6s)

## Audio

Sounds are generated with Web Audio API (no external MP3 required).  
The game continues normally if audio context is blocked or unavailable.  
Volume and mute are available in Settings.

## Progress

Progress (bosses defeated, best score, last character) is stored in `localStorage` under key `neonBossRush`.

## GitHub Pages

1. Create a repository.
2. Upload the contents of the `NEON-BOSS-RUSH` folder to the root (or `/docs`).
3. Enable GitHub Pages in repository settings.
4. Open the provided URL.

## Extending

- Characters: edit the `CHARS` array in `game.js`.
- Bosses: edit the `BOSSES` array and the AI block inside `updateBossAI`.
- Power-ups: edit `POWER_TYPES` and `applyPowerup`.
- Arenas: edit `buildArena` materials and decorations.

## License

Original code. No copyrighted assets from other games.
