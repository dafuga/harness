import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { runCommand, runHarness } from './support/cli';

const root = resolve(import.meta.dirname, '..');

test('JSON larger than a pipe buffer reaches a piped reader whole', async () => {
	const graph = await runHarness(['units', 'graph', '--json'], root);
	expect(graph.stdout.length).toBeGreaterThan(65_536);
	const parsed = JSON.parse(graph.stdout) as { nodes: unknown[] };
	expect(parsed.nodes.length).toBeGreaterThan(100);
	expect(graph.stdout.endsWith('}\n')).toBe(true);
}, 60_000);

test('Tracker compatibility preserves argv, output, and exit status through both entry points', async () => {
	const home = await mkdtemp(join(tmpdir(), 'harness-tracker-cli-'));
	const backend = join(home, '.local', 'libexec', 'harness', 'tracker-legacy');
	const shim = join(root, 'scripts', 'tracker-shim.sh');
	const harness = join(home, 'harness');
	const env = { HOME: home, HARNESS_EXECUTABLE: harness };
	try {
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
			expect(await runCommand(['sh', shim, ...args], home, false, env)).toEqual(expected);
		}
	} finally {
		await rm(home, { recursive: true, force: true });
	}
}, 30_000);
