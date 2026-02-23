/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        'card-hover': '0 8px 25px -5px rgb(0 0 0 / 0.08), 0 4px 10px -4px rgb(0 0 0 / 0.06)',
        'glow': '0 0 40px -10px rgb(16 185 129 / 0.25)',
        'inner-soft': 'inset 0 1px 0 0 rgb(255 255 255 / 0.05)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.35s ease-out'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }
      },
      backgroundImage: {
        'mesh-light': 'radial-gradient(at 40% 0%, rgb(167 243 208 / 0.15) 0px, transparent 50%), radial-gradient(at 80% 50%, rgb(94 234 212 / 0.12) 0px, transparent 50%), radial-gradient(at 0% 80%, rgb(196 181 253 / 0.08) 0px, transparent 50%)',
        'mesh-dark': 'radial-gradient(at 40% 0%, rgb(16 185 129 / 0.12) 0px, transparent 50%), radial-gradient(at 80% 50%, rgb(20 184 166 / 0.1) 0px, transparent 50%)'
      }
    }
  },
  plugins: []
}
