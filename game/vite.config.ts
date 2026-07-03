import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// Deployed to GitHub Pages as a project site (https://<owner>.github.io/loveletterlegend/),
// so all built asset URLs need this base path.
export default defineConfig({
  base: '/loveletterlegend/',
  plugins: [react()],
})
