# Color Middling

A single-file tool for reading colour out of flat artwork, blending sampled colours through
any Photoshop-style blend mode, and painting the result back into the image.

**Published artifact:** https://claude.ai/code/artifact/e10af446-2564-4697-8b75-6da37bbc0680

## Status: reference implementation

This is the most developed tool in the repo, and it is the reference the others are measured
against. When behaviour here disagrees with a simpler tool, this one is correct. As the tools
converge, shared code should be lifted *out of* this file — not merged *into* it from thinner
implementations.

## What it does

Import an image, tap it to sample colours into the `A ∘ B (∘ C) = M` equation, and the tool
computes the middle colour. Leave any one term empty and it solves backwards for that term
instead — given `A` and a target `M`, it finds the `B` that would produce it. Load any swatch
and tap a region to flood fill it. Fills stay live-linked to the equation, so changing the
blend mode or a source colour repaints every region derived from it.

Alongside that: palette extraction by shape, print-gamut warnings, colour merging, harmony-based
palette refinement, permutation alternatives, a chromaticity plot, undo/redo, and export back
out at the source image's full resolution and DPI.

## Layer map

The file is one document, but three layers, and this is where the seams are for later
extraction. Sizes are approximate line spans, not hard boundaries.

**1. Colour engine** — pure functions, no DOM. The most portable part.

- `blend()` and the `perChannelModes` table: 27 blend modes (Multiply through Hard Mix, plus
  the four HSL modes and the two whole-colour comparisons)
- Conversions: `rgbToHslN` / `hslToRgbN`, `rgbToHue`, `rgbToGray`, `rgbToCmyk`, `toHex`
- Oklab/Oklch colour science: `rgbToOklab`, `rgbToOklch`, `oklchToRgb`, `srgbToLinear`
- Print gamut: `inkMix`, `buildGamutTable`, `maxPrintableChroma`, `gamutCheck` — estimated from
  standard process inks, deliberately not a soft proof against a real printer profile
- Equation solvers: `solveOperand` runs a blend backwards. Per-channel modes solve by exhaustive
  256-value search; channel-mixing modes by coarse-then-refine search in RGB. `solveResidual`
  reports how far off the inverse is, because many modes discard information and have no exact
  inverse — it reports the residual rather than pretending
- Harmony: `hueGap`, `hueName`, `harmonySuggestions`

**2. Imaging** — canvas pixel work.

- `extractPalette()`: the substantial one. Treats dark line work as walls dividing the artwork
  into shapes, but only if the dark run is *thin* — a depth transform releases thick dark areas
  back as shapes in their own right. Regions come from 4-connected flood fill with a colour
  tolerance, so untouching shapes stay distinct. Each region is sampled at its deepest interior
  point (BFS distance transform), not its centroid, which can fall outside a hooked shape
- `floodFill()` returns a coverage mask, so a later fill can evict earlier fill records it painted over
- `buildFullResolution()` replays every recorded fill against the untouched source image at
  original resolution; nothing is upscaled. Falls back to the largest allocatable canvas past ~40MP
- `readDPI()` / `pngWithDPI()`: pHYs chunk read and write, so print resolution survives a round trip
- `remapImage()`, `regionIdAt()`: whole-palette substitution for the alternatives previews

**3. Shell** — view and interface.

- Pan / zoom / rotate over the model canvas: `screenToModel`, `modelToScreen`, two-finger
  gestures, rotation snapping at 5° to the cardinals with an unsnapped accumulator underneath
  so it never sticks
- Undo/redo over full state snapshots: `snapshotState`, `restoreState`, `pushHistory`
- Design tokens in `:root` — glass panels over warm paper, Jost / Fraunces / Inter / JetBrains
  Mono, cyan `#0FA3B1` and magenta `#B1338C` as the two marks. This is the visual system the
  other tools should adopt when they converge

## Notes on the published version

Artifacts must ship self-contained: the artifact CSP allows external scripts only from a short
CDN allowlist, and stylesheets only from Google Fonts. All CSS and JS is therefore inline, and
any shared module extracted later has to be inlined at publish time rather than imported at runtime.

Export uses the artifact `downloads` capability (`claude.use('downloads')`) rather than an
`<a download>` link, which the artifact viewer sandbox makes inert. The download button stays
hidden when the capability is unavailable; press-and-hold on the preview image still works
everywhere as a fallback.
