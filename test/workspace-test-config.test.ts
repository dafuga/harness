import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
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
function project(config?: string): string {
	const root = realpathSync(mkdtempSync(join(tmpdir(), 'harness-workspace-config-')));
	roots.push(root);
	for (const file of [
		'vitest.config.ts',
		'src/utils/execution-runtimes/resourceWorkers.ts',
		'test/svelteKitConfigs.ts',
		'test/setup.ts'
	]) {
		mkdirSync(join(root, file, '..'), { recursive: true });
		copyFileSync(join(repository, file), join(root, file));
	}
	symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'));
	mkdirSync(join(root, 'test/support'), { recursive: true });
	symlinkSync(
		join(repository, 'test/support/gameWorkload.ts'),
		join(root, 'test/support/gameWorkload.ts')
	);
	samples(root, 'root', '');
	const disposable = join(root, '.cache', 'generated-game', 'node_modules', 'dependency');
	mkdirSync(join(disposable, 'test'), { recursive: true });
	samples(disposable, 'dependency', '');
	const nested = join(root, 'packages', 'nested');
	mkdirSync(join(nested, 'test'), { recursive: true });
	writeFileSync(join(nested, 'package.json'), '{ "name": "nested", "private": true }\n');
	writeFileSync(
		join(nested, 'test/setup.ts'),
		'(globalThis as { ownSetup?: boolean }).ownSetup = true;\n'
	);
	const ownSetup = 'expect((globalThis as { ownSetup?: boolean }).ownSetup).toBe(true);';
	samples(nested, 'nested', config ? '' : ownSetup);
	if (config) {
		copyFileSync(
			join(repository, 'packages', config, 'vitest.config.ts'),
			join(nested, 'vitest.config.ts')
		);
	}
	return root;
}

/** Several real files reveal the runner's worker fan-out; one file cannot. */
function samples(root: string, name: string, assertion: string): void {
	for (let index = 0; index < 3; index++) {
		writeFileSync(
			join(root, `test/${name}-${index}.test.ts`),
			`import { appendFileSync } from 'node:fs';
import { expect, test } from 'vitest';
test('${name} ${index}', async () => {
	${assertion}
	expect(process.env.HARNESS_RESOURCE_CPUS).toBe('1');
	const id = process.pid + ':${index}';
	appendFileSync('workers.log', 'start ' + id + '\\n');
	await new Promise((resolve) => setTimeout(resolve, 100));
	appendFileSync('workers.log', 'end ' + id + '\\n');
});\n`
		);
	}
}

const files = (prefix: string, name: string) =>
	Array.from({ length: 3 }, (_, index) => [`${prefix}test/${name}-${index}.test.ts`, 'passed']);

/** Isolated files may use successive PIDs; count overlapping work, not lifetime PIDs. */
function peakWorkers(cwd: string): number {
	let peak = 0;
	const active = new Set<string>();
	let events: string[] = [];
	try {
		events = readFileSync(join(cwd, 'workers.log'), 'utf8').trim().split('\n');
	} catch {
		return -1;
	}
	for (const event of events) {
		const [kind, id] = event.split(' ');
		if (kind === 'start') active.add(id);
		else active.delete(id);
		peak = Math.max(peak, active.size);
	}
	return events.length === 6 && active.size === 0 ? peak : -1;
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
	return {
		timedOut,
		status: ran.status,
		files,
		workers: peakWorkers(cwd),
		output: `${ran.stdout}${ran.stderr}`
	};
}

test('a workspace without a config of its own runs its tests with the root config and its own setup', () => {
	const root = project();
	const nested = run(root, join(root, 'packages', 'nested'));
	expect(nested.output).not.toMatch(/ERR_MODULE_NOT_FOUND|ERR_LOAD_URL|No test files found/);
	expect([nested.timedOut, nested.status, nested.files, nested.workers]).toEqual([
		false,
		0,
		files('packages/nested/', 'nested'),
		1
	]);
}, 60_000);

test('the root runs its own tests and still leaves the workspaces to theirs', () => {
	const root = project();
	const top = run(root, root);
	expect([top.timedOut, top.status, top.files, top.workers]).toEqual([
		false,
		0,
		files('', 'root'),
		1
	]);
}, 60_000);

test.each(['collaboration', 'remote', 'relay', 'game'])(
	'%s keeps its own configuration within one worker',
	(config) => {
		const root = project(config);
		const nested = run(root, join(root, 'packages', 'nested'));
		expect([nested.timedOut, nested.status, nested.files, nested.workers]).toEqual([
			false,
			0,
			files('packages/nested/', 'nested'),
			1
		]);
	},
	60_000
);

const managedWorkspaces = [
	'.',
	...readdirSync(join(repository, 'packages'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => `packages/${entry.name}`)
];
test.each(managedWorkspaces)(
	'%s routes standalone verification and build scripts through admission',
	(workspace) => {
		const { scripts } = JSON.parse(
			readFileSync(join(repository, workspace, 'package.json'), 'utf8')
		) as { scripts: Record<string, string> };
		for (const [name, command] of Object.entries(scripts)) {
			if (!/(^|:)(test|build|check|lint|format)(:|$)/.test(name)) continue;
			const delegation = /^bun run [\w:-]+$/.test(command);
			expect(command.includes(' resources run ') || delegation, `${workspace}: ${name}`).toBe(true);
			if (command.includes(' -- sh -c '))
				expect(command, `${workspace}: ${name} arguments`).toMatch(/ "\$@"' --$/);
		}
	}
);
