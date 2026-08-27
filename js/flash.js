// ---------- Cold-launch flash screen ----------
// Runs first, before the main app script (below) does anything, so the
// full-screen splash image can paint immediately with no flash of bare
// page behind it. Holds for HOLD_MS, then fades out over FADE_MS. Tapping
// the screen skips straight to the fade-out early. window.__tocFlashDone /
// window.__tocAfterFlash are the handoff to the tutorial-engine script
// (loaded later): if that script's init runs before the flash finishes,
// it registers itself as __tocAfterFlash and waits; if the flash has
// already finished by the time that script runs, __tocFlashDone lets it
// proceed immediately. This ordering guarantees flash -> (first-run
// tutorial) never overlaps or races, regardless of how fast each script
// happens to execute.
//
// Only plays on a true cold launch, not on every resume from background.
// sessionStorage is what makes that distinction: it survives the app
// being backgrounded/suspended (and, on iOS, even a background reload of
// the page while the app is still open in the app switcher), but gets
// cleared the moment the app is actually closed (swiped away) and
// reopened fresh. So "flag already set" == "we've already shown the
// splash this real session" == skip it; a genuinely new session starts
// with no flag, so the splash plays exactly once per true open.
(function(){
  var flash = document.getElementById('flashScreen');
  var HOLD_MS = 2500;   // how long the splash stays fully visible
  var FADE_MS = 400;    // fade-out duration once finish() is triggered
  var done = false;

  var alreadyPlayed = false;
  try { alreadyPlayed = sessionStorage.getItem('tocFlashPlayed') === '1'; } catch(e){}

  if(alreadyPlayed){
    // Skip straight to the "finished" state with no visible splash at
    // all — hide it before it can ever paint, and set the done flag
    // synchronously so the tutorial-engine script (whenever it loads)
    // sees flash-already-done immediately instead of waiting on a timer
    // that's never going to fire.
    flash.style.display = 'none';
    window.__tocFlashDone = true;
    return;
  }

  function finish(){
    if(done) return; // guards against the timer and a tap both firing finish()
    done = true;
    try { sessionStorage.setItem('tocFlashPlayed', '1'); } catch(e){}
    flash.style.opacity = '0';
    setTimeout(function(){
      flash.style.display = 'none';
      window.__tocFlashDone = true;
      if(typeof window.__tocAfterFlash === 'function') window.__tocAfterFlash();
    }, FADE_MS);
  }
  flash.addEventListener('click', finish, {once:true}); // tap-to-skip
  setTimeout(finish, HOLD_MS);
})();
