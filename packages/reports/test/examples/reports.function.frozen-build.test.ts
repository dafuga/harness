import { afterEach, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { frozenBuild } from '../../src/utils/development-tooling/frozenBuild';
import type { FrozenBuild } from '../../src/utils/development-tooling/frozenBuild.types';

const temporaryDirectories: string[] = [];

function project(): string {
	const directory = mkdtempSync(join(tmpdir(), 'frozen-build-'));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});

test('Copies a finished build with its identity', async () => {
	const root = project();
	const source = join(root, 'build');
	const target = join(root, 'run-build');
	mkdirSync(join(source, 'assets'), { recursive: true });
	writeFileSync(join(source, 'index.html'), '<main>fixture</main>');
	writeFileSync(join(source, 'assets', 'app.js'), 'export const fixture = true;');
	const result: FrozenBuild = await frozenBuild(source, target);
	const summarized = { build: result.build, buildId: result.buildId, files: result.files };
	const input = { source, target };
	expect(summarized).toEqual({ build: target, buildId: expect.any(String), files: 2 });
	recordExampleCases(
		{
			unitId: 'reports.function.frozen-build',
			symbol: 'frozenBuild',
			state: 'copies-a-finished-build-with-its-identity',
			evidence: 'examples-cases',
			file: 'copies-a-finished-build-with-its-identity.json'
		},
		[{ name: 'copies source files into the run directory', input, output: summarized }]
	);
});

test('Rejects a copy whose identity differs and removes the target', async () => {
	const root = project();
	const source = join(root, 'build');
	const target = join(root, 'run-build');
	mkdirSync(source);
	writeFileSync(join(source, 'index.html'), '<main>original</main>');
	const input = { source, target, copied: 'writes a different build' };
	let errorMessage = '';
	try {
		await frozenBuild(source, target, async (_from, to) => {
			mkdirSync(to, { recursive: true });
			writeFileSync(join(to, 'index.html'), '<main>different</main>');
		});
	} catch (error) {
		errorMessage = error instanceof Error ? error.message : String(error);
	}
	expect(errorMessage).toContain('changed while this run was copying it');
	expect(existsSync(target)).toBe(false);
	recordExampleCases(
		{
			unitId: 'reports.function.frozen-build',
			symbol: 'frozenBuild',
			state: 'rejects-a-copy-whose-identity-differs-and-removes-the-target',
			evidence: 'examples-cases',
			file: 'rejects-a-copy-whose-identity-differs-and-removes-the-target.json'
		},
		[
			{
				name: 'rejects a changed build and cleans its target',
				input,
				error: { message: errorMessage, targetRemoved: !existsSync(target) }
			}
		]
	);
});
