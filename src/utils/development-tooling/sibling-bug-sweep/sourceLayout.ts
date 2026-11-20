// @harness-uid u_wwerrde2nk
import { extname } from 'node:path';
import type { SourceTree } from '../../../core/development-tooling/sourceTypes';

export async function sourceLayout(tree: SourceTree) {
	const paths = (await tree.list()).map((entry) => entry.path);
	const groups = paths
		.filter((path) => path.includes('/'))
		.map(
			(path) =>
				path
					.split('/')
					.slice(0, Math.min(path.split('/').length - 1, 2))
					.join('/') + '/'
		);
	return {
		frequentExtensions: mostCommon(paths.map(extname).filter(Boolean), 12),
		frequentDirectories: mostCommon(groups, 22),
		frameworkConfigs: paths
			.filter((path) =>
				/(^|\/)(svelte|vite|next|nuxt|astro|angular|webpack)\.config\.[a-z]+$/.test(path)
			)
			.slice(0, 16)
	};
}

function mostCommon(items: string[], limit: number) {
	const counts = new Map<string, number>();
	for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}
