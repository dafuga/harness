import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { commandOutput, runHarness } from './support/cli';

test('CLI audits Antelope dApps with contract adapters', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-dapp-'));
	try {
		await writeDappFixture(root);

		const result = await runHarness(['audit', '.', '--coverage'], root);
		const output = commandOutput(result);

		expect(output).toContain('Harness audit coverage (dapp profile)');
		expect(output).toContain('- antelope-dapp: 0 files');
		expect(output).toContain('- cpp: 2 files');
		expect(output).toContain('Unknown files: none');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 60_000);

test('CLI fails dApp audits for invalid contract shape', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-cli-bad-dapp-'));
	try {
		await mkdir(join(root, 'contracts/bad/source'), { recursive: true });
		await writeFile(join(root, 'svelte.config.js'), 'export default {};\n');
		await writeFile(join(root, 'contracts/bad/source/main.cpp'), 'void apply() {}\n');

		const result = await runHarness(['audit', '.', '--profile', 'dapp'], root, false);
		const output = commandOutput(result);

		expect(result.exitCode).toBe(1);
		expect(output).toContain('antelope-contract-workspace');
		expect(output).toContain('antelope-contract-source');
		expect(output).toContain('antelope-contract-header');
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}, 60_000);

async function writeDappFixture(root: string): Promise<void> {
	await mkdir(join(root, 'smart-contract/contracts/example/include/example'), { recursive: true });
	await mkdir(join(root, 'smart-contract/contracts/example/src'), { recursive: true });
	await writeFile(join(root, 'svelte.config.js'), 'export default {};\n');
	await writeFile(
		join(root, 'smart-contract/Makefile'),
		'build:\n\tcd contracts/example && make\n'
	);
	await writeFile(
		join(root, 'smart-contract/contracts/example/src/example.cpp'),
		'void apply() {}\n'
	);
	await writeFile(
		join(root, 'smart-contract/contracts/example/include/example/example.hpp'),
		'#pragma once\n'
	);
}
