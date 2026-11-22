# Rick's games
random projects and games (hopefully weekly?)

Live at https://xrolenks.github.io/games/

## Layout

- `index.html` — sends xrolenks.github.io to the games page
- `404.html` — shown for missing pages
- `games/index.html` — home page listing the games
- `games/wasteland/` — Wild Wasteland
- `games/hexisles/` — Hex Isles
- `games/fatalfists/` — Fatal Fists

## Adding a game

1. Make a new folder inside `games/` (e.g. `games/my-game/`) and put the game in it as `index.html`.
2. In `games/index.html`, copy a `<a class="card">` block and point its `href` at `my-game/`.
3. Commit and push in GitHub Desktop.
