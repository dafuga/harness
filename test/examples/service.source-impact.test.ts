import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { SourceImpactService } from '../../src/services/explorer-ui/revision-detail-service/source-impact-service/SourceImpactService';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

function record(symbol: string, state: string, input: unknown, output: unknown) {
	recordExampleCases(
		{ unitId: 'service.source-impact', symbol, state, evidence: 'examples-cases', file: `${state}.json` },
		[{ name: `${symbol} for a readable root commit`, input, output }]
	);
}

async function rootCommit(run: (root: string, commit: string) => Promise<void>) {
	await withTempRepo(async ({ root, git }) => {
		writeFileSync(join(root, 'example.ts'), 'export const answer = 42;\n');
		git('add', 'example.ts');
		git('commit', '-m', 'add example');
		await run(root, git('rev-parse', 'HEAD'));
	});
}

test('Returns root commit impact from an empty base', async () => {
	await rootCommit(async (root, commit) => {
		const output = await new SourceImpactService(root).of(commit);
		expect(output?.base).toBeNull();
		record('of', 'returns-root-commit-impact-from-an-empty-base', { commit }, output);
	});
});

test('Returns required reasons for a readable root tree', async () => {
	await rootCommit(async (root, commit) => {
		const output = await new SourceImpactService(root).reasons(commit);
		expect(output).toEqual([]);
		record('reasons', 'returns-required-reasons-for-a-readable-root-tree', { commit }, output);
	});
});

test('Returns no parent for a root commit', async () => {
	await rootCommit(async (root, commit) => {
		const output = await new SourceImpactService(root).parent(commit);
		expect(output).toBeUndefined();
		record('parent', 'returns-no-parent-for-a-root-commit', { commit }, output);
	});
});

test('Serializes a readable commit side', async () => {
	await rootCommit(async (root, commit) => {
		const output = await new SourceImpactService(root).stored(commit);
		expect(output?.schemaVersion).toBe(1);
		record('stored', 'serializes-a-readable-commit-side', { commit }, output);
	});
});

test('Returns static measurements for a readable commit', async () => {
	await rootCommit(async (root, commit) => {
		const output = await new SourceImpactService(root).measurements(commit);
		expect(output).toEqual([]);
		record('measurements', 'returns-static-measurements-for-a-readable-commit', { commit }, output);
	});
});
