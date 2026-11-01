import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { atomicComponents } from '../../src/templates/development-tooling/atomicPreprocess.js';

export default {
	kit: {
		adapter: adapter({ fallback: 'index.html' }),
		alias: { $reports: '../reports/src', $desktop: './src', $shared: '../reports/src/components' },
		prerender: { entries: [] }
	},
	preprocess: [atomicComponents(), vitePreprocess()]
};
