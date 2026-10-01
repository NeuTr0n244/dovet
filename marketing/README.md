# DOVET marketing artwork

DOVET is an original carrier-bird identity for sourced Solana market observations. Its pixel post-office imagery connects collecting, comparing and retaining source receipts with a recognizable messenger character.

## Files

| File | Export | Purpose |
| --- | --- | --- |
| `dovet-logo.png` | 1024 × 1024 PNG | Opaque logo; same art as avatar |
| `dovet-logo-transparent.png` | 1254 × 1254 PNG with alpha | Original mascot silhouette |
| `dovet-avatar.png` | 1024 × 1024 PNG | Profile image |
| `dovet-x-banner.png` | 1500 × 500 PNG | X header |
| `dovet-post-01.png` | 1600 × 900 PNG | Introduction / postal counter |
| `dovet-post-02.png` | 1600 × 900 PNG | Comparison / paired receipts |
| `dovet-post-03.png` | 1600 × 900 PNG | Evidence / source checklist |
| `POSTS.md` | Markdown | Bio and three English launch posts |
| `PROMPTS.md` | Markdown | Complete image-generation prompts |
| `asset-manifest.json` | JSON | Measured export dimensions and alpha status |
| `raw/` | Original PNGs | Unmodified generated originals, outside public assets |

The site mascot is also saved at `../public/assets/dovet-bird.png`.

## Palette and visual system

Cream `#f6f1e5`, plum `#24152d`, vermilion `#cf493a`, with restrained lilac accents. The small stepped plum outline, alert eye and red messenger bag carrying a receipt form the character identity. Scenes remain pixel illustrations; they are not 3D renders or generated video.

## Credits and tools

All six source images were created for this project using the built-in `image_gen.imagegen` tool with original DOVET art direction. No third-party character, project logo, brand footage or market-data artwork was used. The five follow-on images use the original DOVET mascot as the identity reference. Image lettering is generated artwork, not a redistributed font file.

`sharp` was used only to export the requested pixel dimensions, using nearest-neighbor resizing. It was not used to paint, composite or creatively alter the artwork. The standard logo is an exact copy of the final opaque avatar. The transparent logo and public mascot are exact copies of the original alpha PNG. `export-assets.cjs` reads the preserved `raw/` files and records relative original paths in the manifest.

## Re-export the existing images

From the project root, install Sharp locally only if it is not already available, then run the export script:

```sh
npm install --no-save --package-lock=false sharp
node marketing/export-assets.cjs
```

Sharp is an optional artwork-export tool, not an application runtime dependency. The script resolves `process.env.SHARP_MODULE || 'sharp'`, allowing an existing compatible installation to be selected through `SHARP_MODULE`. It requires all six files in `marketing/raw/`; it never downloads or regenerates images. `node marketing/export-assets.cjs --verify-only` measures current exports and refreshes the relative-path manifest without modifying any PNG.

## Copy and release notes

`POSTS.md` describes token lookups using DexScreener, optional same-pool comparison with GeckoTerminal, source timestamps, content hashes and browser-local lookup history. It makes no claims about prices, returns, partnerships or a live DOVET token. A content hash identifies receipt content; it is not a guarantee that an upstream source is correct. Future token sponsorship of monitoring capacity is intentionally excluded from the public copy.

The verified website is [dovet-ten.vercel.app](https://dovet-ten.vercel.app), with source at [NeuTr0n244/dovet](https://github.com/NeuTr0n244/dovet). Three separate eight-second MP4 films and their posters are included; their original motion-graphics source and verification notes are in `motion/README.md`. They are illustrative workflows, not recordings of live source collection. Scheduler evidence remains distinct from deployment verification. No artwork or post was published to a social account by this asset task.

The public watchlist is scheduled once daily at 03:17 UTC, not continuously. Custom history is limited to 30 receipts in the current browser. The public feed exposes the most recent 14 run records; local server storage is capped at 180, while hosted Blob objects have no automatic deletion policy. A configured cron is not proof of an observed scheduled execution. Source response bodies are hashed but are not retained in the receipt; a later request to the endpoint may return different bytes.

## Verification

Exports are measured in `asset-manifest.json`. The transparent mascot has a real alpha channel. All five composed results were visually inspected after generation: brand spelling, required headlines, pigeon identity, absence of financial claims, and composition. The three post images have distinct scenes. Final-size exports preserve full frames with no intentional content cropping.
