  /* ============ ORDER TRACKING ============
     After each calculated result, the app asks "Did you take it?" (the
     tracklog prompt in the HTML). Answering yes logs that result — what
     the app estimated, not what actually happened — to a running list the
     user can review or export later (see renderLogView / CSV export
     below). Purely local: nothing here ever leaves the device unless the
     user copies the CSV out themselves. Reachable normally via Settings ->
     ORDER LOG; also openable directly by loading the app with a `?log=1`
     URL query param (see openLogOnLoad further down), handy for quickly
     checking logged data without hunting through Settings. */
  const PLATFORM_LABELS = { spark:'Spark', instacart:'Instacart', shipt:'Shipt', food:'Food Delivery' };

  function loadOrderLog(){
    try{ return JSON.parse(localStorage.getItem('toc_order_log') || '[]'); }catch(e){ return []; }
  }
  function saveOrderLog(entries){
    try{ localStorage.setItem('toc_order_log', JSON.stringify(entries)); }catch(e){}
  }
  // Logs the most recent result (see lastResult above) as one entry: the
  // platform, CASH/TRASH verdict, and every estimated number, timestamped.
  function logOrder(){
    if(!lastResult) return;
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
    saveOrderLog(entries);
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
      logOrder();
      document.getElementById('tracklogBtns').classList.add('hidden');
      document.getElementById('tracklogConfirm').classList.remove('hidden');
    });
  }

  function fmtLogDate(ts){
    const d = new Date(ts);
    return (d.getMonth()+1)+'/'+d.getDate()+' '+d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  }

  // Builds the order-log table shown in the Order Log modal, most recent
  // entry first. Rebuilt from scratch each time the modal opens (see
  // settingsLogBtn / openLogOnLoad below) rather than kept in sync live.
  function renderLogView(){
    const wrap = document.getElementById('logListWrap');
    const entries = loadOrderLog().slice().reverse();
    if(entries.length === 0){
      wrap.innerHTML = '<div class="log-empty">Nothing logged yet.</div>';
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
  // Exports the whole log as CSV text to the clipboard (falling back to a
  // plain prompt() dialog — selectable/copyable by hand — on browsers or
  // permission states where the Clipboard API isn't available), for
  // pasting into a spreadsheet to compare estimates against reality.
  document.getElementById('copyLogBtn').addEventListener('click', ()=>{
    const entries = loadOrderLog();
    let csv = 'Date,Platform,App Said,App Est $/hr\n';
    entries.forEach(e=>{
      const d = new Date(e.ts);
      const dateStr = (d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear();
      csv += [dateStr, e.platform, e.verdict, e.estNet].join(',') + '\n';
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
  document.getElementById('clearLogBtn').addEventListener('click', ()=>{
    if(window.confirm('Clear the entire order log? This cannot be undone.')){
      saveOrderLog([]);
      renderLogView();
    }
  });

  // Dev/support convenience: loading the app with ?log=1 in the URL opens
  // the Order Log modal immediately, without going through Settings.
  let openLogOnLoad = false;
  try{ openLogOnLoad = /(?:^|[?&])log=1(?:&|$)/.test(window.location.search); }catch(e){}
  if(openLogOnLoad){
    renderLogView();
    logModal.classList.add('show');
  }
  const settingsLogBtn = document.getElementById('openLogBtn');
  if(settingsLogBtn){
    settingsLogBtn.addEventListener('click', ()=>{
      renderLogView();
      logModal.classList.add('show');
    });
  }

