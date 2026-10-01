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

`sharp` was used only to export the requested pixel dimensions, using nearest-neighbor resizing. It was not used to paint, composite or creatively alter the artwork. The standard logo is an exact copy of the final opaque avatar. The transparent logo and public mascot are exact copies of the original alpha PNG. `export-assets.cjs` records the export procedure; its source paths reflect this local generation session.

## Copy and release notes

`POSTS.md` describes token lookups using DexScreener, optional same-pool comparison with GeckoTerminal, source timestamps, content hashes and browser-local lookup history. It makes no claims about prices, returns, partnerships or a live DOVET token. A content hash identifies receipt content; it is not a guarantee that an upstream source is correct. Future token sponsorship of monitoring capacity is intentionally excluded from the public copy.

Replace `{{SITE_URL}}` after production verification. The parent project release process owns deployment verification, real scheduler status, final video files and the complete launch ZIP. No artwork or post was published to any external account by this asset task.

## Verification

Exports are measured in `asset-manifest.json`. The transparent mascot has a real alpha channel. All five composed results were visually inspected after generation: brand spelling, required headlines, pigeon identity, absence of financial claims, and composition. The three post images have distinct scenes. Final-size exports preserve full frames with no intentional content cropping.

