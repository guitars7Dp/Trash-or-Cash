  // ---------- Init ----------
  // Order matters: restore saved field values first, then show the
  // last-used tab (so the right panel's fields are the ones visible when
  // restored), then refresh the Instacart time preview, then run the
  // first calculation — by which point everything it might read is
  // already in place.
  loadFields();
  activateTab(lastTab);
  updateIcPreview();
  runCheck();
