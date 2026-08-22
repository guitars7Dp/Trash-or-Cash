# Trash or Cash

A gig-economy pay calculator (Spark, Instacart, Shipt, Food Delivery) that tells you whether an offer is worth taking, given your target hourly rate, MPG, and gas price. Includes voice entry, a light/dark theme, a first-run guided tutorial, an FAQ, and a local order-history log.

## How this is organized

This was originally one large single-file `index.html` (HTML + CSS + JS + embedded images/video, all inline). It's been split into files by responsibility, with **no change in behavior, wording, styling, timing, or calculations** — every line of logic here was moved verbatim from that file, not rewritten.

```
index.html          HTML shell: page structure, all markup, modals, and the <script>/<link> tags that pull in the files below
css/styles.css       All styling (was the <style> block)
js/                   Application logic, one file per subsystem (see below)
images/               Static images (was inline base64)
media/                Video assets (was inline base64)
```

### JavaScript load order matters

The `js/` files are **plain scripts sharing one global scope** — not ES modules, not individually wrapped/isolated. This mirrors how the code already worked before the split (everything lived in one shared closure), so functions and variables in one file are visible to files loaded after it. `index.html` loads them in this order, and that order is required:

1. `theme.js` — light/dark theme (color values, apply/toggle logic)
2. `settings.js` — target $/hr, MPG, gas price: stored values, load/save, the Settings modal UI, and the first-run "open Settings" nudge
3. `fields.js` — autosaving every input field to localStorage and restoring it on load; also tracks the last-viewed tab
4. `tabs.js` — switching between the 4 platform tabs, and the "More details" optional-fields toggle
5. `calculations.js` — the actual math for each platform, and `runCheck()`, which renders the verdict card, tilt bar, and stat boxes
6. `voice.js` — spoken-order entry: number-word parsing, per-tab field extraction, and the microphone/SpeechRecognition setup
7. `orders.js` — the local order-history log ("Did you take it?", the log table, CSV export)
8. `init.js` — the four calls that start everything once the page has loaded (must run last, after every file above)
9. `js/flash.js` — the cold-launch splash screen. Loaded separately, near the top of `<body>`, before any of the above. Self-contained: still wrapped in its own function, exactly as before, since nothing else in the app needs to see inside it.
10. `faq.js` — the Help & FAQ modal content and wiring
11. `tutorial.js` — the guided onboarding walkthrough. Loaded after `faq.js` because one tutorial button (the "replay tutorial" link inside the FAQ modal) needs both files' code.

`flash.js` hands off to `tutorial.js` (and `settings.js` receives a call from `tutorial.js`) through three small `window.*` globals — `window.__tocFlashDone`, `window.__tocAfterFlash`, `window.__tocOpenSettingsIfNeeded` — the same handoff mechanism the original single file used to let its three independent script blocks coordinate without needing to share scope directly.

### Assets

Ten assets that used to be embedded as base64 text directly in the HTML are now real files:

| File | Used for |
|---|---|
| `images/favicon.png` | Browser tab icon / apple-touch-icon (same image, used for both) |
| `images/flash-bg.webp`, `images/flash-fg.webp` | Flash screen layers (these two are byte-identical — that's how the original file had them too) |
| `images/wordmark-light.webp`, `images/wordmark-dark.webp` | Header wordmark, swapped by theme |
| `images/waiting-light.webp`, `images/waiting-dark.webp` | "Fill in the fields" illustration, swapped by theme |
| `media/radar-light.mp4`, `media/radar-dark.mp4` | The looping "keep this on your radar" watch-badge animation, swapped by theme |

### Fixed: Order Log modal was opening behind Settings

Found during testing (not caused by the reorganization — it was in the original single file too): every modal shares the same CSS `z-index:50`, and when two share a z-index, whichever sits *later* in the HTML document paints on top. `#logModal`'s markup happened to sit earlier in the document than `#settingsModal`'s, so opening the Order Log from inside Settings opened it directly behind the still-open Settings sheet — invisible, even though it had technically opened. (FAQ didn't have this problem only because its markup happens to sit *after* Settings' in the document.)

Fixed with one CSS rule scoped to `#logModal` (`css/styles.css`, right after `.modal-backdrop.show`) that gives it a `z-index` one higher than the shared default, so it always displays on top regardless of document order. Nothing else about how the modals work changed — verified with a real (non-scripted) pointer click on the log modal's close button, which now succeeds immediately instead of hitting the still-open Settings sheet underneath.

## Verification

Every split file was diffed against the original single-file source and confirmed byte-for-byte identical (aside from the intentional data-URI → real file swaps for the 10 assets above, and the one-line Order Log z-index fix noted above). The full app was also driven through an automated browser pass covering: the flash screen timing, the complete 12-step tutorial, the first-run Settings nudge, theme toggling and persistence, all 4 calculation tabs (with the underlying math independently checked), order logging, the FAQ (including its cross-file call into the tutorial), and field persistence across a reload — 35 of 36 checks passed, the one exception being a sandboxed-test-environment network limitation around the speech-recognition service, unrelated to the app code itself.
