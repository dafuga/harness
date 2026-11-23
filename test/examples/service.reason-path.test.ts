import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { ReasonPathService } from '../../src/services/development-tooling/ReasonPathService';
import type {
	ReasonRange,
	SideLoader
} from '../../src/services/development-tooling/ReasonPathService.types';
import type { ReasonSide } from '../../src/utils/development-tooling/required-reasons/requiredReasons.types';

const emptySide: ReasonSide = { index: { files: new Map() }, manifests: [] };
const changedSide: ReasonSide = {
	index: {
		files: new Map([
			['unit.ts', { hash: 'content-v1', blocks: [{ name: 'unit', hash: 'block-v1' }] }]
		])
	},
	manifests: [
		{
			id: 'unit.example',
			status: 'active',
			owns: { source: ['unit.ts'] },
			declarationHash: 'decl-v1'
		}
	]
};

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

test('Throws SideLoader rejection on a history step', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('commit', '--allow-empty', '-m', 'first');
		git('commit', '--allow-empty', '-m', 'second');
		const rejection = new Error('side unavailable');
		const service = new ReasonPathService(root, async () => {
			throw rejection;
		});
		const range: ReasonRange = {
			base: emptySide,
			head: changedSide,
			baseCommit: null,
			headCommit: git('rev-parse', 'HEAD')
		};
		let caught: unknown;
		try {
			await service.report(range, []);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBe(rejection);
		recordExampleCases(
			{
				unitId: 'service.reason-path',
				symbol: 'report',
				state: 'throws-sideloader-rejection-on-a-history-step',
				evidence: 'examples-cases',
				file: 'throws-sideloader-rejection-on-a-history-step.json'
			},
			[
				{
					name: 'history traversal preserves the loader rejection',
					input: { baseCommit: null, headCommit: 'second', known: [] },
					error: { name: (caught as Error).name, message: (caught as Error).message }
				}
			]
		);
	});
});

test('Throws BoundedCommandFailure when git fails', async () => {
	await withTempDir('reason-path-git-failure-', async (root) => {
		const service = new ReasonPathService(`${root}/missing`, async () => changedSide);
		const range: ReasonRange = {
			base: emptySide,
			head: changedSide,
			baseCommit: null,
			headCommit: 'head-commit'
		};
		let caught: unknown;
		try {
			await service.report(range, []);
		} catch (error) {
			caught = error;
		}

		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error).name).toBe('BoundedCommandFailure');
		recordExampleCases(
			{
				unitId: 'service.reason-path',
				symbol: 'report',
				state: 'throws-boundedcommandfailure-when-git-fails',
				evidence: 'examples-cases',
				file: 'throws-boundedcommandfailure-when-git-fails.json'
			},
			[
				{
					name: 'history traversal rejects when the repository root cannot be opened',
					input: { baseCommit: null, headCommit: 'head-commit', known: [] },
					error: { name: (caught as Error).name, message: (caught as Error).message }
				}
			]
		);
	});
});
