import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This repo's index.html at the root belongs to the FROZEN app (the live,
// production single-file app on the `main` branch) -- it is NOT this Vite
// project's entry point. The rebuild's entry point is `app.html` instead,
// specifically to avoid ever colliding with or overwriting the frozen app's
// index.html again (this happened once already during R0 setup, when a
// robocopy step overwrote the real 200KB frozen app with Vite's default
// 370-byte stub -- recovered from the `main` branch, but the root cause was
// exactly this naming collision, hence the rename).
//
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: 'app.html',
    },
  },
  server: {
    open: '/app.html',
  },
})
