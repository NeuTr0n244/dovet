# DOVET motion graphics

Three original animated videos, rendered from SVG scenes and the project's transparent carrier-bird sprite. They are separate marketing films, not substitutes for the site's native introduction.

| File | Story | Format |
| --- | --- | --- |
| `../dovet-video-01.mp4` | Start with the mint. Read the market and check its source. | H.264, 1280 × 720, 24 fps, 8 s |
| `../dovet-video-02.mp4` | Compare earlier and later observations with source and timestamp attached. | H.264, 1280 × 720, 24 fps, 8 s |
| `../dovet-video-03.mp4` | Keep a portable evidence receipt outside the browser tab. | H.264, 1280 × 720, 24 fps, 8 s |

The scenes explicitly identify their sample workflow as illustrative. They contain no invented market prices, wallets, trades, volumes, users, or claims of live verification. No audio is included. Each movie has a matching `-poster.png` in the parent marketing directory.

## Source and reproduction

Run `node marketing/motion/render-videos.mjs` from the DOVET project directory. Install the `sharp` Node package and FFmpeg first. The script resolves Sharp as a normal Node dependency and FFmpeg from PATH; optionally set `SHARP_MODULE` to a module path and `FFMPEG_PATH` to a binary path. It uses the supplied `public/assets/dovet-bird.png` and renders all 192 frames for each movie directly to H.264, with fast-start metadata. `--posters` renders posters only. Environment variable `VIDEO=1`, `2`, or `3` selects one movie.

Typography: locally installed Cascadia Mono, with Consolas/monospace fallbacks. Palette: cream `#f6f1e5`, plum `#24152d`, carmine `#cf493a`.

## Verification performed

- FFprobe confirmed 8.000 seconds, H.264, 1280 × 720, 24 fps, 192 frames for all three outputs.
- Posters and decoded contact sheets were visually inspected for legibility and animation progression.
- Film 3's ending was adjusted to keep its flying bird clear of the final words.

The native website intro lives independently in `src/intro.js`. Its public API is `mountIntro({onComplete, replay})`, which returns a cleanup function. It respects reduced motion, includes Skip/Escape, restores focus, runs once per tab session, and treats its 3.28-second choreography as an introduction rather than data-collection progress.
