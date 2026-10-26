import { fileURLToPath } from 'node:url';
import { SourceProfileAdapter } from './SourceProfileAdapter';
import { profileEnvironment, profileSelection } from './runnerSelection';
import { CaseResultAdapter } from '../CaseResultAdapter';

/** Vitest-only plugin: the app's ordinary Vite build never installs a source observer. */
export function sourceProfilePlugin(root: string) {
	let adapter: SourceProfileAdapter | undefined;
	return {
		name: 'harness-source-profiles',
		enforce: 'pre' as const,
		config(config: { test?: { reporters?: unknown[] } }, environment: { mode: string }) {
			if (environment.mode !== 'test') return undefined;
			const reporting = process.env.HARNESS_VERIFY_CASE_ROOT
				? { reporters: [...(config.test?.reporters ?? ['default']), new CaseResultAdapter()] }
				: {};
			const selected = profileSelection(root);
			if (!selected) return { test: reporting };
			adapter = new SourceProfileAdapter(selected);
			const env = profileEnvironment(selected.root, selected.directory);
			Object.assign(process.env, env);
			return {
				test: {
					env,
					...reporting,
					setupFiles: [fileURLToPath(new URL('./vitestSetup.ts', import.meta.url))]
				}
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
