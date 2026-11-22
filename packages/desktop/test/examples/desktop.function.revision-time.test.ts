import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { revisionTime, displayTime } from '../../src/utils/shared-primitives/revisionTime';

const snapshot = {
	project: {
		name: 'harness-app',
		root: '/workspace/project',
		id: 'local-9a3f0c7d2e5b81f46c0a9d3e7b2f5108c4e6a1d9b7f2034e8c5a6d1f9b0e72c3'
	},
	revision: {
		branch: 'main',
		commit: '3f9c2a7e5b1d84c60a9e2f71d3b5c8a4e6f01b72',
		tip: '7d1e4b09a6c3f2581e9b7d04c2a8f6e10b3d95a7',
		atTip: false
	},
	branches: [{ name: 'main', tip: '7d1e4b09a6c3f2581e9b7d04c2a8f6e10b3d95a7', current: true }],
	commits: [
		{
			hash: '7d1e4b09a6c3f2581e9b7d04c2a8f6e10b3d95a7',
			subject: 'Add revision time lookup',
			authoredAt: '2026-11-12T09:41:07+01:00',
			committedAt: '2026-11-12T10:02:18+01:00'
		},
		{
			hash: '3f9c2a7e5b1d84c60a9e2f71d3b5c8a4e6f01b72',
			subject: 'Fix commit ordering',
			authoredAt: '2026-11-10T16:05:52+00:00',
			committedAt: '2026-11-10T16:05:52+00:00'
		}
	],
	entities: [],
	writable: false
};

test('finds timestamps for the selected commit and branch tip', () => {
	const commitTime = revisionTime(snapshot, 'commit');
	const branchTime = revisionTime(snapshot, 'branch');
	const missingTime = revisionTime(null, 'commit');

	expect(commitTime).toBe('2026-11-10T16:05:52+00:00');
	expect(branchTime).toBe('2026-11-12T10:02:18+01:00');
	expect(missingTime).toBeNull();
	recordExampleCases(
		{
			unitId: 'desktop.function.revision-time',
			symbol: 'revisionTime',
			state: 'finds-timestamps-for-the-selected-commit-and-branch-tip',
			evidence: 'examples-cases',
			file: 'finds-timestamps-for-the-selected-commit-and-branch-tip.json'
		},
		[
			{ name: 'selected commit timestamp', input: { kind: 'commit', snapshot }, output: commitTime },
			{ name: 'current branch tip timestamp', input: { kind: 'branch', snapshot }, output: branchTime },
			{ name: 'null snapshot has no timestamp', input: { kind: 'commit', snapshot: null }, output: missingTime }
		]
	);
});

test('formats timestamps and labels unknown values', () => {
	const formatted = displayTime('2026-11-12T10:02:18+01:00');
	const unknown = displayTime(null);

	expect(formatted).not.toBe('Unknown');
	expect(unknown).toBe('Unknown');
	recordExampleCases(
		{
			unitId: 'desktop.function.revision-time',
			symbol: 'displayTime',
			state: 'formats-timestamps-and-labels-unknown-values',
			evidence: 'examples-cases',
			file: 'formats-timestamps-and-labels-unknown-values.json'
		},
		[
			{ name: 'format a valid timestamp', input: '2026-11-12T10:02:18+01:00', output: formatted },
			{ name: 'null timestamp uses unknown label', input: null, output: unknown }
		]
	);
});
