/* ============ RECALL ============
     The Recall button (next to Clear) refills whichever tab's fields were
     used for the most recent calculation -- on any platform, whether it
     was ever logged or not -- with that exact order's values, switches to
     that tab if a different one is active, and re-runs the calculation so
     the normal result and "Did you take it?" prompt appear right there,
     same as any fresh calculation.

     This is deliberately separate from fields.js's own autosave
     (toc_fields, which restores whatever's currently typed): the whole
     point of Recall is to survive things autosave does NOT survive --
     typing a new order over the old one, or hitting Clear -- so it needs
     its own snapshot, taken at the moment a calculation actually
     completes rather than tracking every keystroke live. */
  const RECALL_KEY = 'toc_recall_last';

  function loadLastRecall(){
    try{ return JSON.parse(localStorage.getItem(RECALL_KEY) || 'null'); }catch(e){ return null; }
  }
  // Captures the given platform's own fields (using the same per-platform
  // grouping fields.js already defines for the Clear button, TAB_FIELDS --
  // reused here rather than duplicating a second copy of the same field
  // lists that could drift out of sync with it later).
  function saveLastRecall(platform){
    try{
      const ids = TAB_FIELDS[platform] || [];
      const fields = {};
      ids.forEach(id=>{
        const el = document.getElementById(id);
        fields[id] = el ? el.value : '';
      });
      localStorage.setItem(RECALL_KEY, JSON.stringify({ platform, fields }));
    }catch(e){}
  }

  const recallBtn = document.getElementById('recallBtn');
  if(recallBtn){
    recallBtn.addEventListener('click', ()=>{
      const snap = loadLastRecall();
      if(!snap) return; // nothing calculated yet this device -- nothing to recall
      activateTab(snap.platform);
      Object.keys(snap.fields).forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.value = snap.fields[id];
      });
      saveFields();
      if(snap.platform === 'instacart') updateIcPreview();
      runCheck();
    });
  }
