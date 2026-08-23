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
  // Six poses in images/. `w` is display width in px (height follows from
  // `ratio`, height÷width, measured ahead of time so his size is correct
  // immediately instead of waiting on the image to load).
  //
  // `gx`/`gy` are the important part: the exact spot INSIDE his own image
  // — as a fraction of its full width/height, from the top-left corner —
  // where his hands/paws/feet actually make contact. Measured directly
  // off the real source files (see ROCCO_POSES below for how). Positioning
  // locks THAT point exactly onto the target edge, so it always reads as
  // him actually gripping/standing/lying on something real — never
  // floating near it with a gap.
  // Every value below was re-measured directly off the actual files
  // Derek sent (not a local stand-in): each one is a full 1024×1024
  // square canvas with Rocco occupying only part of it — NOT a tight
  // crop the way every earlier measurement here assumed. That mismatch
  // (measuring contact points as fractions of a tight crop, then
  // applying those fractions to a padded square) is why positioning
  // never fully converged no matter how precisely any single number was
  // tuned: the coordinate space itself was wrong. `ratio` is 1 for all
  // of them now (square), and `w` is scaled up from the old tight-crop
  // widths to account for how much of the canvas is empty padding, so
  // Rocco's actual rendered size stays about the same as before.
  const ROCCO_POSES = {
    nap:      { src: 'images/NappingRoccoBGRemoved.png',                 w: 234, ratio: 1, gx: 0.50,  gy: 0.86,  alt: 'Rocco napping' },
    peekTop:  { src: 'images/PeekOverTopRoccoBGRemoved.png',             w: 271, ratio: 1, gx: 0.49,  gy: 0.823, alt: 'Rocco peeking over the top' },
    dangle:   { src: 'images/HoldingSingleCoinRoccoBGRemoved.png',       w: 264, ratio: 1, gx: 0.42,  gy: 0.68,  alt: 'Rocco sitting with a coin' },
    peekSide: { src: 'images/PeekingAroundCross-EyedRoccoBGRemoved.png', w: 246, ratio: 1, gx: 0.113, gy: 0.70,  alt: 'Rocco peeking around the side' },
    hang:     { src: 'images/HangingRoccoBGRemoved.png',                 w: 292, ratio: 1, gx: 0.49,  gy: 0.055, alt: 'Rocco hanging' },
    pawup:    { src: 'images/DollarBillWavingRoccoBGRemoved.png',        w: 260, ratio: 1, gx: 0.234, gy: 0.90,  alt: 'Rocco waving' },
  };

  // Positions #tutRocco so its grip point lands exactly on a real edge.
  // Each step's `rocco` config says which edge and where along it:
  //   edge: 'top' | 'bottom' | 'left' | 'right'  — which side of the
  //         reference rect his grip point attaches to
  //   ref:  'card' (default) — the tutorial text box's own edge, or
  //         'target' — the actual spotlighted app element's edge (the
  //         button/badge itself), for poses that should grab or hang
  //         from THAT instead of the text box
  //   along: 0–1 — where along that edge (left-to-right for top/bottom,
  //         top-to-bottom for left/right)
  //   flip: true — mirrors the art horizontally (peekSide is drawn
  //         gripping with its left paw; flip it to grip with its right
  //         when he's peeking around a box's right-hand edge instead)
  //   dx/dy: small optional nudge in px, once the real contact point is
  //         already correct — not the primary tool anymore
  function positionRocco(step, cardRect, targetRect){
    const cfg = step.rocco;
    if(!cfg){ roccoEl.classList.remove('tut-show'); return; }
    const pose = ROCCO_POSES[cfg.pose];
    if(roccoEl.getAttribute('data-pose') !== cfg.pose){
      roccoEl.src = pose.src;
      roccoEl.alt = pose.alt;
      roccoEl.setAttribute('data-pose', cfg.pose);
    }
    // A step can also override the rendered width (cfg.w) — some spots
    // (a small header icon, a tight corner) don't have room for a pose
    // at its default size without it either getting clamped back onto
    // the wrong spot or swallowing whatever it's supposed to be next to.
    const w = cfg.w || pose.w;
    roccoEl.style.width = w + 'px';
    roccoEl.style.height = 'auto';
    roccoEl.style.transform = cfg.flip ? 'scaleX(-1)' : 'none';
    const rh = w * pose.ratio;

    const ref = (cfg.ref === 'target' && targetRect) ? targetRect : cardRect;
    let ex, ey;
    switch(cfg.edge){
      case 'bottom': ex = ref.left + (cfg.along ?? 0.5) * ref.width; ey = ref.bottom; break;
      case 'left':   ex = ref.left; ey = ref.top + (cfg.along ?? 0.5) * ref.height; break;
      case 'right':  ex = ref.right; ey = ref.top + (cfg.along ?? 0.5) * ref.height; break;
      case 'top':
      default:       ex = ref.left + (cfg.along ?? 0.5) * ref.width; ey = ref.top; break;
    }

    // A step can override which point on the pose makes contact (gx/gy)
    // instead of using the pose's default grip point — e.g. pawup's
    // default grip is his feet (for standing ON something), but a step
    // that has him reaching UP to grab a button above him needs his
    // raised hand to be the contact point instead.
    const baseGx = cfg.gx ?? pose.gx;
    const baseGy = cfg.gy ?? pose.gy;
    const gx = cfg.flip ? (1 - baseGx) : baseGx;
    let left = ex - gx * w + (cfg.dx || 0);
    let top = ey - baseGy * rh + (cfg.dy || 0);

    // Keep him fully on-screen on narrow phones — only kicks in if the
    // exact contact point would otherwise push him off the viewport edge.
    // (Tried dropping the vertical half of this once, betting the clamp
    // itself was the bug on the centered intro/outro steps — it wasn't;
    // without it he rendered entirely off the top of the screen there,
    // which is strictly worse. Kept as a safety net; the actual "too far
    // up" cause is being corrected directly via dy below instead.)
    const margin = 8;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rh - margin));
    roccoEl.style.top = top + 'px';
    roccoEl.style.left = left + 'px';
    roccoEl.classList.add('tut-show');
  }

  const STEPS = [
    {
      target: null,
      rocco: { pose: 'pawup', edge: 'top', along: 0.5 },
      title: "Hey, I'm Rocco!",
      text: "I dig into a gig offer and tell you if it's actually worth taking. Feed me the details and I'll instantly compare it against the $/hr you want to make — after gas — so you know right away if it's CASH or TRASH. Let me show you around in a few quick steps."
    },
    {
      target: '#tabs',
      rocco: { pose: 'peekTop', edge: 'top', along: 0.65 },
      title: 'Pick your platform',
      text: "Start here. Choose which app you're driving for — Spark, Instacart, Shipt, or Food Delivery (DoorDash, Uber Eats, Grubhub, etc.) — the fields below change to match."
    },
    {
      target: '#panel-spark .required-block',
      rocco: { pose: 'peekSide', ref: 'target', edge: 'left', along: 0.35 },
      title: 'The must-haves',
      text: "These are the only fields you really need — how long the offer says it'll take, how many miles, and what it pays."
    },
    {
      target: '#micBtn',
      // Same issue as the radar badge: hanging from the button's BOTTOM
      // edge put ~95% of his body straight down over every line of the
      // card text below (the card starts almost immediately under this
      // button, no gap to work with). Hanging from the button's TOP
      // edge instead means that same ~95% drapes UP over the button
      // itself — its label is short and the gold highlight ring still
      // marks it, so that's a much smaller loss than burying five lines
      // of instructions. Sized down too, so he only grazes the card's
      // title instead of reaching into the paragraph.
      rocco: { pose: 'hang', ref: 'target', edge: 'top', along: 0.75, w: 130 },
      title: 'Tap to speak',
      text: "In a hurry? Check the offer in your gig app, then come back here and tap this to read it out loud. Switch back and forth as needed — I'll hold onto what you've already told me."
    },
    {
      target: '.more-toggle[data-more="spark"]',
      onEnter: openMorePanel,
      onExit: closeMorePanel,
      cardDx: -40,
      rocco: { pose: 'peekSide', ref: 'target', edge: 'right', flip: true, along: 0.3 },
      title: 'More details (optional)',
      text: "Got a return trip? Tap here to add it in. It's never required, but it sharpens the math."
    },
    {
      target: '#calculateBtn',
      // His belly needs to rest ON the button, not hang below it —
      // edge:'bottom' was putting the anchor line at the button's
      // bottom edge, and since nap's belly sits 86% of the way down
      // his own image, that meant 86% of him rendered ABOVE that
      // line, straight into the button. edge:'top' puts the anchor at
      // the button's top edge instead, so the same 86%-above split now
      // lands him lying on top of the button with just his belly
      // grazing the surface — the button's own label stays clear.
      rocco: { pose: 'nap', ref: 'target', edge: 'top', along: 0.5 },
      title: 'Calculate',
      text: "I calculate automatically the moment your required fields are filled — by typing, by voice, or a mix of both across a few mic taps. Tap CALCULATE if you just want to jump straight to the verdict."
    },
    {
      target: '#clearFieldsBtn',
      rocco: { pose: 'peekTop', edge: 'top', along: 0.75 },
      title: 'Clear fields',
      text: "Done with this offer? Tap here to wipe the current tab's fields for the next one."
    },
    {
      target: '#verdictCard',
      onEnter: showDemoResult,
      onExit: hideDemoResult,
      // Seat stays exactly on the card's top edge (that part was
      // finally right) — but at full size his head reached all the
      // way up past the empty-state placeholder above the card,
      // covering its text. Sized down and nudged a few px further
      // into the card so his head clears that placeholder instead of
      // overlapping it.
      rocco: { pose: 'dangle', ref: 'target', edge: 'top', along: 0.5, w: 125, dy: 7 },
      title: 'CASH or TRASH',
      text: "This is the verdict. CASH means the offer meets or beats your target pay per hour after gas — TRASH means it falls short. The stats below break down net pay, gross pay, fuel cost, and time."
    },
    {
      target: '#watchBadge',
      onEnter: showDemoWatch,
      onExit: hideDemoWatch,
      // Hands were gripping the top edge correctly, but at full size
      // his whole body hung straight down over both lines of the
      // badge's own text. Shrunk and shifted over to hang above the
      // radar icon on the right side of the badge instead of the
      // words on the left.
      rocco: { pose: 'hang', ref: 'target', edge: 'top', along: 0.85, w: 140 },
      title: "Keep this on your radar",
      text: "When an offer is TRASH but within $3 of your target, I'll flag it like this. Handy on Spark, where offers often bump up a bit at a time — watch for the number I'm pointing at, and grab it the moment it lands."
    },
    {
      target: '#settingsBtn',
      // Anchoring to the gear button itself was the bug: the button is
      // much smaller than Rocco, so gripping its edge planted most of
      // his body directly on top of it, hiding the very icon this step
      // is pointing at. He should be peeking around the CARD (per your
      // rule — peeking poses use the text box as the thing they peek
      // around, not the target), sized down so a whole extra character
      // fits in the gap between the card and the screen edge, and
      // anchored low enough on the card's right edge to clear the gear
      // button above entirely.
      rocco: { pose: 'peekSide', ref: 'card', edge: 'right', flip: true, along: 0.3, w: 120 },
      title: 'Your numbers',
      text: "Tap the gear to set your target $/hr, your vehicle's MPG, and gas price. I'll remember them for every calculation, and you can always come back here to change them anytime."
    },
    {
      target: '#themeBtn',
      // The hand-grab override was fighting the screen-edge clamp: at
      // full size, reaching up to the button from below pushed him
      // wide enough that the phone-width clamp shoved him back to the
      // left, off the button entirely and straight over the card's own
      // text instead. Switched to his default standing (feet) grip,
      // sized down, and anchored to the CARD's top edge near its right
      // side — he now stands mostly in the open header space next to
      // the button (his raised waving paw lands right against it)
      // instead of draping down over the card.
      rocco: { pose: 'pawup', ref: 'card', edge: 'top', along: 0.78, w: 90 },
      title: 'Light or dark',
      text: 'Tap this anytime to switch between light and dark mode.'
    },
    {
      target: null,
      rocco: { pose: 'nap', edge: 'top', along: 0.75 },
      title: "That's the tour!",
      text: "Find me again anytime under Settings — TUTORIAL for the full walkthrough, or HELP & FAQ for quick answers. Let's get your numbers set up."
    }
  ];

  let stepIndex = 0;              // which STEPS entry is currently showing
  let active = false;             // whether the tutorial overlay is currently running
  let resizeHandlerBound = false; // guards against binding the resize/scroll handlers more than once across replays

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
    return Math.min(300, window.innerWidth * 0.88);
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
  function positionForStep(){
    const step = STEPS[stepIndex];
    const targetEl = step.target ? document.querySelector(step.target) : null;
    const pad = 8;

    if(targetEl){
      const rect = targetEl.getBoundingClientRect();
      spotlight.classList.add('tut-show');
      spotlight.style.top = (rect.top - pad) + 'px';
      spotlight.style.left = (rect.left - pad) + 'px';
      spotlight.style.width = (rect.width + pad*2) + 'px';
      spotlight.style.height = (rect.height + pad*2) + 'px';

      const cardWidth = clampCardWidth();
      card.style.width = cardWidth + 'px';
      const cardHeight = card.offsetHeight || 200;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const placeBelow = spaceBelow >= (cardHeight + 26) || spaceBelow >= spaceAbove;

      let top;
      if(placeBelow){
        top = rect.bottom + pad + 16;
      } else {
        top = rect.top - pad - 16 - cardHeight;
      }
      top = Math.max(10, Math.min(top, window.innerHeight - cardHeight - 10));

      let left = rect.left + rect.width/2 - cardWidth/2;
      left = Math.max(10, Math.min(left, window.innerWidth - cardWidth - 10));

      left += (step.cardDx || 0);
      left = Math.max(10, Math.min(left, window.innerWidth - cardWidth - 10));
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      // Grip the target element's own real edge — not the spotlight's
      // glowing outline (which sits `pad`px further out). The outline is
      // decorative; the element's actual edge is the only line that's
      // still there regardless of the spotlight, so that's what he needs
      // to actually be touching.
      positionRocco(step, card.getBoundingClientRect(), rect);
    } else {
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
      card.style.left = ((window.innerWidth - cardWidth) / 2) + 'px';
      card.style.top = Math.max(10, (window.innerHeight - cardHeight) / 2) + 'px';
      positionRocco(step, card.getBoundingClientRect());
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
    const step = STEPS[stepIndex];
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    progressEl.textContent = 'STEP ' + (stepIndex+1) + ' OF ' + STEPS.length;
    backBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === STEPS.length - 1 ? "LET'S GO!" : 'NEXT';
    buildDots();

    const targetEl = step.target ? document.querySelector(step.target) : null;
    if(targetEl){
      targetEl.scrollIntoView({behavior:'auto', block:'center'});
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
