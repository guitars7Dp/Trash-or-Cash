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

  // Adaptive silence-timeout check: does it look like everything the
  // active tab actually requires to calculate has been said (this
  // utterance) or already sitting in that field (from before this tap)?
  // Deliberately mirrors the exact required-field checks calcSpark /
  // calcInstacart / calcFood / calcShipt already use in calculations.js
  // (time, miles, offer -- items instead of time for Instacart; tip is
  // optional everywhere, matching the calc functions) rather than
  // inventing a separate notion of "required." This is a lightweight
  // presence check via the same kind of regex the real parser uses below,
  // not a full parse -- it only has to answer "probably done" vs.
  // "probably still mid-sentence," not extract exact values, so it can
  // stay simple and not risk the carefully-tuned recoverFoldedOffer/
  // TAB_TAIL_PATTERNS logic those functions depend on.
  function looksLikelyComplete(tab, rawTextSoFar){
    const t = wordsToDigits(rawTextSoFar);
    const hasTime = /\d+\s*(?:hours?|hrs?|minutes?|mins?)\b/.test(t);
    const hasMiles = /\d+(?:\.\d+)?\s*miles?\b/.test(t);
    const hasDollar = /\d+(?:\.\d+)?\s*dollars?\b/.test(t);
    const hasItems = /\d+\s*items?\b/.test(t);
    const filled = id => { const el = document.getElementById(id); return !!(el && el.value !== ''); };
    if(tab === 'spark'){
      return (hasTime || filled('spark-time-hr') || filled('spark-time-min'))
          && (hasMiles || filled('spark-miles'))
          && (hasDollar || filled('spark-offer'));
    }
    if(tab === 'instacart'){
      return (hasItems || filled('ic-items'))
          && (hasMiles || filled('ic-miles'))
          && (hasDollar || filled('ic-offer'));
    }
    if(tab === 'food'){
      return (hasTime || filled('fd-time-hr') || filled('fd-time-min'))
          && (hasMiles || filled('fd-miles'))
          && (hasDollar || filled('fd-offer'));
    }
    // shipt -- base pay is required, tip is optional, matching calcShipt.
    return (hasTime || filled('shipt-time-hr') || filled('shipt-time-min'))
        && (hasMiles || filled('shipt-miles'))
        && (hasDollar || filled('shipt-base'));
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
  // TEMPORARY diagnostic readout for the return-mileage/last-word clipping
  // investigation -- see claude/mic-return-mileage-diagnostic.md. Shows
  // exactly what the recognizer heard, chunk by chunk, with timing, so the
  // question "did it never hear 'return mileage' at all, or did it hear it
  // but something else dropped it" has a real answer instead of a guess.
  // Safe to delete this block (and the matching HTML/CSS) once resolved.
  const voiceDebugEl = document.getElementById('voiceDebugLog');
  let voiceDebugLines = [];
  function voiceDebugLog(line){
    voiceDebugLines.push(line);
    // Raised from 8 -- Derek's report (heard "44 dollars," dropped "and 38
    // cents") is exactly the case where the dropped piece could be
    // anywhere in a longer utterance with several fields, not just at the
    // end. 8 lines could scroll past an early drop before the tap even
    // finished; this keeps the whole tap's history instead.
    if(voiceDebugLines.length > 30) voiceDebugLines.shift();
    if(voiceDebugEl) voiceDebugEl.textContent = voiceDebugLines.join('\n');
  }
  if(!SpeechRec){
    micBtn.style.display = 'none';
  } else {
    let listening = false;
    let activeRecognition = null;
    let isFirstMicUse = true; // first tap per page load needs a touch more settle time

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
        // This wait is the one piece of latency in the whole tap-to-listen
        // path that's new since last week's version (which used a plain
        // getUserMedia grab/release here instead, with no deliberate pad
        // tacked on after it) -- confirmed by diffing this file against
        // last week's copy. It was 100ms; trimmed to 50ms here since that
        // was pure dead time on top of the 80ms tone itself, not something
        // tied to a measured need. Not removed entirely -- some settle gap
        // after the tone is still probably worth keeping for the
        // stale-route/CarPlay case this function exists for -- but this
        // directly targets the extra startup delay behind the new
        // first-word clipping, rather than touching anything else.
        await new Promise(resolve => setTimeout(resolve, 50));
      }catch(e){
        // If this fails, proceed anyway — no worse off than before this existed.
      }
    }

    micBtn.addEventListener('click', async ()=>{
      if(listening) return;
      listening = true;
      micBtn.classList.add('listening');
      micBtn.querySelector('.mic-label').textContent = 'STARTING…';
      voiceDebugLines = []; // fresh log per tap -- see voiceDebugLog above
      const tapStartedAt = Date.now();
      voiceDebugLog('[+0ms] tap');

      // FOUND via the debug log, not guessed: several post-backgrounding
      // failures all showed the exact same fingerprint -- onstart AND
      // onaudiostart both fire (the JS-level session believes it's live),
      // but zero speech is ever recognized for the full 8s until
      // deadMicTimer aborts it. Restoring a getUserMedia mic-input probe
      // (see the comment below) did NOT fix this -- confirmed by a later
      // debug log showing "getUserMedia probe ok" immediately followed by
      // the exact same dead-audio fingerprint. That rules out the raw mic
      // hardware route as the cause; it's more likely the recognition
      // SERVICE session itself (Apple's dictation backend) going stale
      // after backgrounding, not the microphone hardware, which a JS-level
      // "wake the mic" probe was never going to fix. Since there's no known
      // fix for that layer, this instead shrinks the COST of it: a new
      // quick-dead-check (see armQuickDeadCheck below) detects the same
      // fingerprint in ~3.5s instead of the full 8s, and automatically
      // retries once with a completely fresh probe+session before making
      // the person notice it's dead and re-tap themselves. If the retry
      // also fails, it falls through to the normal 8s/20s timers and
      // visible dead-end exactly as before -- this is a mitigation for the
      // symptom, not a fix for whatever's actually stale on Apple's side.
      //
      // getUserMedia({audio:true}) grab-and-release still runs ahead of
      // primeAudioRoute() on every attempt -- kept even though it didn't
      // solve this particular bug, since it's still the right, purpose-
      // built wake for the mic INPUT route (distinct from primeAudioRoute's
      // audio OUTPUT/CarPlay-routing tone) and may still matter for
      // whatever original case it was written for.
      async function primeMicRoutes(label){
        try{
          const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
          stream.getTracks().forEach(t => t.stop());
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (' + label + ') getUserMedia probe ok');
        }catch(e){
          // Don't block voice entry if this fails for any reason -- proceed
          // to primeAudioRoute() and recognition.start() regardless, same
          // fallback posture as the rest of this file.
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (' + label + ') getUserMedia probe failed: ' + (e && e.name || e));
        }
        if(!listening) return false; // user backed out (re-tapped, or backgrounding kill-switch) while awaiting above
        await primeAudioRoute();
        if(!listening) return false;
        return true;
      }

      // One full listen attempt: create a fresh recognition instance, wire
      // it up, settle-delay, start(). Factored out (rather than inlined
      // once in the click handler, as this always used to be) specifically
      // so the quick-dead-check below can call it a second time for the
      // one-time automatic retry, without duplicating this whole block.
      // attemptNum is 1 for the original tap, 2 for the retry -- only
      // attempt 1 ever arms the quick-dead-check, so a retry that also
      // fails falls through to the plain 8s/20s timers instead of looping.
      function startAttempt(attemptNum){
        const recognition = new SpeechRec(); // fresh instance every attempt, on purpose
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
        let handingOffToRetry = false; // true only during the deliberate internal abort()->attempt 2 hand-off

        // Three timers, each with a distinct job, so timing adapts to
        // however fast or slow someone talks instead of guessing one fixed
        // duration for everyone:
        //
        // 1) deadMicTimer — if NOTHING has been heard at all (not even a
        //    partial word) within 8s of starting, that's the dead/stale mic
        //    connection scenario from before backgrounding fixes — abort
        //    with an error, since something is genuinely wrong. Backstop
        //    for attempt 2 (or if quickDeadCheck itself somehow doesn't
        //    fire on attempt 1).
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
            voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') deadMicTimer -> abort()');
            try{ recognition.abort(); }catch(e){}
          }
        }, 8000);
        const hardCeiling = setTimeout(()=>{
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') hardCeiling -> stop()');
          try{ recognition.stop(); }catch(e){}
        }, 20000);

        // NEW: catches the exact stale-route fingerprint (audio start
        // fires, nothing ever heard) much sooner than deadMicTimer's 8s --
        // armed relative to audiostart/start, not tap-time, so it doesn't
        // punish the normal ~1-1.5s gap before someone actually starts
        // talking (see the working reference log in
        // mic-return-mileage-diagnostic.md). Only attempt 1 arms this --
        // see the file-level note above for why a retry that also goes
        // quiet just falls through to the normal timers instead of looping
        // forever.
        let quickDeadCheck = null;
        function armQuickDeadCheck(){
          if(attemptNum !== 1) return;
          clearTimeout(quickDeadCheck);
          quickDeadCheck = setTimeout(()=>{
            if(!heardAnything){
              voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt 1) quickDeadCheck(3.5s post-start) -> auto-retry');
              handingOffToRetry = true;
              clearTimeout(deadMicTimer); clearTimeout(hardCeiling); clearTimeout(silenceTimer);
              try{ recognition.abort(); }catch(e){}
              micBtn.querySelector('.mic-label').textContent = 'RETRYING…';
              primeMicRoutes('retry').then(ok=>{
                if(!ok || !listening) return; // backed out, or backgrounded again, during the retry's own probe
                startAttempt(2);
              });
            }
          }, 3500);
        }

        // Adaptive instead of one fixed number for everyone: 1.8s once it
        // looks like everything the active tab requires has already been
        // said (via looksLikelyComplete above) -- snappy for someone who
        // talks fast/cleanly and never needed the longer tolerance -- or 3s
        // while something required is still evidently missing, which is the
        // exact real-measured case (see the mic-return-mileage-diagnostic.md
        // note) where a natural pause before the last field got cut off at
        // 1.8s. Called fresh on every onresult below with the current
        // completeness read, so the wait in effect can change mid-utterance
        // as more gets recognized -- e.g. starts at 3s while time/miles are
        // still coming in, drops to 1.8s the moment the offer amount is
        // finally heard too.
        function armSilenceTimer(likelyComplete){
          clearTimeout(silenceTimer);
          const wait = likelyComplete ? 1800 : 3000;
          silenceTimer = setTimeout(()=>{
            voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') silenceTimer(' + (wait/1000) + 's, ' + (likelyComplete ? 'looked complete' : 'still incomplete') + ') -> stop()');
            try{ recognition.stop(); }catch(e){}
          }, wait);
        }

        recognition.onaudiostart = ()=>{
          micBtn.querySelector('.mic-label').textContent = 'LISTENING…';
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') audiostart');
          armQuickDeadCheck();
        };
        // Some iOS versions never fire onaudiostart reliably — onstart is a
        // weaker signal (recognition session started, not necessarily audio
        // flowing yet) but still an improvement over flipping the label
        // instantly at tap-time, so it's used as a fallback only.
        recognition.onstart = ()=>{
          if(micBtn.querySelector('.mic-label').textContent === 'STARTING…'){
            micBtn.querySelector('.mic-label').textContent = 'LISTENING…';
          }
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') start');
          armQuickDeadCheck(); // harmless if onaudiostart also fires -- just re-arms from whichever came later
        };
        recognition.onresult = (e)=>{
          heardAnything = true;
          clearTimeout(quickDeadCheck); // real speech came in -- the stale-route check no longer applies
          const result = e.results[e.results.length - 1];
          // Completeness is checked against everything heard so far this
          // session, not just the latest chunk -- concatenating every entry
          // in e.results rather than assuming iOS always keeps one
          // continuous utterance under a single result index. Falls back to
          // "still incomplete" (the safe/patient default) if the active tab
          // can't be read for any reason.
          let fullSoFar = '';
          for(let i=0; i<e.results.length; i++){ fullSoFar += ' ' + e.results[i][0].transcript; }
          const activeTabEl = document.querySelector('.tab.active');
          const complete = activeTabEl ? looksLikelyComplete(activeTabEl.dataset.tab, fullSoFar) : false;
          armSilenceTimer(complete);
          // Logs every result -- interim included -- not just the final one
          // applyVoiceEntry() acts on. That's the point: if "return mileage"
          // shows up in an interim chunk but never in a final one, that's a
          // finalization problem, not an audio-capture problem, and this is
          // the only way to actually tell the two apart. The flag marks any
          // chunk mentioning return/mile so it's easy to spot at a glance;
          // the (complete)/(incomplete) tag shows which wait the NEXT pause
          // will actually get, so a too-short or too-long wait can be read
          // straight off this log instead of inferred.
          const text = result[0].transcript;
          const flag = /return|mile/i.test(text) ? ' ⚑' : '';
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') #' + e.results.length + ' ' + (result.isFinal ? 'FINAL' : 'interim') + ': "' + text + '"' + flag + ' (' + (complete ? 'complete' : 'incomplete') + ')');
          if(result.isFinal){
            applyVoiceEntry(text);
          }
        };
        recognition.onerror = (e)=>{
          // Not surfaced to the user beyond this debug log — the underlying
          // issue is a known Web Speech API limitation on iOS that can't be
          // fixed short of a native app. Still logged to console too, in
          // case that ever changes and this is worth revisiting.
          console.log('SpeechRecognition error:', e.error);
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') ERROR: ' + e.error);
        };
        recognition.onend = ()=>{
          clearTimeout(deadMicTimer);
          clearTimeout(hardCeiling);
          clearTimeout(silenceTimer);
          clearTimeout(quickDeadCheck);
          voiceDebugLog('[+' + (Date.now()-tapStartedAt) + 'ms] (attempt ' + attemptNum + ') end');
          // Swallow this quietly during a deliberate internal hand-off to
          // the retry -- resetting listening/the button here would break
          // the retry's own "if(!listening) return" guards and make it
          // silently no-op. The retry's own eventual onend (or the normal
          // no-retry path) is what actually resets the UI.
          if(handingOffToRetry) return;
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
        // label can flip on before real audio is actually flowing. Kept as
        // short as possible (150ms) so it's not noticeable, while still
        // giving the engine a moment to be ready before we trust it. The
        // very first tap per page load gets a slightly longer settle (300ms)
        // since everything (handshake, engine, audio session) is spinning up
        // cold for the first time and has been observed to clip the very
        // start of speech otherwise; every tap after that uses the shorter,
        // near-imperceptible delay.
        const settleDelay = isFirstMicUse ? 300 : 150;
        isFirstMicUse = false;
        setTimeout(()=>{
          if(!listening) return; // user backed out during this brief wait
          try{ recognition.start(); }
          catch(e){ resetMicButton(); }
        }, settleDelay);
      }

      const probesOk = await primeMicRoutes('initial');
      if(!probesOk) return;
      startAttempt(1);
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
