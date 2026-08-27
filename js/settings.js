// ---------- Settings (target $/hr, MPG, gas price) ----------
  // Starting values for a brand-new user who hasn't opened Settings yet.
  const DEFAULTS = { threshold:25, mpg:25, gas:3.50 };
  // Fallback estimation constants used only when the user hasn't filled in
  // the matching optional field themselves (Instacart's shopping speed and
  // driving speed, and the assumed speed for a Spark/Shipt return trip).
  // Never shown to the user as a "setting" — just reasonable defaults.
  const CONSTANTS = { icSpeed:150, icMph:40, sparkReturnMph:40 };
  // The most recent runCheck() result, kept around so the "Did you take
  // it?" order-tracking prompt (see ORDER TRACKING below) can log it
  // without recalculating anything.
  let lastResult = null;
  let settings = loadSettings();

  // Loads the saved threshold/MPG/gas, falling back to DEFAULTS for
  // anything missing. Deliberately reads only these three known keys out
  // of whatever's stored — if an older saved blob ever had other fields
  // (from a since-removed setting), they're silently dropped rather than
  // carried forward, so a code change to what's stored always takes
  // effect even for a returning user.
  function loadSettings(){
    try{
      const raw = localStorage.getItem('toc_settings');
      if(raw){
        const stored = JSON.parse(raw);
        return {
          threshold: typeof stored.threshold === 'number' ? stored.threshold : DEFAULTS.threshold,
          mpg: typeof stored.mpg === 'number' ? stored.mpg : DEFAULTS.mpg,
          gas: typeof stored.gas === 'number' ? stored.gas : DEFAULTS.gas
        };
      }
    }catch(e){}
    return Object.assign({}, DEFAULTS);
  }
  function saveSettings(){
    try{ localStorage.setItem('toc_settings', JSON.stringify({threshold:settings.threshold, mpg:settings.mpg, gas:settings.gas})); }catch(e){}
  }
  // The one formula every calculation below shares: what one mile of
  // driving costs in gas, derived from the user's own MPG and gas price.
  function costPerMile(){ return settings.gas / settings.mpg; }

  // Same "invalid input falls back to the default" rule the old
  // `parseFloat(x) || DEFAULTS.x` pattern already applied to blank/non-
  // numeric input (0 included — `0 || fallback` is `fallback`, since 0
  // is falsy) — kept as `v <= 0` here rather than `v < 0` specifically
  // so that existing behavior for 0 doesn't change. What's actually new
  // is catching NEGATIVE input, which the old `||` pattern did NOT catch
  // (parseFloat('-5') is truthy, so -5 would have saved as-is). That
  // matters most for mpg/gas specifically: either one saved as <= 0
  // would make costPerMile() divide-by-zero or go negative, corrupting
  // every calculation on every tab until Settings is reopened and fixed
  // — not just one order's worth of bad data.
  function parsePositive(raw, fallback){
    const v = parseFloat(raw);
    return (isNaN(v) || v <= 0) ? fallback : v;
  }


  // ---------- Settings modal (UI wiring) ----------
  // Moved here from later in the original file (it originally sat
  // after Tabs/More-details in the source, purely because that's
  // where it happened to be typed) so all Settings-related code —
  // data layer and modal UI — lives in one file.
  // ---------- Settings modal ----------
  const modal = document.getElementById('settingsModal');
  document.getElementById('settingsBtn').addEventListener('click', ()=>{
    document.getElementById('setThreshold').value = settings.threshold;
    document.getElementById('setThresholdVal').textContent = '$'+settings.threshold;
    document.getElementById('setMpg').value = settings.mpg;
    document.getElementById('setGas').value = settings.gas;
    updateDerivedRate();
    modal.classList.add('show');
  });
  document.getElementById('setThreshold').addEventListener('input', (e)=>{
    document.getElementById('setThresholdVal').textContent = '$'+e.target.value;
  });
  function updateDerivedRate(){
    const mpg = parsePositive(document.getElementById('setMpg').value, DEFAULTS.mpg);
    const gas = parsePositive(document.getElementById('setGas').value, DEFAULTS.gas);
    document.getElementById('derivedRate').textContent = '= $'+(gas/mpg).toFixed(3)+' / mile';
  }
  document.getElementById('setMpg').addEventListener('input', updateDerivedRate);
  document.getElementById('setGas').addEventListener('input', updateDerivedRate);

  document.getElementById('saveSettings').addEventListener('click', ()=>{
    settings.threshold = parsePositive(document.getElementById('setThreshold').value, DEFAULTS.threshold);
    settings.mpg = parsePositive(document.getElementById('setMpg').value, DEFAULTS.mpg);
    settings.gas = parsePositive(document.getElementById('setGas').value, DEFAULTS.gas);
    saveSettings();
    modal.classList.remove('show');
    runCheck();
  });

  // First-run nudge to set up target $/hr, MPG, and gas price. Exposed on
  // window (rather than called directly here) because it needs to run
  // *after* the tutorial engine decides whether to show the tutorial —
  // that logic lives in a separate <script> block loaded later. Both the
  // tutorial's "that's the tour" finish and, for a returning user who
  // already saw the tutorial but never saved settings, the post-flash
  // handoff call this to open Settings automatically exactly once.
  let hasSettings = false;
  try{ hasSettings = !!localStorage.getItem('toc_settings'); }catch(e){}
  window.__tocOpenSettingsIfNeeded = function(){
    if(!hasSettings){
      document.getElementById('settingsBtn').click();
    }
  };
