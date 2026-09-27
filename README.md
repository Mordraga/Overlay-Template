# Stream overlay kit (template)

A set of OBS browser-source overlays, a tiny local Python server, and a control panel that drives them.
This is a cleaned-up copy of a working setup. Names, links, and art have been swapped for placeholders,
so it's a starting point to pull apart and not a finished theme.

Everything is plain HTML, CSS, and JS with no build step. The server is standard-library Python.

## Quick start

1. Install Python 3.10+.
2. Run `python server/server.py` (or double-click `start-crypt-server.bat`).
3. Open <http://localhost:8765/panel.html> for the control panel.
4. In OBS, add a **Browser Source** at 1920×1080 pointing at one of the pages below.

Optional extras:

- **Tray launcher:** `crypt-tray.pyw` runs the server in the background with a system-tray icon (Windows only).
  Needs `pip install --user pystray pillow`. Drop a `tray.png` into `assets/` to use your own icon.
- **Twitch stats (goal bars, followers):** copy `config/twitch-config.example.js` to `config/twitch-config.js`
  and fill it in. The example file walks through getting a token. `twitch-config.js` is git-ignored.
- **Chat:** `layout.html` reads Twitch chat anonymously. Set `var CHANNEL = 'yourname'` in `layout.html`.

## Make it yours

Search for these placeholders and replace them:

| Placeholder | Where |
|---|---|
| `YOUR NAME` | titles and branding bars in every `*.html` page and `stinger/stinger.html` |
| `yourname` | handles (`twitch.tv/yourname`, `fansly.com/yourname`) and `CHANNEL` in `layout.html` |
| `Your · Tagline · Here` | starting / intermission / BRB pages |
| `data/crypt-state.json` | rotator cards, countdown messages, collab guests. You can edit these from the panel too. |

The look (fonts, gold and red palette, "crypt" theme) lives in each page's `<style>` block, and in
`css/panel.css` for the panel.

## Pages

| Page | What it is |
|---|---|
| `layout.html` | Main in-game layout: chat, rotating cards, Twitch goal bars, effects. `?collab` switches to a multi-person layout for up to 6 people. |
| `starting-soon.html`, `intermission.html`, `ending.html` | Countdown screens. Timers are set from the panel. The ending screen shows a recap of the stream. |
| `fansly-*.html` | Variants of the above for a second platform. `fansly-brb.html` and `fansly-promo.html` are standalone and need no server. |
| `panel*.html` | Control panel pages: home, Timers, Counter, Cards, Collab, Face Workshop, Test. |
| `stinger/stinger.html` | Scene transition animations. See "Stingers" below. |

Model and camera spots are transparent holes in the overlay. Place the model or camera source *above* the overlay in OBS.

## How it fits together

```
 control panel ──POST──▶  server/server.py  ◀──GET (polling)── overlay pages in OBS
 (panel*.html)            data/crypt-state.json                (layout.html, etc.)
                          data/crypt-session.json
```

- The **server** (`server/server.py`) serves the pages and a small JSON API on `127.0.0.1:8765`, so only your own PC can reach it.
  - `GET/POST /api/state`: persistent settings (cards, timers, collab, counter) in `data/crypt-state.json`
  - `GET /api/session` and `POST /api/session/event`: tally for this stream (raids, followers, and so on) for the ending recap
  - `POST /api/counter`: bumps the counter
  - `GET/POST /api/test`: the panel's Test page queues fake events that `layout.html` picks up
  - `GET /api/mai`, `/api/mai/moods`: see "Mai" below
- **Overlays** poll the server every few seconds and re-render. They don't use websockets or a framework.
- **Twitch** calls (`api.twitch.tv`, the chat IRC websocket) go straight from the browser source to Twitch. The token never passes through the server.

## Shared scripts (`js/`)

| File | Does |
|---|---|
| `rotator.js` | Rotating quote, card, and "case file" deck (`data-deck` picks which list from state) |
| `countdown.js` | Countdown timer for the starting, intermission, and ending screens (`data-key` picks the timer) |
| `crypt-effects.js` | Chat-triggered effects: "familiars" for first chatters, screen distortion when chat mentions a god, raid effects |
| `holes.js` | Cuts transparent windows in the background for `[data-hole]` elements |
| `mai-face.js` | An animated SVG face for a chat-bot mascot, with moods and custom faces made in the Face Workshop |
| `panel-common.js` | Panel nav, collapsible sections, Twitch token expiry banner |

## Mai (optional)

"Mai" is a separate chat-bot project that this setup reads from, and it isn't included here. The server looks for her
mood file at the path at the top of `server/server.py`. If that file doesn't exist, her face just shows as asleep and
nothing breaks. To hook up your own bot, point `MAI_MOOD_FILE` at a JSON file your bot keeps updated, shaped like
`{"active": true, "last_heartbeat_at": <unix seconds>, "active_mood": "happy"}`. Or delete the Mai bits entirely.

## Stingers

OBS stingers have to be video files, so `stinger/stinger.html` holds the animation and `stinger/render.py` records
it to a transparent `.webm`.

- Preview: open `stinger/stinger.html?style=breach` (or `?style=sigil`). Add `&slow=4` for slow motion.
- Render: `pip install --user playwright imageio-ffmpeg pillow`, run `python -m playwright install chromium`,
  then run `python stinger/render.py`. The output goes to `stinger/out/`.
- In OBS, add a Stinger transition, pick the `.webm`, and set Transition Point Type to **Time**
  (the render script prints the value to use).

## Git-ignored files

`config/twitch-config.js` (your token), `data/crypt-session.json`, `data/server.log`, and `stinger/out/`.
