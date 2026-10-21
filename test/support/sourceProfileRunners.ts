import { mkdtemp, mkdir, writeFile, symlink, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { benchmarkCaptureSchema } from '../../src/core/verifyTypes';
import { runCommand } from './cli';

const repository = resolve(import.meta.dirname, '../..');
export const preload = join(repository, 'src/adapters/source-profile-adapter/bunPreload.ts');
export const source = 'export function greet(name: string) { return name.toUpperCase(); }\n';

/** Synthetic unit ids and captures stay in this owned directory, never in real project evidence. */
export async function runnerFixture() {
	const root = await mkdtemp(join(tmpdir(), 'harness-runner-profiles-'));
	const directory = join(root, 'captures');
	await mkdir(directory);
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir');
	await writeFile(join(root, 'package.json'), '{"type":"module"}');
	await writeFile(join(root, 'subject.ts'), source);
	await writeFile(
		join(root, 'run.ts'),
		"import { greet } from './subject.ts'; console.log(greet('fixture-value'));\n"
	);
	await writeFile(
		join(root, 'specification/units/function.runner-fixture.json'),
		JSON.stringify(manifest())
	);
	await writeFile(join(root, 'vitest.config.ts'), config(root));
	return {
		root,
		directory,
		environment: {
			BUN_OPTIONS: '',
			HARNESS_EVIDENCE_DIR: directory,
			TAKE_SCREENSHOT: '1',
			HARNESS_RUNTIME_PROFILE_ROOT: root,
			HARNESS_RUNTIME_PROFILE_DIR: directory,
			HARNESS_RUNTIME_PROFILE_CONTEXT: 'standard-fixture',
			HARNESS_RUNTIME_PROFILE_BOUNDARY: ''
		},
		write: (path: string, text: string) => writeFile(join(root, path), text),
		run: (args: string[], environment: Record<string, string> = {}) =>
			runCommand(args, root, true, environment),
		remove: () => rm(root, { recursive: true, force: true })
	};
}

export async function runnerCaptures(directory: string) {
	let index: string;
	try {
		index = await readFile(join(directory, 'captures.ndjson'), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	return (
		await Promise.all(
			index
				.trim()
				.split('\n')
				.filter(Boolean)
				.map(async (line) => {
					const capture = JSON.parse(
						await readFile(join(directory, JSON.parse(line).file), 'utf8')
					);
					return benchmarkCaptureSchema.parse(capture).measurements;
				})
		)
	).flat();
}

function manifest() {
	return {
		schemaVersion: 1,
		id: 'function.runner-fixture',
		kind: 'function',
		title: 'Runner fixture',
		responsibility: 'Exercise real source-bound runner operations.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['subject.ts'], symbols: ['greet'] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: 'greet', type: 'string' }],
			errors: []
		},
		dependencies: [],
		runtime: {
			kind: 'module',
			entry: 'subject.ts',
			targets: [{ kind: 'module', entry: 'subject.ts' }]
		},
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}

function config(root: string) {
	const entry = join(repository, 'src/adapters/source-profile-adapter/runnerConfig.ts');
	return `import { defineConfig } from 'vitest/config';
import { sourceProfilePlugin } from ${JSON.stringify(entry)};
export default defineConfig({ plugins:[sourceProfilePlugin(${JSON.stringify(root)})],
test:{include:['subject.test.ts'],minWorkers:1,maxWorkers:1} });\n`;
}
