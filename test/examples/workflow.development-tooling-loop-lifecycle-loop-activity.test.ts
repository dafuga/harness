import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { openStepCount, isOpenLoop, loopActivity, isStale, loopSummaryLines } from '../../src/workflows/development-tooling/loop-lifecycle/loopActivity';
import type { LoopActivity } from '../../src/workflows/development-tooling/loop-lifecycle/loopActivity.types';

const releaseLoop = {
	name: 'release-readiness',
	goal: 'Verify the release checklist',
	createdAt: '2026-11-10T09:00:00.000Z',
	updatedAt: '2026-11-12T12:00:00.000Z',
	steps: [
		{ id: 'prepare', title: 'Confirm release criteria', status: 'complete' as const, completedAt: '2026-11-11T15:00:00.000Z' },
		{ id: 'verify', title: 'Run release checks', status: 'pending' as const }
	]
};
const now = '2026-11-15T12:00:00.000Z';

test('Counts pending steps and classifies an open loop', () => {
	const count = openStepCount(releaseLoop);
	const open = isOpenLoop(releaseLoop);
	expect(count).toBe(1);
	expect(open).toBe(true);
	recordExampleCases(
		{ unitId: 'workflow.development-tooling-loop-lifecycle-loop-activity', symbol: 'openStepCount/isOpenLoop', state: 'counts-pending-steps-and-classifies-an-open-loop', evidence: 'examples-cases', file: 'counts-pending-steps-and-classifies-an-open-loop.json' },
		[
			{ name: 'one pending release check', input: { state: releaseLoop }, output: { openStepCount: count, isOpenLoop: open } },
			{ name: 'empty loop is not open', input: { state: { ...releaseLoop, steps: [] } }, output: { openStepCount: 0, isOpenLoop: false } }
		]
	);
});

test('Derives latest activity and whole-day age', () => {
	const activity: LoopActivity = loopActivity(releaseLoop, now);
	expect(activity).toEqual({ openSteps: 1, totalSteps: 2, lastActivityAt: '2026-11-12T12:00:00.000Z', ageDays: 3 });
	const noTimestamp = loopActivity({ ...releaseLoop, createdAt: '', updatedAt: '', steps: [] }, now);
	expect(noTimestamp).toEqual({ openSteps: 0, totalSteps: 0 });
	recordExampleCases(
		{ unitId: 'workflow.development-tooling-loop-lifecycle-loop-activity', symbol: 'loopActivity', state: 'derives-latest-activity-and-whole-day-age', evidence: 'examples-cases', file: 'derives-latest-activity-and-whole-day-age.json' },
		[
			{ name: 'release activity uses latest timestamp', input: { state: releaseLoop, now }, output: activity },
			{ name: 'empty timestamps omit age fields', input: { state: { ...releaseLoop, createdAt: '', updatedAt: '', steps: [] }, now }, output: noTimestamp }
		]
	);
});

test('Compares stale thresholds and summarizes loop state', () => {
	const activity = loopActivity(releaseLoop, now);
	const stale = isStale(activity, 3);
	const lines = loopSummaryLines(releaseLoop, now);
	expect(stale).toBe(true);
	expect(lines).toEqual(['Age: 3 days since last activity (2026-11-12T12:00:00.000Z)', 'Open steps: 1 of 2']);
	const closed = { ...releaseLoop, closed: { status: 'abandoned' as const, reason: 'Replaced by a newer loop', closedAt: '2026-11-14T10:00:00.000Z' } };
	const closedLines = loopSummaryLines(closed, now);
	expect(closedLines).toHaveLength(3);
	recordExampleCases(
		{ unitId: 'workflow.development-tooling-loop-lifecycle-loop-activity', symbol: 'isStale/loopSummaryLines', state: 'compares-stale-thresholds-and-summarizes-loop-state', evidence: 'examples-cases', file: 'compares-stale-thresholds-and-summarizes-loop-state.json' },
		[
			{ name: 'activity at threshold is stale', input: { activity, staleDays: 3, state: releaseLoop, now }, output: { isStale: stale, lines } },
			{ name: 'closed loop includes closure detail', input: { state: closed, now }, output: { lines: closedLines } }
		]
	);
});
