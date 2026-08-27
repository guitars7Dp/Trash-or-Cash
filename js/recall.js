/* ============ RECALL ============
     The "recall" button next to Clear brings back two things without
     needing to have logged anything or still be looking at the right tab:

     1. LAST CHECKED -- whatever the most recent calculated result was
        (any platform), even if its fields have since been overwritten by
        a newer order, or the app was closed and reopened. Persisted to
        localStorage the moment it's calculated (see the saveLastRecall
        call in calculations.js's runCheck()), independent of the live,
        editable fields it came from.

     2. ON YOUR RADAR -- every platform currently sitting close to target
        (same "keep this on your radar" condition as the in-page watch
        badge), computed live across all four platforms rather than
        stored, since every platform's fields stay in the DOM (just
        hidden) regardless of which tab is active -- see activateTab() in
        tabs.js. This means the radar list can never go stale or need its
        own storage/cleanup; it's always exactly what re-running each
        platform's own calc function against its own fields says right
        now. */
  const RECALL_KEY = 'toc_recall_last';

  function loadLastRecall(){
    try{ return JSON.parse(localStorage.getItem(RECALL_KEY) || 'null'); }catch(e){ return null; }
  }
  function saveLastRecall(entry){
    try{
      // runCheck() calls this on EVERY valid calculation -- not just when
      // the numbers actually change, but also on a plain re-render of the
      // exact same order (tab switch back, a page reload with the same
      // autosaved fields, a live-typing recalc that lands on an identical
      // value). Without this check, any of those would silently wipe a
      // "logged: true" flag back to false, making "already logged" state
      // effectively unreliable. Carry it forward whenever this is the
      // same order (matched on platform + every result number) as what
      // was already persisted.
      const prev = loadLastRecall();
      const sameOrder = prev && prev.platform === entry.platform
        && prev.offer === entry.offer && prev.net === entry.net
        && prev.gross === entry.gross && prev.fuel === entry.fuel && prev.hrs === entry.hrs;
      if(sameOrder && prev.logged){ entry.logged = true; }
      localStorage.setItem(RECALL_KEY, JSON.stringify(entry));
    }catch(e){}
  }
  // Called after logOrder() runs, whether from the in-page "Did you take
  // it?" prompt (orders.js) or from Recall's own LOG IT button below, so
  // Recall never offers to log the same result twice.
  function markLastRecallLogged(){
    const snap = loadLastRecall();
    if(snap){ snap.logged = true; saveLastRecall(snap); }
  }

  // Seeds `lastResult` (declared in settings.js, normally set fresh by
  // every runCheck()) from whatever was last persisted, in case the page
  // was reloaded since the last calculation -- without this, LOG IT
  // inside Recall would have nothing for the existing logOrder() to log
  // right after a reload, even though Recall is still showing a result.
  // init.js's own startup runCheck() (which runs after this script has
  // already executed) immediately overwrites this again with a freshly
  // computed result if the restored active tab's fields are complete --
  // this seed only fills the gap before that, and covers tabs other than
  // whichever one happens to be active on load.
  (function seedLastResultFromRecall(){
    const snap = loadLastRecall();
    if(snap && !lastResult){
      lastResult = {
        r: { offer:snap.offer, net:snap.net, gross:snap.gross, fuel:snap.fuel, hrs:snap.hrs },
        isCash: snap.isCash,
        platform: snap.platform
      };
    }
  })();

  function renderRecallLast(){
    const wrap = document.getElementById('recallLastWrap');
    if(!wrap) return;
    const snap = loadLastRecall();
    if(!snap){
      wrap.innerHTML = '<div class="log-empty">Nothing checked yet — run a calculation on any tab and it\'ll show up here.</div>';
      return;
    }
    const label = PLATFORM_LABELS[snap.platform] || snap.platform;
    const verdictClass = snap.isCash ? 'cash' : 'trash';
    const verdictWord = snap.isCash ? 'CASH' : 'TRASH';
    let html = '<div class="recall-card">'
      + '<div class="recall-card-top"><span class="recall-platform">'+label+'</span><span class="recall-verdict '+verdictClass+'">'+verdictWord+'</span></div>'
      + '<div class="recall-card-stats">$'+snap.net.toFixed(2)+'/hr net · $'+snap.offer.toFixed(2)+' offer</div>'
      + '<div class="recall-card-time">Checked '+fmtLogDate(snap.ts)+'</div>';
    if(snap.logged){
      html += '<div class="tracklog-confirm">Logged ✓</div>';
    } else {
      html += '<button type="button" class="tracklog-btn yes" id="recallLogBtn">LOG IT</button>';
    }
    html += '</div>';
    wrap.innerHTML = html;
    if(!snap.logged){
      const btn = document.getElementById('recallLogBtn');
      if(btn){
        btn.addEventListener('click', ()=>{
          logOrder();
          markLastRecallLogged();
          renderRecallLast();
        });
      }
    }
  }

  function getRadarItems(){
    const platforms = [
      { key:'spark', calc:calcSpark },
      { key:'instacart', calc:calcInstacart },
      { key:'shipt', calc:calcShipt },
      { key:'food', calc:calcFood }
    ];
    const items = [];
    platforms.forEach(p=>{
      const r = p.calc();
      if(!r) return;
      const isCash = r.net >= settings.threshold;
      if(isCash) return;
      const gap = settings.threshold - r.net;
      if(gap > 0 && gap <= WATCH_THRESHOLD){
        items.push({ platform:p.key, net:r.net, gap });
      }
    });
    return items;
  }

  function renderRecallRadar(){
    const wrap = document.getElementById('recallRadarWrap');
    if(!wrap) return;
    const items = getRadarItems();
    if(items.length === 0){
      wrap.innerHTML = '<div class="log-empty">Nothing close to your target right now.</div>';
      return;
    }
    let html = '<table class="log-table"><thead><tr><th>Platform</th><th>Net $/hr</th><th>Within</th></tr></thead><tbody>';
    items.forEach(it=>{
      html += '<tr class="radar-row" data-platform="'+it.platform+'">'
        + '<td>'+(PLATFORM_LABELS[it.platform] || it.platform)+'</td>'
        + '<td>$'+it.net.toFixed(2)+'</td>'
        + '<td>$'+it.gap.toFixed(2)+' of target</td>'
        + '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
    // Tapping a radar row jumps straight to that platform's tab (closing
    // Recall first) and re-runs the calculation there, landing the user
    // right back on the live "Did you take it?" prompt for that order --
    // reuses the existing logging flow rather than duplicating it here.
    wrap.querySelectorAll('.radar-row').forEach(row=>{
      row.addEventListener('click', ()=>{
        const platform = row.dataset.platform;
        recallModal.classList.remove('show');
        activateTab(platform);
        runCheck();
      });
    });
  }

  function renderRecallView(){
    renderRecallLast();
    renderRecallRadar();
  }

  const recallModal = document.getElementById('recallModal');
  const recallBtn = document.getElementById('recallBtn');
  if(recallBtn && recallModal){
    recallBtn.addEventListener('click', ()=>{
      renderRecallView();
      recallModal.classList.add('show');
    });
  }
  const closeRecallBtn = document.getElementById('closeRecallBtn');
  if(closeRecallBtn && recallModal){
    closeRecallBtn.addEventListener('click', ()=> recallModal.classList.remove('show'));
  }
