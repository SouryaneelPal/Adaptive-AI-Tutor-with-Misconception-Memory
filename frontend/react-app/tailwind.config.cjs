/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        px: {
          bg:        '#3d1f6e',
          bg2:       '#2a1050',
          purple:    '#5b3a8e',
          magenta:   '#ff00cc',
          cyan:      '#00ffee',
          hotpink:   '#ff4fa3',
          yellow:    '#ffe94a',
          green:     '#4aff91',
          orange:    '#ff8c1a',
          red:       '#ff3355',
          white:     '#f0e8ff',
          dark:      '#1a0a2e',
          border:    '#000000',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
        body:  ['Inter', 'sans-serif'],
      },
      boxShadow: {
        pixel:   '4px 4px 0px #000',
        'pixel-lg': '6px 6px 0px #000',
        'pixel-inset': 'inset 2px 2px 0px rgba(255,255,255,0.3), inset -2px -2px 0px rgba(0,0,0,0.4)',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-10px)' },
        },
        blink: {
          '0%,100%': { opacity: '1' },
          '50%':     { opacity: '0' },
        },
        bounce2: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-6px)' },
        },
        wiggle: {
          '0%,100%': { transform: 'rotate(-3deg)' },
          '50%':     { transform: 'rotate(3deg)' },
        },
        walk: {
          '0%':   { transform: 'translateX(-120px)' },
          '100%': { transform: 'translateX(0px)' },
        },
        glitch: {
          '0%':   { textShadow: '2px 0 #ff00cc, -2px 0 #00ffee' },
          '25%':  { textShadow: '-2px 0 #ff00cc, 2px 0 #00ffee' },
          '50%':  { textShadow: '2px 0 #ffe94a, -2px 0 #ff3355' },
          '75%':  { textShadow: '-2px 0 #ffe94a, 2px 0 #ff3355' },
          '100%': { textShadow: '2px 0 #ff00cc, -2px 0 #00ffee' },
        },
        confetti: {
          '0%':   { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-200px) rotate(720deg)', opacity: '0' },
        },
        scanline: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '0 100%' },
        },
        cloudmove: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100vw)' },
        },
        busmove: {
          '0%':   { transform: 'translateX(-300px)' },
          '100%': { transform: 'translateX(110vw)' },
        },
        startwink: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%':     { opacity: '0.4', transform: 'scale(0.8)' },
        },
        hpbar: {
          '0%':   { width: '0%' },
          '100%': { width: '100%' },
        },
      },
      animation: {
        float:     'float 3s ease-in-out infinite',
        blink:     'blink 1s step-end infinite',
        bounce2:   'bounce2 0.8s ease-in-out infinite',
        wiggle:    'wiggle 0.5s ease-in-out infinite',
        walk:      'walk 0.8s ease-out forwards',
        glitch:    'glitch 0.3s ease-in-out infinite',
        confetti:  'confetti 1.5s ease-out forwards',
        scanline:  'scanline 4s linear infinite',
        cloudmove: 'cloudmove 18s linear infinite',
        busmove:   'busmove 8s linear infinite',
        startwink: 'startwink 1.5s ease-in-out infinite',
        hpbar:     'hpbar 1.5s ease-out forwards',
      },
    },
  },
  plugins: [],
};

