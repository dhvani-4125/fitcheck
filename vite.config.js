import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the same build works at a domain root (Netlify, Vercel, Docker)
// and under a sub-path (GitHub Pages: /<repo>/).
export default defineConfig({
  plugins: [react()],
  base: './',
});
