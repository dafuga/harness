import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

test('CLI scaffolds and checks a lib project', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-lib-'));
	await runHarness(['new', 'lib', 'demo-lib'], root);
	const project = join(root, 'demo-lib');

	await runHarness(['generate', 'model', 'Post', 'title:string', '--adapter', 'sqlite'], project);
	await runHarness(['generate', 'model', 'Event', 'startsAt:date', '--adapter', 'd1'], project);
	await runHarness(
		['generate', 'model', 'Metric', 'value:number', '--adapter', 'postgres'],
		project
	);

	for (const kind of packageKinds) {
		await runHarness(['generate', kind, 'PublishPost'], project);
	}

	await runCommand(['bun', 'install'], project);
	const check = await runCommand(['bun', 'run', 'check'], project);
	expect(check.stdout).toContain('Checking formatting...');
	expect(check.stdout).toContain('Harness audit passed');
	await rm(root, { recursive: true, force: true });
}, 180_000);

test('CLI scaffolds and checks an app project with routes', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-app-'));
	await runHarness(['new', 'app', 'demo-app'], root);
	const project = join(root, 'demo-app');

	await runHarness(['generate', 'model', 'Post', 'title:string'], project);
	await runHarness(['generate', 'view', 'Dashboard'], project);
	await runHarness(['generate', 'layout', 'Dashboard'], project);
	await runHarness(['generate', 'api', 'Ping'], project);
	await runHarness(['generate', 'component', 'StatusBadge'], project);
	await runHarness(['generate', 'store', 'Session'], project);
	await runHarness(['generate', 'hook', 'RequestLogger'], project);
	await runHarness(['generate', 'e2e', 'Dashboard'], project);
	await runHarness(['generate', 'partial', 'PromoBanner'], project);
	await runHarness(['generate', 'resource', 'Article'], project);

	for (const kind of packageKinds) {
		await runHarness(['g', kind, 'PublishPost'], project);
	}

	await runCommand(['bun', 'install'], project);
	const check = await runCommand(['bun', 'run', 'check'], project);
	expect(check.stdout).toContain('Checking formatting...');
	expect(check.stdout).toContain('Harness audit passed');

	const server = spawn('bun', ['x', 'vite', 'preview', '--host', '127.0.0.1', '--port', '43321'], {
		cwd: project,
		stdio: 'pipe'
	});
	const serverExited = new Promise((resolve) => server.once('exit', resolve));
	try {
		await waitForUrl('http://127.0.0.1:43321/dashboard');
		const page = await fetch('http://127.0.0.1:43321/dashboard').then((response) =>
			response.text()
		);
		const api = await fetch('http://127.0.0.1:43321/api/ping').then((response) => response.json());

		expect(page).toContain('Dashboard');
		expect(page).toContain('data-harness-view="dashboard"');
		expect(api).toEqual({ ok: true, resource: 'ping' });
	} finally {
		server.kill();
		await serverExited;
	}

	await rm(root, { recursive: true, force: true });
}, 180_000);

test('CLI reports edge errors cleanly', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-errors-'));
	await runHarness(['new', 'lib', 'demo-lib'], root);
	const project = join(root, 'demo-lib');

	const invalidAdapter = await runHarness(
		['generate', 'model', 'Post', '--adapter', 'oracle'],
		project,
		false
	);
	expect(invalidAdapter.exitCode).toBe(1);
	expect(invalidAdapter.stderr).toContain('Unsupported adapter');
	expect(invalidAdapter.stderr).not.toContain(' at ');

	const unknownInfo = await runHarness(['info', 'nope'], project, false);
	expect(unknownInfo.exitCode).toBe(1);
	expect(unknownInfo.stderr).toContain('Unknown info topic');
	expect(unknownInfo.stderr.match(/controller/g) ?? []).toHaveLength(1);

	const invalidProfile = await runHarness(['audit', '.', '--profile', 'mobile'], project, false);
	expect(invalidProfile.exitCode).toBe(1);
	expect(invalidProfile.stderr).toContain('Unsupported audit profile');

	const scaffoldInfo = await runHarness(['info', 'scaffold'], project);
	expect(scaffoldInfo.stdout).toContain('# scaffolds');
	const controllerInfo = await runHarness(['info', 'controllers'], project);
	expect(controllerInfo.stdout).toContain('# controller');

	const invalidName = await runHarness(['generate', 'service', '../bad'], project, false);
	expect(invalidName.exitCode).toBe(1);
	expect(invalidName.stderr).toContain('path traversal');

	const appOnly = await runHarness(['generate', 'view', 'Dashboard'], project, false);
	expect(appOnly.exitCode).toBe(1);
	expect(appOnly.stderr).toContain('only available in Harness app projects');

	await rm(root, { recursive: true, force: true });
}, 120_000);

test('CLI supports force overwrites and generated lint failures', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-overwrite-'));
	await runHarness(['new', 'lib', 'demo-lib'], root);
	const project = join(root, 'demo-lib');

	const overwrite = await runHarness(['generate', 'service', 'PublishPost'], project, false);
	expect(overwrite.exitCode).toBe(0);
	await writeFile(join(project, 'src/services/PublishPostService.ts'), 'changed\n');
	const blocked = await runHarness(['generate', 'service', 'PublishPost'], project, false);
	expect(blocked.exitCode).toBe(1);
	expect(blocked.stderr).toContain('Refusing to overwrite');
	const forced = await runHarness(['generate', 'service', 'PublishPost', '--force'], project);
	expect(forced.stdout).toContain('overwrite src/services/PublishPostService.ts');

	await runCommand(['bun', 'install'], project);
	await writeFile(
		join(project, 'src/services/OversizedService.ts'),
		[
			'export class OversizedService {',
			'\trun(): void {',
			...Array.from({ length: 36 }, () => '\t\tvoid 1;'),
			'\t}',
			'}'
		].join('\n')
	);
	const lintFailure = await runCommand(['bun', 'run', 'lint'], project, false);
	expect(lintFailure.exitCode).toBe(1);
	expect(`${lintFailure.stdout}\n${lintFailure.stderr}`).toContain('harness/max-method-lines');

	await rm(root, { recursive: true, force: true });
}, 120_000);

const packageKinds = [
	'controller',
	'service',
	'decorator',
	'test',
	'feature',
	'migration',
	'adapter',
	'repository',
	'validator',
	'serializer',
	'policy',
	'job',
	'notification',
	'seeder',
	'command',
	'util',
	'mailer',
	'helper',
	'concern',
	'channel',
	'form',
	'initializer',
	'config',
	'middleware'
];

async function waitForUrl(url: string): Promise<void> {
	const started = Date.now();

	while (Date.now() - started < 30_000) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
		} catch {
			// Server is still starting.
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw new Error(`Timed out waiting for ${url}`);
}
