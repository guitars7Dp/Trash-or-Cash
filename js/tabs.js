  // ---------- Tabs ----------
  const tabs = document.querySelectorAll('.tab');
  const panels = { spark:'panel-spark', instacart:'panel-instacart', shipt:'panel-shipt', food:'panel-food' };
  // Shows the chosen tab's panel and hides the rest, highlights the active
  // tab button, and remembers the choice so the app reopens on the same
  // tab next time.
  function activateTab(name){
    tabs.forEach(t=> t.classList.toggle('active', t.dataset.tab === name));
    Object.keys(panels).forEach(k=>{
      document.getElementById(panels[k]).style.display = (k===name) ? 'block' : 'none';
    });
    lastTab = name;
    try{ localStorage.setItem('toc_last_tab', name); }catch(e){}
  }
  tabs.forEach(t=> t.addEventListener('click', ()=>{ activateTab(t.dataset.tab); runCheck(); }));

  // ---------- More details toggles ----------
  document.querySelectorAll('.more-toggle').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.more;
      const panel = document.getElementById('more-'+key);
      const open = panel.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.querySelector('span').textContent = open ? '– MORE DETAILS (OPTIONAL)' : '+ MORE DETAILS (OPTIONAL)';
    });
  });

