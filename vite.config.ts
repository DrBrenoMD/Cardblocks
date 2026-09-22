import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
   resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // Usando o path.resolve para forçar a busca dentro do node_modules
        'script-loader!sql.js': path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'),
        'sql.js': path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.js'),
        'anki-apkg-export': 'anki-apkg-export/dist/index.js'
      },
    },
    optimizeDeps: {
      include: ['anki-apkg-export', 'sql.js']
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
