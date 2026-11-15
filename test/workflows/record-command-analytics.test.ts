import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { recordAnalytics } from '../../src/workflows/reports-media/analyticsRecord';
import {
	recordCommandAnalytics,
	skipsAnalytics
} from '../../src/workflows/reports-media/recordCommandAnalytics';
import { runCommand } from '../support/cli';
import { measureWorkload } from '../support/measureWorkload';

const cli = join(process.cwd(), 'src/index.ts');
let scratch = '';
beforeEach(async () => {
	scratch = await mkdtemp(join(tmpdir(), 'record-command-analytics-'));
});
afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(scratch, { recursive: true, force: true });
});

test('help, version and info argv shapes skip analytics', () => {
	const skipped = [
		[],
		['--help'],
		['-h'],
		['--version'],
		['-V'],
		['help'],
		['help', 'loop'],
		['info'],
		['info', 'activity'],
		['contracts', 'show', 'service.billing', '--json'],
		['contracts', 'search', 'Money'],
		['loop', '--help'],
		['loop', 'create', '-h'],
		['audit', '--help', '--json']
	];
	for (const args of skipped) expect(skipsAnalytics(args), args.join(' ')).toBe(true);
});

test('real commands, unknown commands and a help flag after -- still record', () => {
	const recorded = [
		['audit'],
		['loop', 'status'],
		['unknown-command'],
		['api', 'get', '--', '--help'],
		['response-check', '--request', 'a'],
		['information']
	];
	for (const args of recorded) expect(skipsAnalytics(args), args.join(' ')).toBe(false);
});

test('the call site records real commands and leaves out skipped ones', async () => {
	const record = vi.fn<typeof recordAnalytics>(async () => undefined);
	await recordCommandAnalytics(['--help'], Date.now(), 0, record);
	await recordCommandAnalytics(['info', 'loop'], Date.now(), 0, record);
	await recordCommandAnalytics(['-V'], Date.now(), undefined, record);
	await recordCommandAnalytics(['contracts', 'search', 'Money'], Date.now(), 0, record);
	expect(record).not.toHaveBeenCalled();
	await recordCommandAnalytics(['loop', 'status', 'x'], Date.now() - 5, 2, record);
	expect(record).toHaveBeenCalledTimes(1);
	expect(record.mock.calls[0][0]).toMatchObject({
		kind: 'command',
		action: 'loop status',
		exitCode: 2
	});
	expect(record.mock.calls[0][0].durationMs).toBeGreaterThanOrEqual(5);
	for (const [family, action] of [
		['loop', 'list'],
		['loop', 'close'],
		['analytics', 'prune'],
		['history', 'prune']
	]) {
		await recordCommandAnalytics([family, action], Date.now(), 0, record);
		expect(record.mock.calls.at(-1)?.[0].action).toBe(`${family} ${action}`);
	}
});

test('a skipped command never creates the analytics store directory', async () => {
	const home = join(scratch, 'analytics');
	vi.stubEnv('HARNESS_ANALYTICS_HOME', home);
	await recordCommandAnalytics(['--help'], Date.now(), 0);
	await recordCommandAnalytics(['info'], Date.now(), 0);
	expect(existsSync(home)).toBe(false);
});

/** A `git` in front of PATH that logs its arguments, then runs the real one. */
async function gitLog(): Promise<{ path: string; log: string }> {
	const real = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
	const bin = join(scratch, 'bin');
	const log = join(scratch, 'git.log');
	await mkdir(bin);
	await writeFile(join(bin, 'git'), `#!/bin/sh\necho "$@" >> "${log}"\nexec "${real}" "$@"\n`);
	await chmod(join(bin, 'git'), 0o755);
	await writeFile(log, '');
	return { path: `${bin}:${process.env.PATH ?? ''}`, log };
}

test('the real entry runs no sqlite or git worktree work for --help, --version and info', async () => {
	const shim = await gitLog();
	const home = join(scratch, 'analytics');
	const env = { HARNESS_ANALYTICS_HOME: home, PATH: shim.path };
	const imported = await measureWorkload('entry.index', 'compatibility-import-without-cli', () =>
		runCommand(['bun', '-e', `await import(${JSON.stringify(cli)})`], scratch, false, env)
	);
	expect(imported, 'library imports must not invoke the CLI').toMatchObject({
		exitCode: 0,
		stdout: '',
		stderr: ''
	});
	for (const entry of [cli, join(process.cwd(), 'src/cli/index.ts')])
		for (const args of [
			['--help'],
			['--version'],
			['info', 'activity'],
			['loop', '--help'],
			['contracts', 'list', '--json'],
			['contracts', 'search', 'Money', '--json']
		])
			await runCommand(['bun', entry, ...args], scratch, true, env);
	await runCommand(
		['bun', join(process.cwd(), 'src/cli/index.ts'), 'loop', 'list', '--json'],
		scratch,
		true,
		{ ...env, HARNESS_ANALYTICS_DISABLED: '1' }
	);
	expect(existsSync(home)).toBe(false);
	expect(await readFile(shim.log, 'utf8')).not.toContain('worktree');
	await runCommand(['bun', cli, 'unknown-command'], scratch, false, env);
	expect(existsSync(join(home, 'analytics.sqlite'))).toBe(true);
	expect(await readFile(shim.log, 'utf8')).toContain('worktree list');
}, 60_000);
