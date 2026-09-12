/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './about.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        paper: '#f4f1ea',
        ink: '#1c1c1c',
      },
      fontFamily: {
        serif: ['Merriweather', 'serif'],
        masthead: ['"Playfair Display"', 'serif'],
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
};
