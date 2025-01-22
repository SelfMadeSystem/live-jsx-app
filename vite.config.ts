import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '/web_modules/react': 'react',
      '/web_modules/react-dom': 'react-dom',
    }
  }
})
