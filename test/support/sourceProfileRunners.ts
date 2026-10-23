import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { benchmarkCaptureSchema } from '../../src/core/verification-evidence/verifyTypes';
import { runCommand } from './cli';

const repository = resolve(import.meta.dirname, '../..');
export const preload = join(
	repository,
	'src/adapters/verification-evidence/source-profile-adapter/bunPreload.ts'
);
export const source = 'export function greet(name: string) { return name.toUpperCase(); }\n';

/** Exercise native startup without requiring the host to understand TypeScript. */
export function nativeRunnerEnvironments(environment: Record<string, string>) {
	const variants = [environment];
	const flags = process.allowedNodeEnvironmentFlags;
	let disable: string | undefined;
	if (flags.has('--no-strip-types')) disable = '--no-strip-types';
	else if (flags.has('--experimental-strip-types')) disable = '--no-experimental-strip-types';
	if (disable)
		variants.push({
			...environment,
			NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} ${disable}`.trim()
		});
	return variants;
}

/** Synthetic unit ids and captures stay in this owned directory, never in real project evidence. */
export async function runnerFixture(subjectSource = source, symbol = 'greet', output = 'string') {
	const root = await mkdtemp(join(tmpdir(), 'harness-runner-profiles-'));
	const directory = join(root, 'captures');
	await mkdir(directory);
	await mkdir(join(root, 'specification/units'), { recursive: true });
	await symlink(join(repository, 'node_modules'), join(root, 'node_modules'), 'dir');
	await writeFile(join(root, 'package.json'), '{"type":"module"}');
	await writeFile(join(root, 'subject.ts'), subjectSource);
	await writeFile(
		join(root, 'run.ts'),
		"import { greet } from './subject.ts'; import {writeFileSync} from 'node:fs'; const result=greet('fixture-value'); writeFileSync('bun-rss.json',JSON.stringify(process.memoryUsage().rss)); console.log(result);\n"
	);
	await writeFile(
		join(root, 'specification/units/function.runner-fixture.json'),
		JSON.stringify(manifest(symbol, output))
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

export async function runnerCaptures(directory: string, runtimeReference?: string) {
	let index: string;
	try {
		index = await readFile(join(directory, 'captures.ndjson'), 'utf8');
	} catch (error) {
		if ((error as { code?: string }).code === 'ENOENT') return [];
		throw error;
	}
	const measurements = (
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
	if (runtimeReference) await assertRunnerMemory(runtimeReference, measurements);
	return measurements;
}

async function assertRunnerMemory(
	root: string,
	measurements: Awaited<ReturnType<typeof runnerCaptures>>
) {
	const rss = await Promise.all(
		['bun', 'node'].map(
			async (runtime) =>
				JSON.parse(await readFile(join(root, `${runtime}-rss.json`), 'utf8')) as number
		)
	);
	for (const value of rss) expect(value).toBeGreaterThan(0);
	for (const measured of measurements.filter((item) => item.unitOfMeasure === 'bytes')) {
		expect(measured.value, 'fresh runtime RSS uses byte units').toBeGreaterThan(
			Math.min(...rss) / 2
		);
		expect(measured.value, 'fresh runtime RSS uses byte units').toBeLessThan(Math.max(...rss) * 8);
	}
}

function manifest(symbol: string, output: string) {
	return {
		schemaVersion: 1,
		id: 'function.runner-fixture',
		kind: 'function',
		title: 'Runner fixture',
		responsibility: 'Exercise real source-bound runner operations.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: ['subject.ts'], symbols: [symbol] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [{ name: symbol, type: output }],
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
	const entry = join(
		repository,
		'src/adapters/verification-evidence/source-profile-adapter/runnerConfig.ts'
	);
	return `import { defineConfig } from 'vitest/config';
import { sourceProfilePlugin } from ${JSON.stringify(entry)};
export default defineConfig({ plugins:[sourceProfilePlugin(${JSON.stringify(root)})],
test:{include:['subject.test.ts'],minWorkers:1,maxWorkers:1} });\n`;
}
