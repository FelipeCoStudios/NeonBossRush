# Neon Boss Rush Audio Assets

Place these 7 MP3 files in this folder:

```text
music.mp3
shoot.mp3
victory.mp3
defeat.mp3
dash.mp3
special.mp3
powerup.mp3
```

## What each file does

- `music.mp3` — main gameplay music. Loops continuously.
- `shoot.mp3` — player attack/shoot sound.
- `victory.mp3` — plays when a boss is defeated.
- `defeat.mp3` — plays when the player loses.
- `dash.mp3` — dash ability.
- `special.mp3` — character special ability.
- `powerup.mp3` — power-up activation.

The game expects the exact lowercase filenames above.

The main music is started only after a user interaction (click/tap/key), which is necessary because browsers can block autoplay before the user interacts with the page.
