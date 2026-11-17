import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { buildHistory, renderBuild } from '../../src/cli/program/buildHistory';
import type { BuildOptions } from '../../src/cli/program/buildHistory.types';

const buildState = 'rejects-when-output-directory-is-missing';

test('Rejects when output directory is missing', async () => {
	await withTempRepo(async ({ root }) => {
		const input: BuildOptions = { root };
		let error: unknown;
		try {
			await buildHistory(input);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('--out must name the directory');
		recordExampleCases(
			{
				unitId: 'workflow.build-history',
				symbol: 'buildHistory',
				state: buildState,
				evidence: 'examples-cases',
				file: `${buildState}.json`
			},
			[
				{
					name: 'repository root without out is rejected',
					input: { root },
					error: { name: (error as Error).name, message: (error as Error).message }
				}
			]
		);
	});
});

test('Summarizes a built history result', () => {
	const built: Parameters<typeof renderBuild>[0] = {
		out: '/workspace/repo/.harness/history',
		digest: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		media: { resolved: 0, missing: 0 },
		problems: [],
		index: {
			schemaVersion: 1,
			refs: { evidence: null, notes: null },
			branches: [],
			revisions: [],
			units: [],
			benchmarks: [],
			profiles: [],
			legacy: [],
			truncated: false,
			problems: []
		},
		catalog: '/workspace/repo/.harness/history/catalog.sqlite'
	};
	const output = renderBuild(built);
	expect(output).toContain('0 commits: 0 verified, 0 failed, 0 invalid, 0 without evidence.');
	const state = 'summarizes-a-built-history-result';
	recordExampleCases(
		{
			unitId: 'workflow.build-history',
			symbol: 'renderBuild',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: 'empty history summary', input: built, output }]
	);
});
