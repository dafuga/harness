import { execFileSync } from 'node:child_process';
import { expect } from '../../../../test/verificationExpect';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
/** Valid pages added in ordinary authoring order, intentionally different from lexical order. */
export async function sveltePreviewFixture(root: string, dependencies: string) {
	await symlink(dependencies, join(root, 'node_modules'), 'dir');
	const routes = ['pages', 'shells', 'components', 'configs', 'functions', 'services', 'a-first'];
	const files: Record<string, string> = {
		'package.json': '{"type":"module"}',
		'vite.config.mjs':
			'import {sveltekit} from "@sveltejs/kit/vite";export default {plugins:[sveltekit()]};',
		'svelte.config.js': 'export default {};',
		'src/app.html':
			'<!doctype html><html><head>%sveltekit.head%</head><body><div style="display:contents">%sveltekit.body%</div></body></html>'
	};
	for (const name of routes) files[`src/routes/${name}/+page.svelte`] = `<h1>${name}</h1>`;
	for (const [path, text] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), text);
	}
	return routes;
}

export async function assertPreviewRoutes(
	root: string,
	url: string,
	names: string[],
	log: () => string
) {
	try {
		await expect
			.poll(
				async () => {
					try {
						return (await (await fetch(url + '/pages')).text()).includes('node_ids:');
					} catch {
						return false;
					}
				},
				{ timeout: 20000 }
			)
			.toBe(true);
	} catch (cause) {
		throw new Error('Preview fixture did not start: ' + log(), { cause });
	}
	const pages = await Promise.all(
		names.map(async (name) => ({ name, html: await (await fetch(url + '/' + name)).text() }))
	);
	execFileSync('bun', ['x', 'svelte-kit', 'sync'], { cwd: root, stdio: 'pipe' });
	for (const page of pages) {
		const ids = JSON.parse(/node_ids: (\[[^\]]+\])/.exec(page.html)![1]) as number[];
		const leaf = await (
			await fetch(url + `/.svelte-kit/generated/client/nodes/${ids.at(-1)}.js`)
		).text();
		expect(leaf, 'managed routes must hydrate their own components').toContain(
			`/${page.name}/+page.svelte`
		);
	}
}
