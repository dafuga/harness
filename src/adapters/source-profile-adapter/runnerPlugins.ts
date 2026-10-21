import { fileURLToPath } from 'node:url';

/** Shared adoption boundary; normal configuration tests decide when runners are accepted. */
export async function sourceProfilePlugins(root: string) {
	// Let the installed runner load its TS graph; native Node cannot resolve extensionless TS imports.
	const { loadConfigFromFile } = await import('vite');
	const environment = { command: 'serve' as const, mode: 'test', profileRoot: root };
	const entry = fileURLToPath(new URL('./runnerConfig.ts', import.meta.url));
	const loaded = await loadConfigFromFile(environment, entry, root, 'silent');
	if (!loaded) throw new Error('Harness source-profile runner configuration did not load.');
	return loaded.config.plugins ?? [];
}
