// Theme selection, shared by index.html and about.html.
//
// Loaded as a classic blocking script in <head> so the .dark class is set
// before first paint - deferring it would flash the light theme.
(function () {
  const THEME_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

  async function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const savedTime = localStorage.getItem('theme_timestamp');
    const now = Date.now();

    let isDark = false;
    let useAuto = true;

    // Check if a manual preference exists and hasn't expired
    if (savedTheme && savedTime && (now - parseInt(savedTime)) < THEME_EXPIRY) {
      isDark = savedTheme === 'dark';
      useAuto = false;
    } else {
      // Clear expired preference
      localStorage.removeItem('theme');
      localStorage.removeItem('theme_timestamp');

      // Default to automatic logic (initial quick check)
      const hour = new Date().getHours();
      isDark = hour < 6 || hour >= 19;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        isDark = true;
      }
    }

    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // Refine with precise sunrise/sunset if using auto mode
    if (useAuto) {
      try {
        const geoRes = await fetch('https://ipapi.co/json/');
        const geo = await geoRes.json();
        if (geo.latitude && geo.longitude) {
          const sunRes = await fetch(`https://api.sunrise-sunset.org/json?lat=${geo.latitude}&lng=${geo.longitude}&formatted=0`);
          const sunData = await sunRes.json();
          if (sunData.status === 'OK') {
            const sunrise = new Date(sunData.results.sunrise);
            const sunset = new Date(sunData.results.sunset);
            const currentTime = new Date();
            isDark = currentTime < sunrise || currentTime > sunset;

            if (isDark) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
          }
        }
      } catch (e) { }
    }
  }

  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme_timestamp', Date.now().toString());
  };

  initTheme();
})();
