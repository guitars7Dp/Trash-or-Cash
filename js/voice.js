// ---------- Voice entry ----------
  // Word-to-number lookup tables for wordsToDigits() below.
  const ONES_WORDS = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
  const TENS_WORDS = { twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };

  // Converts a raw speech transcript into a version with number words
  // turned into digits, so the field-matching regexes further down (which
  // all look for digits) can find them. Handles compounds ("twenty-five"),
  // "X hundred", "$12" -> "12 dollars", spoken decimals ("twelve point
  // five"), and "N dollars and M cents" -> "N.MM dollars".
  function wordsToDigits(text){
    let t = ' ' + text.toLowerCase() + ' ';
    t = t.replace(/\$\s*(\d+(?:\.\d+)?)/g, (m, amt) => amt + ' dollars');
    t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/g,
      (m, tens, ones) => String(TENS_WORDS[tens] + ONES_WORDS[ones]));
    t = t.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\b/g,
      (m, w) => String(ONES_WORDS[w] * 100));
    t = t.replace(/\b[a-z]+\b/g, (w) => {
      if(ONES_WORDS.hasOwnProperty(w)) return String(ONES_WORDS[w]);
      if(TENS_WORDS.hasOwnProperty(w)) return String(TENS_WORDS[w]);
      return w;
    });
    t = t.replace(/(\d+)\s*point\s*(\d+(?:\s+\d+)*)/g, (m, whole, frac) => whole + '.' + frac.replace(/\s+/g, ''));
    t = t.replace(/(\d+)\s*dollars?\s*(?:and\s*)?(\d+)\s*cents?/g, (m, dollars, cents) => dollars + '.' + cents.padStart(2, '0') + ' dollars');
    return t;
  }

  // Sets one field's value, skipping undefined/null so a field a voice
  // parse didn't recognize is simply left as-is rather than cleared.
  function setVal(id, value){
    const el = document.getElementById(id);
    if(el && value !== undefined && value !== null) el.value = value;
  }

  // No real gig payout — base pay, tip, or a single-field offer amount —
  // ever runs into four figures. If voice parsing hands back a number that
  // high, it's almost certainly two spoken amounts misread as one (e.g.
  // an unmarked "twenty five forty four" landing as a bare 2544), not a
  // real order — so it's discarded rather than silently filled in.
  const MAX_PLAUSIBLE_PAY = 999;
  function plausiblePay(val){
    if(val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    if(isNaN(n) || n >= MAX_PLAUSIBLE_PAY) return null;
    return val;
  }

  // iOS Safari's own speech-to-text sometimes auto-formats a spoken dollar
  // amount followed shortly by ANY other number as a single currency value
  // with cents (e.g. "forty five dollars, thirteen miles" arrives as
  // "$45.13 miles" before this code ever sees it) — regardless of which
  // field that trailing number was actually meant for. recoverFoldedOffer()
  // below detects that fingerprint (a decimal dollar amount with a field
  // keyword sitting directly against it, no gap) and splits it back into
  // the real offer amount plus the trailing field's value. This table
  // lists, per tab and in order from most to least specific, every
  // keyword that could plausibly follow the offer on that tab.
  const TAB_TAIL_PATTERNS = {
    spark: [
      { re:/^\s*,?\s*(?:return(?:ed)?\s*(?:trip\s*)?miles?|miles?\s*return(?:ed)?)\b/, kind:'return' },
      { re:/^\s*,?\s*miles?\b/, kind:'miles' },
      { re:/^\s*,?\s*(?:minutes|minute|mins|min)\b/, kind:'time' },
    ],
    instacart: [
      { re:/^\s*,?\s*(?:miles per hour|mph)\b/, kind:'mph' },
      { re:/^\s*,?\s*(?:seconds per item|speed)\b/, kind:'speed' },
      { re:/^\s*,?\s*miles?\b/, kind:'miles' },
      { re:/^\s*,?\s*items?\b/, kind:'items' },
    ],
    food: [
      { re:/^\s*,?\s*miles?\b/, kind:'miles' },
      { re:/^\s*,?\s*(?:minutes|minute|mins|min)\b/, kind:'time' },
    ],
    shipt: [
      { re:/^\s*,?\s*(?:return(?:ed)?\s*(?:trip\s*)?miles?|miles?\s*return(?:ed)?)\b/, kind:'return' },
      { re:/^\s*,?\s*miles?\b/, kind:'miles' },
      { re:/^\s*,?\s*(?:minutes|minute|mins|min)\b/, kind:'time' },
      { re:/^\s*,?\s*(?:dollars?\s*)?tip\b/, kind:'tip' },
    ],
  };
  // See the TAB_TAIL_PATTERNS comment above for the iOS bug this recovers from.
  function recoverFoldedOffer(text, offerMatch, tab){
    if(!offerMatch) return null;
    const decMatch = offerMatch[1].match(/^(\d+)\.(\d+)$/);
    if(!decMatch) return null;
    const afterIdx = text.indexOf(offerMatch[0]) + offerMatch[0].length;
    const tail = text.slice(afterIdx);
    const value = decMatch[2].replace(/^0+(?=\d)/, '');
    const patterns = TAB_TAIL_PATTERNS[tab] || [];
    for(const p of patterns){
      if(p.re.test(tail)) return { offer:decMatch[1], value, kind:p.kind };
    }
    return null;
  }

  // Shared by every tab that has an hours+minutes time field: pulls both
  // out of the text (removing the hours match as it goes) so whatever's
  // left over can be searched for miles/offer/etc. without re-matching it.
  function extractHourAndTime(text){
    const hourM = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr)\b/);
    const remaining = hourM ? text.replace(hourM[0], ' ') : text;
    const timeM = remaining.match(/(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min)\b/);
    return { hourM, timeM, remaining };
  }

  // Shared by Spark and Shipt, the two tabs with a return-miles field.
  // Same remove-as-you-go pattern as extractHourAndTime above, so the
  // plain "miles" search that follows doesn't double-count the return trip.
  function extractReturnMiles(text){
    const returnM = text.match(/(\d+(?:\.\d+)?)\s*(?:return(?:ed)?\s*(?:trip\s*)?miles?|miles?\s*return(?:ed)?)\b/);
    const remaining = returnM ? text.replace(returnM[0], ' ') : text;
    return { returnM, remaining };
  }

  // Shared by every tab with an hours+minutes field: only touches those
  // two fields at all if some piece of time was actually heard this
  // utterance. When it was, fills whichever part was recognized and
  // clears the other, rather than leaving a stale value from a previous
  // order sitting next to a freshly-spoken one.
  function applyTimeFields(hrId, minId, timeVal, hourVal){
    if(timeVal !== null || hourVal !== null){
      setVal(minId, timeVal !== null ? timeVal : '');
      setVal(hrId, hourVal !== null ? hourVal : '');
    }
  }

  // Takes one finished speech transcript and fills in whatever fields it
  // can recognize for the currently active tab, then saves and
  // recalculates. Each of the four tabs below has its own parsing branch
  // since the fields and voice-command vocabulary differ per platform;
  // the general shape in each branch is: extract every recognizable piece
  // (time, miles, return miles, items, offer/base/tip, speed/mph), check
  // for the folded-offer bug (see recoverFoldedOffer above), then write
  // whatever was found into the matching field.
  function applyVoiceEntry(rawText){
    const t = wordsToDigits(rawText);
    const active = document.querySelector('.tab.active').dataset.tab;
    let remaining = t;

    if(active === 'spark'){
      const { hourM, timeM, remaining: afterHour } = extractHourAndTime(remaining);
      const { returnM, remaining: afterReturn } = extractReturnMiles(afterHour);
      const milesM = afterReturn.match(/(\d+(?:\.\d+)?)\s*miles?\b/);
      const offerM = t.match(/(\d+(?:\.\d+)?)\s*dollars?\b/);
      const recovered = recoverFoldedOffer(t, offerM, 'spark');

      let timeVal = timeM ? timeM[1] : null;
      let hourVal = hourM ? hourM[1] : null;
      let returnVal = returnM ? returnM[1] : null;
      let milesVal = milesM ? milesM[1] : null;
      let offerVal = offerM ? offerM[1] : null;
      if(recovered){
        offerVal = recovered.offer;
        if(recovered.kind === 'return' && !returnM) returnVal = recovered.value;
        else if(recovered.kind === 'miles' && !milesM) milesVal = recovered.value;
        else if(recovered.kind === 'time' && !timeM) timeVal = recovered.value;
      }
      applyTimeFields('spark-time-hr', 'spark-time-min', timeVal, hourVal);
      setVal('spark-return', returnVal);
      setVal('spark-miles', milesVal);
      setVal('spark-offer', plausiblePay(offerVal));
    } else if(active === 'instacart'){
      const itemsM = remaining.match(/(\d+)\s*items?\b/);
      const mphM = remaining.match(/(\d+(?:\.\d+)?)\s*(?:miles per hour|mph)\b/);
      if(mphM) remaining = remaining.replace(mphM[0], ' ');
      const speedM = remaining.match(/(\d+(?:\.\d+)?)\s*(?:seconds per item|speed)\b/);
      const milesM = remaining.match(/(\d+(?:\.\d+)?)\s*miles?\b/);
      const offerM = t.match(/(\d+(?:\.\d+)?)\s*dollars?\b/);
      const recovered = recoverFoldedOffer(t, offerM, 'instacart');

      let itemsVal = itemsM ? itemsM[1] : null;
      let mphVal = mphM ? mphM[1] : null;
      let speedVal = speedM ? speedM[1] : null;
      let milesVal = milesM ? milesM[1] : null;
      let offerVal = offerM ? offerM[1] : null;
      if(recovered){
        offerVal = recovered.offer;
        if(recovered.kind === 'mph' && !mphM) mphVal = recovered.value;
        else if(recovered.kind === 'speed' && !speedM) speedVal = recovered.value;
        else if(recovered.kind === 'miles' && !milesM) milesVal = recovered.value;
        else if(recovered.kind === 'items' && !itemsM) itemsVal = recovered.value;
      }
      setVal('ic-items', itemsVal);
      setVal('ic-mph', mphVal);
      setVal('ic-speed', speedVal);
      setVal('ic-miles', milesVal);
      setVal('ic-offer', plausiblePay(offerVal));
    } else if(active === 'food'){
      const { hourM, timeM, remaining: afterHour } = extractHourAndTime(remaining);
      const milesM = afterHour.match(/(\d+(?:\.\d+)?)\s*miles?\b/);
      const offerM = t.match(/(\d+(?:\.\d+)?)\s*dollars?\b/);
      const recovered = recoverFoldedOffer(t, offerM, 'food');

      let timeVal = timeM ? timeM[1] : null;
      let hourVal = hourM ? hourM[1] : null;
      let milesVal = milesM ? milesM[1] : null;
      let offerVal = offerM ? offerM[1] : null;
      if(recovered){
        offerVal = recovered.offer;
        if(recovered.kind === 'miles' && !milesM) milesVal = recovered.value;
        else if(recovered.kind === 'time' && !timeM) timeVal = recovered.value;
      }
      applyTimeFields('fd-time-hr', 'fd-time-min', timeVal, hourVal);
      setVal('fd-miles', milesVal);
      setVal('fd-offer', plausiblePay(offerVal));
    } else {
      const { hourM, timeM, remaining: afterHour } = extractHourAndTime(remaining);
      const { returnM, remaining: afterReturn } = extractReturnMiles(afterHour);
      const milesM = afterReturn.match(/(\d+(?:\.\d+)?)\s*miles?\b/);
      const baseM = t.match(/(\d+(?:\.\d+)?)\s*dollars?\b/);
      const recovered = recoverFoldedOffer(t, baseM, 'shipt');

      let timeVal = timeM ? timeM[1] : null;
      let hourVal = hourM ? hourM[1] : null;
      let returnVal = returnM ? returnM[1] : null;
      let milesVal = milesM ? milesM[1] : null;
      let baseVal = null;
      let tipVal = null;
      let baseFromFold = false;

      if(recovered){
        baseVal = recovered.offer;
        baseFromFold = true;
        if(recovered.kind === 'return' && !returnM) returnVal = recovered.value;
        else if(recovered.kind === 'miles' && !milesM) milesVal = recovered.value;
        else if(recovered.kind === 'time' && !timeM) timeVal = recovered.value;
        else if(recovered.kind === 'tip') tipVal = recovered.value;
      }

      if(tipVal === null){
        const tipM = t.match(/(\d+(?:\.\d+)?)\s*(?:dollars?\s*)?tip\b/);
        if(tipM) tipVal = tipM[1];

        if(!baseFromFold){
          const searchText = tipM ? t.replace(tipM[0], ' ') : t;
          const taggedBaseM = searchText.match(/(\d+(?:\.\d+)?)\s*dollars?\b/);
          baseVal = taggedBaseM ? taggedBaseM[1] : null;
          if(baseVal === null){
            let cleaned = searchText;
            if(hourM) cleaned = cleaned.replace(hourM[0], ' ');
            if(timeM) cleaned = cleaned.replace(timeM[0], ' ');
            if(returnM) cleaned = cleaned.replace(returnM[0], ' ');
            if(milesM) cleaned = cleaned.replace(milesM[0], ' ');
            const bareM = cleaned.match(/(\d+(?:\.\d+)?)/);
            if(bareM) baseVal = bareM[1];
          }
        }
      }
      applyTimeFields('shipt-time-hr', 'shipt-time-min', timeVal, hourVal);
      setVal('shipt-return', returnVal);
      setVal('shipt-miles', milesVal);
      setVal('shipt-base', plausiblePay(baseVal));
      setVal('shipt-tip', plausiblePay(tipVal));
    }

    saveFields();
    calculateNow();
  }

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('micBtn');
  if(!SpeechRec){
    micBtn.style.display = 'none';
  } else {
    let listening = false;
    let activeRecognition = null;

    function resetMicButtonState(){
      listening = false;
      activeRecognition = null;
      micBtn.classList.remove('listening');
    }
    function resetMicButton(){
      resetMicButtonState();
      micBtn.querySelector('.mic-label').textContent = 'TAP TO SPEAK';
    }
    let audioCtx = null;
    // Forces an active CarPlay audio route before starting speech
    // recognition. CarPlay's audio session isn't "live" until some app is
    // actively playing sound through it — if nothing is playing, Safari's
    // mic session can come up completely silent with no error at all. This
    // plays an ~80ms near-silent tone (not literally 0 volume, since iOS
    // can optimize a fully-silent buffer away and skip opening the route)
    // to force the same live-route behavior music playback already
    // triggers, before the real recognition session is created.
    async function primeAudioRoute(){
      try{
        if(!audioCtx){
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if(audioCtx.state === 'suspended'){
          await audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
        await new Promise(resolve => setTimeout(resolve, 100));
        // Fully release the audio route again right after waking it up,
        // rather than just pausing it. A suspended (but still-open)
        // AudioContext may still register to iOS as "this page has a
        // claim on the audio session," which could be why another app's
        // music was stopping instead of just briefly ducking, and not
        // resuming on its own once the mic session ended -- resuming
        // paused audio is the OS's call, not something this page can
        // force directly, but closing our own session as completely as
        // possible gives it the best chance to hand control back cleanly.
        // close() can't be undone, so the reference is dropped too --
        // the `if(!audioCtx)` check above builds a fresh one next tap.
        try{ await audioCtx.close(); }catch(e){}
        audioCtx = null;
        // close() resolving only means the JS-level teardown finished --
        // not that iOS has actually finished releasing the underlying
        // hardware audio session yet. That gap (JS promise settled vs.
        // real hardware ready) is exactly the same category of stale-route
        // problem this whole function exists to work around in the first
        // place (see the file-level notes on onaudiostart vs onstart).
        // Every mic tap now runs a real create-use-close AudioContext
        // cycle right here, not just the first one per page load, so every
        // tap needs a beat for that release to actually finish before
        // SpeechRecognition is allowed to claim a brand new session --
        // skipping this was the likely cause of the mic silently failing
        // to hear anything past the very first tap of a session.
        await new Promise(resolve => setTimeout(resolve, 150));
      }catch(e){
        // If this fails, proceed anyway — no worse off than before this existed.
      }
    }

    micBtn.addEventListener('click', async ()=>{
      // A second tap while a session is active (or still spinning up) is
      // ignored rather than treated as "stop". This used to support
      // tap-to-stop instead, but that version left the mic unable to hear
      // anything on the first tap after the app returned from being
      // backgrounded -- see claude/mic-tap-to-stop-removed.md for the
      // reasoning. Reverted back to this simpler, longer-tested behavior
      // since reliably hearing you across multiple backgroundings matters
      // more than tap-to-stop.
      if(listening) return;
      listening = true;
      micBtn.classList.add('listening');
      micBtn.querySelector('.mic-label').textContent = 'STARTING…';

      // iOS can leave the underlying audio route to the mic stale after the
      // app is backgrounded — SpeechRecognition's own onaudiostart/onstart
      // can fire normally (the JS-level session believes it's running) while
      // no real audio ever reaches it, until our own hard-stop timer cuts it
      // off with no result and no real error. primeAudioRoute() above forces
      // iOS to re-establish that route by briefly waking an AudioContext
      // (see that function for why a tone, not a getUserMedia grab, is what
      // it actually does) right here at tap-time, before a SpeechRecognition
      // instance is ever created, fully released again before start()
      // below, so there's nothing for it to compete with.
      //
      // NOTE (found while fixing the "cuts off my music" issue this round):
      // the two lines below this comment used to describe a CarPlay-specific
      // skip for this priming step that isn't actually implemented anywhere
      // in this file -- no such check exists. Left as an honest heads-up in
      // case CarPlay behavior comes up again later, rather than silently
      // deleting the note or inventing detection logic that's never been
      // tested on a real device.
      await primeAudioRoute();
      if(!listening) return; // user backed out (re-tapped) while awaiting above




      const recognition = new SpeechRec(); // fresh instance every tap, on purpose
      recognition.lang = 'en-US';
      // interimResults is permanently on — not diagnostic scaffolding.
      // Every partial "still speaking" result, not just the final one,
      // feeds armSilenceTimer() below, which is how the app knows you're
      // still mid-sentence across natural pauses between fields ("45
      // minutes... 12 miles... 25 dollars"). Turning this off would break
      // that listen-through-pauses behavior.
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      // Rattling off several fields in one go naturally has small pauses
      // between numbers ("45 minutes... 12 miles... 25 dollars"). Without
      // this, the engine can treat the first pause as "done" and stop
      // listening before the rest is spoken. With it on, it keeps
      // listening through those pauses; our own silence timer below (not
      // the browser's) decides when the user is actually finished.
      recognition.continuous = true;
      activeRecognition = recognition;
      let heardAnything = false;
      // On iOS — especially a home-screen standalone web app, which spins up
      // its audio engine slower than a normal Safari tab — there's a real
      // gap between calling start() and the mic actually capturing audio.
      // Telling the user to speak immediately risks the first (or only)
      // words being spoken before the engine catches up, with nothing
      // captured and no error to show for it. So the label starts at
      // STARTING… and only flips to LISTENING… once the engine itself
      // confirms it has begun (onaudiostart if available, falling back to
      // onstart), which is the actual cue to start talking.

      // Three timers, each with a distinct job, so timing adapts to
      // however fast or slow someone talks instead of guessing one fixed
      // duration for everyone:
      //
      // 1) deadMicTimer — if NOTHING has been heard at all (not even a
      //    partial word) within 8s of starting, that's the dead/stale mic
      //    connection scenario from before backgrounding fixes — abort
      //    with an error, since something is genuinely wrong.
      // 2) silenceTimer — reset every time any speech comes in (interim
      //    or final). Only fires after a real pause with no new speech,
      //    meaning the person is actually done talking. Ends cleanly
      //    (stop, not abort) — this is the normal, expected end of a
      //    successful entry, not a failure.
      // 3) hardCeiling — an absolute cap that can't be reset by anything,
      //    so a session can never sit open indefinitely and duck
      //    background audio while driving, no matter what else happens.
      let silenceTimer = null;
      const deadMicTimer = setTimeout(()=>{
        if(!heardAnything){
          try{ recognition.abort(); }catch(e){}
        }
      }, 8000);
      const hardCeiling = setTimeout(()=>{
        try{ recognition.stop(); }catch(e){}
      }, 20000);
      function armSilenceTimer(){
        clearTimeout(silenceTimer);
        // 1.8s of quiet after the last bit of speech means "done talking."
        // Short enough that it doesn't linger noticeably after you finish,
        // long enough to survive a normal pause between fields ("45
        // minutes... 12 miles..."). Started at 3.5s, shortened after real
        // testing showed that felt like it lingered too long once done.
        silenceTimer = setTimeout(()=>{
          try{ recognition.stop(); }catch(e){}
        }, 1800);
      }

      recognition.onaudiostart = ()=>{
        micBtn.querySelector('.mic-label').textContent = 'LISTENING…';
      };
      // Some iOS versions never fire onaudiostart reliably — onstart is a
      // weaker signal (recognition session started, not necessarily audio
      // flowing yet) but still an improvement over flipping the label
      // instantly at tap-time, so it's used as a fallback only.
      recognition.onstart = ()=>{
        if(micBtn.querySelector('.mic-label').textContent === 'STARTING…'){
          micBtn.querySelector('.mic-label').textContent = 'LISTENING…';
        }
      };
      recognition.onresult = (e)=>{
        heardAnything = true;
        armSilenceTimer();
        const result = e.results[e.results.length - 1];
        if(result.isFinal){
          applyVoiceEntry(result[0].transcript);
        }
      };
      recognition.onerror = (e)=>{
        // Not surfaced to the user (see onend below) — the underlying issue
        // is a known Web Speech API limitation on iOS that can't be fixed
        // short of a native app. Left logging to console only, in case
        // that ever changes and this is worth revisiting.
        console.log('SpeechRecognition error:', e.error);
      };
      recognition.onend = ()=>{
        clearTimeout(deadMicTimer);
        clearTimeout(hardCeiling);
        clearTimeout(silenceTimer);
        // Only reset shared button/state if this recognition is still the
        // current one. Without this guard, a stale session's onend (firing
        // asynchronously after a tap-to-stop .stop() call above) could fire
        // AFTER a fast re-tap has already started a brand-new session, and
        // would wipe out that new session's state out from under it.
        if(activeRecognition === recognition) resetMicButton();
      };
      // Small settle delay after the handshake, before actually starting
      // recognition. On iOS the mic hardware can need a brief beat to
      // catch up even after the handshake resolves, and the "Listening"
      // label can flip on before real audio is actually flowing. This used
      // to be shorter for every tap after the first, on the assumption
      // only the very first tap per page load was a "cold start." That's
      // no longer true: primeAudioRoute() above now does a real
      // create-use-close AudioContext cycle (plus its own settle wait)
      // before every single tap, not just the first, so every tap is
      // effectively a cold start for the audio session and gets the full
      // 300ms here too.
      const settleDelay = 300;
      setTimeout(()=>{
        if(!listening) return; // user backed out during this brief wait
        try{ recognition.start(); }
        catch(e){ resetMicButton(); }
      }, settleDelay);
    });

    // Extra safety net: if the tab/app gets backgrounded (e.g. switching
    // apps, or the OS tearing the page down) while a session is active,
    // kill it immediately rather than leaving it to iOS's own cleanup.
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden && activeRecognition){
        try{ activeRecognition.abort(); }catch(e){}
        resetMicButton();
      }
    });
  }

  // Debounces recalculation while typing: every keystroke restarts a
  // 250ms timer rather than recalculating on every single character, so
  // runCheck() (which touches a lot of DOM) only actually runs once
  // typing pauses.
  let liveCheckTimer = null;
  function scheduleLiveCheck(){
    clearTimeout(liveCheckTimer);
    liveCheckTimer = setTimeout(runCheck, 250);
  }
  // Autosave + live recalculation on every field, on every tab.
  FIELD_IDS.forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', ()=>{ saveFields(); scheduleLiveCheck(); });
  });

  // Instacart-only: since Instacart never gives a time estimate, this
  // shows a live "here's what I'm assuming" preview under its fields,
  // using the exact same shopping-speed/driving-speed model as
  // calcInstacart() above (kept in sync by sharing CONSTANTS/num()).
  function updateIcPreview(){
    const items = num('ic-items');
    const miles = num('ic-miles');
    const speed = num('ic-speed') || CONSTANTS.icSpeed;
    const mph = num('ic-mph') || CONSTANTS.icMph;
    const preview = document.getElementById('ic-time-preview');
    if(items){
      const shopMin = (items*speed)/60;
      const driveMin = miles ? (miles/mph)*60 : 0;
      const totalMin = Math.round(shopMin + driveMin);
      if(miles){
        preview.textContent = 'Estimated time: '+totalMin+' min ('+Math.round(shopMin)+' shopping at '+speed+' sec/item + '+Math.round(driveMin)+' driving at '+mph+' mph — edit in More Details)';
      } else {
        preview.textContent = 'Estimated time: '+totalMin+' min shopping (at '+speed+' sec/item). Add delivery miles above to include drive time.';
      }
    } else {
      preview.textContent = "Instacart doesn't show a time estimate, so time is estimated from item count and delivery miles. Know your shopping speed? Update it under More Details.";
    }
  }
  document.getElementById('ic-items').addEventListener('input', updateIcPreview);
  document.getElementById('ic-speed').addEventListener('input', updateIcPreview);
  document.getElementById('ic-miles').addEventListener('input', updateIcPreview);
  document.getElementById('ic-mph').addEventListener('input', updateIcPreview);

  document.getElementById('clearFieldsBtn').addEventListener('click', clearActiveTabFields);
  document.getElementById('calculateBtn').addEventListener('click', calculateNow);
