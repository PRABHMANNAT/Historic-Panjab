import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import {fileURLToPath,URL} from 'node:url';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins:[react()],
  css:{postcss:{plugins:[tailwindcss()]}},
  resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
  build:{outDir:'dist-vercel',emptyOutDir:true},
});
