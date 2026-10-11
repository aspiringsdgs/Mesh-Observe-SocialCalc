import { fileURLToPath, URL } from 'node:url'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    nodePolyfills(),
    devtools({ eventBusConfig: { enabled: false } }), // disable devtools server to avoid port conflicts
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // socialcalc-ai's root entry pulls in its Ionic/React editor UI; the read-only preview
      // only needs the spreadsheet engine, which the package does not export on its own.
      'socialcalc-core': fileURLToPath(
        new URL('./node_modules/socialcalc-ai/core/index.js', import.meta.url),
      ),
    },
  },
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'production'),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
})
