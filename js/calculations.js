// ---------- Calculation ----------
  // Reads one field as a number, or null if it's blank/not a number —
  // used everywhere below to tell "not filled in yet" apart from 0.
  // Nothing in this app is ever meant to be negative (miles, pay, items,
  // minutes), so a negative value is treated exactly like a blank field
  // rather than passed through — every required-field guard below
  // (`===null`) and every optional-field fallback (`|| 0`) already knows
  // how to handle "not filled in," so routing negatives through the same
  // null here means the app falls back to its normal waiting/blank state
  // instead of quietly computing a confidently-wrong verdict from a
  // stray minus sign, with no new UI or error state needed anywhere.
  function num(id){
    const v = parseFloat(document.getElementById(id).value);
    return (isNaN(v) || v < 0) ? null : v;
  }

  // Combines a separate hours field + minutes field into total minutes.
  // Returns null only if BOTH are blank (no time entered at all); a blank
  // hours field with a minutes value is treated as 0 hours, not "unknown".
  // Same negative-is-invalid rule as num() above, applied per-field
  // (rather than nulling the whole result) so a negative minutes value
  // can't silently subtract time from a valid hours value or vice versa;
  // every calc function's existing `time<=0` check already catches the
  // case where clamping both down to 0 leaves nothing usable.
  function numTime(hrId, minId){
    const hrEl = document.getElementById(hrId), minEl = document.getElementById(minId);
    const hrRaw = hrEl ? hrEl.value : '', minRaw = minEl ? minEl.value : '';
    if(hrRaw === '' && minRaw === '') return null;
    const hrParsed = parseFloat(hrRaw), minParsed = parseFloat(minRaw);
    const hr = (isNaN(hrParsed) || hrParsed < 0) ? 0 : hrParsed;
    const min = (isNaN(minParsed) || minParsed < 0) ? 0 : minParsed;
    return hr*60 + min;
  }

  // Spark gives its own time estimate for the delivery route, but has no
  // idea where the driver started from or is heading back to. Return
  // miles (optional) get charged as fuel cost like any other mile, but
  // they ALSO cost real minutes the offer's own time estimate never
  // counted — so that drive time is added on top, using an assumed
  // average speed (CONSTANTS.sparkReturnMph), rather than folding it into
  // the platform's number.
  function calcSpark(){
    const time = numTime('spark-time-hr','spark-time-min'), miles = num('spark-miles'), offer = num('spark-offer');
    if(time===null || miles===null || offer===null || time<=0) return null;
    const returnMiles = num('spark-return') || 0;
    const fuel = (miles + returnMiles) * costPerMile();
    const returnHrs = returnMiles / CONSTANTS.sparkReturnMph;
    const hrs = (time/60) + returnHrs;
    return { gross: offer/hrs, net:(offer-fuel)/hrs, fuel, hrs, offer };
  }

  // Instacart, unlike the other platforms, never shows a time estimate at
  // all — so time here is entirely modeled: item count x an assumed
  // seconds-per-item shopping speed, plus delivery miles converted to
  // drive time via an assumed mph. Both assumptions can be overridden per
  // order under "More details" (ic-speed / ic-mph); CONSTANTS supplies the
  // fallback when they're left blank. Same modeled numbers also feed the
  // live "Estimated time" preview in updateIcPreview() below.
  function calcInstacart(){
    const items = num('ic-items'), offer = num('ic-offer'), miles = num('ic-miles');
    if(items===null || offer===null || miles===null) return null;
    // `|| CONSTANTS.icSpeed` used to also swallow an explicitly-typed 0,
    // not just a blank field — num() correctly returns 0 (not null) for
    // "0", but 0 is falsy, so `||` silently replaced it with the 150-sec
    // default anyway. A 0 here is nonsensical either way (instant
    // shopping / driving speed), so it's treated the same as blank —
    // explicit now via icSpeedInput<=0 rather than accidental via `||`.
    const icSpeedInput = num('ic-speed');
    const speed = (icSpeedInput === null || icSpeedInput <= 0) ? CONSTANTS.icSpeed : icSpeedInput;
    const shopTime = (items * speed) / 60;
    const icMphInput = num('ic-mph');
    const mph = (icMphInput === null || icMphInput <= 0) ? CONSTANTS.icMph : icMphInput;
    const driveTime = (miles / mph) * 60;
    const time = shopTime + driveTime;
    if(time<=0) return null;
    const fuel = miles * costPerMile();
    const hrs = time/60;
    return { gross: offer/hrs, net:(offer-fuel)/hrs, fuel, hrs, offer, shopTime, driveTime };
  }

  // Simplest of the four: food delivery platforms (DoorDash, Uber Eats,
  // Grubhub, etc.) give both a time estimate and a one-way trip, so unlike
  // Spark/Shipt there's no separate return-trip adjustment to make.
  function calcFood(){
    const time = numTime('fd-time-hr','fd-time-min'), miles = num('fd-miles'), offer = num('fd-offer');
    if(time===null || miles===null || offer===null || time<=0) return null;
    const fuel = miles * costPerMile();
    const hrs = time/60;
    return { gross: offer/hrs, net:(offer-fuel)/hrs, fuel, hrs, offer };
  }

  // Same return-trip logic as calcSpark above (Shipt has the same "own
  // time estimate doesn't cover the trip back" gap). The one difference:
  // Shipt splits pay into base pay + tip, so the two are summed into a
  // single offer here before running the same math.
  function calcShipt(){
    const time = numTime('shipt-time-hr','shipt-time-min'), miles = num('shipt-miles'), base = num('shipt-base');
    if(time===null || miles===null || base===null || time<=0) return null;
    const tip = num('shipt-tip') || 0;
    const offer = base + tip;
    const returnMiles = num('shipt-return') || 0;
    const fuel = (miles + returnMiles) * costPerMile();
    const returnHrs = returnMiles / CONSTANTS.sparkReturnMph;
    const hrs = (time/60) + returnHrs;
    return { gross: offer/hrs, net:(offer-fuel)/hrs, fuel, hrs, offer };
  }

  // Runs whichever platform's calc function matches the currently active tab.
  function currentCalc(){
    const active = document.querySelector('.tab.active').dataset.tab;
    if(active==='spark') return calcSpark();
    if(active==='instacart') return calcInstacart();
    if(active==='shipt') return calcShipt();
    return calcFood();
  }

  function fmtMoney(v){ return '$'+v.toFixed(2); }
  function fmtHr(v){ return '$'+v.toFixed(2)+'/hr'; }

  // The central render function — runs the active tab's calculation and
  // updates every piece of UI that depends on the result: the CASH/TRASH
  // verdict card, the tilt bar, the four stat boxes, the breakeven note,
  // the "keep this on your radar" watch badge, and the order-tracking
  // prompt. Called after every recalculation trigger in the app (typing,
  // voice entry, tab switch, Calculate tap, settings save). Falls back to
  // showing the "waiting" illustration instead of a verdict whenever the
  // active tab's required fields aren't all filled in yet.
  function runCheck(){
    const r = currentCalc();
    const resultEl = document.getElementById('result');
    const waitingEl = document.getElementById('waitingNote');
    if(!r){
      resultEl.classList.remove('show');
      waitingEl.classList.remove('hidden');
      return;
    }
    waitingEl.classList.add('hidden');
    const card = document.getElementById('verdictCard');
    const word = document.getElementById('verdictWord');
    const sub = document.getElementById('verdictSub');
    const isCash = r.net >= settings.threshold;
    card.className = 'verdict-card ' + (isCash ? 'cash' : 'trash');
    word.textContent = isCash ? 'CASH' : 'TRASH';
    const diff = Math.abs(r.net - settings.threshold);
    sub.textContent = fmtHr(r.net) + ' net — ' + (isCash ? 'above' : 'below') + ' your $'+settings.threshold+' target by '+fmtMoney(diff)+'/hr';

    // Tilt bar: maps the gap between net $/hr and the target onto a
    // -50%..+50% fill from the bar's center, clamped so a huge gap doesn't
    // overflow the track. `range` is how many dollars of spread corresponds
    // to a full bar in either direction — a tuning constant, not a limit on
    // net $/hr itself.
    const range = 20;
    let pct = ((r.net - settings.threshold) / range) * 50;
    pct = Math.max(-50, Math.min(50, pct));
    const fill = document.getElementById('tiltFill');
    if(pct >= 0){
      fill.style.left = '50%';
      fill.style.width = pct+'%';
      fill.style.background = 'var(--cash)';
    } else {
      fill.style.left = (50+pct)+'%';
      fill.style.width = (-pct)+'%';
      fill.style.background = 'var(--trash)';
    }

    document.getElementById('statNet').textContent = fmtHr(r.net);
    document.getElementById('statGross').textContent = fmtHr(r.gross);
    document.getElementById('statFuel').textContent = r.fuel>0 ? fmtMoney(r.fuel) : '— not entered';
    document.getElementById('statTime').textContent = (r.hrs*60).toFixed(0)+' min';

    // "Keep this on your radar" badge: a TRASH offer that's still close
    // (within WATCH_THRESHOLD dollars/hr) to clearing the target. Useful on
    // platforms like Spark where an offer's pay sometimes bumps up in small
    // increments over time.
    const breakeven = document.getElementById('breakevenNote');
    const watchBadge = document.getElementById('watchBadge');
    const WATCH_THRESHOLD = 3;
    if(!isCash){
      const needed = settings.threshold * r.hrs + r.fuel;
      breakeven.textContent = "You'd need "+fmtMoney(needed)+" to clear your target on this one.";
      const gap = settings.threshold - r.net;
      watchBadge.classList.toggle('show', gap > 0 && gap <= WATCH_THRESHOLD);
    } else {
      const cushion = r.offer - (settings.threshold * r.hrs + r.fuel);
      breakeven.textContent = "You're "+fmtMoney(cushion)+" above what you'd need to hit your target.";
      watchBadge.classList.remove('show');
    }

    resultEl.classList.add('show');
    saveFields();

    card.scrollIntoView({behavior:'smooth', block:'center'});
    card.classList.add('pulse');

    // Remembered so the "Did you take it?" prompt (ORDER TRACKING below)
    // can log this exact result without recalculating, and reset so that
    // prompt shows fresh yes/no buttons again for the new result.
    lastResult = { r, isCash, platform: document.querySelector('.tab.active').dataset.tab };
    resetTracklogPrompt();
  }

  // Thin named wrapper around runCheck() — gives the Calculate button and
  // voice entry (applyVoiceEntry below) a stable entry point, distinct
  // from the debounced auto-recalc-while-typing path (scheduleLiveCheck
  // near Init) which calls runCheck() directly.
  function calculateNow(){
    runCheck();
  }
