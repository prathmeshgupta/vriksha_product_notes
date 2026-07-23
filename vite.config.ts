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
// Base path for built asset URLs. Defaults to '/' for local dev and for any
// deploy that serves this build from a domain root. The R8 staging workflow
// (.github/workflows/deploy-rebuild-preview.yml) overrides this via
// VITE_BASE_PATH so asset URLs resolve correctly when the build is published
// under a subfolder (rebuild-preview/) of the live GitHub Pages site instead
// of at the root -- see rebuild/ROADMAP.md R8.
const basePath = process.env.VITE_BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base: basePath,
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
