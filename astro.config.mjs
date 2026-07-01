import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://simulearn.cn',
  i18n: {
    defaultLocale: 'zh',
    locales: ['zh', 'en'],
  },
  integrations: [sitemap()],
});
