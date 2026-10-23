import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
	kit: {
		adapter: adapter(),
		// The same shared workspace paths the cross-platform component fixture build resolves.
		alias: { $desktop: '../desktop/src', $shared: './src/components' }
	},
	preprocess: vitePreprocess()
};
