import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		alias: { $shared: '../reports/src/components' },
		prerender: { entries: [] }
	},
	preprocess: vitePreprocess()
};
