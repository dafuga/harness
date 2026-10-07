import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { runJevCli } from './support/jevCli';

let root: string;

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'harness-clean-code-e2e-'));
	await mkdir(join(root, 'src'), { recursive: true });
	await writeFile(join(root, 'src/index.ts'), 'export const greeting = "Hello";\n');
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

test('CLI previews every supported language without contacting Jev', async () => {
	await addLanguages();
	const result = await runJevCli(
		root,
		['audit', '.', '--clean-code', '--dry-run', '--json'],
		'offline-only'
	);
	expect(result.exitCode, result.stderr).toBe(0);
	const report = JSON.parse(result.stdout).cleanCode;
	expect(report.status).toBe('dry-run');
	expect(report.coverage.selectedFiles).toHaveLength(6);
	expect(report.files).toEqual([]);
	expect(report.usage.input_tokens).toBe(0);
});

test('CLI reports violations as advisory and blocks them only in gate mode', async () => {
	const advisory = await runJevCli(root, ['audit', '.', '--clean-code', '--json'], 'violates');
	const gate = await runJevCli(
		root,
		['audit', '.', '--clean-code', '--gate', '--json'],
		'violates'
	);
	expect(advisory.exitCode, advisory.stderr).toBe(0);
	expect(JSON.parse(advisory.stdout).cleanCode.files[0].status).toBe('violations');
	expect(gate.exitCode, gate.stderr).toBe(1);
});

test('CLI keeps uncertainty visible without blocking the gate', async () => {
	const result = await runJevCli(
		root,
		['audit', '.', '--clean-code', '--gate', '--json'],
		'uncertain'
	);
	expect(result.exitCode, result.stderr).toBe(0);
	expect(JSON.parse(result.stdout).cleanCode.files[0].status).toBe('needs-review');
});

test('CLI treats provider failure as incomplete and keeps credentials out of errors', async () => {
	const result = await runJevCli(root, ['audit', '.', '--clean-code', '--json'], 'unauthorized');
	expect(result.exitCode).toBe(2);
	expect(JSON.parse(result.stdout).cleanCode.status).toBe('incomplete');
	expect(result.stdout + result.stderr).not.toContain('synthetic-test-key');
});

test('configured gate activates review and clean-code guidance is discoverable', async () => {
	await writeFile(
		join(root, 'harness.audit.json'),
		JSON.stringify({ cleanCode: { mode: 'gate' } })
	);
	const result = await runJevCli(root, ['audit', '.', '--json'], 'violates');
	const guide = await runJevCli(root, ['info', 'clean-code', '--json'], 'offline-only');
	expect(result.exitCode, result.stderr).toBe(1);
	expect(guide.exitCode, guide.stderr).toBe(0);
	expect(JSON.parse(guide.stdout).topic).toBe('clean-code');
});

test('normal audit remains offline and JSON contains no semantic review', async () => {
	const result = await runJevCli(root, ['audit', '.', '--json'], 'offline-only');
	expect(result.exitCode, result.stderr).toBe(0);
	expect(JSON.parse(result.stdout).cleanCode).toBeUndefined();
});

async function addLanguages(): Promise<void> {
	const files = {
		'src/query.sql': 'select 1;\n',
		'src/helper.py': 'def greet():\n    return "hello"\n',
		'src/component.svelte': '<h1>Hello</h1>\n',
		'src/tool.cpp': 'int main() { return 0; }\n',
		'src/tool.sh': '#!/usr/bin/env bash\nset -euo pipefail\nprintf "hello"\n'
	};
	for (const [path, contents] of Object.entries(files)) await writeFile(join(root, path), contents);
}
