/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        void: '#0a0a0f',
        'void-light': '#12121a',
        'void-lighter': '#1a1a26',
        'neon-cyan': '#00f0ff',
        'neon-magenta': '#ff0080',
        'neon-lime': '#ccff00',
        'neon-violet': '#8b5cf6',
        'neon-orange': '#ff6b00',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          from: { boxShadow: '0 0 5px #00f0ff, 0 0 10px #00f0ff' },
          to: { boxShadow: '0 0 20px #00f0ff, 0 0 40px #00f0ff' },
        },
      },
    },
  },
  plugins: [],
};
