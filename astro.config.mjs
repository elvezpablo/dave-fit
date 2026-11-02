// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Exercise photos are pre-baked to webp by scripts/build-images.mjs,
    // so we never need a runtime image service.
    imageService: 'passthrough',
    platformProxy: { enabled: true },
  }),
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
