import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	kit: {
		adapter: adapter(),
		alias: { $desktop: '../desktop/src', $shared: './src/components' }
	},
	preprocess: vitePreprocess()
};
