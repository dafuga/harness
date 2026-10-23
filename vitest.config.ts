import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resourceWorkers } from './src/utils/execution-runtimes/resourceWorkers';
/** Test discovery stays private to the config which resolves it for each workspace. */
const testDiscoveryExcludes = [
	'packages/**',
	'**/node_modules/**',
	'dist/**',
	'work/**',
	'.cache/**'
];
// A workspace without a config of its own inherits this one, and Vitest resolves relative paths
// from that workspace. A helper this config owns is therefore named from this file; `setupFiles`
// stays relative on purpose, so each such workspace runs its own `test/setup.ts`.
const owned = (path: string) => fileURLToPath(new URL(path, import.meta.url));
/** Shared low-memory default: CPU count must not multiply whole test runtimes. */
export const testWorkers = { minWorkers: 1, maxWorkers: 1, ...resourceWorkers(process.env, 1) };
/** Load source observers only for evidence runs with a committed unit registry. */
export async function profilingPlugins() {
	const requested = process.env.HARNESS_RUNTIME_PROFILE_DIR ?? process.env.HARNESS_EVIDENCE_DIR;
	if (!requested || !existsSync(owned('./specification/units'))) return [];
	const { default: sourceProfilePlugins } = await import(
		owned('./src/adapters/verification-evidence/source-profile-adapter/runnerPlugins.js')
	);
	return sourceProfilePlugins(owned('./'));
}
export default defineConfig(async () => ({
	plugins: await profilingPlugins(),
	test: {
		...testWorkers,
		// A fresh checkout has no generated SvelteKit configs; root tests resolve them.
		globalSetup: [owned('./test/svelteKitConfigs.ts')],
		setupFiles: ['test/setup.ts'],
		exclude: testDiscoveryExcludes
	}
}));
