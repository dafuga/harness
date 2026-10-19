import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

/**
 * The root Vitest config is inherited by a workspace that has none of its own: Vitest finds it
 * above the workspace and resolves the config's relative paths from that workspace. A copy of the
 * real root config and its helpers, run by real Vitest from the root and from such a workspace,
 * collects exactly the tests of each, with the workspace's own setup.
 */
const repository = resolve(import.meta.dirname, '..');
const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));
function project(): string {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-workspace-config-')));
	roots.push(root);
	for (const file of [
		'vitest.config.ts',
		'src/utils/resourceWorkers.ts',
		'test/svelteKitConfigs.ts',
		'test/setup.ts'
	]) {
		mkdirSync(join(root, file, '..'), { recursive: true });
		copyFileSync(join(repository, file), join(root, file));
	}
	symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'));
	writeFileSync(
		join(root, 'test/root.test.ts'),
		"import { test } from 'vitest';\ntest('root', () => { if(process.env.HARNESS_RESOURCE_CPUS !== '1') throw new Error('Worker inherited the whole suite budget'); });\n"
	);
	const nested = join(root, 'packages', 'nested');
	mkdirSync(join(nested, 'test'), { recursive: true });
	writeFileSync(join(nested, 'package.json'), '{ "name": "nested", "private": true }\n');
	writeFileSync(
		join(nested, 'test/setup.ts'),
		'(globalThis as { ownSetup?: boolean }).ownSetup = true;\n'
	);
	writeFileSync(
		join(nested, 'test/nested.test.ts'),
		"import { expect, test } from 'vitest';\ntest('own setup ran', () => expect((globalThis as { ownSetup?: boolean }).ownSetup).toBe(true));\n test('worker budget', () => expect(process.env.HARNESS_RESOURCE_CPUS).toBe('1'));\n"
	);
	return root;
}
/**
 * How long one Vitest run may take, inside the 60 s each test allows: a blocking spawn cannot be
 * stopped by the test's own timeout, so the run is killed here and fails the guard as timed out.
 */
const runLimit = 45_000;
/** A normal `vitest run` from `cwd`: its exit code and the test files it ran, relative to `root`. */
function run(root: string, cwd: string) {
	const report = join(root, `report-${Math.random().toString(36).slice(2)}.json`);
	const env = Object.fromEntries(
		Object.entries(process.env).filter(
			([name]) => !name.startsWith('VITEST') && name !== 'HARNESS_AGENT_ID'
		)
	);
	const ran = spawnSync(
		'bun',
		['x', 'vitest', 'run', '--reporter=json', `--outputFile=${report}`],
		{
			cwd,
			env: {
				...env,
				NO_COLOR: '1',
				HARNESS_RESOURCE_CPUS: '3',
				HARNESS_RESOURCE_MEMORY_MIB: '1792'
			},
			encoding: 'utf8',
			timeout: runLimit,
			killSignal: 'SIGKILL'
		}
	);
	let files: Array<[string, string]> = [];
	try {
		const parsed = JSON.parse(readFileSync(report, 'utf8')) as {
			testResults: Array<{ name: string; status: string }>;
		};
		files = parsed.testResults.map((item) => [item.name.slice(root.length + 1), item.status]);
	} catch {
		files = [];
	}
	const timedOut = ran.error !== undefined && 'code' in ran.error && ran.error.code === 'ETIMEDOUT';
	return { timedOut, status: ran.status, files, output: `${ran.stdout}${ran.stderr}` };
}

test('a workspace without a config of its own runs its tests with the root config and its own setup', () => {
	const root = project();
	const nested = run(root, join(root, 'packages', 'nested'));
	expect(nested.output).not.toMatch(/ERR_MODULE_NOT_FOUND|ERR_LOAD_URL|No test files found/);
	expect([nested.timedOut, nested.status, nested.files], nested.output).toEqual([
		false,
		0,
		[['packages/nested/test/nested.test.ts', 'passed']]
	]);
}, 60_000);

test('the root runs its own tests and still leaves the workspaces to theirs', () => {
	const root = project();
	const top = run(root, root);
	expect([top.timedOut, top.status, top.files], top.output).toEqual([
		false,
		0,
		[['test/root.test.ts', 'passed']]
	]);
}, 60_000);
