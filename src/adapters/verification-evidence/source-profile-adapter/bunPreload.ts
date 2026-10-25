import { plugin } from 'bun';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { SourceProfileAdapter } from './SourceProfileAdapter';
import { profileSelection } from './runnerSelection';

let pending: Promise<SourceProfileAdapter | null> | undefined;
const root = preloadRoot();
if (root) {
	const prefix = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const filter = new RegExp(`^${prefix}/(?!.*node_modules/).*\\.(?:[cm]?[jt]s|[jt]sx)$`);
	plugin({
		name: 'harness-source-profiles',
		setup(build) {
			build.onLoad({ filter }, async ({ path }) => {
				const source = await Bun.file(path).text();
				const adapter = bootstrapSource(path) ? null : await sourceAdapter(root);
				const code = adapter?.transform(source, path);
				const transpiler = new Bun.Transpiler({ loader: loader(path), trimUnusedImports: true });
				return { contents: transpiler.transformSync(code ?? source), loader: 'js' };
			});
		}
	});
}

/** Foreign tools pay no compiler or registry setup unless they import project source. */
function preloadRoot(): string | null {
	if (process.env.HARNESS_COLLECT_FILES || benchmarkBoundary()) return null;
	const directory = process.env.HARNESS_RUNTIME_PROFILE_DIR;
	const evidence = process.env.TAKE_SCREENSHOT === '1' && Boolean(process.env.HARNESS_EVIDENCE_DIR);
	if (!directory && !evidence) return null;
	try {
		return process.env.HARNESS_RUNTIME_PROFILE_ROOT
			? realpathSync(process.env.HARNESS_RUNTIME_PROFILE_ROOT)
			: null;
	} catch {
		return null;
	}
}

function sourceAdapter(root: string): Promise<SourceProfileAdapter | null> {
	pending ??= (async () => {
		const { SourceProfileAdapter } = await import('./SourceProfileAdapter');
		const selected = profileSelection(root);
		return selected ? new SourceProfileAdapter(selected) : null;
	})();
	return pending;
}

/** Bootstrap imports must never await the adapter that is loading those same imports. */
function bootstrapSource(path: string): boolean {
	const directory = fileURLToPath(new URL('./', import.meta.url));
	return path.startsWith(realpathSync(directory) + '/');
}

function benchmarkBoundary(): boolean {
	const command = process.argv.some(
		(value, index) => ['budget', 'kernel'].includes(value) && process.argv[index + 1] === 'bench'
	);
	if (!command && process.env.HARNESS_RUNTIME_PROFILE_BOUNDARY !== 'benchmark') return false;
	process.env.HARNESS_RUNTIME_PROFILE_BOUNDARY = 'benchmark';
	const options = process.env.BUN_OPTIONS;
	if (options)
		process.env.BUN_OPTIONS = options
			.split(/\s+/)
			.filter((option) => !ownedPreload(option))
			.join(' ');
	return true;
}

function ownedPreload(option: string): boolean {
	if (!option.startsWith('--preload=')) return false;
	try {
		return (
			realpathSync(option.slice('--preload='.length)) ===
			realpathSync(fileURLToPath(import.meta.url))
		);
	} catch {
		return false;
	}
}

function loader(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
	if (path.endsWith('.tsx')) return 'tsx';
	if (path.endsWith('.jsx')) return 'jsx';
	return path.endsWith('ts') ? 'ts' : 'js';
}
