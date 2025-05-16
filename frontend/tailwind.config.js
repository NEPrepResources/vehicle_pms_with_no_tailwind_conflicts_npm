/** @type {import('@tailwindcss/postcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8', 
        secondary: '#3B82F6', 
        accent: '#DBEAFE', 
        chartRed: '#EF4444', 
        chartGreen: '#10B981',
        chartYellow: '#F59E0B',
      },
    },
  },
  plugins: [],
}