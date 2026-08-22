  // ---------- Field persistence ----------
  // Every input across all 4 tabs, in one flat list — this is the full
  // autosave/restore set (see loadFields/saveFields below). TAB_FIELDS
  // further down is a *different*, smaller grouping used only by the
  // "clear fields" button.
  const FIELD_IDS = ['spark-time-hr','spark-time-min','spark-miles','spark-offer','spark-return',
    'ic-items','ic-offer','ic-speed','ic-miles','ic-mph','fd-time-hr','fd-time-min','fd-miles','fd-offer',
    'shipt-time-hr','shipt-time-min','shipt-miles','shipt-base','shipt-tip','shipt-return'];

  // Restores every field's last-typed value on page load, so switching
  // tabs (or reopening the app) doesn't lose what was already entered.
  function loadFields(){
    try{
      const raw = localStorage.getItem('toc_fields');
      if(!raw) return;
      const data = JSON.parse(raw);
      FIELD_IDS.forEach(id=>{
        const el = document.getElementById(id);
        if(el && data[id] !== undefined && data[id] !== '') el.value = data[id];
      });
    }catch(e){}
  }
  // Snapshots every field's current value to localStorage. Called on every
  // keystroke (see the FIELD_IDS input listener near Init below) and again
  // after voice entry fills fields in.
  function saveFields(){
    try{
      const data = {};
      FIELD_IDS.forEach(id=>{
        const el = document.getElementById(id);
        if(el) data[id] = el.value;
      });
      localStorage.setItem('toc_fields', JSON.stringify(data));
    }catch(e){}
  }
  let lastTab = 'spark';
  try{ lastTab = localStorage.getItem('toc_last_tab') || 'spark'; }catch(e){}

  // Same fields as FIELD_IDS, but grouped by which tab they belong to.
  // Used only by the "clear fields" button below, so clearing wipes just
  // the tab you're currently on, not every tab's saved data.
  const TAB_FIELDS = {
    spark: ['spark-time-hr','spark-time-min','spark-miles','spark-offer','spark-return'],
    instacart: ['ic-items','ic-offer','ic-speed','ic-miles','ic-mph'],
    shipt: ['shipt-time-hr','shipt-time-min','shipt-miles','shipt-base','shipt-tip','shipt-return'],
    food: ['fd-time-hr','fd-time-min','fd-miles','fd-offer']
  };
  function clearActiveTabFields(){
    const active = document.querySelector('.tab.active').dataset.tab;
    (TAB_FIELDS[active] || []).forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.value = '';
    });
    saveFields();
    if(active==='instacart') updateIcPreview();
    runCheck();
  }

