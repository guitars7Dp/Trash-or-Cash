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
(function(){
  var flash = document.getElementById('flashScreen');
  var HOLD_MS = 2500;   // how long the splash stays fully visible
  var FADE_MS = 400;    // fade-out duration once finish() is triggered
  var done = false;
  function finish(){
    if(done) return; // guards against the timer and a tap both firing finish()
    done = true;
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
