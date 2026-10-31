import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Run `npm run icons` after changing public/favicon.svg. The generated PNGs are committed.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background: '#1c2124' } },
    apple: { ...minimal2023Preset.apple, padding: 0.1, resizeOptions: { background: '#1c2124' } },
  },
  images: ['public/favicon.svg'],
})
