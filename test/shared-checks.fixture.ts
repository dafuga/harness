import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Fixture, Measurement } from './shared-checks.test.types';

const cli = resolve('scripts/shared-checks.ts');

export function git(repo: string, ...args: string[]) {
	return execFileSync('git', args, {
		cwd: repo,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	}).trim();
}

function write(repo: string, path: string, content: string) {
	const file = join(repo, path);
	mkdirSync(resolve(file, '..'), { recursive: true });
	writeFileSync(file, content);
}

function commit(repo: string, message: string): string {
	git(repo, 'add', '.');
	git(repo, 'commit', '-qm', message);
	return git(repo, 'rev-parse', 'HEAD');
}

export function fixture(): Fixture {
	const folder = mkdtempSync(join(tmpdir(), 'harness-shared-check-proof-'));
	const repo = join(folder, 'repo');
	const home = join(folder, 'host');
	const notes = join(folder, 'tracker-notes');
	const client = join(folder, 'check-client.ts');
	write(
		folder,
		'check-client.ts',
		String.raw`
		import { appendFileSync } from 'node:fs';
		import { runSharedChecks } from ${JSON.stringify(cli)};
		process.exitCode = await runSharedChecks({
			home: process.env.HARNESS_PROOF_CHECK_QUEUE,
			note: async (item, text) => appendFileSync(${JSON.stringify(notes)}, 'note ' + item + ' ' + text + '\n')
		});
	`
	);
	writeFixtureRepo(repo, client);
	const base = commit(repo, 'Baseline');
	const first = candidate(
		repo,
		base,
		'first',
		'export const top = 2;\n// preserve merge context\nexport const bottom = 1;\n'
	);
	const second = candidate(
		repo,
		base,
		'second',
		'export const top = 1;\n// preserve merge context\nexport const bottom = 2;\n'
	);
	const failing = candidate(
		repo,
		base,
		'failing',
		'export const top = 1;\n// preserve merge context\nexport const bottom = 5;\n'
	);
	git(repo, 'switch', '-q', 'main');

	return { folder, repo, home, first, second, failing, notes };
}

function writeFixtureRepo(repo: string, client: string): void {
	mkdirSync(repo);
	git(repo, 'init', '-q', '-b', 'main');
	git(repo, 'config', 'user.name', 'Check proof');
	git(repo, 'config', 'user.email', 'check-proof@example.invalid');
	const config = {
		schemaVersion: 1,
		setup: [],
		link: [],
		runners: { vitest: 'bun {target}' },
		timeouts: { test: 20_000 }
	};
	write(repo, 'harness.verify.json', JSON.stringify(config));
	write(
		repo,
		'package.json',
		JSON.stringify({ scripts: { check: `bun ${JSON.stringify(client)}` } })
	);
	write(
		repo,
		'src/utils/values.js',
		'export const top = 1;\n// preserve merge context\nexport const bottom = 1;\n'
	);
	write(
		repo,
		'test/affected.test.ts',
		`
import { top, bottom } from '../src/utils/values.js';
const tree = top * bottom;
if (tree > 4) process.exit(1);
const result = Bun.spawnSync(['ps', '-o', 'nice=', '-p', String(process.pid)]);
if (Number(result.stdout.toString()) < 10) process.exit(1);
await Bun.sleep(250);
`
	);
	write(repo, 'test/unrelated.test.ts', 'throw new Error("Excluded test ran");\n');
	write(repo, 'eslint.config.mjs', 'export default [{}];\n');
}

function candidate(repo: string, base: string, name: string, content: string): string {
	git(repo, 'switch', '-qc', name, base);
	write(repo, 'src/utils/values.js', content);
	return commit(repo, name);
}

export function submit(
	fixture: Fixture,
	commit: string,
	item: string | undefined,
	options: { home?: string; exact?: boolean } = {}
): Promise<Measurement> {
	const { home = fixture.home, exact = false } = options;
	const started = performance.now();
	const child = spawn(
		'bun',
		[
			'run',
			'check',
			'--commit',
			commit,
			...(item ? ['--item', item] : []),
			...(exact ? ['--exact'] : []),
			'--json'
		],
		{
			cwd: fixture.repo,
			env: {
				...process.env,
				HARNESS_PROOF_CHECK_QUEUE: join(home, 'checks'),
				PATH: `${resolve('node_modules/.bin')}:${process.env.PATH}`,
				HARNESS_RESOURCES_HOME: join(home, 'resources'),
				TRACKER_ITEM_ID: ''
			},
			stdio: ['ignore', 'pipe', 'pipe']
		}
	);
	return readCheckResult(child, started);
}

function readCheckResult(
	child: ChildProcessByStdio<null, Readable, Readable>,
	started: number
): Promise<Measurement> {
	return new Promise((resolve, reject) => {
		let stdout = '',
			stderr = '';
		const timeout = setTimeout(() => child.kill('SIGTERM'), 55_000);
		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += String(chunk);
		});
		child.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.on('close', (code) => {
			clearTimeout(timeout);
			try {
				resolve({
					code,
					result: JSON.parse(stdout),
					wallMs: Math.round(performance.now() - started)
				});
			} catch {
				reject(new Error(`Check command exited ${code}: ${stderr}\n${stdout}`));
			}
		});
	});
}
