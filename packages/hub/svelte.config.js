import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { atomicComponents } from '../../src/templates/development-tooling/atomicPreprocess.js';
export default {
	kit: {
		adapter: adapter(),
		alias: { $desktop: '../desktop/src', $shared: '../reports/src/components' }
	},
	preprocess: [atomicComponents(), vitePreprocess()]
};
