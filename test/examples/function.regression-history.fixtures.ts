import { recordExampleCases } from '../support/recordExampleCases';
import { regressionHash } from '../../src/utils/git-source-history/regressionHistory';
import type { RegressionNote } from '../../src/utils/git-source-history/regressionHistory.types';
import type { RegressionRecord } from '../../src/core/verification-evidence/regressionTypes.types';

export const redRecord = {
	schemaVersion: 1,
	id: '5e0c9a7f3d1b8e62c4a07f95d3e1b6c8a2f04d79e5b13c6a8f0d2e7b9c41a365',
	loop: 'loop-evidence-grid',
	phase: 'red',
	status: 'failed',
	exitCode: 1,
	command: 'npm test -- regressionHistory',
	assertion: 'expected 2 to equal 3',
	profile: 'darwin-arm64-node22',
	source: {
		commit: '7d4a91c0e3b52f86a1d09e47c3b8f25a6e10d9b3',
		tree: '3a0f6d2b9c71e45a8d0b36f19e2c7a84d5b0e1f6',
		parent: '9fa2943ff2ba6a70e8b746eb7a0c3435843e8a6d'
	},
	inputs: [
		{
			path: 'test/fixtures/evidence-grid-basic.json',
			hash: '4168ecc76a4f959ddeba597ecd36cde089900943'
		}
	],
	units: ['reports.component.evidence-grid'],
	tests: ['regressionHistory keeps a red commit free of future green results'],
	log: {
		path: 'output.log',
		sha256: '47b2e9d0c6a13f58e2d7b04a9c61f3e8d25b07c4a9e6f1d3b80c2a5e7f94d16b',
		bytes: 45
	},
	startedAt: '2026-11-12T09:14:02.000Z',
	finishedAt: '2026-11-12T09:14:31.000Z'
} satisfies RegressionRecord;

export const greenRecord = {
	...redRecord,
	id: 'a64f1d0b92e7c35f8a1d06e4b7c93f2e5d8a01b6c4e7f93a2d5b08c1e6f4a719',
	phase: 'green',
	status: 'passed',
	exitCode: 0,
	source: {
		...redRecord.source,
		commit: 'b2f60e8d17a4c93e5d08f7b26a1c4e90d3f58a71',
		tree: 'f6c1a80d3e92b47c5a1d0e8f6b39c2a7d4e15b08'
	},
	red: { commit: redRecord.source.commit, record: redRecord.id },
	log: {
		...redRecord.log,
		sha256: '9f4c2e7b0d61a85e3c9b2f07d4a6e1c85b3f97e0d2a4c6b18e5f3d07a9c2e46b',
		bytes: 23
	}
} satisfies RegressionRecord;

export function note(record: RegressionRecord, phase: 'red' | 'green'): RegressionNote {
	return {
		schemaVersion: 1,
		kind: 'regression',
		commit: record.source.commit,
		loop: record.loop,
		phase,
		record: record.id,
		evidence: {
			commit: '5546c3a62fa98e2d118328b7eab6b595c5de2ac6',
			path: `regressions/${record.source.commit}/${record.id}`,
			manifest: '0f9e3b7a1c5d28e4b06a7f3c9d1e52b8a4c07f6e3d9b1a58c2e7f04d6b3a9c15'
		}
	} satisfies RegressionNote;
}

export function readBytes(recordJson: string, manifestJson?: string) {
	const log = Buffer.from('FAIL regressionHistory\nexpected 2 to equal 3\n');
	const manifest = Buffer.from(
		manifestJson ?? JSON.stringify({ record: regressionHash(recordJson), log: regressionHash(log) })
	);
	const bytes = new Map<string, Buffer>([
		['manifest.json', manifest],
		['record.json', Buffer.from(recordJson)],
		['output.log', log]
	]);
	return { manifest, log, read: async (path: string) => bytes.get(path) };
}

export function recordError(state: string, message: string, input: unknown) {
	recordExampleCases(
		{
			unitId: 'function.regression-history',
			symbol: 'readRegression',
			state,
			evidence: 'examples-cases',
			file: `${state}.json`
		},
		[{ name: message, input, error: message }]
	);
}
