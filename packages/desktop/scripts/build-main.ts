// @harness-uid u_l6w3l34t4a
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { ExpectedCliError } from '../../../src/core/development-tooling/errors';
const jsoncParser: Bun.BunPlugin = {
	name: 'bundle-jsonc-parser-module',
	setup(build) {
		build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
			path: Bun.resolveSync('jsonc-parser/lib/esm/main.js', import.meta.dir)
		}));
	}
};
export const desktopNodeOptions = {
	target: 'node' as const,
	format: 'cjs' as const,
	external: ['electron'],
	plugins: [jsoncParser],
	outdir: 'dist',
	sourcemap: 'external' as const
};

async function buildDesktopMain() {
	await mkdir('dist', { recursive: true });
	for (const [entry, out] of [
		['src/initializers/initializeDesktop.ts', 'main.cjs'],
		['src/initializers/initializePreload.ts', 'preload.cjs']
	]) {
		const result = await Bun.build({ ...desktopNodeOptions, entrypoints: [entry], naming: out });
		if (!result.success) throw new ExpectedCliError(result.logs.map(String).join('\n'));
		execFileSync('node', ['--check', 'dist/' + out], { stdio: 'inherit' });
	}
}
if (import.meta.main) await buildDesktopMain();
