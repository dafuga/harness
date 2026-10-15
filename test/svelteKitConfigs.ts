import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The config `svelte-kit sync` writes; a SvelteKit package's tsconfig.json extends it. */
const generated = './.svelte-kit/tsconfig.json';
const extendsGenerated = /"extends"\s*:\s*"\.\/\.svelte-kit\/tsconfig\.json"/;

/**
 * The packages whose tsconfig.json extends the generated SvelteKit config while it is not there,
 * as in a fresh checkout. Root tests import modules of such packages, and loading those modules
 * resolves that tsconfig, so the config must exist before Vitest collects any test.
 */
export function unsyncedKitPackages(root: string): string[] {
	const packages = join(root, 'packages');
	return readdirSync(packages)
		.filter((name) => {
			const config = join(packages, name, 'tsconfig.json');
			if (!existsSync(config) || !extendsGenerated.test(readFileSync(config, 'utf8'))) return false;
			return !existsSync(join(packages, name, generated));
		})
		.sort();
}

/** Vitest global setup: generates each missing SvelteKit config once, before collection. */
export default function setup(): void {
	const root = resolve(import.meta.dirname, '..');
	for (const name of unsyncedKitPackages(root)) {
		const cwd = join(root, 'packages', name);
		const synced = spawnSync('bun', ['run', 'svelte-kit', 'sync'], { cwd, stdio: 'inherit' });
		if (synced.status !== 0) throw new Error(`svelte-kit sync failed in packages/${name}`);
	}
}
