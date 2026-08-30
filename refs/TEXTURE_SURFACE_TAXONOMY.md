# Plan: Texture surface taxonomy (opinion + recommended model)

## Goal

React to the proposed Texture surface list, align it with how gMixer already names and paints roles, and recommend a surface taxonomy for a future Texture UI — **global Noise/Grid params + per-surface on/off**. This is a product/architecture recommendation, not a Stage 2 implementation plan.

## Status

- [x] Taxonomy decided (GUI rename, fill vs text vs media families, media reserved)
- [x] Stage 1: Texture tab + global Noise/Grid controls
- [x] Stage 2a: `texture.surfaces` in schema/catalog + Apply-to checkboxes in Texture panel
- [x] Stage 2b: Live Preview texture targets (GUI, media stand-ins, headings, links, captions)
- [x] Stage 2c: Page paint — Family A fills (GUI)
- [x] Stage 2c: Page paint — Family B text techniques
- [x] Stage 2c: Page paint — Family C media overlays
- [ ] Optional later: `containers` / `sheet` / `canvas` UI + paint

## Verdict on the proposed list

The direction is right: Texture should target **concrete, selectable page surfaces**, not only a single page wash. The list mixes three different ideas, though, and a few names fight the existing Color Scheme vocabulary.

### What works well

| Proposal | Why it fits |
|---|---|
| Split **Button / Input / TextArea** | Matches real CSS targets (`button`, `input`, `textarea`) and the theme preview’s GUI chrome. Users can feel texture on compact controls. |
| **Heading Large / Medium / Small** bands | Same hierarchy instinct as typography (h1–h2 / h3–h4 / h5–h6). Easy to explain. |
| **Link: Bare / Article / Heading** | Parallels Effects categories (body links vs article/teaser cards vs heading anchors). Classifier already distinguishes some of this. |
| **Muted caption family** | Product already treats captions as a semantic cluster (`figcaption`, `small`, kickers, meta). Splitting them is useful if selectors stay honest. |

### What to change

**1. Don’t hang GUI chrome under `BG:Secondary`** — [x] adopted

Today:

- **BG:Secondary** = sheet / rail / elevated page region fill (`backgroundSecondary`)
- **Surface:GUI** = buttons, inputs, selects, compact controls (`surfaceGui`)

Theme preview already paints the input and button with `surfaceGui` on a `backgroundSecondary` tray. Calling those targets `BG:Secondary:Button` teaches the wrong mental model and will collide with Color Scheme language.

**Recommendation:** rename to **Surface:GUI → Button / Input field / Text area**.

**2. Accent / Link / Muted are color roles, not fill hosts** — [x] modeled as Family B (text)

Texture on headings and links is not the same CSS problem as texture on a button background:

- **GUI fills** → `background-image` / layered gradients on the control
- **Text roles** → need a different treatment (e.g. `background-clip: text`, decorative underline/sheen, or a soft behind-glyph wash). Plain `background` on `h1`/`a` often looks like a highlighter bar, not “text texture”

The UI can still *group* them under Accent / Link / Muted for familiarity, but the paint path should treat **fill surfaces**, **text surfaces**, and **media overlays** as separate technique families.

**3. Caption splits need crisp selectors or they will blur** — [x] ids shipped; page selectors deferred to 2c

| Proposed | Likely selector intent | Risk |
|---|---|---|
| Muted:Caption-Kicker | eyebrow / kicker above titles (often `p`/`.kicker`/`.eyebrow`) | Hard to detect universally; preview can fake it, pages are messy |
| Muted:Photo-Caption | `figcaption` (and maybe `figure .caption`) | Strong, reliable |
| Muted:Caption-Asides-Notes | `aside`, `small`, `.meta`, timestamps, supporting notes | Broad; overlaps “muted body” |

`<caption>` is a **table** caption, not a photo caption. Prefer **`figcaption`** for Photo-Caption; keep table `caption` either in the same bucket or call it out separately.

**4. Media should be first-class Texture surfaces (review feedback)** — [x] ids + UI + Live Preview stand-ins; page overlay paint still open

Texture overlays on photography/video are a natural next step and should be modeled as surfaces from the start, even if UI/paint land later:

- **Article / card image** — teaser and story images (classifier already uses `data-gmixer-media="article-image"`)
- **Video thumbnail / paused video** — poster frames and paused `<video>` (classifier uses `video-thumbnail` for related cases; paused playback is an additional state gate)

Technique differs from GUI fills: typically an **overlay** (pseudo-element, mask, or blend) on the media box, not replacing the image. Keep these out of the GUI/text checklists so Chroming Media filters and Texture overlays can compose cleanly.

**5. Other gaps worth considering (optional, later)** — [ ] still reserved (`inUi: false`)

- **Surface:Containers** (cards / panels) — high-impact fill texture
- **BG:Secondary** sheet itself (not its child controls)
- **BG:Primary** page wash (easy to overdo; default off)
- **Code** blocks (`pre`/`code`) — optional personality slot

Don’t block early Stage 2 on these; reserve ids in the catalog so media + sheet/canvas can appear without a schema rename.

## Recommended taxonomy

Keep **one global texture** (mode + Noise/Grid params from Stage 1). Add **per-surface enable flags** only.

### Family A — Fill surfaces (background texture)

| ID | Label | Primary selectors (intent) | Status |
|---|---|---|---|
| `gui.button` | Surface:GUI · Button | `button`, `[role="button"]`, submit/button inputs | [x] UI + preview + page |
| `gui.input` | Surface:GUI · Input field | `input:not([type="button\|submit\|…"])`, `[role="textbox"]` singles | [x] UI + preview + page |
| `gui.textarea` | Surface:GUI · Text area | `textarea`, multiline textboxes | [x] UI + preview + page |
| *(later)* `containers` | Surface:Containers | cards / panels / dialogs | [ ] reserved |
| *(later)* `sheet` | BG:Secondary · sheet | classified secondary regions | [ ] reserved |
| *(later)* `canvas` | BG:Primary · root | page background | [ ] reserved |

### Family C — Media overlays (texture over imagery)

Reserved now so Texture can grow into photo/video treatments without reshaping the model. Prefer classifier attrs over tag soup.

| ID | Label | Primary selectors (intent) | Status |
|---|---|---|---|
| `media.articleImage` | Media · Article / card image | `[data-gmixer-media="article-image"]`, card/teaser `<img>` companions | [x] UI + preview + page (`:has()` wrappers) |
| `media.videoThumb` | Media · Video thumbnail / paused | `[data-gmixer-media="video-thumbnail"]`, `video[poster]`, `video` when paused (state-gated) | [x] UI + preview + page (`:has()` / `:paused`) |

Notes:

- Overlays compose with Chroming Media filters (filter first or texture-on-top — decide in paint stage).
- Playing video should default to **no** texture overlay unless the user explicitly wants a persistent veil; paused / poster / thumbnail are the safe surfaces.
- [x] Live Preview sample image + explicit video-thumb stand-in when these checkboxes ship.

### Family B — Text surfaces (text-oriented texture technique)

| ID | Label | Primary selectors (intent) | Status |
|---|---|---|---|
| `accent.headingLarge` | Accent · Heading large | `h1`, `h2` (+ aria heading levels 1–2) | [x] UI + preview + page |
| `accent.headingMedium` | Accent · Heading medium | `h3`, `h4` | [x] UI + preview + page |
| `accent.headingSmall` | Accent · Heading small | `h5`, `h6` | [x] UI + preview + page |
| `link.bare` | Link · Bare | in-body / paragraph links (`main a`, `article p a`, etc. — exclude nav/chrome) | [x] UI + preview + page |
| `link.article` | Link · Article | article/teaser title links (reuse article-card detector where possible) | [x] UI + preview + page |
| `link.heading` | Link · Heading | `h1 a` … `h6 a`, heading-wrapped anchors | [x] UI + preview + page |
| `muted.kicker` | Muted · Caption / kicker | preview + best-effort page heuristics; start conservative | [x] UI + preview + page |
| `muted.photoCaption` | Muted · Photo caption | `figcaption` (optionally figure-adjacent caption classes) | [x] UI + preview + page |
| `muted.asideNotes` | Muted · Asides / notes | `aside`, `small`, time/meta-like muted copy | [x] UI + preview + page |

This preserves your intent while renaming GUI under **Surface:GUI**, clarifying Photo caption vs table `<caption>`, and reserving **Media** surfaces for article images and paused video / thumbnails.

## How the Texture UI should present it

Mirror Effects’ “category checklist” feel, not Color Scheme’s swatch board:

1. [x] **Global mode** (already built): Off · Noise · Grid (+ grid params)
2. [x] **Apply to** accordion or fieldsets:
   - Surface:GUI — three checkboxes
   - Media — Article/card image · Video thumbnail / paused
   - Accent headings — three checkboxes
   - Links — three checkboxes
   - Muted captions — three checkboxes
3. [x] Defaults on first opt-in: enable **GUI buttons + inputs** only. Headings/links/captions/media default **off** until the user opts in.
4. [x] Live Preview: texture-target ids + blurb counterparts (button / field / textarea / h1 / figcaption / media frame / etc.).

Suggested state shape — [x] implemented:

```js
texture: {
  mode: 'noise' | 'grid' | 'none',
  xDistance, yDistance, gridRotation, gridStyle,
  surfaces: {
    'gui.button': true,
    'gui.input': true,
    'gui.textarea': false,
    'media.articleImage': false,
    'media.videoThumb': false,
    'accent.headingLarge': false,
    // …
  }
}
```

Missing keys normalize to `false` (or catalog defaults). Section master `sections.texture` still gates everything.

## Mapping critique → your labels

| Your label | Recommended id / label | Notes |
|---|---|---|
| BG:Secondary:Button | `gui.button` · Surface:GUI · Button | Color role is GUI, not Secondary |
| BG:Secondary:InputField | `gui.input` · Surface:GUI · Input field | same |
| BG:Secondary:TextArea | `gui.textarea` · Surface:GUI · Text area | same |
| Accent:Heading-Large | `accent.headingLarge` | h1–h2; text technique |
| Accent:Heading-Medium | `accent.headingMedium` | h3–h4 |
| Accent:Heading-Small | `accent.headingSmall` | h5–h6 |
| Link:Bare | `link.bare` | define as non-nav, non-heading body links |
| Link:Article | `link.article` | teaser/card title links |
| Link:Heading | `link.heading` | anchors inside headings |
| Muted:Caption-Kicker | `muted.kicker` | best-effort; preview-first |
| Muted:Photo-Caption | `muted.photoCaption` | `figcaption`, not `<caption>` |
| Muted:Caption-Asides-Notes | `muted.asideNotes` | keep selector set tight |

## Design principles to carry forward

1. **Reuse Color Scheme family names only where the paint host matches** (GUI / Accent / Link / Muted). Don’t invent a parallel `BG:Secondary:*` tree for controls.
2. **One texture recipe, many outlets** — avoids a 12× parameter explosion.
3. **Separate fill vs text vs media-overlay paint paths** early so CSS doesn’t force `background-image` onto every heading or rewrite `<img>`/`<video>` pixels when an overlay will do.
4. **Prefer classifier-backed targets** (`data-gmixer-role`, `data-gmixer-media`, article-card detector) over class-name guessing when reliability matters (article links, article images, video thumbs, sheets).
5. **Preview before page** — every surface flag should have a blurb counterpart so walkthrough/settings stay honest even before content CSS is perfect.

## What this document is not / remaining work

- [x] Surface checkboxes (Stage 2a)
- [x] Live Preview wiring (Stage 2b)
- [x] Page CSS paint (Stage 2c) — `src/lib/texture-page-css.js` via `buildCss`
- [x] Stage 1 Noise/Grid controls (unchanged recipe)
- [x] Page selector strings for shipped surfaces (refine as needed)

## Suggested next step

Optional polish: ship `containers` / `sheet` / `canvas` UI, tighten kicker/article-link heuristics, and decide media playing-veil behavior. Resolve open product nits below.

## Open product nits (non-blocking)

- [ ] Should **select** / **slider** share `gui.input`, or stay ungated until later?
- [ ] Is **Link:Bare** meant to exclude nav only, or also exclude footer/chrome links?
- [ ] For kickers: class-name heuristics are live — tighten if false positives appear
- [ ] Media: texture only while **paused** / poster, or also a light veil while playing?
- [ ] Media: one shared `media.videoThumb` surface, or split **poster/thumbnail** vs **paused playback** later?
