/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        instagram: {
          border: '#dbdbdb',
          darkBorder: '#262626',
          bg: '#fafafa',
          blue: '#0095f6',
          hoverBlue: '#1877f2',
          like: '#ed4956',
        },
      },
    },
  },
  plugins: [],
}
