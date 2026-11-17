import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { ReasonPathService } from '../../src/services/development-tooling/ReasonPathService';
import type { ReasonRange, SideLoader } from '../../src/services/development-tooling/ReasonPathService.types';

const emptySide = { index: { files: new Map() }, manifests: [] };

test('Returns a clear report when the range has no changes', async () => {
	await withTempDir('reason-path-clear-', async (root) => {
		const load: SideLoader = async () => emptySide;
		const service = new ReasonPathService(root, load);
		const range: ReasonRange = {
			base: emptySide,
			head: emptySide,
			baseCommit: null,
			headCommit: null
		};
		const report = await service.report(range, []);

		expect(report).toEqual({ required: [], entries: [], overlong: [], failures: [] });
		recordExampleCases(
			{
				unitId: 'service.reason-path',
				symbol: 'report',
				state: 'returns-a-clear-report-when-the-range-has-no-changes',
				evidence: 'examples-cases',
				file: 'returns-a-clear-report-when-the-range-has-no-changes.json'
			},
			[
				{
					name: 'empty base and head need no explanation or history walk',
					input: { range: { baseCommit: null, headCommit: null }, known: [] },
					output: { required: [], entries: [], overlong: [], failures: [] }
				}
			]
		);
	});
});
