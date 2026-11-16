import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { SourceArchiveService } from '../../src/cli/program/history-index-service/SourceArchiveService';
import type { Unit } from '../../src/cli/program/history-index-service/SourceArchiveService.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

const sourcePath = 'src/cli/program/history-index-service/SourceArchiveService.ts';
const testPath = 'test/services/source-archive.test.ts';

function exampleUnit(status = 'active'): Unit {
	return {
		id: 'service.source-archive',
		kind: 'service',
		status,
		title: 'SourceArchiveService',
		responsibility: 'Archives committed source and associated tests.',
		dependencies: [],
		scenarios: ['source-archive-tests'],
		owns: { source: [sourcePath], symbols: ['SourceArchiveService'] },
		contract: { inputs: [], outputs: [], errors: [] }
	} as unknown as Unit;
}

function writeFixtureFile(root: string, path: string, content: string): void {
	mkdirSync(join(root, path, '..'), { recursive: true });
	writeFileSync(join(root, path), content);
}

test('Archives committed source and its direct test importer', async () => {
	await withTempRepo(async ({ root, git }) => {
		writeFixtureFile(root, sourcePath, 'export const archived = true;');
		writeFixtureFile(root, testPath, "import { archived } from '../../src/cli/program/history-index-service/SourceArchiveService';");
		git('add', sourcePath, testPath);
		git('commit', '-m', 'fixture');
		const commit = git('rev-parse', 'HEAD');
		const out = join(root, 'history', 'source');
		const unit = exampleUnit();
		const side = {
			schemaVersion: 1,
			config: { schemaVersion: 1, workspaces: [{ name: '', root: '.' }], tests: ['test/'], global: [], ignored: [], references: [] },
			files: [[sourcePath, '0123456789abcdef0123456789abcdef01234567'], [testPath, '89abcdef0123456789abcdef0123456789abcdef']],
			units: [{ id: unit.id, status: 'active', source: [sourcePath] }],
			scenarios: [],
			nodes: [[`test:${testPath}`, 'test'], [`file:${sourcePath}`, 'source']],
			edges: [[0, 1]],
			uncertain: []
		} as unknown as Parameters<SourceArchiveService['archive']>[2];
		await new SourceArchiveService(root, out).archive(commit, [unit], side);
		const source = unit.sourceFiles?.[0];
		const associated = unit.testFiles?.[0];
		expect(source?.path).toBe(sourcePath);
		expect(associated?.path).toBe(testPath);
		expect(readFileSync(join(out, source!.media!), 'utf8')).toBe('export const archived = true;');
		recordExampleCases(
			{ unitId: 'service.source-archive', symbol: 'SourceArchiveService.archive', state: 'archives-committed-source-and-its-direct-test-importer', evidence: 'examples-cases', file: 'archives-committed-source-and-its-direct-test-importer.json' },
			[{ name: 'archives selected commit source and graph importer', input: { commit, owned: [sourcePath], testImporter: testPath }, output: { sourcePath: source?.path, sourceMedia: source?.media, testPath: associated?.path, text: 'export const archived = true;' } }]
		);
	});
});

test('Leaves inactive units without archived source', async () => {
	await withTempRepo(async ({ root, git }) => {
		writeFixtureFile(root, sourcePath, 'committed source');
		git('add', sourcePath);
		git('commit', '-m', 'fixture');
		const commit = git('rev-parse', 'HEAD');
		const unit = exampleUnit('inactive');
		await new SourceArchiveService(root, join(root, 'history')).archive(commit, [unit]);
		expect(unit.sourceFiles).toEqual([]);
		recordExampleCases(
			{ unitId: 'service.source-archive', symbol: 'SourceArchiveService.archive', state: 'leaves-inactive-units-without-archived-source', evidence: 'examples-cases', file: 'leaves-inactive-units-without-archived-source.json' },
			[{ name: 'inactive registry entry has no source snapshot', input: { commit, status: 'inactive', owned: [sourcePath] }, output: { sourceFiles: unit.sourceFiles } }]
		);
	});
});
