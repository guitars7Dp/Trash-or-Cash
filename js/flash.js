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
// Ideally this would only play on a genuine close-and-reopen, never on a
// mere resume from background. There's no reliable way to tell those two
// apart from JS, though: both a true close+relaunch and iOS tearing down
// and reloading a long-backgrounded page look identical to the page when
// it starts back up -- a plain fresh load with nothing in memory. Any
// storage that survives a page reload (which is what "surviving
// backgrounding" requires) survives a real close the exact same way, so
// there's no flag that's true for one and false for the other.
//
// Given that, this plays once per calendar day (local time) instead:
// first launch of the day shows it, everything else that same day
// (backgrounded-and-resumed or genuinely closed-and-reopened) skips it.
// Stores the date it last played, not just a played/not-played flag, in
// localStorage specifically because it needs to survive a background
// reload without resetting -- sessionStorage was tried first and doesn't
// (see the flash-screen-persistence-fix note for that history).
(function(){
  var flash = document.getElementById('flashScreen');
  var HOLD_MS = 2500;   // how long the splash stays fully visible
  var FADE_MS = 400;    // fade-out duration once finish() is triggered
  var done = false;

  function todayKey(){
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  var alreadyPlayedToday = false;
  try { alreadyPlayedToday = localStorage.getItem('tocFlashPlayedDay') === todayKey(); } catch(e){}

  if(alreadyPlayedToday){
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
    try { localStorage.setItem('tocFlashPlayedDay', todayKey()); } catch(e){}
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
