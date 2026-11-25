---
name: launch-video-template
description: Template and workflow for a vertical (1080x1920) app launch video built in HyperFrames from screen recordings, as done for Move with Tamar in launch-video/. Use when making a new launch/promo video, updating the existing one after an app change, or reusing its look, structure, timing and lessons for another product.
---

# Launch video template (from `launch-video/`)

The finished reference project is `launch-video/` (read its `README.md`, `SPEC.md`, `REVIEW.md`, `CREDITS.md` first). Load the `hyperframes` skill before touching any composition; this skill is the *recipe*, that one is the *contract*.

## The pattern that worked
- Vertical 1080x1920, 30 fps, ~33 s, no voiceover, Hebrew RTL text, music bed + small SFX.
- 7 scenes, each a different composition (hook, home, main flow, feature + twist, quick integration, climax with several screens, end card). One file per scene in `compositions/sNN-name.html`, stitched in `index.html`.
- Real product UI on a real-looking phone body (600x1300, radius 92, bezel 16, island 170x50). Screen recording is cut into clean clips; UI cards are "lifted" out of the phone toward the camera.
- All scene seams land on the music's beat grid (BPM -> s/beat; bar = 4 beats). Music drop = the payoff moment (a zoom-through).
- One accent colour on one word per headline. Cream ground, colour floods for emphasis scenes (peach, terracotta).
- Motion: arrive `expo.out` 0.6-0.9 s; camera moves `power2.inOut`; exits `power3.in` 0.3-0.45 s. Words animate blur->0 + opacity, 0.13 s each, 0.067 s apart. Finger dot appears 0.15 s before a tap.
- Banned: dark void, glow/orbs/particles, idle loops, everything centred, every element fading up, three cards in a row, logo in a corner, tilted UI while read.

## Workflow (plan -> approval -> build)
1. Write `SPEC.md` (goal, look, objects, motion, shot list with times, sound, banned, QA timestamps). Show the plan, wait for explicit approval.
2. Pick music, detect the beat grid, set scene seams on bar lines.
3. Cut clips with `scripts/extract-footage.sh` (crop status bar and tab bar, mask/blur private data).
4. Build scenes with the HyperFrames skills (`hyperframes`, `-animation`, `-keyframes`, `-creative`, `-registry`, `-audio`, `media-use`).
5. `npx hyperframes check --json` after every change, then `snapshot --at ...` and look at the frames. Then render.

## Commands (run inside `launch-video/`)
```bash
npx hyperframes preview --background   # Studio at http://localhost:3002; stop: --stop
npx hyperframes check --json
npx hyperframes snapshot --at 5,12,20 --no-end
npx hyperframes render -q delivery --video-frame-format png --skill hyperframes -o out/<name>.mp4
ffmpeg -i out/<name>.mp4 -c:v libx264 -crf 26 -preset slow -vf scale=720:1280 -c:a aac -b:a 128k -movflags +faststart out/<name>-whatsapp.mp4
```

## Lessons (each cost hours)
- Screen recording is full-range bt709 (`yuvj420p`): convert to RGB before `drawbox` (`scale=in_color_matrix=bt709:in_range=pc,format=gbrp`, then `format=rgb24`) or masks come out darker than the background.
- Blur a circular avatar with `boxblur` + `geq` circular alpha, then `overlay`.
- Hidden-at-start elements: `style="opacity:0"` in HTML, not `tl.set(..., 0)` (frame 0 won't render it).
- Audio clips need `data-duration` equal to the file length, else `duplicate_audio_track`. Music fade: `data-fade-out` on `<audio>`, not JS.
- Instagram safe area: text between y=168 and y=1330, nothing at the right edge (`right:130px; width:830px`). 96px headlines wrap to 3 lines there; use 86px when needed.
- ffmpeg on Windows: no `-pattern_type glob`, use `%02d`. `hyperframes check` is noisy: save JSON, summarise with a small script.
- Measure loudness (target about -15 LUFS, peak under -1 dB) but a human must listen once.
- Updating HyperFrames skills (`npx hyperframes skills update`) is the person's step, not the agent's.

## Rules for this project
- Privacy is a red line: no admin UI, no real member name/photo/phone/email, no Tamar profile screen. Verify on actual frames. Raw recordings never go to git or get shared.
- Do not change app code for marketing material. Free, local tools only.
- Plan, get explicit approval, then build. Approval for one video does not carry to another.
- Credit music in the post text (see `launch-video/CREDITS.md`).
- Best next improvement: record a demo *member* account instead of the admin account (removes masking).
