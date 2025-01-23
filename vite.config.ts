import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/monaco-editor/min/vs',
          dest: 'min',
        },
        {
          src: 'node_modules/monaco-editor/esm/vs',
          dest: 'esm',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '/web_modules/react.js': 'react',
      '/web_modules/react-dom.js': 'react-dom',
      '/web_modules/react-dom-client.js': 'react-dom/client',
      '/esm/vs': '/node_modules/monaco-editor/esm/vs',
      '/min/vs': '/node_modules/monaco-editor/min/vs',
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
