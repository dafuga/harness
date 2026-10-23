import { fileURLToPath } from 'node:url';
import { SourceProfileAdapter } from './SourceProfileAdapter';
import { profileEnvironment, profileSelection } from './runnerSelection';

/** Vitest-only plugin: the app's ordinary Vite build never installs a source observer. */
export function sourceProfilePlugin(root: string) {
	let adapter: SourceProfileAdapter | undefined;
	return {
		name: 'harness-source-profiles',
		enforce: 'pre' as const,
		config(_config: unknown, environment: { mode: string }) {
			if (environment.mode !== 'test') return undefined;
			const selected = profileSelection(root);
			if (!selected) return undefined;
			adapter = new SourceProfileAdapter(selected);
			const env = profileEnvironment(selected.root, selected.directory);
			Object.assign(process.env, env);
			return {
				test: { env, setupFiles: [fileURLToPath(new URL('./vitestSetup.ts', import.meta.url))] }
			};
		},
		transform(source: string, id: string) {
			const code = adapter?.transform(source, id);
			return code ? { code, map: null } : null;
		}
	};
}

/** The installed Vite loader supplies its original source addresses and resolves TS imports. */
export default function runnerConfiguration(environment: { profileRoot: string }) {
	return { plugins: [sourceProfilePlugin(environment.profileRoot)] };
}
