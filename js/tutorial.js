// ---------- Tutorial engine ----------
  // A guided, spotlight-driven walkthrough: STEPS below defines the script
  // (what to point at and what to say at each stop), positionForStep()
  // does the on-screen geometry, and goToStep/renderStep/startTutorial/
  // endTutorial drive playback. Runs automatically on a user's first visit
  // (see tutorialSeen/afterFlash near the bottom of this block) and can be
  // replayed anytime from Settings or the FAQ modal.
  const overlay = document.getElementById('tutOverlay');
  const spotlight = document.getElementById('tutSpotlight');
  const card = document.getElementById('tutCard');
  const roccoEl = document.getElementById('tutRocco');
  // Two small decorative fixtures, created here (not in the HTML) so the
  // paste-in stays to just these two files, and appended into the card
  // itself so they scale/reposition with it automatically. #tutBar is a
  // little rod near the top of the card's reserved header strip for
  // hang to grip from above; #tutShelf is a ledge near the bottom of
  // that strip for everyone else to stand, sit, lie, or peek around —
  // see positionRocco() below for how each pose uses them. Styling is
  // in the CSS.
  const roccoBar = document.createElement('div');
  roccoBar.id = 'tutBar';
  card.appendChild(roccoBar);
  const roccoShelf = document.createElement('div');
  roccoShelf.id = 'tutShelf';
  card.appendChild(roccoShelf);
  // #tutWall is a short vertical post, centered in the strip, for the
  // "peeking around the side" pose specifically — a horizontal ledge's
  // END doesn't read as something to peek AROUND, and gripping the far
  // edge of a wide shelf also pushed him well off-center. A thin
  // centered post fixes both: it visually reads as a wall/pillar, and
  // because it's centered and narrow, gripping either edge of it keeps
  // him close to the card's center instead of way off to one side.
  const roccoWall = document.createElement('div');
  roccoWall.id = 'tutWall';
  card.appendChild(roccoWall);
  const dotsEl = document.getElementById('tutDots');
  const progressEl = document.getElementById('tutProgress');
  const titleEl = document.getElementById('tutTitle');
  const textEl = document.getElementById('tutText');
  const backBtn = document.getElementById('tutBack');
  const nextBtn = document.getElementById('tutNext');
  const skipBtn = document.getElementById('tutSkip');

  // Tutorial onEnter/onExit hooks for the "More details" step (see STEPS
  // below): auto-expand the Spark tab's optional-fields panel while the
  // tutorial is pointing at it, then collapse it again on the way out, so
  // the tutorial doesn't leave the app in a different state than it found it.
  function openMorePanel(){
    const btn = document.querySelector('.more-toggle[data-more="spark"]');
    const panel = document.getElementById('more-spark');
    if(panel && !panel.classList.contains('open')){
      panel.classList.add('open');
      if(btn){ btn.classList.add('open'); btn.querySelector('span').textContent = '– MORE DETAILS (OPTIONAL)'; }
    }
  }
  function closeMorePanel(){
    const btn = document.querySelector('.more-toggle[data-more="spark"]');
    const panel = document.getElementById('more-spark');
    if(panel && panel.classList.contains('open')){
      panel.classList.remove('open');
      if(btn){ btn.classList.remove('open'); btn.querySelector('span').textContent = '+ MORE DETAILS (OPTIONAL)'; }
    }
  }
  // The "CASH or TRASH" and "keep this on your radar" tutorial steps need
  // to point at real UI elements — but a brand-new user, mid-tutorial,
  // hasn't entered any order details yet, so those elements aren't
  // actually on screen. These onEnter/onExit hooks fake them into view
  // just for the tutorial: force the verdict card open in its CASH state,
  // and force the watch badge visible, then hide them again on exit — but
  // ONLY if the tutorial was the one that forced them open in the first
  // place. The demoResultForced / demoWatchForced flags track that, so if
  // a real result happens to already be showing (or becomes visible)
  // during the tutorial, exiting the step doesn't rip a genuine result
  // off the screen.
  // Forces an element straight to its final on-screen state, skipping
  // whatever CSS transition normally animates it in — used only for the
  // tutorial's fake reveals below. Without this, positionForStep() would
  // measure the element mid-animation (e.g. still growing into view) and
  // lock Rocco onto a rect that isn't final yet, which is exactly what
  // was causing both the "floating"/"mid-air" positioning and the
  // noticeable pause the tutorial used to insert to wait it out. Reading
  // offsetHeight forces the browser to apply the class change immediately
  // (a synchronous layout), so by the time this returns the element's
  // real, final rect is available right away — no animation, no wait.
  function revealInstantly(el, addClass){
    const prevTransition = el.style.transition;
    el.style.transition = 'none';
    if(addClass) el.classList.add(addClass);
    void el.offsetHeight;
    el.style.transition = prevTransition;
  }
  let demoResultForced = false;
  function showDemoResult(){
    const resultEl = document.getElementById('result');
    if(!resultEl.classList.contains('show')){
      demoResultForced = true;
      const verdictEl = document.getElementById('verdictCard');
      revealInstantly(resultEl, 'show');
      revealInstantly(verdictEl, 'cash');
    }
  }
  function hideDemoResult(){
    if(demoResultForced){
      const resultEl = document.getElementById('result');
      resultEl.classList.remove('show');
      document.getElementById('verdictCard').classList.remove('cash');
      demoResultForced = false;
    }
  }
  let demoWatchForced = false;
  function showDemoWatch(){
    const resultEl = document.getElementById('result');
    const badge = document.getElementById('watchBadge');
    if(!resultEl.classList.contains('show')){
      demoResultForced = true;
      revealInstantly(resultEl, 'show');
    }
    if(!badge.classList.contains('show')){
      demoWatchForced = true;
      revealInstantly(badge, 'show');
    }
  }
  function hideDemoWatch(){
    if(demoWatchForced){
      document.getElementById('watchBadge').classList.remove('show');
      demoWatchForced = false;
    }
    hideDemoResult();
  }

  // The tutorial script, played in order. Each step: `target` is a CSS
  // selector for the element to spotlight (null = a centered step with no
  // spotlight, used for the intro/outro), `title`/`text` are the card
  // copy, and the optional `onEnter`/`onExit` hooks run side effects
  // needed just for that step (expanding a panel, faking a demo result —
  // see the functions above).

  // ---------- Rocco pose art ----------
  // He lives inside the card's reserved header strip on every step (see
  // #tutCard's padding-top in the CSS) — that part didn't change. What's
  // back is a real contact point for each pose to land on, without going
  // back to anchoring off real app elements (that's what kept breaking
  // across devices). #tutBar and #tutShelf, created above, are two small
  // fixtures that live inside the card itself, so their position is 100%
  // ours — no dependency on the app's layout at all:
  //   - #tutBar:   a little rod near the TOP of the strip. Only `hang`
  //     uses it, gripping its underside with both hands, dangling down.
  //   - #tutShelf: a ledge nearer the BOTTOM of the strip. Everyone else
  //     uses it — lying on top of it (nap), standing on it (pawup),
  //     peeking over its top edge (peekTop), or peeking around its left/
  //     right end (peekSide).
  // `anchor` below says which fixture + which edge of it a pose uses.
  // `gx`/`gy` are the exact spot inside that pose's own 1024×1024 image
  // — as a fraction of its width/height — where the hands/paws/feet
  // actually make contact, measured directly off the real art, same as
  // before. Locking that point onto the fixture's edge is what makes it
  // read as him actually gripping/standing/lying on something, instead
  // of just floating near it.
  // `cx` (shelf-top/bar-bottom poses only) is the pose's own visible-
  // content center, as a fraction of its 1024px canvas width — measured
  // from the actual alpha-channel bounding box, not assumed. Needed
  // because a pose's art isn't always padded evenly left/right inside
  // its square canvas (seatedCoin's tail sticks out well to the left of
  // his body), so centering on the raw canvas width alone would still
  // look off-center. Omit it and it defaults to 0.5 (true canvas center).
  const ROCCO_POSES = {
    nap:        { src: 'images/NappingRoccoBGRemoved.png',                 w: 88,  gx: 0.50,  gy: 0.86,  anchor: 'shelf-top',   alt: 'Rocco napping' },
    peekTop:    { src: 'images/PeekOverTopRoccoBGRemoved.png',             w: 100, gx: 0.49,  gy: 0.823, anchor: 'shelf-top',   alt: 'Rocco peeking over the top' },
    peekSide:   { src: 'images/PeekingAroundCross-EyedRoccoBGRemoved.png', w: 72,  gx: 0.113, gy: 0.70,  anchor: 'wall-side',   alt: 'Rocco peeking around the side' },
    hang:       { src: 'images/HangingRoccoBGRemoved.png',                 w: 100, gx: 0.49,  gy: 0.055, anchor: 'bar-bottom',  alt: 'Rocco hanging' },
    pawup:      { src: 'images/DollarBillWavingRoccoBGRemoved.png',        w: 96,  cx: 0.385, gy: 0.90,  anchor: 'shelf-top',   alt: 'Rocco waving' },
    seatedCoin: { src: 'images/HoldingSingleCoinRoccoBGRemoved.png',       w: 92,  cx: 0.424, gy: 0.70,  anchor: 'shelf-top',   alt: 'Rocco sitting with a coin' },
  };

  // Fetches every pose image right away, as soon as this script runs —
  // not lazily, the first time each one is actually needed. On a first
  // visit, nothing has these cached yet: assigning roccoEl.src mid-step
  // used to kick off the fetch at that exact moment, and since the
  // browser doesn't know an image's real dimensions until it finishes
  // downloading, #tutRocco would render at some fallback size and then
  // visibly resize/settle once it arrived — reads as "the character
  // moving into place." A replay never showed this because every pose
  // was already browser-cached from the first run. Kicking every fetch
  // off immediately (in parallel, well before the tutorial can actually
  // start) gives them the most possible time to finish first.
  Object.values(ROCCO_POSES).forEach(pose => { new Image().src = pose.src; });

  // Places #tutRocco against #tutBar or #tutShelf per the pose's anchor.
  // Both fixtures are real elements inside the card, so their rects are
  // just measured directly — no target geometry, no viewport-dependent
  // math, nothing that changes across devices.
  //   flip: true — for peekSide only, grips the wall's LEFT edge instead
  //         of its default right edge (also mirrors the art to match).
  function positionRocco(step){
    const cfg = step.rocco;
    if(!cfg){
      roccoEl.classList.remove('tut-show');
      roccoBar.style.opacity = '0';
      roccoShelf.style.opacity = '0';
      roccoWall.style.opacity = '0';
      return;
    }
    const pose = ROCCO_POSES[cfg.pose];
    if(roccoEl.getAttribute('data-pose') !== cfg.pose){
      roccoEl.src = pose.src;
      roccoEl.alt = pose.alt;
      roccoEl.setAttribute('data-pose', cfg.pose);
    }
    roccoEl.style.width = pose.w + 'px';
    roccoEl.style.height = 'auto';

    const shelf = roccoShelf.getBoundingClientRect();
    const bar = roccoBar.getBoundingClientRect();
    const wall = roccoWall.getBoundingClientRect();

    // Only the fixture actually being used is shown — otherwise idle
    // fixtures with nothing on them just read as visual clutter.
    roccoBar.style.opacity = (pose.anchor === 'bar-bottom') ? '1' : '0';
    roccoShelf.style.opacity = (pose.anchor === 'shelf-top') ? '1' : '0';
    roccoWall.style.opacity = (pose.anchor === 'wall-side') ? '1' : '0';

    let ex, ey, left;
    if(pose.anchor === 'bar-bottom'){
      ex = bar.left + bar.width/2;
      ey = bar.bottom;
      // Centered on the bar by his actual displayed width (adjusted by
      // cx below), not by gx — gx marks where his paws grip, which
      // isn't always the horizontal center of the artwork, and centering
      // on gx made him look noticeably off-center even though the grip
      // point was "correct."
      left = ex - (pose.cx ?? 0.5) * pose.w;
      roccoEl.style.transform = 'none';
    } else if(pose.anchor === 'wall-side'){
      // A short vertical post, centered in the card, that he grips the
      // left or right edge of — reads as actually peeking AROUND
      // something (unlike the old horizontal-shelf-end anchor), and
      // because the post is thin and centered, either edge sits close
      // to the card's center, so he stays close to center too instead
      // of leaning way off to one side.
      const rightEnd = !cfg.flip;
      ex = rightEnd ? wall.right : wall.left;
      ey = wall.top + wall.height/2;
      const gx = rightEnd ? pose.gx : (1 - pose.gx);
      left = ex - gx * pose.w;
      roccoEl.style.transform = rightEnd ? 'none' : 'scaleX(-1)';
    } else { // shelf-top
      ex = shelf.left + shelf.width/2;
      ey = shelf.top;
      left = ex - (pose.cx ?? 0.5) * pose.w;
      roccoEl.style.transform = 'none';
    }

    roccoEl.style.left = left + 'px';
    roccoEl.style.top = (ey - pose.gy * pose.w) + 'px';
    roccoEl.classList.add('tut-show');
  }

  const STEPS = [
    {
      target: null,
      rocco: { pose: 'pawup' },
      title: "Hey, I'm Rocco!",
      text: "I dig into a gig offer and tell you if it's actually worth taking. Feed me the details and I'll instantly compare it against the $/hr you want to make — after gas — so you know right away if it's CASH or TRASH. Let me show you around in a few quick steps."
    },
    {
      // '.tabs' (class), not '#tabs' — the tab bar's id was dropped from
      // the HTML at some point; the class name is still there and stable.
      target: '.tabs',
      rocco: { pose: 'peekTop' },
      title: 'Pick your platform',
      text: "Start here. Choose which app you're driving for — Spark, Instacart, Shipt, or Food Delivery (DoorDash, Uber Eats, Grubhub, etc.) — the fields below change to match."
    },
    {
      target: '#panel-spark .required-block',
      rocco: { pose: 'peekSide' },
      title: 'The must-haves',
      text: "These are the only fields you really need — how long the offer says it'll take, how many miles, and what it pays."
    },
    {
      target: '#micBtn',
      rocco: { pose: 'hang' },
      title: 'Tap to speak',
      text: "In a hurry? Check the offer in your gig app, then come back here and tap this to read it out loud. Switch back and forth as needed — I'll hold onto what you've already told me."
    },
    {
      target: '.more-toggle[data-more="spark"]',
      onEnter: openMorePanel,
      onExit: closeMorePanel,
      cardDx: -40,
      rocco: { pose: 'nap' },
      title: 'More details (optional)',
      text: "Got a return trip? Tap here to add it in. It's never required, but it sharpens the math."
    },
    {
      target: '#calculateBtn',
      rocco: { pose: 'pawup' },
      title: 'Calculate',
      text: "I calculate automatically the moment your required fields are filled — by typing, by voice, or a mix of both across a few mic taps. Tap CALCULATE if you just want to jump straight to the verdict."
    },
    {
      target: '#clearFieldsBtn',
      rocco: { pose: 'peekTop' },
      title: 'Clear fields',
      text: "Done with this offer? Tap here to wipe the current tab's fields for the next one."
    },
    {
      target: '#verdictCard',
      onEnter: showDemoResult,
      onExit: hideDemoResult,
      // Now that #tutShelf gives him something real to sit on, the
      // seated/coin pose is back — and it's the strongest thematic fit
      // in the whole set for the CASH/TRASH verdict specifically.
      rocco: { pose: 'seatedCoin' },
      title: 'CASH or TRASH',
      text: "This is the verdict. CASH means the offer meets or beats your target pay per hour after gas — TRASH means it falls short. The stats below break down net pay, gross pay, fuel cost, and time."
    },
    {
      target: '#watchBadge',
      onEnter: showDemoWatch,
      onExit: hideDemoWatch,
      rocco: { pose: 'hang' },
      title: "Keep this on your radar",
      text: "When an offer is TRASH but within $3 of your target, I'll flag it like this. Handy on Spark, where offers often bump up a bit at a time — watch for the number I'm pointing at, and grab it the moment it lands."
    },
    {
      target: '#settingsBtn',
      rocco: { pose: 'peekSide', flip: true },
      title: 'Your numbers',
      text: "Tap the gear to set your target $/hr, your vehicle's MPG, and gas price. I'll remember them for every calculation, and you can always come back here to change them anytime."
    },
    {
      target: '#themeBtn',
      rocco: { pose: 'peekTop' },
      title: 'Light or dark',
      text: 'Tap this anytime to switch between light and dark mode.'
    },
    {
      target: null,
      rocco: { pose: 'nap' },
      title: "That's the tour!",
      text: "Find me again anytime under Settings — TUTORIAL for the full walkthrough, or HELP & FAQ for quick answers. Let's get your numbers set up."
    }
  ];

  let stepIndex = 0;              // which STEPS entry is currently showing
  let active = false;             // whether the tutorial overlay is currently running
  let resizeHandlerBound = false; // guards against binding the resize/scroll handlers more than once across replays
  // How far from the top of the screen a step's target gets scrolled to
  // (see renderStep() below) — shared with positionForStep()'s fit
  // check so both agree on how much vertical room is actually available.
  const TARGET_TOP_MARGIN = 56;

  // window.innerHeight on iOS Safari isn't a stable number — it grows
  // when the address bar auto-hides on scroll and shrinks back when it
  // reappears, even though nothing about the actual page changed. Every
  // "does the target+card group fit, or do we need to pin to the top"
  // decision reads window.innerHeight, so measuring it fresh on every
  // single step meant the SAME step (CASH or TRASH, the radar badge)
  // could get a different answer depending on whatever toolbar state
  // happened to be showing at that exact moment — which is exactly the
  // "sometimes it centers, sometimes it doesn't" Derek reported. These
  // two track a settled reference size instead: trackViewportSize()
  // (called at the top of positionForStep(), so every code path that
  // measures the viewport goes through it first) only lets the height
  // shrink on its own — an actual rotation or window resize is detected
  // by the WIDTH changing at the same time, and only then does the
  // reference reset outright. Everywhere below that used to read
  // window.innerHeight/innerWidth directly now reads these instead.
  let stableViewportW = window.innerWidth;
  let stableViewportH = window.innerHeight;
  function trackViewportSize(){
    const w = window.innerWidth, h = window.innerHeight;
    if(Math.abs(w - stableViewportW) > 40){
      stableViewportW = w;
      stableViewportH = h;
    } else {
      stableViewportW = w;
      stableViewportH = Math.min(stableViewportH, h);
    }
  }
  // The one element currently shrunk to make room for the card (see
  // shrinkTargetToFit() below) — tracked so it can be restored to full
  // size the moment the tutorial moves off it, whether that's the next
  // step or closing the tutorial entirely. This is always a *temporary*
  // inline transform on the real app element, never a change to its
  // actual CSS, and it's gone the instant the tutorial stops pointing
  // at it — the app itself is untouched outside these few seconds.
  let shrunkTarget = null;
  // A temporary spacer appended to the very end of the page while the
  // tutorial is running (see startTutorial()/endTutorial()) purely so
  // there's always enough room to scroll a late-page target (the verdict
  // card, the watch badge) up near the top of the screen. Without it,
  // the browser simply can't scroll any further once the real page
  // content runs out — a target near the bottom of the page gets stuck
  // wherever it naturally sits, leaving no room below it for the card,
  // which was pushing the card's Back/Next buttons off-screen. It's
  // added on start and removed on end, so it never affects the app
  // outside an active tutorial run.
  let scrollSpacer = null;

  // Redraws the step-progress dots, highlighting the current step.
  function buildDots(){
    dotsEl.innerHTML = '';
    STEPS.forEach((s, i)=>{
      const d = document.createElement('span');
      if(i === stepIndex) d.className = 'on';
      dotsEl.appendChild(d);
    });
  }

  // Caps the tutorial card at 300px, but shrinks it further on narrow
  // screens so it never gets close to the viewport edges.
  function clampCardWidth(){
    return Math.min(300, stableViewportW * 0.88);
  }

  // Positions the spotlight cutout and the tutorial card for the current
  // step, relative to its target element's current on-screen position,
  // and hands off to positionRocco() to place that step's pose art
  // against the card. Flips the card above vs. below the target
  // depending on which side has more room, and clamps everything to stay
  // fully on-screen. Steps with no target (target: null) instead just
  // center the card with no spotlight cutout. Called on every step change
  // and again on resize/scroll while the tutorial is active, since the
  // target's position can shift.
  // Undoes any temporary shrink from a previous step so the app element
  // is back to its real size the moment the tutorial stops pointing at
  // it. Safe to call even when nothing is shrunk.
  function restoreShrunkTarget(){
    if(shrunkTarget){
      shrunkTarget.style.transform = '';
      shrunkTarget.style.transformOrigin = '';
      shrunkTarget = null;
    }
  }

  // If a target is simply too tall to fit alongside the card — the
  // required-fields block wrapping all three field groups is the one
  // that actually hits this — there's no placement above/below that
  // avoids BOTH covering the target and pushing the card's Back/Next
  // buttons off the bottom of the screen; on "The must-haves" step that
  // left the tutorial un-advanceable. Rather than touch the app's own
  // CSS (which would shrink it outside the tutorial too), this scales
  // the target down with a temporary inline transform — measured fresh
  // each time against the actual available space, and undone the
  // instant the tutorial moves off it (see restoreShrunkTarget()) — so
  // the real app is never permanently affected.
  function shrinkTargetToFit(targetEl, cardHeight){
    if(shrunkTarget && shrunkTarget !== targetEl) restoreShrunkTarget();
    targetEl.style.transform = '';
    targetEl.style.transformOrigin = '';
    const naturalHeight = targetEl.getBoundingClientRect().height;
    const pad = 8, gap = 16, bottomMargin = 10;
    const available = stableViewportH - TARGET_TOP_MARGIN - cardHeight - pad*2 - gap - bottomMargin;
    if(naturalHeight > available && available > 60){
      const scale = Math.max(0.55, available / naturalHeight);
      targetEl.style.transform = 'scale(' + scale + ')';
      targetEl.style.transformOrigin = 'top center';
      shrunkTarget = targetEl;
    } else {
      shrunkTarget = null;
    }
  }

  function positionForStep(){
    trackViewportSize();
    const step = STEPS[stepIndex];
    const targetEl = step.target ? document.querySelector(step.target) : null;
    const pad = 8;

    if(targetEl){
      const cardWidthForFit = clampCardWidth();
      card.style.width = cardWidthForFit + 'px';
      shrinkTargetToFit(targetEl, card.offsetHeight || 200);

      const rect = targetEl.getBoundingClientRect();
      spotlight.classList.add('tut-show');
      spotlight.style.top = (rect.top - pad) + 'px';
      spotlight.style.left = (rect.left - pad) + 'px';
      spotlight.style.width = (rect.width + pad*2) + 'px';
      spotlight.style.height = (rect.height + pad*2) + 'px';

      const cardWidth = cardWidthForFit;
      const cardHeight = card.offsetHeight || 200;

      const spaceBelow = stableViewportH - rect.bottom;
      const spaceAbove = rect.top;
      const placeBelow = spaceBelow >= (cardHeight + 26) || spaceBelow >= spaceAbove;

      let top;
      if(placeBelow){
        top = rect.bottom + pad + 16;
      } else {
        top = rect.top - pad - 16 - cardHeight;
      }
      // Keep the card fully on-screen when there's room to...
      top = Math.max(10, Math.min(top, stableViewportH - cardHeight - 10));
      // ...but never let that on-screen adjustment pull it back over the
      // target. For a tall target (the verdict panel with its stats
      // breakdown, a multi-field required-block, etc.) there sometimes
      // isn't enough room on either side for the full card, and the
      // clamp above was winning that fight — shoving the card back over
      // the exact element the step is explaining. The whole point of
      // this card is to point at that element, so never covering it
      // wins even in the rare case where the card's far edge ends up
      // running slightly past the viewport edge instead.
      if(placeBelow){
        top = Math.max(top, rect.bottom + pad);
      } else {
        top = Math.min(top, rect.top - pad - cardHeight);
      }

      let left = rect.left + rect.width/2 - cardWidth/2;
      left = Math.max(10, Math.min(left, stableViewportW - cardWidth - 10));

      left += (step.cardDx || 0);
      left = Math.max(10, Math.min(left, stableViewportW - cardWidth - 10));
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      positionRocco(step);
    } else {
      restoreShrunkTarget();
      // Still dim the background even with nothing spotlighted (previously
      // this branch skipped the scrim entirely, which worked fine for a
      // solid card but left free-floating text sitting directly over the
      // full-brightness app underneath — no longer legible without a
      // panel behind it). Width/height stay 0 so there's no cutout hole,
      // just a full, even dim.
      spotlight.classList.add('tut-show');
      spotlight.style.width = '0px';
      spotlight.style.height = '0px';
      spotlight.style.top = '50%';
      spotlight.style.left = '50%';

      const cardWidth = clampCardWidth();
      card.style.width = cardWidth + 'px';
      const cardHeight = card.offsetHeight || 200;
      card.style.left = ((stableViewportW - cardWidth) / 2) + 'px';
      card.style.top = Math.max(10, (stableViewportH - cardHeight) / 2) + 'px';
      positionRocco(step);
    }
  }

  // Updates the card's text/progress/buttons for the current step, jumps
  // straight to the target (an instant scroll, not an animated one), and
  // shows the spotlight/card/Rocco together in the same pass. No waiting,
  // no delayed re-check: everything that could previously make a rect
  // wrong at measurement time (fonts still swapping in, a demo reveal
  // still animating) is now made correct BEFORE this runs — see
  // revealInstantly() above and the font-ready gate in startTutorial()
  // below — so a single synchronous measure-and-show is reliable, and
  // the character and text box appear together with no visible pause.
  function renderStep(){
    trackViewportSize();
    const step = STEPS[stepIndex];
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    progressEl.textContent = 'STEP ' + (stepIndex+1) + ' OF ' + STEPS.length;
    backBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === STEPS.length - 1 ? "LET'S GO!" : 'NEXT';
    buildDots();

    const targetEl = step.target ? document.querySelector(step.target) : null;
    if(targetEl){
      const rect = targetEl.getBoundingClientRect();
      const cardWidthNow = clampCardWidth();
      card.style.width = cardWidthNow + 'px';
      const cardHeightNow = card.offsetHeight || 200;
      const groupGap = 8 + 16; // matches the pad+gap positionForStep() puts between target and card
      const groupHeight = rect.height + groupGap + cardHeightNow;
      const breathingRoom = 20;
      let desiredTop;
      if(groupHeight + breathingRoom*2 <= stableViewportH){
        // Room to spare — center the target+card as one visual group
        // instead of pinning the target to the top. Pinning to the top
        // when there's slack left the target sitting right under the
        // status bar with all the leftover space dumped below the card
        // (the verdict card on "CASH or TRASH" was the clearest case of
        // this) — centering the pair splits that slack evenly above and
        // below instead. Using stableViewportH rather than a fresh
        // window.innerHeight read here is what makes this consistent
        // step to step — see the comment by its declaration.
        desiredTop = (stableViewportH - groupHeight) / 2;
      } else {
        // Not enough room for both together (the required-fields block
        // on "The must-haves" is the one that actually hits this) — a
        // tall target needs every pixel of headroom below it can get,
        // so pin it to a small fixed margin from the top instead of
        // centering, and let shrinkTargetToFit()/positionForStep()'s
        // never-cover-the-target rule handle the rest.
        desiredTop = TARGET_TOP_MARGIN;
      }
      const delta = rect.top - desiredTop;
      if(Math.abs(delta) > 2){
        // Force truly-instant scrolling, not just the default. The
        // Element.scroll*() `behavior` option only standardizes 'auto'
        // and 'smooth' — 'auto' means "whatever scroll-behavior CSS
        // says", so if the page (or the OS's own reduced-motion/
        // accessibility settings) has smooth scrolling on anywhere, an
        // unqualified scroll call still animates over several frames,
        // and the 'scroll' listener below re-runs positionForStep() on
        // every one of them — which is what was making Rocco and the
        // card visibly glide into place each step instead of snapping
        // straight there. Temporarily forcing scroll-behavior:auto via
        // inline style (higher specificity than any stylesheet rule)
        // guarantees an instant jump regardless of what CSS elsewhere
        // requests, then restores whatever was there before.
        const html = document.documentElement;
        const prevHtmlBehavior = html.style.scrollBehavior;
        const prevBodyBehavior = document.body.style.scrollBehavior;
        html.style.scrollBehavior = 'auto';
        document.body.style.scrollBehavior = 'auto';
        window.scrollBy(0, delta);
        html.style.scrollBehavior = prevHtmlBehavior;
        document.body.style.scrollBehavior = prevBodyBehavior;
      }
    }
    positionForStep();
    spotlight.classList.add('tut-show');
    card.classList.add('tut-show');
  }

  // Moves to a new step: runs the outgoing step's onExit (if any), runs
  // the incoming step's onEnter (if any), then re-renders.
  function goToStep(newIndex){
    const prevStep = STEPS[stepIndex];
    if(prevStep && prevStep.onExit) prevStep.onExit();
    stepIndex = newIndex;
    const nextStep = STEPS[stepIndex];
    if(nextStep && nextStep.onEnter) nextStep.onEnter();
    renderStep();
  }

  // Begins (or restarts) the tutorial from step 1. Switches to the Spark
  // tab first so every run starts from the same known layout, regardless
  // of whichever tab the user happened to be on. Binds the resize/scroll
  // re-positioning listeners the first time only — resizeHandlerBound
  // stops a replay from stacking duplicate listeners on top of the ones
  // from an earlier run.
  //
  // The one thing genuinely worth waiting on, ever, is the page's web
  // fonts — if they're still swapping in when a step first measures the
  // card, its height (and so its whole layout) can be wrong. So that
  // waiting happens exactly once, here, before anything is shown at all
  // — not per step. In the overwhelmingly common case the fonts are
  // already loaded (document.fonts.ready resolves on the next microtask,
  // imperceptible), so this adds no visible delay; it only actually
  // pauses on a rare cold load, and even then it pauses before the
  // overlay appears rather than causing a jump after it's already shown.
  function startTutorial(){
    try{ document.querySelector('.tab[data-tab="spark"]').click(); }catch(e){}
    document.getElementById('settingsModal').classList.remove('show');
    document.getElementById('faqModal').classList.remove('show');
    stepIndex = 0;
    active = true;
    overlay.classList.add('tut-active');
    document.body.style.overflow = 'hidden';

    // Fresh reference reading for this run — see the declaration above.
    stableViewportW = window.innerWidth;
    stableViewportH = window.innerHeight;

    // See the scrollSpacer declaration above — guarantees every step's
    // target can be scrolled up near the top of the screen even if it
    // sits close to the bottom of the real page.
    if(!scrollSpacer){
      scrollSpacer = document.createElement('div');
      scrollSpacer.id = 'tutScrollSpacer';
      scrollSpacer.style.cssText = 'height:' + (stableViewportH + 100) + 'px; pointer-events:none;';
      document.body.appendChild(scrollSpacer);
    }

    const first = STEPS[0];
    if(first.onEnter) first.onEnter();

    if(!resizeHandlerBound){
      resizeHandlerBound = true;
      window.addEventListener('resize', ()=>{ if(active) positionForStep(); });
      window.addEventListener('scroll', ()=>{ if(active) positionForStep(); }, {passive:true});
    }

    try{
      if(document.fonts && document.fonts.ready){
        document.fonts.ready.then(()=>{ if(active) renderStep(); });
        return;
      }
    }catch(e){}
    renderStep();
  }

  // Closes the tutorial overlay. `markSeen` records toc_tutorial_seen so
  // it won't auto-run again on future visits — true for both Skip and
  // finishing the last step, since either way the user has seen it.
  // `forceOpenSettings` is only true when finishing normally (the "LET'S
  // GO!" button on the last step): it sends the user straight into
  // Settings to enter their numbers. Skipping early doesn't force that,
  // but still triggers the same first-run Settings nudge via
  // window.__tocOpenSettingsIfNeeded if they haven't saved settings yet.
  function endTutorial(markSeen, forceOpenSettings){
    const step = STEPS[stepIndex];
    if(step && step.onExit) step.onExit();
    restoreShrunkTarget();
    if(scrollSpacer){
      scrollSpacer.remove();
      scrollSpacer = null;
    }
    active = false;
    overlay.classList.remove('tut-active');
    spotlight.classList.remove('tut-show');
    card.classList.remove('tut-show');
    roccoEl.classList.remove('tut-show');
    document.body.style.overflow = '';
    if(markSeen){
      try{ localStorage.setItem('toc_tutorial_seen', '1'); }catch(e){}
    }
    if(forceOpenSettings){
      document.getElementById('settingsBtn').click();
    } else if(markSeen && window.__tocOpenSettingsIfNeeded){
      window.__tocOpenSettingsIfNeeded();
    }
  }

  nextBtn.addEventListener('click', ()=>{
    if(stepIndex === STEPS.length - 1){
      endTutorial(true, true);
    } else {
      goToStep(stepIndex + 1);
    }
  });
  backBtn.addEventListener('click', ()=>{
    if(stepIndex > 0) goToStep(stepIndex - 1);
  });
  skipBtn.addEventListener('click', ()=> endTutorial(true));

  document.getElementById('replayTutorialBtn').addEventListener('click', startTutorial);
  document.getElementById('faqReplayTutorialBtn').addEventListener('click', ()=>{
    faqModal.classList.remove('show');
    startTutorial();
  });

  let tutorialSeen = false;
  try{ tutorialSeen = !!localStorage.getItem('toc_tutorial_seen'); }catch(e){}
  // Dev/support convenience: loading the app with ?tutorial=1 in the URL
  // forces the tutorial to run regardless of whether it's already been
  // seen — handy for demoing it or troubleshooting without clearing
  // localStorage first.
  let forceTutorial = false;
  try{ forceTutorial = /(?:^|[?&])tutorial=1(?:&|$)/.test(window.location.search); }catch(e){}

  // Runs once the cold-launch flash screen has finished (see the
  // window.__tocFlashDone / __tocAfterFlash handoff below): starts the
  // tutorial for a first-time (or forced) visitor, or otherwise falls
  // through to the first-run Settings nudge for a returning visitor who
  // hasn't saved settings yet.
  function afterFlash(){
    if(!tutorialSeen || forceTutorial){
      setTimeout(startTutorial, 200);
    } else if(window.__tocOpenSettingsIfNeeded){
      window.__tocOpenSettingsIfNeeded();
    }
  }

  // The flash screen (added at the very top of <body>) always plays first
  // on a cold app open. It may finish before this script even parses (slow
  // network) or after (fast device) — either order is handled: if it's
  // already done, run immediately; otherwise wait for its callback. This
  // guarantees first-time users see flash -> tutorial in sequence, never
  // stacked on top of each other.
  if(window.__tocFlashDone){
    afterFlash();
  } else {
    window.__tocAfterFlash = afterFlash;
  }
