import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';
import { withTempDir } from './support/temporary';

const root = resolve(import.meta.dirname, '..');

test(
	'Tracker rehearsal owns one loopback endpoint and persists through shutdown',
	() =>
		withTempDir('harness-tracker-rehearsal-', async (home) => {
			const database = join(home, 'copy.sqlite');
			await writeFile(database, '', { mode: 0o600 });
			const args = ['tracker', 'rehearse', database, '--node', 'fixture-mac'];
			const cli = join(root, 'src/index.ts');
			const env = { HOME: home, HARNESS_TRACKER_LEGACY_BIN: '/dev/null/tracker' };
			const candidate = spawn('bun', [cli, ...args], {
				cwd: home,
				env: { ...process.env, ...env },
				stdio: ['ignore', 'pipe', 'pipe']
			});
			const output = createInterface({ input: candidate.stdout });
			const exited = once(candidate, 'exit');
			try {
				const [line] = await Promise.race([
					once(output, 'line'),
					exited.then(([code]) => {
						throw new Error(`Tracker rehearsal exited before readiness (${code})`);
					})
				]);
				const ready = JSON.parse(line);
				expect(ready).toMatchObject({ node: 'fixture-mac', pid: candidate.pid });
				const base = `http://127.0.0.1:${ready.port}`;
				expect(await (await fetch(base + '/health')).json()).toMatchObject({
					app: 'tracker',
					pid: candidate.pid,
					node: 'fixture-mac'
				});
				expect(await (await fetch(base + '/status')).json()).toMatchObject({
					node: 'fixture-mac',
					role: 'spoke',
					pid: candidate.pid,
					db_id: expect.any(String),
					ops: 0,
					sync: { disabled: true },
					deliveries: {},
					active_reminders: 0
				});
				const duplicate = await runHarness(
					[...args, '--port', String(ready.port)],
					home,
					false,
					env
				);
				expect(duplicate.exitCode).toBe(1);
				const secondOwner = await runHarness(args, home, false, env);
				expect(secondOwner.exitCode).toBe(1);
				const livePort = await runHarness([...args, '--port', '7701'], home, false, env);
				expect(livePort.exitCode).toBe(2);
				const crossOrigin = await fetch(base + '/items', {
					method: 'POST',
					headers: { origin: 'https://fixture.invalid' },
					body: JSON.stringify({ title: 'Rejected cross-origin request' })
				});
				expect(crossOrigin.status).toBe(403);
				const response = await fetch(base + '/items', {
					method: 'POST',
					body: JSON.stringify({ title: 'Rehearsal journal canary' })
				});
				expect(response.status).toBe(201);
			} finally {
				output.close();
				candidate.kill('SIGTERM');
				await exited;
			}
			const stopped = new DatabaseSync(database, { readOnly: true });
			try {
				expect(stopped.prepare('SELECT title FROM items').all()).toEqual([
					{ title: 'Rehearsal journal canary' }
				]);
			} finally {
				stopped.close();
			}
		}),
	30_000
);

test('JSON larger than a pipe buffer reaches a piped reader whole', async () => {
	const graph = await runHarness(['units', 'graph', '--json'], root);
	expect(graph.stdout.length).toBeGreaterThan(65_536);
	const parsed = JSON.parse(graph.stdout) as { nodes: unknown[] };
	expect(parsed.nodes.length).toBeGreaterThan(100);
	expect(graph.stdout.endsWith('}\n')).toBe(true);
}, 60_000);

test(
	'Tracker compatibility preserves argv, output, and exit status through both entry points',
	() =>
		withTempDir('harness-tracker-cli-', async (home) => {
			const backend = join(home, '.local', 'libexec', 'harness', 'tracker-legacy');
			const shim = join(root, 'scripts', 'tracker-shim.sh');
			const harness = join(home, 'harness');
			const env = {
				HOME: home,
				HARNESS_EXECUTABLE: harness,
				HARNESS_TRACKER_LEGACY_BIN: '',
				HARNESS_TRACKER_FORWARD_PARENT: ''
			};
			await mkdir(join(home, '.local', 'libexec', 'harness'), { recursive: true });
			await writeFile(
				backend,
				`#!/usr/bin/env bun
const args = process.argv.slice(2);
process.stdout.write(JSON.stringify(args) + '\\n');
process.stderr.write('fixture diagnostic\\n');
process.exitCode = args[1] === 'ignored' ? 4 : args[1] === 'open' ? 5 : 0;
`,
				{ mode: 0o700 }
			);
			await writeFile(harness, '#!/bin/sh\nexec bun "$HARNESS_CLI_PATH" "$@"\n', { mode: 0o700 });
			for (const args of [
				[],
				['--help'],
				['check', 'ignored', '--json'],
				['check', 'open', '--json'],
				['note', 'abc', '--', '--help', 'quoted "text"', 'a\nb'],
				['--version']
			]) {
				const expected = await runCommand([backend, ...args], home, false, env);
				expect(await runHarness(['tracker', ...args], home, false, env)).toEqual(expected);
				expect(await runCommand([shim, ...args], home, false, env)).toEqual(expected);
			}
		}),
	30_000
);

test(
	'Tracker cutover verification detects a same-count queued operation change',
	() =>
		withTempDir('harness-tracker-cutover-', async (home) => {
			const before = join(home, 'before.sqlite');
			const after = join(home, 'after.sqlite');
			const marker = 'private-fixture-field';
			const db = new DatabaseSync(before);
			try {
				db.exec(`
				CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
				INSERT INTO meta VALUES ('pushed_seq', '0'), ('peer_pushed_seq', '0');
				CREATE TABLE ops(seq INTEGER PRIMARY KEY, op_id TEXT UNIQUE, node TEXT, fields TEXT);
			`);
				db.prepare('INSERT INTO ops VALUES (?, ?, ?, ?)').run(1, 'a', 'fixture', marker);
			} finally {
				db.close();
			}
			await copyFile(before, after);
			const beforeBytes = await readFile(before);
			const args = [
				'tracker',
				'verify-cutover',
				before,
				after,
				'--node',
				'fixture',
				'--peer-relay-ops'
			];
			const env = { HOME: home, HARNESS_TRACKER_LEGACY_BIN: join(home, 'missing-tracker') };
			const equal = await runHarness(args, home, false, env);
			expect(equal).toMatchObject({ exitCode: 0, stderr: '' });
			expect(JSON.parse(equal.stdout)).toMatchObject({
				matches: true,
				before: { pendingPush: { hub: { rowCount: 1 }, peer: { rowCount: 1 } } }
			});
			const modified = new DatabaseSync(after);
			try {
				modified.exec("UPDATE ops SET fields = 'new fixture value'");
			} finally {
				modified.close();
			}
			const changedBytes = await readFile(after);
			const different = await runHarness(args, home, false, env);
			expect(different).toMatchObject({ exitCode: 1, stderr: '' });
			expect(JSON.parse(different.stdout)).toMatchObject({
				matches: false,
				changedTables: ['ops'],
				changedPendingLinks: ['hub', 'peer']
			});
			expect(different.stdout).not.toContain(marker);
			expect([await readFile(before), await readFile(after)]).toEqual([beforeBytes, changedBytes]);
		}),
	30_000
);

test(
	'Tracker shim finds its installed Harness executable with a restricted service PATH',
	() =>
		withTempDir('harness-tracker-service-', async (home) => {
			const directory = join(home, '.local', 'libexec', 'harness');
			const shim = join(root, 'scripts', 'tracker-shim.sh');
			await mkdir(directory, { recursive: true });
			await writeFile(join(directory, 'harness'), '#!/bin/sh\nprintf "%s\\n" "$@"\n', {
				mode: 0o700
			});
			const result = await runCommand([shim, 'note', 'item', 'Fixture event'], home, false, {
				HOME: home,
				HARNESS_EXECUTABLE: '',
				PATH: '/usr/bin:/bin:/usr/sbin:/sbin'
			});
			expect(result).toEqual({
				exitCode: 0,
				stdout: 'tracker\nnote\nitem\nFixture event\n',
				stderr: ''
			});
		}),
	30_000
);
