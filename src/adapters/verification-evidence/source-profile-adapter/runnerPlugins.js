import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';

/** Native startup needs JavaScript only; the installed runner compiles its typed implementation. */
export default async function nativeProfilePlugins(root) {
	if (process.env.HARNESS_COLLECT_FILES) return [];
	const { loadConfigFromFile } = await import('vite');
	const environment = { command: 'serve', mode: 'test', profileRoot: root };
	const entry = fileURLToPath(new URL('./runnerConfig.ts', import.meta.url));
	const loaded = await loadConfigFromFile(environment, entry, root, 'silent');
	if (!loaded) throw new Error('Harness source-profile runner configuration did not load.');
	return loaded.config.plugins ?? [];
}
