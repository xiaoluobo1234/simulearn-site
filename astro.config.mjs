import { defineConfig } from 'astro/config';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
  },

  output: "hybrid",
  adapter: cloudflare()
});