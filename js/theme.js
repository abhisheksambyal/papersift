// Theme selection, shared by index.html and about.html.
//
// Loaded as a classic blocking script in <head> so the .dark class is set
// before first paint - deferring it would flash the light theme.
(function () {
  const SUN_CACHE_KEY = 'theme_sun_cache';

  const setDark = (isDark) => document.documentElement.classList.toggle('dark', isDark);
  const isNightAt = (sunrise, sunset) => {
    const now = new Date();
    return now < new Date(sunrise) || now > new Date(sunset);
  };

  async function initTheme() {
    // A manual choice always wins and never expires.
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return setDark(savedTheme === 'dark');

    // Quick guess shown before first paint.
    const hour = new Date().getHours();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(prefersDark || hour < 6 || hour >= 19);

    // Refine with precise sunrise/sunset, cached per day so repeat page
    // loads don't re-fetch (and re-race) on every navigation.
    const today = new Date().toDateString();
    let cache;
    try { cache = JSON.parse(localStorage.getItem(SUN_CACHE_KEY)); } catch (e) { }
    if (cache && cache.date === today) return setDark(isNightAt(cache.sunrise, cache.sunset));

    try {
      const geo = await (await fetch('https://ipapi.co/json/')).json();
      if (!geo.latitude || !geo.longitude) return;
      const sun = await (await fetch(`https://api.sunrise-sunset.org/json?lat=${geo.latitude}&lng=${geo.longitude}&formatted=0`)).json();
      if (sun.status !== 'OK') return;

      const { sunrise, sunset } = sun.results;
      localStorage.setItem(SUN_CACHE_KEY, JSON.stringify({ date: today, sunrise, sunset }));
      // Don't stomp on a manual toggle made while this fetch was in flight.
      if (!localStorage.getItem('theme')) setDark(isNightAt(sunrise, sunset));
    } catch (e) { }
  }

  window.toggleTheme = function () {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  initTheme();
})();
