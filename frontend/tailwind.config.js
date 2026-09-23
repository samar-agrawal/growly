/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dfeaff',
          500: '#2d6cdf',
          600: '#255bc1',
        },
        success: '#2bb673',
        warning: '#f4b942',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(30, 41, 59, 0.08)',
      },
    },
  },
  plugins: [],
};
