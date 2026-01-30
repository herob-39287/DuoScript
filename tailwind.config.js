export default {
  content: ['./index.html', './**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#1c1917', // stone-900 equivalent
        foreground: '#e7e5e4', // stone-200
        primary: {
          DEFAULT: '#ea580c', // orange-600
          hover: '#f97316', // orange-500
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#292524', // stone-800
          hover: '#44403c', // stone-700
          foreground: '#a8a29e', // stone-400
        },
        muted: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          foreground: '#78716c', // stone-500
        },
        destructive: {
          DEFAULT: '#ef4444', // red-500
          foreground: '#ffffff',
          muted: 'rgba(244, 63, 94, 0.2)', // rose-500/20
          text: '#fb7185', // rose-400
        },
        accent: {
          DEFAULT: 'rgba(234, 88, 12, 0.1)', // orange-500/10
          foreground: '#fb923c', // orange-400
        },
        indigo: {
          DEFAULT: '#4f46e5',
          hover: '#6366f1',
          muted: 'rgba(79, 70, 229, 0.2)',
          foreground: '#818cf8',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        slideInLeft: {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
