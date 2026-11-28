---
name: launch-video-template
description: Template and workflow for a vertical (1080x1920) app launch video built in HyperFrames from the real app's screens, as done for Move with Tamar in launch-video/. Use when making a new launch/promo video, updating the existing one after an app change, or reusing its look, structure, timing and lessons for another product.
---

# Launch video template (from `launch-video/`)

The finished reference project is `launch-video/` (read its `README.md`, `SPEC.md`, `REVIEW.md`, `CREDITS.md` first). Load the `hyperframes` skill before touching any composition; this skill is the *recipe*, that one is the *contract*.

## The pattern that worked
- Vertical 1080x1920, 30 fps, ~33 s, no voiceover, Hebrew RTL text, music bed + small SFX.
- 8 scenes, each a different composition (hook, home, main flow, feature + twist, quick integration, short achievement beat, climax with several screens, end card). One file per scene in `compositions/sNN-name.html`, stitched in `index.html`.
- Real product UI on a real-looking phone body (600x1300, radius 92, bezel 16, island 170x50). UI cards are "lifted" out of the phone toward the camera.
- All scene seams land on the music's beat grid (BPM -> s/beat; bar = 4 beats). Music drop = the payoff moment (a zoom-through). To add a beat without changing length, take whole bars from the longest scene.
- Take colours and radii from the app's own theme file. One accent per headline. Ground floods in the app's companion colours for emphasis scenes.
- Motion: arrive `expo.out` 0.6-0.9 s; camera moves `power2.inOut`; exits `power3.in` 0.3-0.45 s. Words animate blur->0 + opacity, 0.13 s each, 0.067 s apart. Finger dot appears 0.15 s before a tap.
- **Entrance rule** (approved after a mockup): the phone rises as one piece (0.8 s, `power2.out`), rests ~0.2 s, only then a card comes out. The lifted card is hidden until then and fades in 0.1 s exactly on its place.
- Banned: dark void, particles, idle loops, everything centred, every element fading up, three cards in a row, logo in a corner, tilted UI while read.

## Workflow (plan -> approval -> build -> samples -> approval -> render)
1. Write `SPEC.md` (goal, look, objects, motion, shot list with times, sound, banned, QA). Show the plan, wait for explicit approval.
2. Pick music, detect the beat grid, set scene seams on bar lines.
3. Capture screens and cards (below).
4. Build scenes with the HyperFrames skills (`hyperframes`, `-animation`, `-keyframes`, `-creative`, `-registry`, `-audio`, `media-use`).
5. `npx hyperframes check --json` after every change, then look at frames. Show a one-image sample sheet and the preview; render only after approval.
6. For a change request on motion: ask short multiple-choice questions, mock it on a **copy** of the project, render only those seconds, then apply.

## Capturing the app without a phone and without real data (`launch-video/scripts/capture/`)
- `demo-data.ts` (fictional member; run the app's own logic for derived data) -> `server.mjs` (stand-in for the backend's REST/auth, localhost only) -> `browser.mjs` (headless Edge over CDP as an iPhone, fixed clock, seeded session, real backend hosts blocked) -> `capture.mjs` (taps through the real flows, saves full screens at 3x, cards at 5x+, scroll frames, `rects.json`) -> `build-assets.mjs`.
- The demo build is the unmodified app with the backend URL overridden by env var and a separate `--output-dir`. **Rebuild normally with `--clear` straight afterwards** and verify `dist` holds the real URL, or the bundler cache can ship the demo URL.
- Screen is 390x871 CSS px -> 568 px wide in the video (x1.4564). Card position = phone left/top + 16 + rect x 1.4564.
- Scenes that slide a page up need a taller capture, sized so the bottom bar lands exactly at the screen edge (page height = (1268 + shift) / 1.4564).
- Check demo values against what the live app shows (seed files go stale once content is edited in the app).

## Commands (run inside `launch-video/`)
```bash
npx hyperframes preview --background   # Studio at http://localhost:3002; stop: --stop
npx hyperframes check --json
npx hyperframes snapshot --at 5,12,20 --no-end
npx hyperframes snapshot --review
npx hyperframes render -q delivery --video-frame-format png --skill hyperframes -o out/<name>.mp4
ffmpeg -i out/<name>.mp4 -c:v libx264 -crf 26 -preset slow -vf scale=720:1280 -c:a aac -b:a 128k -movflags +faststart out/<name>-whatsapp.mp4
```

## Lessons (each cost hours)
- A `fromTo` tween applies its "from" values immediately: a card meant to be hidden needs `opacity:0` in the HTML **and** `immediateRender:false` on the later tween.
- A property given only in the "from" of `fromTo` stays at that value: a phone tweening `{y, scale:0.95} -> {y:0}` stays at 0.95 and cards placed for scale 1 miss it.
- Sample frames must include the moments *during* entrances and every tap, not only settled frames: both bugs above passed a settled-frames review.
- Hidden-at-start elements: `style="opacity:0"` in HTML, not `tl.set(..., 0)` (frame 0 won't render it).
- Audio clips need `data-duration` equal to the file length, else `duplicate_audio_track`. Music fade: `data-fade-out` on `<audio>`, not JS.
- Instagram safe area: text between y=168 and y=1330, nothing at the right edge (`right:130px; width:830px`). 96px headlines wrap to 3 lines there; use 86px when needed.
- If footage ever comes from an iPhone screen recording: it is full-range bt709 (`yuvj420p`), convert to RGB before `drawbox`; mask private data; never share the raw file.
- ffmpeg on Windows: no `-pattern_type glob`, use `%02d`. `hyperframes check` is noisy: save JSON, summarise with a small script.
- Measure loudness (target about -15 LUFS, peak under -1 dB) but a human must listen once.
- Updating HyperFrames skills (`npx hyperframes skills update`) is the person's step, not the agent's.

## Rules for this project
- Privacy is a red line: no admin UI, no real member name/photo/phone/email, no Tamar profile screen. Verify on actual frames.
- Do not change app code for marketing material. Free, local tools only.
- Plan, get explicit approval, then build. Approval for one video does not carry to another.
- Credit music in the post text (see `launch-video/CREDITS.md`).
