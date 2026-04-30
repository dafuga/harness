import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = join(repoRoot, 'src/index.ts');

test('CLI scaffolds and verifies a lib project', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-cli-lib-'));
	await runFrame(['new', 'lib', 'demo-lib'], root);
	const project = join(root, 'demo-lib');

	await runFrame(['generate', 'model', 'Post', 'title:string', '--adapter', 'sqlite'], project);
	await runFrame(['generate', 'model', 'Event', 'startsAt:date', '--adapter', 'd1'], project);
	await runFrame(['generate', 'model', 'Metric', 'value:number', '--adapter', 'postgres'], project);

	for (const kind of packageKinds) {
		await runFrame(['generate', kind, 'PublishPost'], project);
	}

	await runCommand(['bun', 'install'], project);
	await runCommand(['bun', 'run', 'check'], project);
	await runCommand(['bun', 'run', 'lint'], project);
	await runCommand(['bun', 'run', 'test'], project);
	await runCommand(['bun', 'run', 'build'], project);
	await runCommand(['bun', 'run', 'verify'], project);
	await rm(root, { recursive: true, force: true });
}, 180_000);

test('CLI scaffolds and verifies an app project with routes', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-cli-app-'));
	await runFrame(['new', 'app', 'demo-app'], root);
	const project = join(root, 'demo-app');

	await runFrame(['generate', 'model', 'Post', 'title:string'], project);
	await runFrame(['generate', 'view', 'Dashboard'], project);
	await runFrame(['generate', 'layout', 'Dashboard'], project);
	await runFrame(['generate', 'api', 'Ping'], project);
	await runFrame(['generate', 'component', 'StatusBadge'], project);
	await runFrame(['generate', 'store', 'Session'], project);
	await runFrame(['generate', 'hook', 'RequestLogger'], project);
	await runFrame(['generate', 'e2e', 'Dashboard'], project);
	await runFrame(['generate', 'partial', 'PromoBanner'], project);
	await runFrame(['generate', 'resource', 'Article'], project);

	for (const kind of packageKinds) {
		await runFrame(['g', kind, 'PublishPost'], project);
	}

	await runCommand(['bun', 'install'], project);
	await runCommand(['bun', 'run', 'check'], project);
	await runCommand(['bun', 'run', 'lint'], project);
	await runCommand(['bun', 'run', 'test'], project);
	await runCommand(['bun', 'run', 'build'], project);
	await runCommand(['bun', 'run', 'verify'], project);

	const server = spawn('bun', ['x', 'vite', 'preview', '--host', '127.0.0.1', '--port', '43321'], {
		cwd: project,
		stdio: 'pipe'
	});
	const serverExited = new Promise((resolve) => server.once('exit', resolve));
	try {
		await waitForUrl('http://127.0.0.1:43321/dashboard');
		const page = await fetch('http://127.0.0.1:43321/dashboard').then((response) => response.text());
		const api = await fetch('http://127.0.0.1:43321/api/ping').then((response) => response.json());

		expect(page).toContain('Dashboard');
		expect(page).toContain('data-frame-view="dashboard"');
		expect(api).toEqual({ ok: true, resource: 'ping' });
	} finally {
		server.kill();
		await serverExited;
	}

	await rm(root, { recursive: true, force: true });
}, 180_000);

test('CLI reports edge errors cleanly and supports force overwrites', async () => {
	const root = await mkdtemp(join(tmpdir(), 'frame-cli-errors-'));
	await runFrame(['new', 'lib', 'demo-lib'], root);
	const project = join(root, 'demo-lib');

	const invalidAdapter = await runFrame(
		['generate', 'model', 'Post', '--adapter', 'oracle'],
		project,
		false
	);
	expect(invalidAdapter.exitCode).toBe(1);
	expect(invalidAdapter.stderr).toContain('Unsupported adapter');
	expect(invalidAdapter.stderr).not.toContain(' at ');

	const unknownInfo = await runFrame(['info', 'nope'], project, false);
	expect(unknownInfo.exitCode).toBe(1);
	expect(unknownInfo.stderr).toContain('Unknown info topic');

	const invalidName = await runFrame(['generate', 'service', '../bad'], project, false);
	expect(invalidName.exitCode).toBe(1);
	expect(invalidName.stderr).toContain('path traversal');

	const appOnly = await runFrame(['generate', 'view', 'Dashboard'], project, false);
	expect(appOnly.exitCode).toBe(1);
	expect(appOnly.stderr).toContain('only available in Frame app projects');

	const overwrite = await runFrame(['generate', 'service', 'PublishPost'], project, false);
	expect(overwrite.exitCode).toBe(0);
	await writeFile(join(project, 'src/services/PublishPostService.ts'), 'changed\n');
	const blocked = await runFrame(['generate', 'service', 'PublishPost'], project, false);
	expect(blocked.exitCode).toBe(1);
	expect(blocked.stderr).toContain('Refusing to overwrite');
	const forced = await runFrame(['generate', 'service', 'PublishPost', '--force'], project);
	expect(forced.stdout).toContain('overwrite src/services/PublishPostService.ts');

	await runCommand(['bun', 'install'], project);
	await writeFile(
		join(project, 'src/services/OversizedService.ts'),
		['export class OversizedService {', '\trun(): void {', ...Array.from({ length: 36 }, () => '\t\tvoid 1;'), '\t}', '}'].join('\n')
	);
	const lintFailure = await runCommand(['bun', 'run', 'lint'], project, false);
	expect(lintFailure.exitCode).toBe(1);
	expect(`${lintFailure.stdout}\n${lintFailure.stderr}`).toContain('frame/max-method-lines');

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

interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

async function runFrame(args: string[], cwd: string, expectSuccess = true): Promise<CommandResult> {
	return runCommand(['bun', cliPath, ...args], cwd, expectSuccess);
}

async function runCommand(args: string[], cwd: string, expectSuccess = true): Promise<CommandResult> {
	const child = spawn(args[0], args.slice(1), { cwd, stdio: 'pipe' });
	const stdoutChunks: Buffer[] = [];
	const stderrChunks: Buffer[] = [];

	child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
	child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

	const exitCode = await new Promise<number>((resolve) => {
		child.once('exit', (code) => resolve(code ?? 1));
	});
	const stdout = Buffer.concat(stdoutChunks).toString('utf8');
	const stderr = Buffer.concat(stderrChunks).toString('utf8');

	if (expectSuccess && exitCode !== 0) {
		throw new Error(`${args.join(' ')} failed with ${exitCode}\n${stdout}\n${stderr}`);
	}

	return { exitCode, stdout, stderr };
}

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
