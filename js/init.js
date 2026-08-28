// ---------- Init ----------
  // Order matters: restore saved field values first, then show the
  // last-used tab (so the right panel's fields are the ones visible when
  // restored), then refresh the Instacart time preview, then run the
  // first calculation — by which point everything it might read is
  // already in place.
  loadFields();
  activateTab(lastTab);
  updateIcPreview();

  // ---------- Voice entry via URL parameter (Siri / Shortcuts) ----------
  // Lets an external trigger -- a Siri Shortcut that dictates the offer and
  // opens this page as ?voice=<encoded text> -- fill in and calculate an
  // order the exact same way a mic tap does, without touching the
  // mic/SpeechRecognition machinery in voice.js at all. All the real
  // parsing work is applyVoiceEntry() (defined in voice.js); this block's
  // only job is handing it whatever text arrived in the URL. This runs
  // here, at the very end of the boot sequence, rather than from the
  // bottom of voice.js itself, specifically because it needs every other
  // script already loaded -- recall.js in particular, since runCheck()
  // (called inside applyVoiceEntry) calls its saveLastRecall(), and
  // recall.js loads after voice.js.
  // Same constraint the mic button already has: this fills whichever tab
  // is active once activateTab(lastTab) above has run -- it doesn't infer
  // platform from the words themselves. Speaking about a different
  // platform than whatever tab was last open lands in the wrong tab's
  // fields, same as it would tapping the mic while on the wrong tab today.
  let voiceParamHandled = false;
  try{
    const params = new URLSearchParams(window.location.search);
    const spoken = params.get('voice');
    if(spoken){
      applyVoiceEntry(spoken);
      voiceParamHandled = true;
      // Scrub the param from the visible URL afterward, so reloading or
      // revisiting this same browser tab later doesn't silently re-run
      // the same stale text against whatever's changed since.
      params.delete('voice');
      const qs = params.toString();
      const cleanUrl = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      history.replaceState(null, '', cleanUrl);
    }
  }catch(e){
    // If anything above fails, fall through to the normal boot below --
    // worst case the fields just don't get pre-filled from the URL.
  }
  if(!voiceParamHandled) runCheck();
