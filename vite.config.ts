import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
      '/web_modules/react-jsx-runtime.js': 'react/jsx-runtime',
      '/web_modules/react-dom.js': 'react-dom',
      '/web_modules/react-dom-client.js': 'react-dom/client',
      '/esm/vs': '/node_modules/monaco-editor/esm/vs',
      '/min/vs': '/node_modules/monaco-editor/min/vs',
      'util': './src/stubs/util.ts',
      'util-deprecate': './src/stubs/util-deprecate.ts',
      'vscode-emmet-helper-bundled':
        './src/stubs/vscode-emmet-helper-bundled.ts',
      '/service-worker.js': './src/service.worker.ts',
    },
  },
  build: {
    sourcemap: true, // TODO: Remove when I figure out why it doesn't work
    rollupOptions: {
      input: {
        main: 'index.html',
        react: 'public/react.js',
        'react-dom': 'public/react-dom.js',
        'react-dom-client': 'public/react-dom-client.js',
        'react-jsx-runtime': 'public/react-jsx-runtime.js',
        'service-worker': 'service.worker.ts',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
      },
      preserveEntrySignatures: 'strict',
    },
  },
});
