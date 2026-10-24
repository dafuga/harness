import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { componentManifestSchema } from '../../../core/development-tooling/unitTypes';

export function profileSelection(root: string) {
	if (process.env.HARNESS_COLLECT_FILES) return null;
	const explicit = process.env.HARNESS_RUNTIME_PROFILE_DIR;
	const evidence =
		process.env.TAKE_SCREENSHOT === '1' ? process.env.HARNESS_EVIDENCE_DIR : undefined;
	const directory = explicit === '' ? evidence : (explicit ?? evidence);
	if (!directory || process.env.HARNESS_RUNTIME_PROFILE_BOUNDARY === 'benchmark') return null;
	const registry = join(root, 'specification/units');
	if (!existsSync(registry)) return null;
	const units = readdirSync(registry)
		.filter((name) => name.endsWith('.json'))
		.map((name) =>
			componentManifestSchema.parse(JSON.parse(readFileSync(join(registry, name), 'utf8')))
		);
	if (benchmarkInvocation() || benchmarkScenario(root)) return null;
	return { root: realpathSync(root), directory, units };
}

export function profileEnvironment(root: string, directory: string) {
	const preload = fileURLToPath(new URL('./bunPreload.ts', import.meta.url));
	const options = process.env.BUN_OPTIONS ?? '';
	return {
		HARNESS_RUNTIME_PROFILE_ROOT: root,
		HARNESS_RUNTIME_PROFILE_DIR: directory,
		HARNESS_RUNTIME_PROFILE_CONTEXT:
			process.env.HARNESS_RUNTIME_PROFILE_CONTEXT ?? 'standard-runner',
		BUN_OPTIONS: options.includes(preload) ? options : `${options} --preload=${preload}`.trim()
	};
}

/** Existing explicit benchmarks keep their original measured boundary, without proxy overhead. */
function benchmarkInvocation(): boolean {
	return process.argv.some(
		(value, index) => ['budget', 'kernel'].includes(value) && process.argv[index + 1] === 'bench'
	);
}

function benchmarkScenario(root: string): boolean {
	const scenario = process.env.HARNESS_SCENARIO;
	if (!scenario || !/^[a-zA-Z0-9_.-]+$/.test(scenario)) return false;
	const path = join(root, 'specification/scenarios', `${scenario}.json`);
	if (!existsSync(path)) return false;
	const manifest = JSON.parse(readFileSync(path, 'utf8')) as { evidence?: { kind: string }[] };
	return manifest.evidence?.some((item) => item.kind === 'benchmark') ?? false;
}
