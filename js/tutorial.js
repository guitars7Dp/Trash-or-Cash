/* ---------- Onboarding tutorial ----------
     The card lost its pill background/border in favor of a soft
     translucent panel — text sits on a blurred dark backdrop instead of
     a hard-edged box. #tutRocco lives INSIDE the card, in a reserved
     header strip (padding-top below), every single step — no more
     anchoring him to real app elements whose position/size varies by
     device. #tutBar and #tutShelf are two small fixtures INSIDE that
     strip (created in tutorial.js, styled here) that give him something
     real to grip, stand on, or peek around — see positionRocco() in
     tutorial.js for which pose uses which. */
  #tutSpotlight{
    position:fixed; z-index:300; pointer-events:none; border-radius:14px;
    box-shadow:0 0 0 9999px rgba(0,0,0,0.9);
    border:2px solid var(--caution);
    /* Only opacity is allowed to transition, and !important guarantees
       that even if the main stylesheet has a blanket "transition: all"
       rule somewhere that happens to win the cascade, top/left/width/
       height still snap instantly instead of gliding — this is what
       repositions the spotlight cutout every step. */
    transition:opacity .12s ease !important;
    top:50%; left:50%; width:0; height:0; opacity:0;
  }
  #tutSpotlight.tut-show{ opacity:1; }
  #tutOverlay{ display:none; }
  #tutOverlay.tut-active{ display:block; }
  #tutCard{
    position:fixed; z-index:302; max-width:300px; width:88vw;
    /* Top padding reserves the header strip #tutBar and #tutShelf live
       in, sized to the actual tallest pose (peekSide) plus a small
       buffer — not padded further than that. The previous version
       (180px) made the card tall enough that the existing above/below
       placement logic could no longer fit it without overlapping the
       very app element the slide points at; this is the smallest
       padding that still keeps every pose off the title/body text. */
    padding:145px 18px 16px;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    border-radius: 14px;
    text-align: center;
    visibility:hidden; opacity:0;
    /* Same !important guard as #tutSpotlight — this is the card itself,
       repositioned every step via top/left. Without this, any inherited
       "transition: all" from elsewhere in the app would animate that
       reposition instead of letting it snap, which is what reads as the
       card "sliding into place" between steps. */
    transition:opacity .12s ease !important;
  }
  #tutCard.tut-show{ visibility:visible; opacity:1; }
  /* The three fixtures Rocco stands on / hangs from / peeks around —
     plain little painted ledges/posts, styled to read as physical
     objects (a soft highlight on the lit side, a shadow on the other)
     rather than just decorative lines. */
  #tutBar, #tutShelf, #tutWall{
    position:absolute; left:50%; transform:translateX(-50%);
    border-radius:3px;
    box-shadow: 0 3px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35);
  }
  #tutBar, #tutShelf{
    background:linear-gradient(180deg, #d4a24a, var(--caution) 55%, #8a611f);
  }
  #tutBar{ top:18px; width:64px; height:5px; }
  #tutShelf{ top:110px; width:150px; height:5px; }
  /* #tutWall is a short vertical post, not a ledge — for the "peeking
     around the side" pose specifically, so it actually reads as
     peeking AROUND something. Gradient runs left-to-right (a lit edge,
     a shadowed edge) to match its vertical orientation. */
  #tutWall{
    top:40px; width:6px; height:56px;
    background:linear-gradient(90deg, #d4a24a, var(--caution) 55%, #8a611f);
  }
  /* Only the fixture in use for the current pose is shown (toggled in
     positionRocco()) — the idle one fades out instead of sitting there
     unused. */
  #tutBar, #tutShelf{ transition:opacity .12s ease !important; }
  #tutRocco{
    position:fixed; z-index:303; pointer-events:none;
    /* Same !important guard as #tutCard/#tutSpotlight — Rocco is
       repositioned via top/left every step (positionRocco()), and this
       is what stops any inherited "transition: all" from turning that
       reposition into a visible glide instead of an instant snap. */
    transition:opacity .12s ease !important;
    visibility:hidden; opacity:0;
    /* Just a plain drop shadow to lift him off the background — the
       round glow halo that used to sit behind him is gone, it read as
       an odd spotlight circle rather than helping him stand out. */
    filter:drop-shadow(0 6px 14px rgba(0,0,0,0.6));
  }
  #tutRocco.tut-show{ visibility:visible; opacity:1; }
  .tut-rule{ width:38px; height:3px; background:var(--caution); border-radius:2px; margin:0 auto 10px; }
  .tut-progress{
    font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:0.06em;
    /* Fixed color, not var(--muted) — the tutorial card's background is
       always solid black regardless of the app's light/dark theme, but
       --muted is a theme-dependent value tuned for the app's OWN light
       panels. In light theme that resolves to a dark gray, which is
       nearly invisible sitting directly on this always-black card. This
       light warm gray is chosen specifically to read on black in either
       theme. */
    color:#b8b8ae; text-transform:uppercase; text-shadow:0 2px 6px rgba(0,0,0,0.7);
  }
  .tut-title{
    font-family:'Archivo Black',sans-serif; font-size:16px; margin:6px 0 6px;
    color: var(--caution);
    text-shadow:0 2px 10px rgba(0,0,0,0.7);
  }
  .tut-text{
    font-size:13.5px; color:#f0ede4; line-height:1.6; margin:0 0 12px;
    text-shadow:0 2px 8px rgba(0,0,0,0.7);
  }
  .tut-dots{ display:flex; justify-content:center; gap:5px; margin-bottom:14px; }
  .tut-dots span{ width:6px; height:6px; border-radius:50%; background:var(--line-bright); box-shadow:0 1px 3px rgba(0,0,0,0.6); }
  .tut-dots span.on{ background:var(--caution); }
  .tut-actions{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .tut-skip{
    /* Same fixed-color fix as .tut-progress above, and for the same
       reason — this sits directly on the always-black card, so it needs
       a color that reads on black regardless of the app's own theme. */
    background:none; border:none; color:#b8b8ae; font-family:'IBM Plex Sans',sans-serif;
    font-weight:500; font-size:12.5px; letter-spacing:0.01em; cursor:pointer; padding:8px 2px;
    text-decoration:underline; text-shadow:0 2px 6px rgba(0,0,0,0.7);
  }
  .tut-nav{ display:flex; gap:8px; }
  .tut-back, .tut-next{
    font-family:'Archivo Black',sans-serif; font-size:12.5px; letter-spacing:0.02em;
    border-radius:10px; padding:10px 16px; cursor:pointer;
  }
  .tut-back{ background:var(--panel-2); border:1.5px solid var(--line-bright); color:var(--text); }
  .tut-back:disabled{ opacity:0.35; cursor:default; }
  .tut-next{ background:var(--caution); border:none; color:var(--bg); box-shadow:0 4px 14px rgba(0,0,0,0.4); }
