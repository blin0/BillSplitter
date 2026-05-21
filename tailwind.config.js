/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        // Warm neutral grays — Alabaster Stone light mode palette
        // Dark mode still uses slate-*, which is unaffected here
        gray: {
          50:  '#F7F7F5',
          100: '#EAE9E4',
          200: '#E0DED8',
          300: '#C8C5BD',
          400: '#A8A49D',
          500: '#71716A',
          600: '#57574F',
          700: '#3D3D35',
          800: '#2A2A22',
          900: '#1C1C1A',
          950: '#121210',
        },
        // Warm stone replaces violet/purple accents
        violet: {
          50:  '#F5EDEA', 100: '#EBE0DA', 200: '#D9C8BF', 300: '#C4ADA2',
          400: '#A08880', 500: '#7A6058', 600: '#5E4540', 700: '#4A3530',
          800: '#362622', 900: '#241918', 950: '#180F0D',
        },
        purple: {
          50:  '#F5EDEA', 100: '#EBE0DA', 200: '#D9C8BF', 300: '#C4ADA2',
          400: '#A08880', 500: '#7A6058', 600: '#5E4540', 700: '#4A3530',
          800: '#362622', 900: '#241918', 950: '#180F0D',
        },
        // Muted sage replaces emerald/green
        emerald: {
          50:  '#EEF0E8', 100: '#DCE0D2', 200: '#BEC9B0', 300: '#9DAF8C',
          400: '#7A926A', 500: '#5E7252', 600: '#4C5D42', 700: '#3C4A34',
          800: '#2D3828', 900: '#1E261C', 950: '#11160F',
        },
        green: {
          50:  '#EEF0E8', 100: '#DCE0D2', 200: '#BEC9B0', 300: '#9DAF8C',
          400: '#7A926A', 500: '#5E7252', 600: '#4C5D42', 700: '#3C4A34',
          800: '#2D3828', 900: '#1E261C', 950: '#11160F',
        },
        // Dusty rose replaces rose/red
        rose: {
          50:  '#F5EEEB', 100: '#EBD9D4', 200: '#D9BFBA', 300: '#C19E98',
          400: '#A87B74', 500: '#8B5850', 600: '#6E4440', 700: '#553432',
          800: '#3D2724', 900: '#271918', 950: '#190F0E',
        },
        red: {
          50:  '#F5EEEB', 100: '#EBD9D4', 200: '#D9BFBA', 300: '#C19E98',
          400: '#A87B74', 500: '#8B5850', 600: '#6E4440', 700: '#553432',
          800: '#3D2724', 900: '#271918', 950: '#190F0E',
        },
        // Warm gold replaces amber
        amber: {
          50:  '#F5F0E2', 100: '#EDE4C6', 200: '#D9C88C', 300: '#C4AA52',
          400: '#A88C34', 500: '#8B7020', 600: '#6E5818', 700: '#524212',
          800: '#3D310D', 900: '#292208', 950: '#1A1505',
        },
        // Muted teal replaces cyan
        cyan: {
          50:  '#EFF3F0', 100: '#DAE6DC', 200: '#B8CEBF', 300: '#91B09A',
          400: '#6C9377', 500: '#507860', 600: '#3E6050', 700: '#2E4A3C',
          800: '#203628', 900: '#152418', 950: '#0C1610',
        },
      },
    },
  },
  plugins: [],
}
