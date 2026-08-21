import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Defaults to deploying at strlabs.app/cube/. Override at build time if the
// path changes, e.g. BASE_PATH=/apps/cube/ npm run build
export default defineConfig({
  base: process.env.BASE_PATH || '/cube/',
  plugins: [react()],
})
