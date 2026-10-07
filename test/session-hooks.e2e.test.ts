import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, test } from 'vitest';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let root: string;
let project: string;
let settings: string;
let credential: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-session-'));
	project = join(root, 'project');
	settings = join(root, 'settings.json');
	credential = join(root, 'jev.env');
	await mkdir(join(project, 'src'), { recursive: true });
	await writeFile(join(project, 'harness.audit.json'), '{}');
	await writeFile(join(project, 'src/greet.ts'), 'export const greeting = "Hello";\n');
	await writeFile(credential, 'HARNESS_JEV_API_KEY="synthetic-test-key"\n', { mode: 0o600 });
	await writeFile(settings, JSON.stringify({ roots: [project], credentialFile: credential }));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('session start automatically reviews a governed project and reuses unchanged judgments', () => {
	const first = runHook('meets');
	expect(first.status, first.stderr).toBe(0);
	expect(context(first.stdout)).toContain('Jev Clean Code: clean');
	expect(context(first.stdout)).toContain('1 reviewed');
	const repeated = runHook('offline-only');
	expect(repeated.status, repeated.stderr).toBe(0);
	expect(context(repeated.stdout)).toContain('1 cached');
	expect(repeated.stdout).not.toContain('synthetic-test-key');
});

test('session review invalidates a cached judgment when source changes', async () => {
	expect(context(runHook('meets').stdout)).toContain('Jev Clean Code: clean');
	await writeFile(join(project, 'src/greet.ts'), 'export const greeting = "Changed";\n');
	expect(context(runHook('offline-only').stdout)).toContain('Jev Clean Code: incomplete');
});

test('violations and provider failures remain honest advisory results', () => {
	const violation = runHook('violates');
	expect(violation.status, violation.stderr).toBe(0);
	expect(context(violation.stdout)).toContain('Jev Clean Code: violations');
	expect(JSON.parse(violation.stdout).systemMessage).toContain('violations');
	const failure = runHook('unauthorized', { refresh: true });
	expect(failure.status, failure.stderr).toBe(0);
	expect(context(failure.stdout)).toContain('Jev Clean Code: incomplete');
	expect(failure.stdout + failure.stderr).not.toContain('synthetic-test-key');
});

test('dry run excludes sensitive source and makes no provider requests', async () => {
	await mkdir(join(project, 'secrets'));
	await writeFile(join(project, 'secrets/key.ts'), 'export const secret = "private-fixture";');
	await writeFile(join(project, '.env'), 'UNRELATED_KEY=private-fixture');
	const result = runHook('offline-only', { dryRun: true });
	expect(result.status, result.stderr).toBe(0);
	expect(context(result.stdout)).toContain('1 eligible');
	expect(context(result.stdout)).toContain('dry-run');
	expect(result.stdout).not.toContain('private-fixture');
});

test('unrelated sessions do not read the credential or contact Jev', async () => {
	await rm(credential);
	const outside = join(root, 'outside');
	await mkdir(outside);
	expect(runHook('offline-only', { cwd: outside }).stdout.trim()).toBe('{}');
	await rm(join(project, 'harness.audit.json'));
	expect(runHook('offline-only').stdout.trim()).toBe('{}');
});

test('unsafe credential permissions produce an explicit incomplete warning', async () => {
	await chmod(credential, 0o644);
	const result = runHook('offline-only');
	expect(result.status, result.stderr).toBe(0);
	expect(JSON.parse(result.stdout).systemMessage).toContain('incomplete');
	expect(result.stdout).not.toContain('synthetic-test-key');
});

test('installation preserves unrelated hooks and stays idempotent without embedding secrets', async () => {
	const home = join(root, 'codex');
	const bundle = join(root, 'bundle.js');
	await mkdir(home);
	await writeFile(bundle, '// synthetic bundled entry\n');
	const existing = {
		hooks: { Stop: [{ hooks: [{ type: 'command', command: 'existing-hook' }] }] }
	};
	await writeFile(join(home, 'hooks.json'), JSON.stringify(existing));
	const args = [
		'session',
		'install',
		'--home',
		home,
		'--root',
		project,
		'--credential-file',
		credential,
		'--bundle',
		bundle
	];
	expect(runCli(args).status).toBe(0);
	expect(runCli(args).status).toBe(0);
	const installed = JSON.parse(await readFile(join(home, 'hooks.json'), 'utf8'));
	expect(installed.hooks.Stop).toEqual(existing.hooks.Stop);
	expect(installed.hooks.SessionStart).toHaveLength(1);
	expect(installed.hooks.SessionStart[0].hooks[0]).toMatchObject({ async: true, type: 'command' });
	expect(JSON.stringify(installed)).not.toContain('synthetic-test-key');
});

function runHook(
	scenario: string,
	options: { cwd?: string; dryRun?: boolean; refresh?: boolean } = {}
) {
	const args = ['session', 'hook', '--settings', settings];
	if (options.dryRun) args.push('--dry-run');
	if (options.refresh) args.push('--refresh');
	return runCli(
		args,
		scenario,
		JSON.stringify({
			hook_event_name: 'SessionStart',
			session_id: 'fixture-session',
			source: 'startup',
			cwd: options.cwd ?? project
		})
	);
}

function runCli(args: string[], scenario = 'offline-only', input?: string) {
	return spawnSync(
		'bun',
		['--preload', join(repo, 'test/support/jevPreload.ts'), join(repo, 'src/index.ts'), ...args],
		{
			cwd: project,
			encoding: 'utf8',
			input,
			env: { ...process.env, HARNESS_ANALYTICS_DISABLED: '1', TEST_JEV_SCENARIO: scenario }
		}
	);
}

function context(stdout: string): string {
	return JSON.parse(stdout).hookSpecificOutput.additionalContext;
}
