import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: [
        'app/api/next-menu/**',
        'app/plan/**',
        'lib/saveMenuParser.ts'
      ]
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') }
  }
})
