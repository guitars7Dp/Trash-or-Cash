  // ---------- Theme (light/dark) ----------
  // Mirrors the color tokens defined in the <style> block's :root and
  // html[data-theme="light"] rules. The CSS versions are a fallback only
  // (see the comment on that CSS block); this JS copy is what the toggle
  // below actually applies, as inline custom properties, since some
  // constrained webview/preview contexts don't reliably re-apply
  // [data-theme] attribute-selector CSS even though they do run JS.
  const THEMES = {
    dark: {
      bg:'#131313', panel:'#1C1C1C', panel2:'#232323', line:'#383838', lineBright:'#4a4a4a',
      text:'#F4F1EA', muted:'#9C9C94', cash:'#3ECF6E', cashDim:'#163821',
      trash:'#FF5A36', trashDim:'#3D1D14', caution:'#FFD23F', wordmarkOutline:'#201812'
    },
    light: {
      bg:'#F5F2E9', panel:'#FFFFFF', panel2:'#ECE7D8', line:'#D9D3C0', lineBright:'#B8B096',
      text:'#201D16', muted:'#3A362A', cash:'#1E8F4C', cashDim:'#DCF3E4',
      trash:'#D8471E', trashDim:'#FCE2D6', caution:'#B8790A', wordmarkOutline:'#0A0705'
    }
  };
  // Maps each THEMES key to the CSS custom property it drives.
  const VAR_MAP = {
    bg:'--bg', panel:'--panel', panel2:'--panel-2', line:'--line', lineBright:'--line-bright',
    text:'--text', muted:'--muted', cash:'--cash', cashDim:'--cash-dim',
    trash:'--trash', trashDim:'--trash-dim', caution:'--caution', wordmarkOutline:'--wordmark-outline'
  };
  // Reads the saved theme choice, defaulting to light for a first-time visitor.
  function loadTheme(){
    try{ return localStorage.getItem('toc_theme') || 'light'; }catch(e){ return 'light'; }
  }
  // Applies a theme by writing every color as an inline custom property on
  // <html> (not by relying on the [data-theme] CSS selector alone — see
  // the THEMES comment above for why), sets data-theme for the CSS that
  // does key off it (the light/dark image-swap rules), and swaps the
  // sun/moon icon in the header button.
  function applyTheme(theme){
    const colors = THEMES[theme] || THEMES.dark;
    const root = document.documentElement.style;
    Object.keys(VAR_MAP).forEach(key=>{
      root.setProperty(VAR_MAP[key], colors[key]);
    });
    document.documentElement.setAttribute('data-theme', theme);
    const sun = document.getElementById('themeIconSun');
    const moon = document.getElementById('themeIconMoon');
    if(sun && moon){
      sun.style.display = theme === 'light' ? 'none' : 'block';
      moon.style.display = theme === 'light' ? 'block' : 'none';
    }
  }
  let currentTheme = loadTheme();
  applyTheme(currentTheme);
  document.getElementById('themeBtn').addEventListener('click', ()=>{
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(currentTheme);
    try{ localStorage.setItem('toc_theme', currentTheme); }catch(e){}
  });

