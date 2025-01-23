import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '/web_modules/react.js': 'react',
      '/web_modules/react-dom.js': 'react-dom',
      '/web_modules/react-dom-client.js': 'react-dom/client',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        react: 'public/react.js',
        'react-dom': 'public/react-dom.js',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        preserveModules: true,
      },
      preserveEntrySignatures: 'strict',
    },
  },
});
