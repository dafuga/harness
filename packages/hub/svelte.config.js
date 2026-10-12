import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default {
	kit: {
		adapter: adapter(),
		alias: { $desktop: '../desktop/src', $shared: '../reports/src/components' }
	},
	preprocess: vitePreprocess()
};
