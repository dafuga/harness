import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';
import { proveTrackerRehearsal } from './support/proveTrackerRehearsal';
import { withTempDir } from './support/temporary';

const root = resolve(import.meta.dirname, '..');

test(
	'Tracker rehearsal owns one loopback endpoint and persists through shutdown',
	() => withTempDir('harness-tracker-rehearsal-', (home) => proveTrackerRehearsal(root, home)),
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
