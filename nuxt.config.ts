import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-23',
  devtools: { enabled: true },

  // Tailwind CSS 4 integration
  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
    // Optimize deps to exclude native modules
    optimizeDeps: {
      exclude: ['better-sqlite3']
    }
  },

  // Nitro server configuration for native modules
  nitro: {
    // Use node-server preset which handles native modules better
    preset: 'node-server',
    // Externalize native modules
    externals: {
      external: ['better-sqlite3']
    },
    // Module resolution
    moduleSideEffects: ['better-sqlite3']
  },

  // Runtime configuration
  runtimeConfig: {
    databasePath: './data/jobs.db',
    browserDataPath: './.browser-data',
  }
})
