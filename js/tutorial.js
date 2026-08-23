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
  let demoResultForced = false;
  function showDemoResult(){
    const resultEl = document.getElementById('result');
    if(!resultEl.classList.contains('show')){
      demoResultForced = true;
      resultEl.classList.add('show');
      document.getElementById('verdictCard').classList.add('cash');
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
      resultEl.classList.add('show');
    }
    if(!badge.classList.contains('show')){
      demoWatchForced = true;
      badge.classList.add('show');
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
  // Six poses in images/, each anchoring to a different edge of the
  // free-floating text. `w` is the pose's display width in px — heights
  // follow automatically from each image's own aspect ratio.
  const ROCCO_POSES = {
    nap:      { src: 'images/rocco-nap.png',       w: 130, alt: 'Rocco napping' },
    peekTop:  { src: 'images/rocco-peek-top.png',  w: 100, alt: 'Rocco peeking over the top' },
    dangle:   { src: 'images/rocco-dangle.png',    w: 95,  alt: 'Rocco sitting with a coin' },
    peekSide: { src: 'images/rocco-peek-side.png', w: 90,  alt: 'Rocco peeking around the side' },
    hang:     { src: 'images/rocco-hang.png',      w: 85,  alt: 'Rocco hanging' },
    pawup:    { src: 'images/rocco-pawup.png',     w: 105, alt: 'Rocco waving' },
  };

  // Positions #tutRocco against the just-placed #tutCard. `anchor` picks
  // which corner/edge of the card the image locks to before dx/dy nudge
  // it — those two numbers are the actual tuning knobs; move Rocco
  // around per step by editing dx/dy in STEPS below until it looks right,
  // nothing else needs to change.
  //   'top-right' → above the card, right-aligned to its top edge
  //   'top-left'  → above the card, left-aligned to its top edge
  //   'left'      → beside the card's left edge, vertically centered
  //   'right'     → beside the card's right edge, vertically centered
  function positionRocco(step, cardRect){
    const cfg = step.rocco;
    if(!cfg){ roccoEl.classList.remove('tut-show'); return; }
    const pose = ROCCO_POSES[cfg.pose];
    if(roccoEl.getAttribute('data-pose') !== cfg.pose){
      roccoEl.src = pose.src;
      roccoEl.alt = pose.alt;
      roccoEl.setAttribute('data-pose', cfg.pose);
    }
    roccoEl.style.width = pose.w + 'px';
    roccoEl.style.height = 'auto';
    const rh = roccoEl.offsetHeight || pose.w;

    let top, left;
    switch(cfg.anchor){
      case 'top-left':
        top = cardRect.top - rh; left = cardRect.left; break;
      case 'left':
        top = cardRect.top + cardRect.height/2 - rh/2; left = cardRect.left - pose.w; break;
      case 'right':
        top = cardRect.top + cardRect.height/2 - rh/2; left = cardRect.right; break;
      case 'top-right':
      default:
        top = cardRect.top - rh; left = cardRect.right - pose.w; break;
    }
    top += (cfg.dy || 0);
    left += (cfg.dx || 0);
    // Keep Rocco fully on-screen on narrow viewports — the anchor math
    // above assumes there's room beside/above the card, which isn't
    // always true on a phone, so clamp back inside the visible area
    // with a small margin.
    const margin = 6;
    left = Math.max(margin, Math.min(left, window.innerWidth - pose.w - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - rh - margin));
    roccoEl.style.top = top + 'px';
    roccoEl.style.left = left + 'px';
    roccoEl.classList.add('tut-show');
  }

  const STEPS = [
    {
      target: null,
      rocco: { pose: 'pawup', anchor: 'right', dx: 6, dy: 40 },
      title: "Hey, I'm Rocco!",
      text: "I dig into a gig offer and tell you if it's actually worth taking. Feed me the details and I'll instantly compare it against the $/hr you want to make — after gas — so you know right away if it's CASH or TRASH. Let me show you around in a few quick steps."
    },
    {
      target: '#tabs',
      rocco: { pose: 'peekTop', anchor: 'top-right', dx: 4, dy: 6 },
      title: 'Pick your platform',
      text: "Start here. Choose which app you're driving for — Spark, Instacart, Shipt, or Food Delivery (DoorDash, Uber Eats, Grubhub, etc.) — the fields below change to match."
    },
    {
      target: '#panel-spark .required-block',
      rocco: { pose: 'peekSide', anchor: 'left', dx: -6, dy: 0 },
      title: 'The must-haves',
      text: "These are the only fields you really need — how long the offer says it'll take, how many miles, and what it pays."
    },
    {
      target: '#micBtn',
      rocco: { pose: 'hang', anchor: 'top-right', dx: 4, dy: 4 },
      title: 'Tap to speak',
      text: "In a hurry? Check the offer in your gig app, then come back here and tap this to read it out loud. Switch back and forth as needed — I'll hold onto what you've already told me."
    },
    {
      target: '.more-toggle[data-more="spark"]',
      onEnter: openMorePanel,
      onExit: closeMorePanel,
      rocco: { pose: 'peekSide', anchor: 'right', dx: 6, dy: 0 },
      title: 'More details (optional)',
      text: "Got a return trip? Tap here to add it in. It's never required, but it sharpens the math."
    },
    {
      target: '#calculateBtn',
      rocco: { pose: 'nap', anchor: 'top-right', dx: 8, dy: 6 },
      title: 'Calculate',
      text: "I calculate automatically the moment your required fields are filled — by typing, by voice, or a mix of both across a few mic taps. Tap CALCULATE if you just want to jump straight to the verdict."
    },
    {
      target: '#clearFieldsBtn',
      rocco: { pose: 'peekTop', anchor: 'top-right', dx: 4, dy: 6 },
      title: 'Clear fields',
      text: "Done with this offer? Tap here to wipe the current tab's fields for the next one."
    },
    {
      target: '#verdictCard',
      onEnter: showDemoResult,
      onExit: hideDemoResult,
      rocco: { pose: 'dangle', anchor: 'top-right', dx: 6, dy: 4 },
      title: 'CASH or TRASH',
      text: "This is the verdict. CASH means the offer meets or beats your target pay per hour after gas — TRASH means it falls short. The stats below break down net pay, gross pay, fuel cost, and time."
    },
    {
      target: '#watchBadge',
      onEnter: showDemoWatch,
      onExit: hideDemoWatch,
      rocco: { pose: 'hang', anchor: 'top-right', dx: 4, dy: 4 },
      title: "Keep this on your radar",
      text: "When an offer is TRASH but within $3 of your target, I'll flag it like this. Handy on Spark, where offers often bump up a bit at a time — watch for the number I'm pointing at, and grab it the moment it lands."
    },
    {
      target: '#settingsBtn',
      rocco: { pose: 'peekSide', anchor: 'right', dx: 6, dy: 0 },
      title: 'Your numbers',
      text: "Tap the gear to set your target $/hr, your vehicle's MPG, and gas price. I'll remember them for every calculation, and you can always come back here to change them anytime."
    },
    {
      target: '#themeBtn',
      rocco: { pose: 'pawup', anchor: 'left', dx: -6, dy: 0 },
      title: 'Light or dark',
      text: 'Tap this anytime to switch between light and dark mode.'
    },
    {
      target: null,
      rocco: { pose: 'nap', anchor: 'top-right', dx: 8, dy: 6 },
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

      card.style.top = top + 'px';
      card.style.left = left + 'px';
      positionRocco(step, card.getBoundingClientRect());
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

  // Updates the card's text/progress/buttons for the current step, then
  // animates into position — closing the spotlight down to a pinpoint,
  // jumping to the new target while the screen is fully covered, and
  // reopening there (see the inline notes below for why it's done this
  // way instead of visibly scrolling).
  function renderStep(){
    const step = STEPS[stepIndex];
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    progressEl.textContent = 'STEP ' + (stepIndex+1) + ' OF ' + STEPS.length;
    backBtn.disabled = stepIndex === 0;
    nextBtn.textContent = stepIndex === STEPS.length - 1 ? "LET'S GO!" : 'NEXT';
    buildDots();

    card.classList.remove('tut-show');
    const targetEl = step.target ? document.querySelector(step.target) : null;

    if(targetEl){
      // The spotlight's dark backdrop spreads out 9999px in every
      // direction, so collapsing it to zero size still fully covers the
      // screen — it reads as the "hole" smoothly pinching shut into a
      // total blackout. Only once it's fully closed do we jump the page
      // to the new target (invisibly, since the screen is covered) and
      // let the hole reopen there. This replaces literally scrolling the
      // visible page underneath, which looked busy and back-and-forth
      // whenever consecutive steps weren't in strict top-to-bottom order
      // on the page.
      spotlight.classList.add('tut-show');
      spotlight.style.width = '0px';
      spotlight.style.height = '0px';
      setTimeout(()=>{
        targetEl.scrollIntoView({behavior:'auto', block:'center'});
        positionForStep();
        card.classList.add('tut-show');
      }, 280);
    } else {
      // No-target steps (intro/outro) now dim the same as every other
      // step — see the note in positionForStep() — so this just centers
      // the card instead of also killing the scrim.
      setTimeout(()=>{
        positionForStep();
        card.classList.add('tut-show');
      }, 200);
    }
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
    renderStep();

    if(!resizeHandlerBound){
      resizeHandlerBound = true;
      window.addEventListener('resize', ()=>{ if(active) positionForStep(); });
      window.addEventListener('scroll', ()=>{ if(active) positionForStep(); }, {passive:true});
    }
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
