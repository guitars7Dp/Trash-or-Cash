  // ---------- Help & FAQ ----------
  // Question/answer pairs shown in the Help & FAQ modal (opened via the
  // gear icon -> HELP & FAQ). Rendered into #faqList as expandable
  // accordion items just below; edit the copy here, no HTML changes needed.
  const FAQ_ITEMS = [
    {
      q: 'What do CASH and TRASH mean?',
      a: "CASH means the offer clears your target pay per hour after gas — TRASH means it doesn't. Rocco compares the offer's net $/hr against the target you set in Settings."
    },
    {
      q: 'What does the radar badge mean?',
      a: "When an offer is TRASH but within $3/hr of your target, Rocco flags it with a badge. Handy on Spark, where offers often bump up in small increments — you'll know the moment one hits your number without re-running the math."
    },
    {
      q: 'How do I use the mic / voice entry?',
      a: 'Tap "TAP TO SPEAK" and read the offer out loud — time, miles, and pay. It fills in whatever it recognizes for the tab you\'re on, then calculates automatically. Each tap starts a fresh listening session.'
    },
    {
      q: 'Which fields do I actually need to fill in?',
      a: "Just the ones marked required at the top of each tab — usually estimated time, miles, and the offer amount. Everything under \"+ More details\" is optional and only sharpens the math."
    },
    {
      q: 'Do I have to tap CALCULATE?',
      a: "No — the verdict appears automatically the moment all of a tab's required fields are filled, whether you typed them, spoke them, or filled some in one mic tap and the rest in another (handy if you're switching back and forth to a gig app on a single phone). CALCULATE just jumps you straight to it."
    },
    {
      q: 'What does "+ More details" add?',
      a: "Extras like return-trip miles, or platform-specific settings (like Instacart's shopping speed and driving speed). These aren't required, but including them gives a more accurate $/hr."
    },
    {
      q: 'How is fuel cost calculated?',
      a: "Fuel cost = miles driven × (gas price ÷ your vehicle's MPG). You set your MPG and gas price once in Settings, and every calculation uses that rate automatically."
    },
    {
      q: "What's the difference between Net $/hr and Gross $/hr?",
      a: "Gross $/hr is just the offer divided by time. Net $/hr subtracts your estimated fuel cost first — it's the number that matters most, and the one CASH/TRASH is based on."
    },
    {
      q: 'How do I change my target pay, MPG, or gas price?',
      a: 'Tap the gear icon in the top right to open Settings. Adjust your $/hr target, MPG, and gas price there, then tap SAVE.'
    },
    {
      q: 'How do I switch between light and dark mode?',
      a: 'Tap the sun/moon icon next to the gear icon in the top right. It remembers your choice next time you open the app.'
    },
    {
      q: 'How do I clear the fields on a tab?',
      a: 'Tap the trash-can icon next to CALCULATE. It only clears the fields on the tab you\'re currently viewing.'
    },
    {
      q: 'Can I see the full tutorial again?',
      a: 'Yes — open Settings and tap "TUTORIAL" at the bottom, or tap it right here at the bottom of this FAQ.'
    },
    {
      q: 'What does "Did you take it?" do?',
      a: "Keeps track of the orders you take so you can export them to a spreadsheet and compare the app's estimate to what really happened. Nothing leaves the app unless you copy it out yourself. Find it in Settings under \"ORDER LOG.\""
    }
  ];

  // Builds one collapsed accordion item per FAQ_ITEMS entry; each starts
  // closed and expands on tap via the .faq-item.open CSS rule.
  const faqList = document.getElementById('faqList');
  FAQ_ITEMS.forEach((item, i)=>{
    const wrap = document.createElement('div');
    wrap.className = 'faq-item';
    wrap.innerHTML =
      '<button class="faq-q" type="button">' +
        '<span>'+item.q+'</span>' +
        '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      '</button>' +
      '<div class="faq-a">'+item.a+'</div>';
    wrap.querySelector('.faq-q').addEventListener('click', ()=>{
      wrap.classList.toggle('open');
    });
    faqList.appendChild(wrap);
  });

  const faqModal = document.getElementById('faqModal');
  const settingsModalEl = document.getElementById('settingsModal');
  document.getElementById('openFaqBtn').addEventListener('click', ()=>{
    settingsModalEl.classList.remove('show');
    faqModal.classList.add('show');
  });
  document.getElementById('closeFaqBtn').addEventListener('click', ()=>{
    faqModal.classList.remove('show');
  });
  faqModal.addEventListener('click', (e)=>{
    if(e.target === faqModal) faqModal.classList.remove('show');
  });

