/* ============ ORDER TRACKING ============
     After each calculated result, the app asks "Did you take it?" (the
     tracklog prompt in the HTML). Answering yes logs that result — what
     the app estimated, not what actually happened — to a running list the
     user can review or export later (see renderLogView / CSV export
     below). Purely local: nothing here ever leaves the device unless the
     user copies the CSV out themselves. Reachable normally via Settings ->
     ORDER LOG; also openable directly by loading the app with a `?log=1`
     URL query param (see openLogOnLoad further down), handy for quickly
     checking logged data without hunting through Settings.

     "Clear" never deletes anything. Logged entries stay in localStorage
     permanently (see loadOrderLog/saveOrderLog below); the START FRESH
     button (clearLogBtn) just moves a "cleared at" cursor (see
     loadClearedAt/saveClearedAt) forward to now, which is what the
     default "Since last clear" filter view hides behind. Older entries
     are never gone — the filter dropdown (#logFilterSelect) can always
     switch to Today/This Week/This Month/All Time to see them again, and
     COPY AS CSV exports whatever the current filter is showing. */
  const PLATFORM_LABELS = { spark:'Spark', instacart:'Instacart', shipt:'Shipt', food:'Food Delivery' };

  function loadOrderLog(){
    try{ return JSON.parse(localStorage.getItem('toc_order_log') || '[]'); }catch(e){ return []; }
  }
  function saveOrderLog(entries){
    // Used to swallow every failure silently, same shape as the bug this
    // whole change addresses: logOrder()/the click handler always showed
    // "Logged ✓" regardless of whether this actually wrote anything.
    // Reporting real success/failure here is what let that be found and
    // fixed with evidence instead of another guess -- see
    // claude/order-log-silent-failure-fix.md.
    try{
      localStorage.setItem('toc_order_log', JSON.stringify(entries));
      return { ok:true };
    }catch(e){
      return { ok:false, error: (e && e.message) || String(e) };
    }
  }
  // The "cleared at" cursor for the default filter view — see the big
  // comment above. 0 (never cleared) means "since last clear" shows
  // everything, which is exactly right for someone who's never hit
  // START FRESH yet.
  function loadClearedAt(){
    try{ return +localStorage.getItem('toc_log_cleared_at') || 0; }catch(e){ return 0; }
  }
  function saveClearedAt(ts){
    try{ localStorage.setItem('toc_log_cleared_at', String(ts)); }catch(e){}
  }
  // Start-of-period cutoffs, all in the device's local time (so "today"
  // matches whatever day it actually is for the person holding the
  // phone, not UTC). Week starts Sunday, matching how the US gig
  // platforms this app covers report weekly pay periods.
  function startOfToday(){
    const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
  }
  function startOfWeek(){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay()); return d.getTime();
  }
  function startOfMonth(){
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d.getTime();
  }
  // Returns { entries, emptyMsg } for whatever filter is currently
  // selected — shared by renderLogView() and the CSV export so "copy as
  // csv" always exports exactly what's on screen.
  function getFilteredEntries(){
    const all = loadOrderLog();
    const filter = (document.getElementById('logFilterSelect') || {}).value || 'current';
    let cutoff = 0, emptyMsg = 'Nothing logged yet.';
    if(filter === 'today'){ cutoff = startOfToday(); emptyMsg = 'Nothing logged today.'; }
    else if(filter === 'week'){ cutoff = startOfWeek(); emptyMsg = 'Nothing logged this week.'; }
    else if(filter === 'month'){ cutoff = startOfMonth(); emptyMsg = 'Nothing logged this month.'; }
    else if(filter === 'all'){ cutoff = 0; emptyMsg = 'Nothing logged yet.'; }
    else { cutoff = loadClearedAt(); emptyMsg = cutoff ? 'Nothing logged since your last clear — switch "Show" above to look further back.' : 'Nothing logged yet.'; }
    return { entries: all.filter(e => e.ts > cutoff), emptyMsg };
  }
  // Logs the most recent result (see lastResult above) as one entry: the
  // platform, CASH/TRASH verdict, and every estimated number, timestamped.
  // Returns { ok, reason, error, count } instead of nothing -- Derek
  // reported tapping LOG IT on several orders that never showed up under
  // "All Time," meaning the confirmation was lying: this used to run
  // silently and the click handler always showed "Logged ✓" no matter
  // what actually happened, so a failure here and a real success looked
  // identical. Now the caller (the click handler below) can tell the
  // difference and say so. See claude/order-log-silent-failure-fix.md.
  function logOrder(){
    if(!lastResult) return { ok:false, reason:'No calculated result to log yet.' };
    const { r, isCash, platform } = lastResult;
    const entry = {
      ts: Date.now(),
      platform: PLATFORM_LABELS[platform] || platform,
      verdict: isCash ? 'CASH' : 'TRASH',
      estOffer: +r.offer.toFixed(2),
      estNet: +r.net.toFixed(2),
      estGross: +r.gross.toFixed(2),
      estFuel: +r.fuel.toFixed(2),
      estMinutes: Math.round(r.hrs*60)
    };
    const entries = loadOrderLog();
    entries.push(entry);
    const saved = saveOrderLog(entries);
    if(!saved.ok) return { ok:false, reason:'Storage write failed.', error: saved.error };
    // Read back what's actually in storage rather than trusting that the
    // write above did what it claimed -- this is the part that actually
    // catches a silent failure instead of just moving where the trust is.
    const verify = loadOrderLog();
    const last = verify[verify.length - 1];
    if(verify.length !== entries.length || !last || last.ts !== entry.ts){
      return { ok:false, reason:'Entry did not verify after saving.', count: verify.length };
    }
    return { ok:true, count: verify.length };
  }

  // Puts the "Did you take it?" yes/no buttons back to their default
  // state. Called by runCheck() after every new result, so a fresh
  // calculation always shows the question again instead of a leftover
  // "logged!" confirmation from the previous one.
  function resetTracklogPrompt(){
    const prompt = document.getElementById('tracklogPrompt');
    if(!prompt) return;
    document.getElementById('tracklogBtns').classList.remove('hidden');
    document.getElementById('tracklogConfirm').classList.add('hidden');
  }

  const tracklogYesBtn = document.getElementById('tracklogYes');
  if(tracklogYesBtn){
    tracklogYesBtn.addEventListener('click', ()=>{
      const result = logOrder();
      if(result.ok){
        document.getElementById('tracklogBtns').classList.add('hidden');
        const confirmEl = document.getElementById('tracklogConfirm');
        // Includes the running total so a success message actually means
        // something verified, not just "this function ran." If the count
        // ever doesn't go up the way you expect, that's itself a signal
        // worth reporting back, same as an outright failure would be.
        confirmEl.textContent = 'Logged ✓ (' + result.count + ' total)';
        confirmEl.classList.remove('hidden');
      } else {
        // Previously this branch didn't exist -- logOrder() ran silently
        // and the "Logged ✓" confirmation showed unconditionally, whether
        // or not anything was actually saved. Surfaced for real now rather
        // than a false positive.
        window.alert('Could not log this order: ' + result.reason + (result.error ? ' (' + result.error + ')' : '') + '\n\nNothing was saved -- try LOG IT again.');
      }
    });
  }

  function fmtLogDate(ts){
    const d = new Date(ts);
    return (d.getMonth()+1)+'/'+d.getDate()+' '+d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  }

  // Builds the order-log table shown in the Order Log modal, most recent
  // entry first, respecting whatever the "Show" filter is currently set
  // to. Rebuilt from scratch each time the modal opens or the filter
  // changes (see settingsLogBtn / openLogOnLoad / logFilterSelect below)
  // rather than kept in sync live.
  function renderLogView(){
    const wrap = document.getElementById('logListWrap');
    const { entries: filtered, emptyMsg } = getFilteredEntries();
    const entries = filtered.slice().reverse();
    if(entries.length === 0){
      wrap.innerHTML = '<div class="log-empty">'+emptyMsg+'</div>';
      return;
    }
    let html = '<table class="log-table"><thead><tr>'
      + '<th>When</th><th>Platform</th><th>Verdict</th><th>Est $</th><th>Est min</th><th>Est net/hr</th>'
      + '</tr></thead><tbody>';
    entries.forEach(e=>{
      html += '<tr>'
        + '<td>'+fmtLogDate(e.ts)+'</td>'
        + '<td>'+e.platform+'</td>'
        + '<td class="'+(e.verdict==='CASH'?'lv-cash':'lv-trash')+'">'+e.verdict+'</td>'
        + '<td>$'+e.estOffer.toFixed(2)+'</td>'
        + '<td>'+e.estMinutes+'</td>'
        + '<td>$'+e.estNet.toFixed(2)+'</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  const logModal = document.getElementById('logModal');
  document.getElementById('closeLogBtn').addEventListener('click', ()=> logModal.classList.remove('show'));
  // Re-render whenever the "Show" filter changes.
  const logFilterSelect = document.getElementById('logFilterSelect');
  if(logFilterSelect){
    logFilterSelect.addEventListener('change', renderLogView);
  }
  // Exports whatever the current filter is showing as tab-delimited text to
  // the clipboard (falling back to a plain prompt() dialog — selectable/
  // copyable by hand — on browsers or permission states where the
  // Clipboard API isn't available), for pasting into a spreadsheet to
  // compare estimates against reality. Tabs (not commas) are used as the
  // separator because Numbers and Excel only auto-split pasted plain text
  // into columns on tabs — commas paste as one literal string per row.
  document.getElementById('copyLogBtn').addEventListener('click', ()=>{
    const { entries } = getFilteredEntries();
    // No header row here on purpose — this is meant to be pasted straight
    // into an existing tracker sheet that already has its own header row,
    // so including one here would just create a duplicate.
    let csv = '';
    entries.forEach(e=>{
      const d = new Date(e.ts);
      const dateStr = (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
      csv += [dateStr, e.platform, e.verdict, e.estNet].join('\t') + '\n';
    });
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(csv).then(()=>{
        const btn = document.getElementById('copyLogBtn');
        const orig = btn.textContent;
        btn.textContent = 'COPIED ✓';
        setTimeout(()=>{ btn.textContent = orig; }, 1500);
      }).catch(()=>{ window.prompt('Copy this:', csv); });
    } else {
      window.prompt('Copy this:', csv);
    }
  });
  // Non-destructive: nothing is ever deleted from storage here. This just
  // moves the "cleared at" cursor to now, so the default "Since last
  // clear" view starts fresh — past entries stay fully intact and
  // reachable any time via the Today/This Week/This Month/All Time
  // options in the filter above.
  document.getElementById('clearLogBtn').addEventListener('click', ()=>{
    if(window.confirm('Start a fresh log? Nothing is deleted — past entries stay available under "This Week", "This Month", or "All Time" in the Show menu above.')){
      saveClearedAt(Date.now());
      if(logFilterSelect) logFilterSelect.value = 'current';
      renderLogView();
    }
  });

  // Dev/support convenience: loading the app with ?log=1 in the URL opens
  // the Order Log modal immediately, without going through Settings.
  let openLogOnLoad = false;
  try{ openLogOnLoad = /(?:^|[?&])log=1(?:&|$)/.test(window.location.search); }catch(e){}
  if(openLogOnLoad){
    if(logFilterSelect) logFilterSelect.value = 'current';
    renderLogView();
    logModal.classList.add('show');
  }
  const settingsLogBtn = document.getElementById('openLogBtn');
  if(settingsLogBtn){
    settingsLogBtn.addEventListener('click', ()=>{
      // Always reopen on the default filter, so the log never *appears*
      // empty just because it was left on an old filter selection.
      if(logFilterSelect) logFilterSelect.value = 'current';
      renderLogView();
      logModal.classList.add('show');
    });
  }
