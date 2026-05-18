import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  // Next använder den automatiska JSX-runtimen (komponentfiler importerar
  // inte React). Säkerställ samma transform i tester så .tsx-komponenter
  // kan renderas (t.ex. renderToStaticMarkup-smoketester).
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
