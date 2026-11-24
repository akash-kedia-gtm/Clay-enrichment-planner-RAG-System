/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clay: {
          orange: '#FF4713',
          'orange-hover': '#E03E0F',
          'orange-light': '#FFF0EB',
          'orange-border': '#FFD5C7',
          canvas: '#FAF9F5',
          surface: '#FFFFFF',
          'surface-warm': '#F7F4ED',
          'surface-card': '#FAF7F2',
          border: '#E5E0D6',
          'border-subtle': '#EFEBE2',
          ink: '#121316',
          'ink-muted': '#636772',
          'ink-subtle': '#8C909B',
          lime: '#CBD810',
          'lime-light': '#F5F8D5',
          'lime-text': '#4A5404',
          blue: '#429EFF',
          'blue-light': '#EDF5FF',
          'blue-text': '#1E6FD9',
          pink: '#FF4D8B',
          lavender: '#B8A4ED',
          teal: '#1A3A3A',
          ochre: '#E8B94A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Space Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace']
      }
    },
  },
  plugins: [],
}
