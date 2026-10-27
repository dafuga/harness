import { execFileSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
const jsoncParser: Bun.BunPlugin = {
	name: 'bundle-jsonc-parser-module',
	setup(build) {
		build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
			path: Bun.resolveSync('jsonc-parser/lib/esm/main.js', import.meta.dir)
		}));
	}
};
const sandboxResolver: Bun.BunPlugin = {
	name: 'bundle-sandbox-runtime-resolver',
	setup(build) {
		build.onLoad(
			{ filter: /[\\/]src[\\/]adapters[\\/]agents-providers[\\/]ModuleTaskSandboxAdapter\.ts$/ },
			async ({ path }) => {
				const source = await readFile(path, 'utf8');
				const parts = source.split('createRequire(import.meta.url)');
				if (parts.length !== 2) throw new Error('Unexpected sandbox runtime resolver.');
				return { contents: parts.join('createRequire(__filename)'), loader: 'ts' };
			}
		);
	}
};
export const desktopNodeOptions = {
	target: 'node' as const,
	format: 'cjs' as const,
	external: ['electron'],
	plugins: [jsoncParser, sandboxResolver],
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
		if (!result.success) throw new Error(result.logs.map(String).join('\n'));
		execFileSync('node', ['--check', 'dist/' + out], { stdio: 'inherit' });
	}
}
if (import.meta.main) await buildDesktopMain();
